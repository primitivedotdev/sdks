import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  _resetChatLockForTests,
  acquireChatLock,
  ChatLockContentionError,
} from "../../src/oclif/chat-lock.js";

let configDir: string;

beforeEach(() => {
  configDir = mkdtempSync(join(tmpdir(), "chat-lock-test-"));
  _resetChatLockForTests();
});

afterEach(() => {
  _resetChatLockForTests();
  rmSync(configDir, { force: true, recursive: true });
});

describe("acquireChatLock", () => {
  it("writes the holder's PID into the lock file", () => {
    const release = acquireChatLock(configDir);
    try {
      const contents = readFileSync(
        join(configDir, "chat-state.lock"),
        "utf8",
      ).trim();
      expect(Number.parseInt(contents, 10)).toBe(process.pid);
    } finally {
      release();
    }
  });

  it("removes the lock file when release() is called", () => {
    const release = acquireChatLock(configDir);
    expect(existsSync(join(configDir, "chat-state.lock"))).toBe(true);
    release();
    expect(existsSync(join(configDir, "chat-state.lock"))).toBe(false);
  });

  it("release() is idempotent", () => {
    const release = acquireChatLock(configDir);
    release();
    expect(() => {
      release();
      release();
    }).not.toThrow();
  });

  it("steals a stale lock when the holder PID is dead", () => {
    // PID 999999 is well above any realistic running PID; if a real
    // process happens to be there this test could be flaky, but on
    // CI containers the search-space is small enough that this is
    // safe in practice.
    const stalePid = 999_999;
    writeFileSync(join(configDir, "chat-state.lock"), `${stalePid}\n`, {
      mode: 0o600,
    });
    const release = acquireChatLock(configDir);
    try {
      const contents = readFileSync(
        join(configDir, "chat-state.lock"),
        "utf8",
      ).trim();
      expect(Number.parseInt(contents, 10)).toBe(process.pid);
    } finally {
      release();
    }
  });

  it("steals a lock file with malformed PID contents", () => {
    writeFileSync(join(configDir, "chat-state.lock"), "not-a-pid\n");
    const release = acquireChatLock(configDir);
    try {
      const contents = readFileSync(
        join(configDir, "chat-state.lock"),
        "utf8",
      ).trim();
      expect(Number.parseInt(contents, 10)).toBe(process.pid);
    } finally {
      release();
    }
  });

  it("throws ChatLockContentionError when a live process holds the lock", () => {
    // The current test process is definitely alive — write its own
    // PID into the lock file and ensure a second acquire fails.
    // Simulating this requires bypassing the re-entrancy short-
    // circuit, which checks the in-process holder. Write the lock
    // file directly so the EEXIST path runs against a "foreign" PID.
    writeFileSync(join(configDir, "chat-state.lock"), `${process.pid}\n`, {
      mode: 0o600,
    });
    expect(() => acquireChatLock(configDir)).toThrow(ChatLockContentionError);
    // The lock file should still be intact — not stolen.
    expect(existsSync(join(configDir, "chat-state.lock"))).toBe(true);
  });

  it("is re-entrant within the same process", () => {
    const outer = acquireChatLock(configDir);
    expect(() => {
      const inner = acquireChatLock(configDir);
      // Inner release decrements depth; lock file should still exist.
      inner();
      expect(existsSync(join(configDir, "chat-state.lock"))).toBe(true);
    }).not.toThrow();
    outer();
    // Outer release removes the lock file.
    expect(existsSync(join(configDir, "chat-state.lock"))).toBe(false);
  });

  it("creates the configDir if it does not exist", () => {
    const fresh = join(configDir, "nested", "fresh");
    expect(existsSync(fresh)).toBe(false);
    const release = acquireChatLock(fresh);
    try {
      expect(existsSync(join(fresh, "chat-state.lock"))).toBe(true);
    } finally {
      release();
    }
  });
});
