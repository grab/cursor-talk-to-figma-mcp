// Shared rules for channel names, used by both the MCP server
// (src/talk_to_figma_mcp/server.ts) and the WebSocket relay (src/socket.ts).
//
// A channel name is chosen by the MCP client — ultimately by the LLM, whose
// input can be steered by prompt injection — and is written to the MCP
// server log (stderr) and the relay console. Restricting names to a safe
// alphabet and length keeps CR/LF and other control characters out of
// channel names entirely (CWE-117).

export const CHANNEL_NAME_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export function isValidChannelName(name: unknown): name is string {
  return typeof name === "string" && CHANNEL_NAME_PATTERN.test(name);
}

// Escape CR/LF in a value that is about to be interpolated into a log line,
// so the value can never terminate the line and forge a new one. Used as
// defence in depth wherever caller-controlled values reach the logs.
export function escapeForLog(value: string): string {
  return value.replace(/\r/g, "\\r").replace(/\n/g, "\\n");
}
