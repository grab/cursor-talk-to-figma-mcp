import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawn, type Subprocess } from "bun";
import { join } from "node:path";
import WebSocket from "ws";

// Regression test for #198 (CWE-117): a channel name containing CR/LF must
// not be able to forge log lines in the WebSocket relay output, and the
// relay must refuse the join instead of accepting the name.

const repoRoot = join(import.meta.dir, "..");
const RELAY_URL = "ws://127.0.0.1:3055";
const FORGED_CHANNEL = "tofu\r\n[ERROR] FAKE-LOG-ENTRY";
const FAKE_LINE = "[ERROR] FAKE-LOG-ENTRY";

let relay: Subprocess;
let relayOutput = "";

function drain(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  (async () => {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      relayOutput += decoder.decode(value, { stream: true });
    }
  })().catch(() => {});
}

beforeAll(async () => {
  relay = spawn({
    cmd: ["bun", "run", "src/socket.ts"],
    cwd: repoRoot,
    stdout: "pipe",
    stderr: "pipe",
  });
  drain(relay.stdout as ReadableStream<Uint8Array>);
  drain(relay.stderr as ReadableStream<Uint8Array>);

  const deadline = Date.now() + 15000;
  while (!relayOutput.includes("WebSocket server running on port")) {
    if (Date.now() > deadline) {
      throw new Error(`Relay did not start. Output so far:\n${relayOutput}`);
    }
    await Bun.sleep(100);
  }
}, 20000);

afterAll(() => {
  relay.kill();
});

// Connect to the relay, send a join for `channel`, and collect every
// message the relay sends back within a short window.
function joinAndCollect(channel: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(RELAY_URL);
    const messages: any[] = [];
    const timer = setTimeout(() => {
      ws.close();
      resolve(messages);
    }, 1200);
    ws.on("open", () => {
      ws.send(JSON.stringify({ type: "join", channel, id: "test-join" }));
    });
    ws.on("message", (data) => {
      try {
        messages.push(JSON.parse(data.toString()));
      } catch {
        // ignore non-JSON frames
      }
    });
    ws.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

describe("relay join_channel log injection (#198)", () => {
  test("a channel name with CR/LF is rejected and forges no log line", async () => {
    const messages = await joinAndCollect(FORGED_CHANNEL);

    // The join must be refused with an error, not accepted.
    expect(messages.some((m) => m.type === "error")).toBe(true);
    expect(
      messages.some(
        (m) => typeof m.message === "string" && m.message.includes("Joined channel")
      )
    ).toBe(false);

    // Give the relay a moment to flush its logs, then inspect them.
    await Bun.sleep(300);
    const lines = relayOutput.split("\n");
    // No output line may be the forged entry standing on its own line.
    expect(lines.some((line) => line.startsWith(FAKE_LINE))).toBe(false);
    // The relay must not have logged a successful join for the forged name.
    expect(relayOutput).not.toContain("Client joined channel \"tofu");
  }, 10000);

  test("a normal channel name still joins successfully", async () => {
    const messages = await joinAndCollect("tofu-channel");
    expect(
      messages.some(
        (m) =>
          m.type === "system" &&
          typeof m.message === "string" &&
          m.message.includes("Joined channel: tofu-channel")
      )
    ).toBe(true);
  }, 10000);
});
