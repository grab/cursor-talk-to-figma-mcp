// Bulk export job tracking for the Talk to Figma MCP server.
//
// A bulk export runs as a background job:
//   1. start_bulk_export creates a job here (server-generated jobId) and
//      sends one `start_bulk_export` command to the Figma plugin.
//   2. The plugin exports nodes with exportAsync and streams one event per
//      node (bytes are base64, split into chunks so no single websocket frame
//      gets too large). Events reach this module via handleEvent().
//   3. Each image is written to disk as soon as its last chunk arrives.
//      Image bytes are never returned to the agent.
//   4. get_bulk_export_status / cancel_bulk_export read and change job state.

import { mkdir, writeFile } from "fs/promises";
import path from "path";

export type BulkExportFormat = "PNG" | "JPG" | "SVG" | "PDF";
export type BulkExportStatus = "running" | "done" | "failed" | "cancelled";

export interface BulkExportFailure {
  nodeId: string;
  error: string;
}

export interface BulkExportJob {
  jobId: string;
  status: BulkExportStatus;
  format: BulkExportFormat;
  scale: number;
  outputDir: string;
  total: number;
  done: number;
  failed: BulkExportFailure[];
  currentNode: { id: string; name?: string } | null;
  startedAt: number;
  finishedAt: number | null;
  lastEventAt: number;
  cancelRequested: boolean;
  stallTimeoutMs: number | null;
  concurrency: number | null;
  error: string | null;
  files: string[];
  // internal
  fileNames: Map<string, string>;
  usedNames: Set<string>;
  chunks: Map<string, { parts: string[]; received: number; count: number }>;
  pendingWrites: Set<Promise<void>>;
  settledNodes: Set<string>;
  finishRequested: { status: BulkExportStatus; error?: string } | null;
}

export interface BulkExportEvent {
  type: "bulk_export_event";
  jobId: string;
  event:
    | "job_started"
    | "node_started"
    | "node_chunk"
    | "node_failed"
    | "concurrency_changed"
    | "job_finished";
  nodeId?: string;
  name?: string;
  chunkIndex?: number;
  chunkCount?: number;
  data?: string;
  error?: string;
  status?: BulkExportStatus;
  concurrency?: number;
  total?: number;
  notFound?: string[];
}

const EXTENSIONS: Record<BulkExportFormat, string> = {
  PNG: "png",
  JPG: "jpg",
  SVG: "svg",
  PDF: "pdf",
};

/** Make a node id or user-supplied name safe to use as a file name. */
export function sanitizeFileName(name: string): string {
  const cleaned = String(name)
    .replace(/[\/\\:*?"<>|\x00-\x1f]/g, "-")
    .replace(/^\.+/, "")
    .trim();
  return cleaned.length > 0 ? cleaned.slice(0, 200) : "node";
}

/** Strip a trailing extension that matches the export format (".png" etc). */
function stripKnownExtension(name: string, ext: string): string {
  const lower = name.toLowerCase();
  return lower.endsWith("." + ext) ? name.slice(0, -(ext.length + 1)) : name;
}

export function formatDuration(ms: number): string {
  if (!isFinite(ms) || ms < 0) return "?";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m < 60) return rem ? `${m}m ${rem}s` : `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export interface BulkExportSnapshot {
  jobId: string;
  status: BulkExportStatus;
  total: number;
  done: number;
  failedCount: number;
  left: number;
  percent: number;
  currentNode: { id: string; name?: string } | null;
  startedAt: string;
  finishedAt: string | null;
  elapsedMs: number;
  avgMsPerNode: number | null;
  etaMs: number | null;
  concurrency: number | null;
  outputDir: string;
  format: BulkExportFormat;
  scale: number;
  failed: BulkExportFailure[];
  error: string | null;
  summary: string;
}

export class BulkExportManager {
  private jobs = new Map<string, BulkExportJob>();
  private stallTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private options: {
      /** No events for this long while running => job fails as stalled. */
      stallTimeoutMs?: number;
      now?: () => number;
      log?: (msg: string) => void;
    } = {}
  ) {}

  private now(): number {
    return this.options.now ? this.options.now() : Date.now();
  }

  private log(msg: string) {
    this.options.log?.(msg);
  }

  createJob(params: {
    jobId: string;
    nodeIds: string[];
    format: BulkExportFormat;
    scale: number;
    outputDir: string;
    fileNames?: string[] | Record<string, string>;
    /** Per-job override of the stall timeout. */
    stallTimeoutMs?: number;
  }): BulkExportJob {
    const ext = EXTENSIONS[params.format];
    const fileNames = new Map<string, string>();
    const usedNames = new Set<string>();
    params.nodeIds.forEach((nodeId, i) => {
      let requested: string | undefined;
      if (Array.isArray(params.fileNames)) requested = params.fileNames[i];
      else if (params.fileNames) requested = params.fileNames[nodeId];
      let base = sanitizeFileName(
        stripKnownExtension(requested && requested.trim() ? requested : nodeId, ext)
      );
      // Avoid two nodes overwriting each other's file.
      let candidate = base;
      let n = 2;
      while (usedNames.has(candidate.toLowerCase())) candidate = `${base}_${n++}`;
      usedNames.add(candidate.toLowerCase());
      if (!fileNames.has(nodeId)) fileNames.set(nodeId, `${candidate}.${ext}`);
    });

    const now = this.now();
    const job: BulkExportJob = {
      jobId: params.jobId,
      status: "running",
      format: params.format,
      scale: params.scale,
      outputDir: path.resolve(params.outputDir),
      total: params.nodeIds.length,
      done: 0,
      failed: [],
      currentNode: null,
      startedAt: now,
      finishedAt: null,
      lastEventAt: now,
      cancelRequested: false,
      stallTimeoutMs: params.stallTimeoutMs ?? null,
      concurrency: null,
      error: null,
      files: [],
      fileNames,
      usedNames,
      chunks: new Map(),
      pendingWrites: new Set(),
      settledNodes: new Set(),
      finishRequested: null,
    };
    this.jobs.set(job.jobId, job);
    this.ensureStallWatch();
    return job;
  }

  getJob(jobId: string): BulkExportJob | undefined {
    return this.jobs.get(jobId);
  }

  listJobs(): BulkExportJob[] {
    return [...this.jobs.values()];
  }

  fileNameFor(job: BulkExportJob, nodeId: string): string {
    return (
      job.fileNames.get(nodeId) ||
      `${sanitizeFileName(nodeId)}.${EXTENSIONS[job.format]}`
    );
  }

  /** Mark a node as failed (idempotent per node). */
  private markFailed(job: BulkExportJob, nodeId: string, error: string) {
    if (job.settledNodes.has(nodeId)) return;
    job.settledNodes.add(nodeId);
    job.failed.push({ nodeId, error });
    job.chunks.delete(nodeId);
  }

  /** Route an event from the plugin. Returns true if it belonged to a known job. */
  handleEvent(evt: BulkExportEvent): boolean {
    const job = evt && this.jobs.get(evt.jobId);
    if (!job) return false;
    job.lastEventAt = this.now();
    if (job.finishedAt !== null) return true; // late event after finish/cancel

    switch (evt.event) {
      case "job_started":
        if (typeof evt.concurrency === "number") job.concurrency = evt.concurrency;
        for (const id of evt.notFound || []) {
          this.markFailed(job, id, "Node not found");
        }
        break;
      case "concurrency_changed":
        if (typeof evt.concurrency === "number") job.concurrency = evt.concurrency;
        break;
      case "node_started":
        if (evt.nodeId) job.currentNode = { id: evt.nodeId, name: evt.name };
        break;
      case "node_failed":
        if (evt.nodeId) this.markFailed(job, evt.nodeId, evt.error || "Unknown error");
        break;
      case "node_chunk":
        this.handleChunk(job, evt);
        break;
      case "job_finished":
        job.finishRequested = { status: evt.status || "done", error: evt.error };
        void this.maybeFinalize(job);
        break;
    }
    return true;
  }

  private handleChunk(job: BulkExportJob, evt: BulkExportEvent) {
    const nodeId = evt.nodeId;
    if (!nodeId || job.settledNodes.has(nodeId)) return;
    const count = Math.max(1, evt.chunkCount || 1);
    const index = evt.chunkIndex || 0;
    let entry = job.chunks.get(nodeId);
    if (!entry || entry.count !== count) {
      entry = { parts: new Array(count), received: 0, count };
      job.chunks.set(nodeId, entry);
    }
    if (entry.parts[index] === undefined) {
      entry.parts[index] = evt.data || "";
      entry.received++;
    }
    if (entry.received < entry.count) return;

    job.chunks.delete(nodeId);
    job.settledNodes.add(nodeId);
    const bytes = Buffer.from(entry.parts.join(""), "base64");
    const fileName = this.fileNameFor(job, nodeId);
    const filePath = path.join(job.outputDir, fileName);
    const write = (async () => {
      try {
        await mkdir(job.outputDir, { recursive: true });
        await writeFile(filePath, bytes);
        job.done++;
        job.files.push(filePath);
      } catch (e) {
        job.failed.push({
          nodeId,
          error: `Write failed: ${e instanceof Error ? e.message : String(e)}`,
        });
      }
    })();
    job.pendingWrites.add(write);
    write.finally(() => {
      job.pendingWrites.delete(write);
      void this.maybeFinalize(job);
    });
  }

  private async maybeFinalize(job: BulkExportJob) {
    if (!job.finishRequested || job.finishedAt !== null) return;
    if (job.pendingWrites.size > 0) return; // called again when writes settle
    // Nodes the plugin never reported (e.g. export lost in transit).
    if (job.finishRequested.status === "done") {
      for (const nodeId of job.fileNames.keys()) {
        if (!job.settledNodes.has(nodeId)) {
          this.markFailed(job, nodeId, "No image received from Figma");
        }
      }
    }
    let status = job.finishRequested.status;
    if (job.cancelRequested && status !== "done") status = "cancelled";
    if (status === "done" && job.total > 0 && job.done === 0) status = "failed";
    this.finish(job, status, job.finishRequested.error);
  }

  private finish(job: BulkExportJob, status: BulkExportStatus, error?: string | null) {
    if (job.finishedAt !== null) return;
    job.status = status;
    job.finishedAt = this.now();
    job.currentNode = null;
    job.chunks.clear();
    if (error) job.error = error;
    else if (status === "failed" && !job.error && job.done === 0 && job.total > 0) {
      job.error = "No nodes were exported";
    }
    this.log(`Bulk export ${job.jobId} finished: ${this.summarize(job)}`);
    void this.writeManifest(job);
  }

  private async writeManifest(job: BulkExportJob) {
    try {
      await mkdir(job.outputDir, { recursive: true });
      const snapshot = this.snapshot(job);
      await writeFile(
        path.join(job.outputDir, `bulk-export-${job.jobId}.json`),
        JSON.stringify({ ...snapshot, files: job.files }, null, 2)
      );
    } catch (e) {
      this.log(`Could not write manifest for ${job.jobId}: ${e}`);
    }
  }

  /** Mark a job as failed from the server side (start error, disconnect, stall). */
  failJob(jobId: string, error: string) {
    const job = this.jobs.get(jobId);
    if (!job || job.finishedAt !== null) return;
    this.finish(job, job.cancelRequested ? "cancelled" : "failed", error);
  }

  /** Request cancel. If finalize=true (plugin unreachable) the job is closed now. */
  cancel(jobId: string, finalize: boolean): BulkExportJob | undefined {
    const job = this.jobs.get(jobId);
    if (!job) return undefined;
    if (job.finishedAt !== null) return job;
    job.cancelRequested = true;
    if (finalize) this.finish(job, "cancelled", "Cancelled (Figma plugin did not confirm)");
    return job;
  }

  /** Fail every running job, e.g. when the websocket connection drops. */
  failAllRunning(error: string) {
    for (const job of this.jobs.values()) {
      if (job.finishedAt === null) this.failJob(job.jobId, error);
    }
  }

  private ensureStallWatch() {
    const stallMs = this.options.stallTimeoutMs;
    if (!stallMs || this.stallTimer) return;
    this.stallTimer = setInterval(() => this.checkStalls(), Math.min(5000, stallMs));
    // Don't keep the process alive just for this timer.
    (this.stallTimer as any).unref?.();
  }

  /** Fail jobs that have not produced any event for stallTimeoutMs. */
  checkStalls() {
    const now = this.now();
    for (const job of this.jobs.values()) {
      const stallMs = job.stallTimeoutMs ?? this.options.stallTimeoutMs;
      if (!stallMs) continue;
      if (job.finishedAt === null && job.pendingWrites.size === 0 && now - job.lastEventAt > stallMs) {
        this.failJob(
          job.jobId,
          `Stalled: no progress from Figma for ${formatDuration(now - job.lastEventAt)}`
        );
      }
    }
  }

  snapshot(job: BulkExportJob): BulkExportSnapshot {
    const end = job.finishedAt ?? this.now();
    const elapsedMs = Math.max(0, end - job.startedAt);
    const failedCount = job.failed.length;
    const processed = job.done + failedCount;
    const left = Math.max(0, job.total - processed);
    const percent = job.total > 0 ? Math.round((processed / job.total) * 1000) / 10 : 100;
    // Average wall time per finished node. Because nodes export concurrently
    // this is throughput-based, which is what the ETA needs.
    const avgMsPerNode = processed > 0 ? elapsedMs / processed : null;
    const etaMs =
      job.status === "running" && avgMsPerNode !== null ? Math.round(avgMsPerNode * left) : null;
    return {
      jobId: job.jobId,
      status: job.status,
      total: job.total,
      done: job.done,
      failedCount,
      left,
      percent,
      currentNode: job.currentNode,
      startedAt: new Date(job.startedAt).toISOString(),
      finishedAt: job.finishedAt !== null ? new Date(job.finishedAt).toISOString() : null,
      elapsedMs,
      avgMsPerNode: avgMsPerNode !== null ? Math.round(avgMsPerNode) : null,
      etaMs,
      concurrency: job.concurrency,
      outputDir: job.outputDir,
      format: job.format,
      scale: job.scale,
      failed: job.failed.slice(),
      error: job.error,
      summary: this.summarize(job),
    };
  }

  summarize(job: BulkExportJob): string {
    const failedCount = job.failed.length;
    const processed = job.done + failedCount;
    const left = Math.max(0, job.total - processed);
    const pct = job.total > 0 ? ((processed / job.total) * 100).toFixed(1) : "100.0";
    const end = job.finishedAt ?? this.now();
    const elapsed = end - job.startedAt;
    let text = `${job.done}/${job.total} done (${pct}%), ${left} left, ${failedCount} failed`;
    if (job.status === "running") {
      if (processed > 0) text += `, ETA ~${formatDuration((elapsed / processed) * left)}`;
      else text += ", ETA unknown";
      if (job.cancelRequested) text += " [cancelling]";
    } else {
      text += ` [${job.status} in ${formatDuration(elapsed)}]`;
    }
    return text;
  }
}
