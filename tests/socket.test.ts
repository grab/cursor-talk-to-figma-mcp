import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { connect } from "node:net";
import WebSocket from "ws";
import { isOriginAllowed, startRelayServer } from "../src/socket";

let server: ReturnType<typeof startRelayServer>;
let port: number;

beforeAll(() => {
  server = startRelayServer(0);
  port = server.port!;
});

afterAll(() => {
  server.stop(true);
});

// Send a raw HTTP request to the relay and return the status code and the
// response head (everything up to the blank line). Used instead of fetch so
// tests can control the Origin header exactly, like the report in #201.
function rawRequest(requestText: string): Promise<{ status: number; head: string }> {
  return new Promise((resolve, reject) => {
    const socket = connect(port, "127.0.0.1", () => {
      socket.write(requestText);
    });
    let buffer = "";
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error("Timed out waiting for relay response"));
    }, 5000);
    socket.on("data", (chunk) => {
      buffer += chunk.toString("latin1");
      const end = buffer.indexOf("\r\n\r\n");
      if (end !== -1) {
        clearTimeout(timer);
        const head = buffer.slice(0, end);
        socket.destroy();
        resolve({ status: Number(head.split(" ")[1]), head });
      }
    });
    socket.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

function handshake(origin?: string): Promise<{ status: number; head: string }> {
  const lines = [
    "GET / HTTP/1.1",
    `Host: 127.0.0.1:${port}`,
    "Upgrade: websocket",
    "Connection: Upgrade",
    "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==",
    "Sec-WebSocket-Version: 13",
  ];
  if (origin !== undefined) {
    lines.push(`Origin: ${origin}`);
  }
  lines.push("", "");
  return rawRequest(lines.join("\r\n"));
}

function request(method: string, origin?: string): Promise<{ status: number; head: string }> {
  const lines = [`${method} / HTTP/1.1`, `Host: 127.0.0.1:${port}`];
  if (origin !== undefined) {
    lines.push(`Origin: ${origin}`);
  }
  lines.push("", "");
  return rawRequest(lines.join("\r\n"));
}

describe("isOriginAllowed", () => {
  const cases: Array<[string | null, boolean]> = [
    [null, true], // non-browser client (MCP server, curl)
    ["null", true], // Figma plugin UI sandboxed iframe
    ["https://www.figma.com", true],
    ["https://figma.com", true],
    ["http://localhost:3000", true],
    ["http://127.0.0.1:3055", true],
    ["http://[::1]:8080", true],
    ["https://evil.example", false],
    ["https://figma.com.evil.example", false],
    ["https://evilfigma.com", false],
    ["not a url", false],
  ];
  for (const [origin, expected] of cases) {
    test(`origin ${JSON.stringify(origin)} -> ${expected}`, () => {
      expect(isOriginAllowed(origin)).toBe(expected);
    });
  }
});

describe("WebSocket upgrade Origin check", () => {
  test("rejects a foreign web origin before the upgrade", async () => {
    const { status } = await handshake("https://evil.example");
    expect(status).toBe(403);
  });

  test("rejects a lookalike domain that only ends in figma.com text", async () => {
    const { status } = await handshake("https://figma.com.evil.example");
    expect(status).toBe(403);
  });

  test("accepts the Figma web origin", async () => {
    const { status } = await handshake("https://www.figma.com");
    expect(status).toBe(101);
  });

  test("accepts Origin: null (Figma plugin UI sandboxed iframe)", async () => {
    const { status } = await handshake("null");
    expect(status).toBe(101);
  });

  test("accepts a localhost origin (local development pages)", async () => {
    const { status } = await handshake("http://localhost:3000");
    expect(status).toBe(101);
  });

  test("accepts requests with no Origin header (non-browser clients)", async () => {
    const { status } = await handshake();
    expect(status).toBe(101);
  });
});

describe("CORS headers", () => {
  test("rejects a CORS preflight from a foreign origin", async () => {
    const { status, head } = await request("OPTIONS", "https://evil.example");
    expect(status).toBe(403);
    expect(head.toLowerCase()).not.toContain("access-control-allow-origin: *");
  });

  test("answers a preflight from a trusted origin without a wildcard", async () => {
    const { status, head } = await request("OPTIONS", "https://www.figma.com");
    expect(status).toBe(200);
    expect(head.toLowerCase()).toContain("access-control-allow-origin: https://www.figma.com");
    expect(head.toLowerCase()).not.toContain("access-control-allow-origin: *");
  });

  test("fallback response carries no wildcard CORS header", async () => {
    const { status, head } = await request("GET", "https://evil.example");
    expect(status).toBe(200);
    expect(head.toLowerCase()).not.toContain("access-control-allow-origin: *");
  });
});

describe("channel protocol (no-Origin client, like the MCP server)", () => {
  test("a client can still join a channel and be answered", async () => {
    const client = new WebSocket(`ws://127.0.0.1:${port}`);
    await new Promise<void>((resolve, reject) => {
      client.once("open", resolve);
      client.once("error", reject);
    });

    const joined = new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("No join response")), 5000);
      client.on("message", (data) => {
        const text = data.toString();
        if (text.includes("Joined channel")) {
          clearTimeout(timer);
          resolve(text);
        }
      });
    });
    client.send(JSON.stringify({ type: "join", channel: "origin-test", id: "test-1" }));

    const message = await joined;
    expect(message).toContain("Joined channel: origin-test");
    client.close();
  });
});
