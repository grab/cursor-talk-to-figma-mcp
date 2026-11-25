import { describe, expect, test } from "bun:test";
import { escapeForLog, isValidChannelName } from "../src/channel";

describe("isValidChannelName (#198)", () => {
  test("accepts ordinary channel names", () => {
    expect(isValidChannelName("tofu")).toBe(true);
    expect(isValidChannelName("my-channel_1")).toBe(true);
    expect(isValidChannelName("A")).toBe(true);
    expect(isValidChannelName("a".repeat(64))).toBe(true);
  });

  test("rejects names containing CR/LF or other unsafe characters", () => {
    expect(isValidChannelName("tofu\r\n[ERROR] FAKE-LOG-ENTRY")).toBe(false);
    expect(isValidChannelName("tofu\n")).toBe(false);
    expect(isValidChannelName("tofu\r")).toBe(false);
    expect(isValidChannelName("my channel")).toBe(false);
    expect(isValidChannelName("chan/nel")).toBe(false);
    expect(isValidChannelName("chännel")).toBe(false);
  });

  test("rejects empty, over-long, and non-string values", () => {
    expect(isValidChannelName("")).toBe(false);
    expect(isValidChannelName("a".repeat(65))).toBe(false);
    expect(isValidChannelName(undefined)).toBe(false);
    expect(isValidChannelName(null)).toBe(false);
    expect(isValidChannelName(42)).toBe(false);
  });
});

describe("escapeForLog (#198)", () => {
  test("escapes CR and LF so a value stays on one log line", () => {
    const escaped = escapeForLog("tofu\r\n[ERROR] FAKE-LOG-ENTRY");
    expect(escaped).toBe("tofu\\r\\n[ERROR] FAKE-LOG-ENTRY");
    expect(escaped).not.toContain("\r");
    expect(escaped).not.toContain("\n");
  });

  test("leaves ordinary text untouched", () => {
    expect(escapeForLog("Joined channel: tofu")).toBe("Joined channel: tofu");
  });
});
