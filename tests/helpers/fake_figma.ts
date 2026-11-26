// Test harness: runs the real plugin code (code.js) and the real plugin UI
// script (ui.html) in VM contexts with a fake `figma` API and a fake DOM.
// The UI uses a real WebSocket, so it talks to a real relay (socket.ts).
// Analytics network calls from ui.html are stubbed out (no requests leave the machine).

import { readFileSync } from "fs";
import path from "path";
import vm from "vm";

const PLUGIN_DIR = path.join(import.meta.dir, "..", "..", "src", "cursor_mcp_plugin");

export interface FakeNodeSpec {
  id: string;
  name?: string;
  pageId: string;
  /** Size of the fake image in bytes. */
  size?: number;
  /** Simulated export time in ms. */
  delayMs?: number;
  /** Always throw on export. */
  failWith?: string;
  /** Never resolve the export (to test per-node timeouts). */
  hang?: boolean;
  /** No exportAsync method (e.g. not exportable). */
  notExportable?: boolean;
}

export function fakeImageBytes(id: string, size: number): Uint8Array {
  const bytes = new Uint8Array(size);
  let seed = 0;
  for (const ch of id) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  for (let i = 0; i < size; i++) {
    seed = (seed * 1103515245 + 12345) >>> 0;
    bytes[i] = seed >>> 24;
  }
  return bytes;
}

class FakeElement {
  value = "";
  textContent = "";
  innerHTML = "";
  className = "";
  disabled = false;
  style: Record<string, string> = {};
  private listeners: Record<string, Array<() => void>> = {};
  classList = {
    add: () => {},
    remove: () => {},
  };
  addEventListener(type: string, fn: () => void) {
    (this.listeners[type] ||= []).push(fn);
  }
  click() {
    for (const fn of this.listeners["click"] || []) fn();
  }
  select() {}
}

export interface FakeFigmaOptions {
  pages: Array<{ id: string; name: string }>;
  nodes: FakeNodeSpec[];
  currentPageId: string;
  relayPort: number;
  /** If set, exports fail while more than this many run at once. */
  maxParallelExports?: number;
}

export async function startFakeFigma(opts: FakeFigmaOptions) {
  const notifications: string[] = [];
  const uiMessages: any[] = [];
  const exportCalls: Array<{ id: string; settings: any }> = [];
  let inFlight = 0;
  let maxInFlightSeen = 0;

  const pages = new Map<string, any>();
  for (const p of opts.pages) {
    pages.set(p.id, {
      id: p.id,
      name: p.name,
      type: "PAGE",
      parent: { type: "DOCUMENT" },
      selection: [] as any[],
      loaded: false,
      async loadAsync() {
        this.loaded = true;
      },
    });
  }

  const nodes = new Map<string, any>();
  for (const spec of opts.nodes) {
    const node: any = {
      id: spec.id,
      name: spec.name || `Node ${spec.id}`,
      type: "FRAME",
      parent: pages.get(spec.pageId),
    };
    if (!spec.notExportable) {
      node.exportAsync = async (settings: any) => {
        exportCalls.push({ id: spec.id, settings });
        inFlight++;
        maxInFlightSeen = Math.max(maxInFlightSeen, inFlight);
        try {
          if (opts.maxParallelExports && inFlight > opts.maxParallelExports) {
            await new Promise((r) => setTimeout(r, 5));
            throw new Error("Too many concurrent exports");
          }
          if (spec.hang) await new Promise(() => {});
          await new Promise((r) => setTimeout(r, spec.delayMs ?? 5));
          if (spec.failWith) throw new Error(spec.failWith);
          return fakeImageBytes(spec.id, spec.size ?? 2048);
        } finally {
          inFlight--;
        }
      };
    }
    nodes.set(spec.id, node);
  }

  let uiWindow: any;
  let pluginOnMessage: ((msg: any) => void) | null = null;

  const figma: any = {
    currentPage: pages.get(opts.currentPageId),
    showUI() {},
    on() {},
    notify(message: string) {
      notifications.push(message);
    },
    closePlugin() {},
    clientStorage: {
      async getAsync() {
        return "test-client";
      },
      async setAsync() {},
    },
    viewport: { scrollAndZoomIntoView() {} },
    async getNodeByIdAsync(id: string) {
      return nodes.get(id) || pages.get(id) || null;
    },
    async setCurrentPageAsync(page: any) {
      figma.currentPage = page;
    },
    ui: {
      postMessage(msg: any) {
        uiMessages.push(msg);
        // Deliver asynchronously, like Figma's iframe bridge.
        setTimeout(() => uiWindow?.onmessage?.({ data: { pluginMessage: msg } }), 0);
      },
      set onmessage(fn: (msg: any) => void) {
        pluginOnMessage = fn;
      },
      get onmessage() {
        return pluginOnMessage as any;
      },
    },
  };

  // --- Plugin main thread (code.js) ---
  const pluginContext = vm.createContext({
    figma,
    __html__: "",
    console: { log() {}, warn() {}, error: console.error, info() {} },
    setTimeout,
    clearTimeout,
    Promise,
    Uint8Array,
  });
  vm.runInContext(readFileSync(path.join(PLUGIN_DIR, "code.js"), "utf8"), pluginContext, {
    filename: "code.js",
  });

  // --- Plugin UI (ui.html script) ---
  const html = readFileSync(path.join(PLUGIN_DIR, "ui.html"), "utf8");
  const script = html.slice(html.indexOf("<script>") + "<script>".length, html.lastIndexOf("</script>"));
  const elements = new Map<string, FakeElement>();
  const document = {
    getElementById(id: string) {
      if (!elements.has(id)) elements.set(id, new FakeElement());
      return elements.get(id);
    },
    querySelectorAll() {
      return [];
    },
    execCommand() {},
  };
  document.getElementById("port").value = String(opts.relayPort);

  let channel: string | null = null;
  const RealWebSocket = globalThis.WebSocket;
  class CapturingWebSocket extends RealWebSocket {
    send(data: any) {
      try {
        const parsed = JSON.parse(data);
        if (parsed.type === "join") channel = parsed.channel;
      } catch {}
      return super.send(data);
    }
  }

  uiWindow = {
    document,
    parent: {
      postMessage(msg: any) {
        setTimeout(() => pluginOnMessage?.(msg.pluginMessage), 0);
      },
    },
    WebSocket: CapturingWebSocket,
    btoa,
    // Stub analytics: never call out to the network from tests.
    fetch: async () => ({ ok: true }),
    navigator: {},
    console: { log() {}, warn() {}, error: console.error, info() {} },
    setTimeout,
    clearTimeout,
    Promise,
    JSON,
    Math,
    Date,
    String,
    Uint8Array,
    URLSearchParams,
  };
  uiWindow.window = uiWindow;
  const uiContext = vm.createContext(uiWindow);
  vm.runInContext(script, uiContext, { filename: "ui.html" });

  // Connect like a user clicking "Connect".
  document.getElementById("btn-connect").click();
  const deadline = Date.now() + 5000;
  while (!channel || !document.getElementById("connection-status").className.includes("connected")) {
    if (Date.now() > deadline) throw new Error("Fake Figma UI did not connect to relay");
    await new Promise((r) => setTimeout(r, 20));
  }
  // Wait for join confirmation.
  while (document.getElementById("btn-connect").textContent !== "Disconnect") {
    if (Date.now() > deadline) throw new Error("Fake Figma UI did not join channel");
    await new Promise((r) => setTimeout(r, 20));
  }

  return {
    channel: channel as string,
    figma,
    pages,
    nodes,
    notifications,
    uiMessages,
    exportCalls,
    get maxInFlightSeen() {
      return maxInFlightSeen;
    },
    progressText: () => document.getElementById("progress-message").textContent,
    progressStatus: () => document.getElementById("progress-status").textContent,
    progressPercent: () => document.getElementById("progress-percentage").textContent,
    disconnect() {
      document.getElementById("btn-connect").click();
    },
  };
}
