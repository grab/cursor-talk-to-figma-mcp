import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtemp, readFile, readdir, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import {
  BulkExportManager,
  formatDuration,
  sanitizeFileName,
} from "../src/talk_to_figma_mcp/bulk_export";

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "bulk-export-unit-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const waitFor = async (cond: () => boolean, ms = 2000) => {
  const end = Date.now() + ms;
  while (!cond()) {
    if (Date.now() > end) throw new Error("timeout waiting for condition");
    await new Promise((r) => setTimeout(r, 5));
  }
};

const chunk = (jobId: string, nodeId: string, data: Buffer, parts = 1) => {
  const b64 = data.toString("base64");
  const size = Math.ceil(b64.length / parts / 4) * 4;
  const out = [];
  for (let i = 0; i < parts; i++) {
    out.push({
      type: "bulk_export_event" as const,
      jobId,
      event: "node_chunk" as const,
      nodeId,
      chunkIndex: i,
      chunkCount: parts,
      data: b64.slice(i * size, (i + 1) * size),
    });
  }
  return out;
};

describe("helpers", () => {
  test("sanitizeFileName replaces unsafe characters", () => {
    expect(sanitizeFileName("12:34")).toBe("12-34");
    expect(sanitizeFileName("a/b\\c*?")).toBe("a-b-c--");
    expect(sanitizeFileName("..hidden")).toBe("hidden");
    expect(sanitizeFileName("   ")).toBe("node");
  });

  test("formatDuration", () => {
    expect(formatDuration(4000)).toBe("4s");
    expect(formatDuration(240000)).toBe("4m");
    expect(formatDuration(250000)).toBe("4m 10s");
    expect(formatDuration(3720000)).toBe("1h 2m");
  });
});

describe("BulkExportManager", () => {
  test("writes files as chunks arrive, reassembling multi-chunk nodes", async () => {
    const m = new BulkExportManager();
    const job = m.createJob({ jobId: "j1", nodeIds: ["1:2", "3:4"], format: "PNG", scale: 2, outputDir: dir });
    const a = Buffer.from("first image bytes");
    const b = Buffer.alloc(10000, 7);
    for (const e of chunk("j1", "1:2", a)) m.handleEvent(e);
    const parts = chunk("j1", "3:4", b, 3);
    // out-of-order chunks are fine
    m.handleEvent(parts[2]);
    m.handleEvent(parts[0]);
    expect(job.done).toBeLessThanOrEqual(1);
    m.handleEvent(parts[1]);
    m.handleEvent({ type: "bulk_export_event", jobId: "j1", event: "job_finished", status: "done" });
    await waitFor(() => job.status !== "running");
    expect(job.status).toBe("done");
    expect(job.done).toBe(2);
    expect(await readFile(path.join(dir, "1-2.png"))).toEqual(a);
    expect(await readFile(path.join(dir, "3-4.png"))).toEqual(b);
    const files = await readdir(dir);
    expect(files.some((f) => f === "bulk-export-j1.json")).toBe(true);
  });

  test("uses fileNames (array or map), strips extension, de-duplicates", () => {
    const m = new BulkExportManager();
    const j = m.createJob({
      jobId: "j2",
      nodeIds: ["1:1", "1:2", "1:3"],
      format: "JPG",
      scale: 1,
      outputDir: dir,
      fileNames: ["hero.jpg", "hero", ""],
    });
    expect(m.fileNameFor(j, "1:1")).toBe("hero.jpg");
    expect(m.fileNameFor(j, "1:2")).toBe("hero_2.jpg");
    expect(m.fileNameFor(j, "1:3")).toBe("1-3.jpg");
    const j2 = m.createJob({
      jobId: "j3",
      nodeIds: ["1:1"],
      format: "SVG",
      scale: 1,
      outputDir: dir,
      fileNames: { "1:1": "icon" },
    });
    expect(m.fileNameFor(j2, "1:1")).toBe("icon.svg");
  });

  test("status summary, percent and ETA", () => {
    let now = 1_000_000;
    const m = new BulkExportManager({ now: () => now });
    const ids = Array.from({ length: 323 }, (_, i) => `n${i}`);
    const job = m.createJob({ jobId: "j", nodeIds: ids, format: "PNG", scale: 1, outputDir: dir });
    // simulate 178 done + 2 failed after 180s (1s per node)
    job.done = 178;
    m.handleEvent({ type: "bulk_export_event", jobId: "j", event: "node_failed", nodeId: "n0", error: "boom" });
    m.handleEvent({ type: "bulk_export_event", jobId: "j", event: "node_failed", nodeId: "n1", error: "boom" });
    m.handleEvent({ type: "bulk_export_event", jobId: "j", event: "node_started", nodeId: "n180", name: "Frame 180" });
    now += 180_000;
    const s = m.snapshot(job);
    expect(s.left).toBe(143);
    expect(s.failedCount).toBe(2);
    expect(s.percent).toBe(55.7);
    expect(s.etaMs).toBe(143_000);
    expect(s.currentNode).toEqual({ id: "n180", name: "Frame 180" });
    expect(s.summary).toBe("178/323 done (55.7%), 143 left, 2 failed, ETA ~2m 23s");
    expect(JSON.stringify(s)).not.toContain("base64");
  });

  test("failed nodes are recorded once, notFound from job_started count as failed", async () => {
    const m = new BulkExportManager();
    const job = m.createJob({ jobId: "j", nodeIds: ["a", "b", "c"], format: "PNG", scale: 1, outputDir: dir });
    m.handleEvent({ type: "bulk_export_event", jobId: "j", event: "job_started", concurrency: 3, notFound: ["c"] });
    m.handleEvent({ type: "bulk_export_event", jobId: "j", event: "node_failed", nodeId: "b", error: "x" });
    m.handleEvent({ type: "bulk_export_event", jobId: "j", event: "node_failed", nodeId: "b", error: "x" });
    for (const e of chunk("j", "a", Buffer.from("ok"))) m.handleEvent(e);
    m.handleEvent({ type: "bulk_export_event", jobId: "j", event: "job_finished", status: "done" });
    await waitFor(() => job.status !== "running");
    expect(job.status).toBe("done");
    expect(job.failed.map((f) => f.nodeId).sort()).toEqual(["b", "c"]);
    expect(job.concurrency).toBe(3);
  });

  test("nodes never reported are failed on finish; all failed => job failed", async () => {
    const m = new BulkExportManager();
    const job = m.createJob({ jobId: "j", nodeIds: ["a", "b"], format: "PNG", scale: 1, outputDir: dir });
    m.handleEvent({ type: "bulk_export_event", jobId: "j", event: "job_finished", status: "done" });
    await waitFor(() => job.status !== "running");
    expect(job.status).toBe("failed");
    expect(job.failed.length).toBe(2);
    expect(job.failed[0].error).toBe("No image received from Figma");
  });

  test("cancel: requested then confirmed by plugin, or finalized locally", async () => {
    const m = new BulkExportManager();
    const job = m.createJob({ jobId: "j", nodeIds: ["a", "b"], format: "PNG", scale: 1, outputDir: dir });
    m.cancel("j", false);
    expect(job.status).toBe("running");
    expect(m.summarize(job)).toContain("[cancelling]");
    m.handleEvent({ type: "bulk_export_event", jobId: "j", event: "job_finished", status: "cancelled" });
    await waitFor(() => job.status !== "running");
    expect(job.status).toBe("cancelled");

    const job2 = m.createJob({ jobId: "k", nodeIds: ["a"], format: "PNG", scale: 1, outputDir: dir });
    m.cancel("k", true);
    expect(job2.status).toBe("cancelled");
    // late events after finish are ignored
    for (const e of chunk("k", "a", Buffer.from("late"))) m.handleEvent(e);
    expect(job2.done).toBe(0);
  });

  test("stall watchdog and disconnect fail running jobs", () => {
    let now = 0;
    const m = new BulkExportManager({ now: () => now, stallTimeoutMs: 1000 });
    const job = m.createJob({ jobId: "j", nodeIds: ["a"], format: "PNG", scale: 1, outputDir: dir });
    now = 500;
    m.checkStalls();
    expect(job.status).toBe("running");
    now = 2000;
    m.checkStalls();
    expect(job.status).toBe("failed");
    expect(job.error).toContain("Stalled");

    const job2 = m.createJob({ jobId: "k", nodeIds: ["a"], format: "PNG", scale: 1, outputDir: dir });
    m.failAllRunning("Lost connection");
    expect(job2.status).toBe("failed");
    expect(job2.error).toBe("Lost connection");

    // per-job stall timeout overrides the default
    now = 10_000;
    const job3 = m.createJob({ jobId: "p", nodeIds: ["a"], format: "PNG", scale: 1, outputDir: dir, stallTimeoutMs: 5000 });
    now = 13_000;
    m.checkStalls();
    expect(job3.status).toBe("running");
    now = 16_000;
    m.checkStalls();
    expect(job3.status).toBe("failed");
  });

  test("unknown job events are ignored", () => {
    const m = new BulkExportManager();
    expect(m.handleEvent({ type: "bulk_export_event", jobId: "nope", event: "job_finished" })).toBe(false);
  });

  test("write errors count as failed, job still finishes", async () => {
    const m = new BulkExportManager();
    // outputDir under a regular file -> mkdir fails
    const file = path.join(dir, "file");
    await Bun.write(file, "x");
    const job = m.createJob({ jobId: "j", nodeIds: ["a"], format: "PNG", scale: 1, outputDir: path.join(file, "sub") });
    for (const e of chunk("j", "a", Buffer.from("img"))) m.handleEvent(e);
    m.handleEvent({ type: "bulk_export_event", jobId: "j", event: "job_finished", status: "done" });
    await waitFor(() => job.status !== "running");
    expect(job.failed[0].error).toContain("Write failed");
    expect(job.status).toBe("failed");
  });
});
