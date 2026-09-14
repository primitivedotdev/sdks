import { spawn, spawnSync } from "node:child_process";
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
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";
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

  it("does not let a leftover legacy reclamation directory block recovery", () => {
    const path = join(configDir, "chat-state.lock");
    writeFileSync(path, "999999\n");
    mkdirSync(`${path}.reclaim`);
    const release = acquireChatLock(configDir);
    expect(readFileSync(path, "utf8")).toContain(`${process.pid}\n`);
    expect(existsSync(`${path}.reclaim`)).toBe(true);
    release();
  });
});

function subprocessModule(): string {
  const path = join(configDir, "chat-lock.mjs");
  writeFileSync(
    path,
    ts.transpileModule(
      readFileSync(resolve("src/oclif/chat-lock.ts"), "utf8"),
      {
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ESNext,
        },
      },
    ).outputText,
  );
  return pathToFileURL(path).href;
}

function crashReclaimer(moduleUrl: string): void {
  const script = `
    import fs from 'node:fs';
    import { syncBuiltinESMExports } from 'node:module';
    const original = fs.linkSync;
    fs.linkSync = (source, destination) => {
      original(source, destination);
      if (destination.includes('.reclaim-')) process.kill(process.pid, 'SIGKILL');
    };
    syncBuiltinESMExports();
    const { acquireChatLock } = await import(${JSON.stringify(moduleUrl)});
    acquireChatLock(process.argv[1]);
  `;
  const child = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", script, configDir],
    { timeout: 5_000 },
  );
  expect(child.error).toBeUndefined();
  expect(child.signal).toBe("SIGKILL");
}

describe("reclamation crash recovery", () => {
  it("recovers processes killed after publishing a guard, including a successor", () => {
    const moduleUrl = subprocessModule();
    const path = join(configDir, "chat-state.lock");
    writeFileSync(path, "999999\n");
    crashReclaimer(moduleUrl);
    crashReclaimer(moduleUrl);
    const guards = readdirSync(configDir).filter((name) =>
      name.includes(".reclaim-"),
    );
    expect(guards).toHaveLength(2);
    for (const name of guards)
      expect(readFileSync(join(configDir, name), "utf8")).toMatch(
        /^[1-9]\d*\n[0-9a-f-]{36}\n$/,
      );
    expect(readFileSync(path, "utf8")).toBe("999999\n");
    const release = acquireChatLock(configDir);
    expect(readFileSync(path, "utf8")).toContain(`${process.pid}\n`);
    expect(
      readdirSync(configDir).filter((name) => name.includes(".reclaim-")),
    ).toEqual([]);
    release();
  });

  it("keeps exactly one owner when real processes reclaim a crashed successor", async () => {
    const moduleUrl = subprocessModule();
    const path = join(configDir, "chat-state.lock");
    writeFileSync(path, "999999\n");
    crashReclaimer(moduleUrl);
    const script = `
      import fs from 'node:fs';
      import { syncBuiltinESMExports } from 'node:module';
      import { acquireChatLock } from ${JSON.stringify(moduleUrl)};
      const link = fs.linkSync;
      let guarded = false;
      fs.linkSync = (source, destination) => {
        if (!guarded && destination.includes('.reclaim-')) {
          guarded = true;
          process.send('reclaiming');
          while (!fs.existsSync(process.argv[1] + '/continue-reclaim'))
            Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5);
        }
        return link(source, destination);
      };
      syncBuiltinESMExports();
      let release;
      process.on('message', (message) => {
        if (message === 'go') {
          try {
            release = acquireChatLock(process.argv[1]);
            process.send('owned');
          } catch { process.send('busy'); }
        } else if (message === 'finish') {
          if (release) {
            const pid = Number.parseInt(fs.readFileSync(process.argv[1] + '/chat-state.lock', 'utf8'), 10);
            if (pid !== process.pid) process.exit(2);
            release();
          }
          process.disconnect();
        }
      });
      process.send('ready');
    `;
    const contenders = Array.from({ length: 8 }, () => {
      const child = spawn(
        process.execPath,
        ["--input-type=module", "-e", script, configDir],
        { stdio: ["ignore", "pipe", "pipe", "ipc"] },
      );
      const ready = new Promise<void>((done) => {
        child.on("message", (message) => {
          if (message === "ready") done();
        });
      });
      const result = new Promise<string>((done) => {
        child.on("message", (message) => {
          if (message === "owned" || message === "busy") done(message);
        });
      });
      const reclaiming = new Promise<void>((done) => {
        child.on("message", (message) => {
          if (message === "reclaiming") done();
        });
      });
      const exited = new Promise<number | null>((done) => {
        child.on("exit", done);
      });
      return { child, ready, result, reclaiming, exited };
    });
    try {
      await Promise.all(contenders.map(({ ready }) => ready));
      for (const { child } of contenders) child.send("go");
      // Every process has observed the same stale primary before any contender
      // can elect a successor. This exercises the stale-deleter race directly.
      await Promise.all(contenders.map(({ reclaiming }) => reclaiming));
      writeFileSync(join(configDir, "continue-reclaim"), "");
      const results = await Promise.all(contenders.map(({ result }) => result));
      expect(results.filter((result) => result === "owned")).toHaveLength(1);
      const winner = contenders[results.indexOf("owned")];
      expect(Number.parseInt(readFileSync(path, "utf8"), 10)).toBe(
        winner?.child.pid,
      );
      for (const { child } of contenders) child.send("finish");
      expect(await Promise.all(contenders.map(({ exited }) => exited))).toEqual(
        Array(8).fill(0),
      );
      expect(existsSync(path)).toBe(false);
    } finally {
      for (const { child } of contenders) child.kill("SIGKILL");
      await Promise.all(contenders.map(({ exited }) => exited));
    }
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
