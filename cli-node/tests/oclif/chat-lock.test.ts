import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  _resetChatLockForTests,
  acquireChatLock,
  acquireChatStateLock,
  ChatLockContentionError,
} from "../../src/oclif/chat-lock.js";

let configDir: string;

beforeEach(() => {
  configDir = mkdtempSync(join(tmpdir(), "chat-lock-test-"));
  _resetChatLockForTests();
});

afterEach(() => {
  vi.restoreAllMocks();
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

  it.each([
    "",
    "not-a-pid\n",
    "123garbage\n",
  ])("preserves an ambiguous lock %j", (contents) => {
    const path = join(configDir, "chat-state.lock");
    writeFileSync(path, contents);
    expect(() => acquireChatLock(configDir)).toThrow(ChatLockContentionError);
    expect(readFileSync(path, "utf8")).toBe(contents);
    expect(readdirSync(configDir)).toEqual(["chat-state.lock"]);
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

describe("scoped chat locks", () => {
  it("allows independent scopes and the default state lock to coexist", () => {
    const first = acquireChatLock(configDir, "first@example.test");
    const second = acquireChatLock(configDir, "second@example.test");
    const state = acquireChatLock(configDir);
    expect(readdirSync(configDir)).toHaveLength(3);
    expect(readdirSync(configDir).join(" ")).not.toContain("example.test");
    first();
    expect(readdirSync(configDir)).toHaveLength(2);
    second();
    expect(readdirSync(configDir)).toEqual(["chat-state.lock"]);
    state();
    expect(readdirSync(configDir)).toEqual([]);
  });

  it("releases a reentrant scope only after all holders release, in either order", () => {
    const outer = acquireChatLock(configDir, "same");
    const inner = acquireChatLock(configDir, "same");
    expect(readdirSync(configDir)).toHaveLength(1);
    outer();
    expect(readdirSync(configDir)).toHaveLength(1);
    outer();
    inner();
    expect(readdirSync(configDir)).toEqual([]);
  });

  it("keeps independent config directories tracked until each is released", () => {
    const nested = join(configDir, "other");
    const first = acquireChatLock(configDir);
    const second = acquireChatLock(nested);
    first();
    expect(existsSync(join(configDir, "chat-state.lock"))).toBe(false);
    expect(existsSync(join(nested, "chat-state.lock"))).toBe(true);
    second();
    expect(existsSync(join(nested, "chat-state.lock"))).toBe(false);
  });

  it("does not remove a replacement lock on release or stale release callbacks", () => {
    const path = join(configDir, "chat-state.lock");
    const original = acquireChatLock(configDir);
    unlinkSync(path);
    writeFileSync(path, `${process.pid}\n`);
    original();
    expect(readFileSync(path, "utf8")).toBe(`${process.pid}\n`);
    unlinkSync(path);
    const current = acquireChatLock(configDir);
    original();
    expect(existsSync(path)).toBe(true);
    current();
    expect(existsSync(path)).toBe(false);
  });

  it("refuses to reenter a lock whose ownership record changed", () => {
    const release = acquireChatLock(configDir, "scope");
    const path = join(configDir, readdirSync(configDir)[0] ?? "missing");
    writeFileSync(path, `${process.pid}\n`);
    expect(() => acquireChatLock(configDir, "scope")).toThrow(
      ChatLockContentionError,
    );
    release();
    expect(existsSync(path)).toBe(true);
  });

  it("preserves an ambiguous stale reclamation instead of deleting its guard", () => {
    const path = join(configDir, "chat-state.lock");
    writeFileSync(path, "999999\n");
    mkdirSync(`${path}.reclaim`);
    expect(() => acquireChatLock(configDir)).toThrow(ChatLockContentionError);
    expect(readFileSync(path, "utf8")).toBe("999999\n");
    expect(existsSync(`${path}.reclaim`)).toBe(true);
  });
});

describe("acquireChatStateLock", () => {
  it("waits for another state transaction in the same process", async () => {
    const first = await acquireChatStateLock(configDir);
    let entered = false;
    const next = acquireChatStateLock(configDir).then((release) => {
      entered = true;
      return release;
    });
    await new Promise((resolve) => setTimeout(resolve, 35));
    expect(entered).toBe(false);
    first();
    const second = await next;
    expect(entered).toBe(true);
    second();
    expect(existsSync(join(configDir, "chat-state.lock"))).toBe(false);
  });

  it("retries a foreign live lock and acquires after it releases", async () => {
    const path = join(configDir, "chat-state.lock");
    writeFileSync(path, `${process.pid}\n`);
    const timer = setTimeout(() => unlinkSync(path), 35);
    try {
      const release = await acquireChatStateLock(configDir);
      expect(readFileSync(path, "utf8")).toContain(`${process.pid}\n`);
      release();
    } finally {
      clearTimeout(timer);
    }
  });

  it("does not wait for an independent conversation lock", async () => {
    const conversation = acquireChatLock(configDir, "conversation");
    const state = await acquireChatStateLock(configDir);
    expect(readdirSync(configDir)).toHaveLength(2);
    state();
    expect(readdirSync(configDir)).toHaveLength(1);
    conversation();
  });

  it("bounds waiting and preserves an ambiguous lock on timeout", async () => {
    const path = join(configDir, "chat-state.lock");
    writeFileSync(path, "");
    vi.spyOn(performance, "now").mockReturnValueOnce(0).mockReturnValue(5_001);
    await expect(acquireChatStateLock(configDir)).rejects.toBeInstanceOf(
      ChatLockContentionError,
    );
    expect(readFileSync(path, "utf8")).toBe("");
    expect(readdirSync(configDir)).toEqual(["chat-state.lock"]);
  });
});
