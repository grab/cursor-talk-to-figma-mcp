// End-to-end: real relay (src/socket.ts) + real built MCP server (dist/server.js)
// + real plugin code (code.js) and plugin UI script (ui.html), with a fake
// Figma API. Uses a random free port; never touches the default 3055.
//
// Requires `bun run build` first (the `test` script does this).

import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { mkdtemp, readFile, readdir, rm } from "fs/promises";
import { execSync } from "child_process";
import { tmpdir } from "os";
import path from "path";
import net from "net";
import { fakeImageBytes, startFakeFigma } from "./helpers/fake_figma";

const ROOT = path.join(import.meta.dir, "..");

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const port = (srv.address() as net.AddressInfo).port;
      srv.close(() => (port === 3055 ? freePort().then(resolve, reject) : resolve(port)));
    });
    srv.on("error", reject);
  });
}

async function waitFor<T>(fn: () => Promise<T | undefined> | T | undefined, ms = 20000): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) throw new Error("timeout");
    await new Promise((r) => setTimeout(r, 50));
  }
}

let relay: ReturnType<typeof Bun.spawn>;
let port: number;
let outRoot: string;

async function startMcp(channel: string) {
  const client = new Client({ name: "e2e-test", version: "1.0.0" });
  const transport = new StdioClientTransport({
    command: "node",
    args: [path.join(ROOT, "dist", "server.js"), `--port=${port}`],
    stderr: "ignore",
  });
  await client.connect(transport);
  // Server connects to the relay asynchronously at startup.
  await waitFor(async () => {
    const r: any = await client.callTool({ name: "join_channel", arguments: { channel } });
    return r.content[0].text.startsWith("Successfully joined") ? true : undefined;
  }, 10000);
  return client;
}

const text = (r: any) => r.content[0].text as string;
const statusOf = async (client: Client, jobId: string) => {
  const t = text(await client.callTool({ name: "get_bulk_export_status", arguments: { jobId } }));
  const nl = t.indexOf("\n");
  return { summary: t.slice(0, nl), ...JSON.parse(t.slice(nl + 1)) };
};
const waitFinished = (client: Client, jobId: string, ms = 30000) =>
  waitFor(async () => {
    const s = await statusOf(client, jobId);
    return s.status !== "running" ? s : undefined;
  }, ms);

beforeAll(async () => {
  port = await freePort();
  relay = Bun.spawn(["bun", "run", path.join(ROOT, "src", "socket.ts")], {
    env: { ...process.env, PORT: String(port) },
    stdout: "ignore",
    stderr: "ignore",
  });
  await waitFor(async () => {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/`);
      return r.ok ? true : undefined;
    } catch {
      return undefined;
    }
  }, 10000);
  outRoot = await mkdtemp(path.join(tmpdir(), "bulk-export-e2e-"));
});

afterAll(async () => {
  relay?.kill();
  if (outRoot) await rm(outRoot, { recursive: true, force: true });
});

describe("bulk export end-to-end", () => {
  test("exports many nodes across pages, streams large images, records failures", async () => {
    const nodes = [];
    for (let i = 1; i <= 10; i++) nodes.push({ id: `2:${i}`, name: `Card ${i}`, pageId: "0:2", size: 3000 + i });
    nodes.push({ id: "2:99", name: "Huge", pageId: "0:2", size: 6 * 1024 * 1024 }); // > 1 websocket chunk
    nodes.push({ id: "3:1", name: "Other page", pageId: "0:3" });
    nodes.push({ id: "2:50", name: "Broken", pageId: "0:2", failWith: "Render failed" });
    nodes.push({ id: "2:60", name: "Group", pageId: "0:2", notExportable: true });
    const fig = await startFakeFigma({
      pages: [
        { id: "0:1", name: "Cover" },
        { id: "0:2", name: "Screens" },
        { id: "0:3", name: "Other" },
      ],
      currentPageId: "0:1",
      nodes,
      relayPort: port,
    });
    const client = await startMcp(fig.channel);
    try {
      // All upstream tools are still registered.
      const tools = (await client.listTools()).tools.map((t) => t.name);
      // Compare with the tool list of the upstream base (git main).
      const upstreamSrc = execSync("git show main:src/talk_to_figma_mcp/server.ts", { cwd: ROOT, encoding: "utf8" });
      const upstreamTools = [...upstreamSrc.matchAll(/server\.tool\(\s*"([a-z_]+)"/g)].map((m) => m[1]);
      expect(upstreamTools.length).toBeGreaterThan(40);
      for (const name of upstreamTools) expect(tools).toContain(name);
      // No tool is registered twice (other branches may add tools beyond the 4 bulk ones).
      expect(new Set(tools).size).toBe(tools.length);
      for (const name of ["start_bulk_export", "get_bulk_export_status", "cancel_bulk_export", "select_nodes"]) {
        expect(tools).toContain(name);
      }

      const outputDir = path.join(outRoot, "run1");
      const ids = [...nodes.map((n) => n.id), "9:404", "2:1" /* duplicate */];
      const t0 = Date.now();
      const startRes = JSON.parse(
        text(
          await client.callTool({
            name: "start_bulk_export",
            arguments: { nodeIds: ids, outputDir, scale: 2, fileNames: { "2:1": "first-card" } },
          })
        )
      );
      expect(Date.now() - t0).toBeLessThan(3000); // returns right away
      expect(startRes.jobId).toMatch(/^bulk-/);
      expect(startRes.total).toBe(15); // 14 nodes + 1 missing, duplicate removed
      expect(startRes.selectedCount).toBe(13);
      expect(startRes.page).toEqual({ id: "0:2", name: "Screens" });
      expect(startRes.onOtherPages).toEqual(["3:1"]);
      expect(startRes.notFound.sort()).toEqual(["2:60", "9:404"]);
      // Multi-select switched page and selected the nodes.
      expect(fig.figma.currentPage.id).toBe("0:2");
      expect(fig.figma.currentPage.selection.length).toBe(13);

      const s = await waitFinished(client, startRes.jobId);
      expect(s.status).toBe("done");
      expect(s.total).toBe(15);
      expect(s.done).toBe(12);
      expect(s.failedCount).toBe(3);
      expect(s.left).toBe(0);
      expect(s.percent).toBe(100);
      expect(s.failed.map((f: any) => f.nodeId).sort()).toEqual(["2:50", "2:60", "9:404"]);
      expect(s.failed.find((f: any) => f.nodeId === "2:50").error).toContain("Render failed");
      expect(s.summary).toMatch(/^12\/15 done \(100\.0%\), 0 left, 3 failed \[done in/);

      // Files: bytes match exactly what Figma returned, including the 6MB one.
      expect(await readFile(path.join(outputDir, "first-card.png"))).toEqual(Buffer.from(fakeImageBytes("2:1", 3001)));
      expect(await readFile(path.join(outputDir, "2-99.png"))).toEqual(Buffer.from(fakeImageBytes("2:99", 6 * 1024 * 1024)));
      expect(await readFile(path.join(outputDir, "3-1.png"))).toEqual(Buffer.from(fakeImageBytes("3:1", 2048)));
      const pngs = (await readdir(outputDir)).filter((f) => f.endsWith(".png"));
      expect(pngs.length).toBe(12);
      expect(fig.exportCalls.every((c) => c.settings.constraint.value === 2)).toBe(true);

      // Status never carries image data.
      const raw = text(await client.callTool({ name: "get_bulk_export_status", arguments: { jobId: startRes.jobId } }));
      expect(raw.length).toBeLessThan(5000);

      // Plugin UI progress + notifications.
      expect(fig.notifications[fig.notifications.length - 2]).toBe("Exporting 15 nodes...");
      expect(fig.notifications[fig.notifications.length - 1]).toMatch(/^Export done: 12\/15 exported, 3 failed in \d+s$/);
      expect(fig.progressText()).toBe("Bulk export: 12/15 done, 0 left, 3 failed");
      expect(fig.progressStatus()).toBe("Completed");
      expect(fig.progressPercent()).toBe("100%");
      expect(fig.maxInFlightSeen).toBeGreaterThan(1);

      // Existing single-node export still returns an inline image.
      const single: any = await client.callTool({ name: "export_node_as_image", arguments: { nodeId: "2:2" } });
      expect(single.content[0].type).toBe("image");
      expect(Buffer.from(single.content[0].data, "base64")).toEqual(Buffer.from(fakeImageBytes("2:2", 3002)));

      // Stand-alone multi-select.
      const sel = JSON.parse(text(await client.callTool({ name: "select_nodes", arguments: { nodeIds: ["3:1", "nope"] } })));
      expect(sel.selectedCount).toBe(1);
      expect(sel.page.name).toBe("Other");
      expect(sel.notFound).toEqual(["nope"]);
      expect(fig.figma.currentPage.id).toBe("0:3");
    } finally {
      await client.close();
      fig.disconnect();
    }
  }, 60000);

  test("falls back to concurrency 1 when Figma rejects parallel exports", async () => {
    const nodes = Array.from({ length: 8 }, (_, i) => ({ id: `5:${i}`, pageId: "0:1", delayMs: 15 }));
    const fig = await startFakeFigma({
      pages: [{ id: "0:1", name: "Page 1" }],
      currentPageId: "0:1",
      nodes,
      relayPort: port,
      maxParallelExports: 1,
    });
    const client = await startMcp(fig.channel);
    try {
      const outputDir = path.join(outRoot, "run2");
      const start = JSON.parse(
        text(
          await client.callTool({
            name: "start_bulk_export",
            arguments: { nodeIds: nodes.map((n) => n.id), outputDir, concurrency: 4 },
          })
        )
      );
      const s = await waitFinished(client, start.jobId);
      expect(s.status).toBe("done");
      expect(s.concurrency).toBe(1);
      expect(s.done).toBe(8);
      expect(s.failedCount).toBe(0);
    } finally {
      await client.close();
      fig.disconnect();
    }
  }, 60000);

  test("per-node timeout fails that node and the batch keeps going", async () => {
    const nodes = [
      { id: "6:1", pageId: "0:1" },
      { id: "6:2", pageId: "0:1", hang: true },
      { id: "6:3", pageId: "0:1" },
    ];
    const fig = await startFakeFigma({
      pages: [{ id: "0:1", name: "Page 1" }],
      currentPageId: "0:1",
      nodes,
      relayPort: port,
    });
    const client = await startMcp(fig.channel);
    try {
      const start = JSON.parse(
        text(
          await client.callTool({
            name: "start_bulk_export",
            arguments: { nodeIds: ["6:1", "6:2", "6:3"], outputDir: path.join(outRoot, "run3"), nodeTimeoutMs: 5000 },
          })
        )
      );
      const s = await waitFinished(client, start.jobId, 20000);
      expect(s.status).toBe("done");
      expect(s.done).toBe(2);
      expect(s.failed).toEqual([{ nodeId: "6:2", error: "Export timed out after 5s" }]);
    } finally {
      await client.close();
      fig.disconnect();
    }
  }, 60000);

  test("cancel stops the job; files already written stay", async () => {
    const nodes = Array.from({ length: 40 }, (_, i) => ({ id: `7:${i}`, pageId: "0:1", delayMs: 60 }));
    const fig = await startFakeFigma({
      pages: [{ id: "0:1", name: "Page 1" }],
      currentPageId: "0:1",
      nodes,
      relayPort: port,
    });
    const client = await startMcp(fig.channel);
    try {
      const outputDir = path.join(outRoot, "run4");
      const start = JSON.parse(
        text(
          await client.callTool({
            name: "start_bulk_export",
            arguments: { nodeIds: nodes.map((n) => n.id), outputDir, concurrency: 1 },
          })
        )
      );
      await waitFor(async () => ((await statusOf(client, start.jobId)).done >= 3 ? true : undefined));
      const mid = await statusOf(client, start.jobId);
      expect(mid.status).toBe("running");
      expect(mid.summary).toMatch(/^\d+\/40 done \(\d+\.\d%\), \d+ left, 0 failed, ETA ~\d+s$/);
      expect(mid.currentNode?.id).toMatch(/^7:/);
      const c = text(await client.callTool({ name: "cancel_bulk_export", arguments: { jobId: start.jobId } }));
      expect(c).toContain("Cancel requested");
      const s = await waitFinished(client, start.jobId);
      expect(s.status).toBe("cancelled");
      expect(s.done).toBeLessThan(40);
      const pngs = (await readdir(outputDir)).filter((f) => f.endsWith(".png"));
      expect(pngs.length).toBe(s.done);
      expect(fig.notifications[fig.notifications.length - 1]).toMatch(/^Export cancelled/);
      expect(fig.progressStatus()).toBe("Cancelled");
    } finally {
      await client.close();
      fig.disconnect();
    }
  }, 60000);
});
