import { execFile, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { Parser } from "@oclif/core";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveCliAuth, saveCliCredentials } from "../../src/oclif/auth.js";
import ListenCommand from "../../src/oclif/commands/listen.js";
import {
  BACKGROUND_HEAL_INTERVAL_MS,
  BACKGROUND_LISTEN_TARGET_ENV,
  BACKGROUND_LISTEN_TOKEN_ENV,
  type BackgroundListenFailureCode,
  type BackgroundListenTarget,
  backgroundListenRestartable,
  backgroundListenStatus,
  backgroundListenToken,
  claimBackgroundListenRestart,
  runBackgroundListen,
  runBackgroundListenSupervisor,
  startBackgroundListen,
  stopBackgroundListen,
  verifyBackgroundListenTarget,
} from "../../src/oclif/listen-background.js";
import {
  acquireListenLock,
  ListenStateError,
  listenProcessIdentity,
} from "../../src/oclif/listen-state.js";
import {
  readMailJson,
  writeMailJson,
} from "../../src/oclif/shared-mail-files.js";
import { emptyContactPolicy } from "./contact-policy-fixture.js";

// Simulates a full disk for this process's own state writes only.
const storage = vi.hoisted(() => ({
  failWrites: null as string | null,
  failReads: null as string | null,
}));
vi.mock("../../src/oclif/shared-mail-files.js", async (original) => {
  const actual =
    await original<typeof import("../../src/oclif/shared-mail-files.js")>();
  return {
    ...actual,
    writeMailJson: (path: string, value: unknown) => {
      if (storage.failWrites)
        throw Object.assign(new Error("synthetic storage failure"), {
          code: storage.failWrites,
        });
      actual.writeMailJson(path, value);
    },
    readMailJson: (path: string, maxBytes?: number) => {
      if (storage.failReads) {
        // The same shape the real reader produces for a filesystem error.
        const error = actual.invalidSharedMail();
        error.cause = { code: storage.failReads };
        throw error;
      }
      return actual.readMailJson(path, maxBytes);
    },
  };
});

vi.mock("../../src/oclif/listen-state.js", async (original) => {
  const actual =
    await original<typeof import("../../src/oclif/listen-state.js")>();
  return {
    ...actual,
    listenProcessIdentity: vi.fn(actual.listenProcessIdentity),
  };
});

let directory: string;
let target: BackgroundListenTarget;
const active: Array<{ controller: AbortController; done: Promise<void> }> = [];
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "primitive-listen-background-"));
  target = {
    configDir: directory,
    scope: "synthetic-address-scope",
    threadId: randomUUID(),
  };
});
afterEach(async () => {
  storage.failWrites = null;
  storage.failReads = null;
  vi.unstubAllEnvs();
  vi.mocked(listenProcessIdentity).mockRestore();
  for (const item of active.splice(0)) {
    item.controller.abort();
    await item.done.catch(() => {});
  }
  await stopBackgroundListen(target).catch(() => {});
  rmSync(directory, { recursive: true, force: true });
});

function deadPid(): number {
  return spawnSync(process.execPath, ["-e", ""]).pid as number;
}
function stateFile() {
  const key = createHash("sha256")
    .update(JSON.stringify([target.scope, target.threadId]))
    .digest("hex");
  return join(directory, "listen-background", key, "state.json");
}
function saved() {
  return JSON.parse(readFileSync(stateFile(), "utf8"));
}
function untilStopped(signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve();
  return new Promise((resolve) =>
    signal.addEventListener("abort", () => resolve(), { once: true }),
  );
}
function running(
  run = async (signal: AbortSignal, ready: () => void) => {
    ready();
    await untilStopped(signal);
  },
  retryable = (_error: unknown) => false,
  options: {
    detached?: boolean;
    configuration?: string;
    failureCode?: (error: unknown) => BackgroundListenFailureCode;
  } = {},
) {
  const controller = new AbortController();
  const token = randomUUID();
  const done = runBackgroundListen({
    ...target,
    ...options,
    token,
    signal: controller.signal,
    heartbeatMs: 20,
    retryDelayMs: 10,
    run,
    retryable,
  });
  active.push({ controller, done });
  return { token, controller, done };
}

/** The synthetic relaunch's JSON lines: kills, starts and errors. */
function relaunchRows(path: string): Array<Record<string, unknown>> {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function childFiles() {
  for (const name of [
    "listen-background",
    "listen-state",
    "shared-mail-files",
    "notification-contact-policy",
    "notify-session-content",
    "contact-policy",
    "contact-rule-matcher",
  ]) {
    writeFileSync(
      join(directory, `${name}.js`),
      ts.transpileModule(
        readFileSync(resolve(`src/oclif/${name}.ts`), "utf8"),
        {
          compilerOptions: {
            target: ts.ScriptTarget.ES2022,
            module: ts.ModuleKind.ESNext,
          },
        },
      ).outputText,
    );
  }
  writeFileSync(
    join(directory, "package.json"),
    JSON.stringify({ type: "module" }),
  );
  symlinkSync(resolve("node_modules"), join(directory, "node_modules"));
  const child = join(directory, "synthetic-child.mjs");
  writeFileSync(
    child,
    `
    import { backgroundListenToken, runBackgroundListen } from './listen-background.js';
    if (process.env.PRIMITIVE_LISTEN_SUPERVISOR === '1') {
      const { runBackgroundListenSupervisor } = await import('./listen-background.js');
      await runBackgroundListenSupervisor({
        restartDelayMs: Number(process.env.TEST_RESTART_DELAY_MS) || undefined,
        cooldownMs: Number(process.env.TEST_COOLDOWN_MS) || undefined,
      });
      process.exit(0);
    }
    // A worker that lost its supervisor relaunches its own command with
    // --background, as the real CLI does.
    if (process.argv.includes('--background')) {
      const { startBackgroundListen } = await import('./listen-background.js');
      const { appendFileSync, readFileSync } = await import('node:fs');
      const relaunchTarget = JSON.parse(process.env.TEST_LISTEN_TARGET);
      const startedAt = Date.now();
      // The test reads this to know the relaunch has finished, and why not.
      const log = (row) => appendFileSync(process.env.TEST_RELAUNCH_LOG ?? '/dev/null', JSON.stringify({ after: Date.now() - startedAt, ...row }) + '\\n');
      // Kill the replacement's new worker after it reported ready and before
      // this start checks ownership, and wait until its supervisor reaped it.
      const beforeStartupCheck = process.env.TEST_KILL_READY_WORKER ? async () => {
        const { pid } = JSON.parse(readFileSync(process.env.TEST_KILL_READY_WORKER, 'utf8'));
        process.kill(pid, 'SIGKILL');
        const until = Date.now() + 5000;
        for (;;) {
          try { process.kill(pid, 0); } catch { break; }
          if (Date.now() > until) throw new Error('killed worker was not reaped');
          await new Promise(resolve => setTimeout(resolve, 5));
        }
        log({ killed: pid });
      } : undefined;
      try {
        await startBackgroundListen({ ...relaunchTarget, argv: [process.argv[1]], startupTimeoutMs: 5000,
          env: process.env.TEST_RELAUNCH_MODE ? { TEST_LISTEN_MODE: process.env.TEST_RELAUNCH_MODE } : undefined,
          beforeStartupCheck });
        log({ started: true });
      } catch (error) {
        log({ error: String(error?.message ?? error) });
        throw error;
      }
      process.exit(0);
    }
    import { appendFileSync, existsSync, writeFileSync } from 'node:fs';
    let policyModule;
    if (process.env.TEST_LISTEN_MODE === 'policy-retry' || process.env.TEST_EXPECT_AUTH) {
      const { register } = await import('tsx/esm/api');
      register();
    }
    if (process.env.TEST_LISTEN_MODE === 'policy-retry') {
      policyModule = await import('./notification-contact-policy.js');
    }
    const target = JSON.parse(process.env.TEST_LISTEN_TARGET);
    if (process.env.TEST_EXPECT_AUTH) {
      const { Parser } = await import('@oclif/core');
      const { default: ListenCommand } = await import(${JSON.stringify(pathToFileURL(resolve("src/oclif/commands/listen.ts")).href)});
      const { resolveCliAuth } = await import(${JSON.stringify(pathToFileURL(resolve("src/oclif/auth.ts")).href)});
      const { flags } = await Parser.parse(process.argv.slice(2), { flags: ListenCommand.flags });
      const auth = resolveCliAuth({ configDir: target.configDir, apiKey: flags['api-key'] });
      if (JSON.stringify([auth.apiKey ?? null, auth.source]) !== process.env.TEST_EXPECT_AUTH)
        throw new Error('child selected a different connection');
    }
    if (process.env.TEST_IPC_CAPTURE && process.send) {
      const send = process.send.bind(process);
      process.send = (...args) => {
        appendFileSync(process.env.TEST_IPC_CAPTURE, JSON.stringify(args[0]) + '\\n');
        return send(...args);
      };
    }
    // Workers that exit before reporting anything, every time or only once.
    if (process.env.TEST_EXIT_ALWAYS) process.exit(1);
    if (process.env.TEST_EXIT_ONCE && !existsSync(process.env.TEST_EXIT_ONCE)) {
      writeFileSync(process.env.TEST_EXIT_ONCE, 'exited');
      process.exit(1);
    }
    let attempts = 0;
    await runBackgroundListen({ ...target, token: backgroundListenToken(), detached: true,
      configuration: process.env.TEST_CONFIGURATION,
      heartbeatMs: 30, retryDelayMs: 250,
      retryable: error => (policyModule && error instanceof policyModule.ContactPolicyReadRetryError) || error?.message === 'synthetic-preflight',
      failureCode: () => process.env.TEST_FAILURE_CODE,
      run: async (signal, ready) => {
        if (process.env.TEST_RUN_MARKER) writeFileSync(process.env.TEST_RUN_MARKER, 'ran');
        if (process.argv.some(arg => arg.startsWith('--background') || arg.startsWith('--api-key')))
          throw new Error('private argument reached child');
        if (process.env.TEST_EXPECT_KEY && process.env.PRIMITIVE_API_KEY !== process.env.TEST_EXPECT_KEY)
          throw new Error('missing private environment override');
        if (process.env.TEST_LISTEN_MODE === 'retry' && attempts++ === 0) throw new Error('synthetic-preflight');
        if (process.env.TEST_LISTEN_MODE === 'policy-retry') {
          const policy = policyModule.createNotificationContactPolicy({
            recipient: 'agent@example.com',
            readPolicy: async () => {
              if (!existsSync(process.env.TEST_POLICY_RESTORED)) throw new policyModule.ContactPolicyReadRetryError();
              return JSON.parse(process.env.TEST_POLICY_DOCUMENT);
            },
            readPage: async () => ({ data: [], cursor: null }),
          });
          await policy.refresh(signal);
        }
        if (process.env.TEST_LISTEN_MODE === 'failed') throw new Error(process.env.TEST_FAILURE_DETAIL);
        if (process.env.TEST_LISTEN_MODE !== 'blocked') ready();
        if (!signal.aborted) await new Promise(resolve => signal.addEventListener('abort', resolve, { once: true }));
      }
    });
  `,
  );
  return child;
}

describe("listener lifecycle state", () => {
  it.skipIf(process.platform === "win32")(
    "keeps a readable config root unchanged while foreground state remains private",
    async () => {
      chmodSync(directory, 0o755);
      expect(backgroundListenStatus(target).reason).toBe("absent");
      expect((await stopBackgroundListen(target)).phase).toBeNull();
      const f = running();
      expect(backgroundListenStatus(target).phase).toBe("receiving");
      expect(statSync(directory).mode & 0o777).toBe(0o755);
      expect(statSync(join(directory, "listen-background")).mode & 0o777).toBe(
        0o700,
      );
      expect(statSync(join(stateFile(), "..")).mode & 0o777).toBe(0o700);
      expect(statSync(stateFile()).mode & 0o777).toBe(0o600);
      expect((await stopBackgroundListen(target, f.token)).phase).toBe(
        "stopped",
      );
      await f.done;
      expect(statSync(directory).mode & 0o777).toBe(0o755);
    },
  );

  it.skipIf(process.platform === "win32")(
    "refuses a config root writable by other users before creating listener state",
    async () => {
      chmodSync(directory, 0o775);
      expect(() => backgroundListenStatus(target)).toThrow("write access");
      await expect(stopBackgroundListen(target)).rejects.toThrow(
        "write access",
      );
      await expect(
        startBackgroundListen({ ...target, argv: ["unused"] }),
      ).rejects.toThrow("write access");
      expect(existsSync(join(directory, "listen-background"))).toBe(false);
    },
  );

  it("refuses a symlinked config root before reading or creating listener state", async () => {
    const link = join(directory, "config-link");
    symlinkSync(
      directory,
      link,
      process.platform === "win32" ? "junction" : "dir",
    );
    const linked = { ...target, configDir: link };
    expect(() => backgroundListenStatus(linked)).toThrow("symlink");
    await expect(stopBackgroundListen(linked)).rejects.toThrow("symlink");
    await expect(
      startBackgroundListen({ ...linked, argv: ["unused"] }),
    ).rejects.toThrow("symlink");
    expect(existsSync(join(directory, "listen-background"))).toBe(false);
  });

  it("keeps missing records distinct from receiving and records private verified foreground ownership", async () => {
    expect(backgroundListenStatus(target)).toMatchObject({
      phase: null,
      healthy: false,
      reason: "absent",
    });
    const f = running();
    expect(backgroundListenStatus(target)).toMatchObject({
      phase: "receiving",
      pid: process.pid,
      healthy: true,
      detached: false,
    });
    expect(statSync(stateFile()).mode & 0o777).toBe(0o600);
    expect(statSync(join(stateFile(), "..")).mode & 0o777).toBe(0o700);
    await stopBackgroundListen(target, f.token);
    await f.done;
    expect(backgroundListenStatus(target)).toMatchObject({
      phase: "stopped",
      healthy: false,
    });
  });

  it("rejects another owner and ignores a stop request for the wrong generation", async () => {
    const f = running();
    await expect(
      runBackgroundListen({
        ...target,
        token: randomUUID(),
        run: async () => {},
        retryable: () => false,
      }),
    ).rejects.toThrow("Another listener");
    await expect(stopBackgroundListen(target, randomUUID())).rejects.toThrow(
      "ownership changed",
    );
    writeFileSync(
      join(stateFile(), "..", "stop.json"),
      JSON.stringify({ token: randomUUID() }),
      { mode: 0o600 },
    );
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(backgroundListenStatus(target).phase).toBe("receiving");
    expect(saved().token).toBe(f.token);
  });

  it("refuses to reuse a foreground receiver for a background request", async () => {
    running();
    await expect(
      startBackgroundListen({ ...target, argv: ["unused"] }),
    ).rejects.toThrow("foreground listener");
    expect(backgroundListenStatus(target)).toMatchObject({
      healthy: true,
      detached: false,
    });
  });

  it("reuses only a detached worker with the same private configuration fingerprint", async () => {
    const configuration = createHash("sha256")
      .update("synthetic delivery options")
      .digest("hex");
    running(undefined, undefined, { detached: true, configuration });
    expect(
      await startBackgroundListen({
        ...target,
        argv: ["unused"],
        configuration,
      }),
    ).toMatchObject({
      started: false,
      status: { healthy: true, detached: true },
    });
    await expect(
      startBackgroundListen({
        ...target,
        argv: ["unused"],
        configuration: "f".repeat(64),
      }),
    ).rejects.toThrow("before changing receiving options");
    await expect(
      startBackgroundListen({ ...target, argv: ["unused"] }),
    ).rejects.toThrow("before changing receiving options");
    expect(saved().configuration).toBe(configuration);
    expect(readFileSync(stateFile(), "utf8")).not.toContain(
      "synthetic delivery options",
    );
    await expect(
      startBackgroundListen({
        ...target,
        argv: ["unused"],
        configuration: "raw options",
      }),
    ).rejects.toThrow("fingerprint is invalid");
  });

  it("fails closed for stale, reused, and unverifiable process identities", async () => {
    const f = running();
    const record = saved();
    writeFileSync(
      stateFile(),
      JSON.stringify({ ...record, updatedAt: Date.now() - 15_001 }),
    );
    expect(backgroundListenStatus(target)).toMatchObject({
      healthy: false,
      reason: "stale",
    });
    await expect(
      startBackgroundListen({ ...target, argv: ["unused"] }),
    ).rejects.toThrow("retained");
    writeFileSync(stateFile(), JSON.stringify(record));
    vi.mocked(listenProcessIdentity).mockReturnValue(null);
    expect(backgroundListenStatus(target)).toMatchObject({
      healthy: false,
      reason: "unverifiable",
    });
    await expect(stopBackgroundListen(target, f.token)).rejects.toThrow(
      "cannot be verified",
    );
    vi.mocked(listenProcessIdentity).mockReturnValue(
      `${record.identity}:reused`,
    );
    expect(backgroundListenStatus(target)).toMatchObject({
      healthy: false,
      reason: "exited",
    });
  });

  function writeSupervisor(token: string, phase: string, updatedAt: number) {
    writeMailJson(join(stateFile(), "..", "supervisor.json"), {
      version: 1,
      token,
      pid: process.pid,
      identity: listenProcessIdentity(process.pid),
      phase,
      updatedAt,
      failureCode: null,
    });
  }

  it("does not treat a supervisor heartbeat dated in the future as fresh", async () => {
    const f = running(undefined, undefined, { detached: true });
    await vi.waitFor(() => expect(saved().phase).toBe("receiving"));
    writeSupervisor(f.token, "running", Date.now() + 60_000);
    expect(backgroundListenStatus(target)).toMatchObject({
      healthy: false,
      reason: "stale",
    });
    writeSupervisor(f.token, "running", Date.now());
    expect(backgroundListenStatus(target)).toMatchObject({ healthy: true });
  });

  it("records an existing receiver it could neither verify nor stop, until that receiver recovers", async () => {
    const f = running(undefined, undefined, { detached: true });
    await vi.waitFor(() => expect(saved().phase).toBe("receiving"));
    writeSupervisor(f.token, "running", Date.now() - 60_000);
    await expect(
      startBackgroundListen({ ...target, argv: ["unused"] }),
    ).rejects.toThrow("stale or unverifiable");
    const current = backgroundListenStatus(target);
    expect(current).toMatchObject({
      reason: "stale",
      lastStartFailure: { reason: "existing-kept", failureCode: null },
    });
    expect(current.detail).toContain(
      "could not be verified or stopped, so it was left in place.",
    );
    // A healthy, receiving receiver makes the failed start history.
    writeSupervisor(f.token, "running", Date.now());
    expect(backgroundListenStatus(target)).toMatchObject({ healthy: true });
    expect(backgroundListenStatus(target)).not.toHaveProperty(
      "lastStartFailure",
    );
    writeSupervisor(f.token, "stopped", Date.now());
    f.controller.abort();
    await f.done;
  });

  it("replaces a worker whose supervisor has failed instead of reusing it", async () => {
    const f = running(undefined, undefined, { detached: true });
    await vi.waitFor(() => expect(saved().phase).toBe("receiving"));
    writeSupervisor(f.token, "failed", Date.now());
    const exits = join(directory, "exits.mjs");
    writeFileSync(exits, "process.exit(0);");
    // The orphan is stopped, then a fresh supervised start is attempted
    // (this fixture entrypoint exits before becoming ready).
    await expect(
      startBackgroundListen({ ...target, argv: [exits] }),
    ).rejects.toThrow("did not become ready");
    await f.done;
  });

  it("retains a live legacy macOS worker and stops only its private generation", async () => {
    vi.mocked(listenProcessIdentity).mockReturnValue(
      "darwin:1700000000:123:Wed Sep 9 12:34:56 2026",
    );
    const f = running();
    vi.mocked(listenProcessIdentity).mockReturnValue(
      "darwin-boot:0385d3d5-2a65-41bd-9596-c3dd32c06ddd:Wed Sep 9 12:34:56 2026",
    );
    expect(backgroundListenStatus(target)).toMatchObject({
      healthy: false,
      reason: "unverifiable",
    });
    await expect(
      startBackgroundListen({ ...target, argv: ["unused"] }),
    ).rejects.toThrow("retained");
    expect(await stopBackgroundListen(target, f.token)).toMatchObject({
      phase: "stopped",
      healthy: false,
    });
    await f.done;
  });

  it("retries only caller-classified safe failures and publishes reconnecting before receiving", async () => {
    let attempt = 0;
    const transient = new Error("synthetic preflight failure");
    let allowReady: () => void = () => {};
    const readyAllowed = new Promise<void>((resolve) => {
      allowReady = resolve;
    });
    const f = running(
      async (signal, ready) => {
        if (++attempt === 1) throw transient;
        await readyAllowed;
        ready();
        await untilStopped(signal);
      },
      (error) => error === transient,
    );
    await vi.waitFor(() =>
      expect(backgroundListenStatus(target).phase).toBe("reconnecting"),
    );
    allowReady();
    await vi.waitFor(() =>
      expect(backgroundListenStatus(target).phase).toBe("receiving"),
    );
    expect(attempt).toBe(2);
    f.controller.abort();
    await f.done;
  });

  it("keeps receiving through a full disk and resumes its heartbeat afterwards", async () => {
    let aborted = false;
    const f = running(async (signal, ready) => {
      ready();
      await untilStopped(signal);
      aborted = true;
    });
    await vi.waitFor(() =>
      expect(backgroundListenStatus(target).phase).toBe("receiving"),
    );
    storage.failWrites = "ENOSPC";
    const frozen = saved().updatedAt;
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(aborted).toBe(false);
    expect(saved().updatedAt).toBe(frozen);
    storage.failWrites = null;
    await vi.waitFor(() => expect(saved().updatedAt).toBeGreaterThan(frozen));
    expect(backgroundListenStatus(target)).toMatchObject({
      phase: "receiving",
      healthy: true,
    });
    f.controller.abort();
    await f.done;
  });

  it("keeps receiving when reading its own state fails on a failing disk", async () => {
    let aborted = false;
    const f = running(async (signal, ready) => {
      ready();
      await untilStopped(signal);
      aborted = true;
    });
    await vi.waitFor(() =>
      expect(backgroundListenStatus(target).phase).toBe("receiving"),
    );
    storage.failReads = "EIO";
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(aborted).toBe(false);
    storage.failReads = null;
    expect(backgroundListenStatus(target)).toMatchObject({
      phase: "receiving",
      healthy: true,
    });
    f.controller.abort();
    await f.done;
  });

  it("keeps a filesystem errno, and nothing else, on a failed private read", () => {
    const file = join(directory, "plain.json");
    writeFileSync(file, "{}", { mode: 0o600 });
    const error = (() => {
      try {
        readMailJson(join(file, "child.json"));
      } catch (caught) {
        return caught as Error;
      }
    })();
    expect(error?.cause).toEqual({ code: "ENOTDIR" });
    expect(String(error?.message)).not.toContain(directory);
  });

  it.skipIf(process.platform === "win32")(
    "retries replacing a lost supervisor after a refused restart claim",
    async () => {
      const token = randomUUID();
      vi.stubEnv("PRIMITIVE_LISTEN_SUPERVISOR_WORKER", token);
      const relaunch = vi.fn();
      const controller = new AbortController();
      const done = runBackgroundListen({
        ...target,
        token,
        signal: controller.signal,
        heartbeatMs: 50,
        retryDelayMs: 10,
        relaunchSupervisor: relaunch,
        run: async (signal, ready) => {
          ready();
          await untilStopped(signal);
        },
        retryable: () => false,
      });
      active.push({ controller, done });
      await vi.waitFor(() =>
        expect(backgroundListenStatus(target).phase).toBe("receiving"),
      );
      // Another restart took the slot moments ago; it frees in about a second.
      const directoryPath = join(stateFile(), "..");
      writeMailJson(join(directoryPath, "restart.json"), {
        at: Date.now() - BACKGROUND_HEAL_INTERVAL_MS + 1000,
      });
      const dead = deadPid();
      writeMailJson(join(directoryPath, "supervisor.json"), {
        version: 1,
        token,
        pid: dead,
        identity: `synthetic:${dead}`,
        phase: "running",
        updatedAt: Date.now() - 60_000,
        failureCode: null,
      });
      await new Promise((resolve) => setTimeout(resolve, 500));
      expect(relaunch).not.toHaveBeenCalled();
      await vi.waitFor(() => expect(relaunch).toHaveBeenCalledOnce(), {
        timeout: 8000,
      });
      controller.abort();
      await done;
    },
    15_000,
  );

  it("refuses a restart claim while another claimant holds the claim lock", () => {
    const now = Date.now();
    expect(claimBackgroundListenRestart(target, now)).toBe(true);
    const release = acquireListenLock(
      join(stateFile(), ".."),
      "background-restart-claim",
    );
    try {
      expect(
        claimBackgroundListenRestart(
          target,
          now + 2 * BACKGROUND_HEAL_INTERVAL_MS,
        ),
      ).toBe(false);
    } finally {
      release();
    }
    expect(
      claimBackgroundListenRestart(
        target,
        now + 2 * BACKGROUND_HEAL_INTERVAL_MS,
      ),
    ).toBe(true);
  });

  it.each([
    ["ENOSPC", "disk-full"],
    ["EDQUOT", "disk-full"],
    ["EIO", "storage-unavailable"],
  ] as const)(
    "records %s from the receiver as %s with guidance",
    async (code, failureCode) => {
      const primary = Object.assign(new Error("synthetic write failure"), {
        code,
      });
      const f = running(async () => {
        throw primary;
      });
      await expect(f.done).rejects.toBe(primary);
      const current = backgroundListenStatus(target);
      expect(current).toMatchObject({
        phase: "failed",
        reason: "failed",
        healthy: false,
        failureCode,
      });
      expect(current.detail).toContain("new mail is not reaching this session");
      expect(backgroundListenRestartable(current)).toBe(true);
    },
  );

  it("keeps a holding failure code over a storage classification", async () => {
    const primary = Object.assign(new Error("synthetic"), { code: "ENOSPC" });
    const f = running(
      async () => {
        throw primary;
      },
      () => false,
      { failureCode: () => "notification-outcome-unknown" },
    );
    await expect(f.done).rejects.toBe(primary);
    const current = backgroundListenStatus(target);
    expect(current.failureCode).toBe("notification-outcome-unknown");
    expect(backgroundListenRestartable(current)).toBe(false);
  });

  it("reads a failure code from a newer CLI without rejecting the record or restarting it", async () => {
    const f = running();
    await vi.waitFor(() =>
      expect(backgroundListenStatus(target).phase).toBe("receiving"),
    );
    f.controller.abort();
    await f.done;
    writeFileSync(
      stateFile(),
      JSON.stringify({
        ...saved(),
        phase: "failed",
        failureCode: "some-future-code",
      }),
    );
    const current = backgroundListenStatus(target);
    expect(current).toMatchObject({
      phase: "failed",
      failureCode: "unrecognized",
    });
    // A newer CLI's code may be a deliberate hold, so it is never auto-restarted.
    expect(backgroundListenRestartable(current)).toBe(false);
  });

  it("reads a start failure saved by a newer CLI and ignores an unreadable one", () => {
    const path = join(stateFile(), "..", "start-failure.json");
    writeMailJson(path, {
      version: 1,
      at: 1_700_000_000_000,
      reason: "some-future-reason",
      failureCode: "some-future-code",
      extra: "ignored",
    });
    expect(backgroundListenStatus(target)).toMatchObject({
      reason: "absent",
      healthy: false,
      lastStartFailure: {
        at: 1_700_000_000_000,
        reason: "unrecognized",
        failureCode: "unrecognized",
      },
    });
    expect(backgroundListenStatus(target).detail).toContain(
      "The last background start, at 2023-11-14T22:13:20.000Z, failed",
    );
    // Past the latest time a Date can hold: ignored rather than fatal.
    writeMailJson(path, {
      version: 1,
      at: 9e15,
      reason: "timed-out",
      failureCode: null,
    });
    expect(backgroundListenStatus(target)).not.toHaveProperty(
      "lastStartFailure",
    );
    writeFileSync(path, "not json", { mode: 0o600 });
    const unreadable = backgroundListenStatus(target);
    expect(unreadable).toMatchObject({ reason: "absent" });
    expect(unreadable).not.toHaveProperty("lastStartFailure");
  });

  it("allows one external restart per interval and refuses when the claim cannot be saved", () => {
    const now = Date.now();
    expect(claimBackgroundListenRestart(target, now)).toBe(true);
    expect(claimBackgroundListenRestart(target, now + 1000)).toBe(false);
    expect(
      claimBackgroundListenRestart(target, now + BACKGROUND_HEAL_INTERVAL_MS),
    ).toBe(true);
    storage.failWrites = "ENOSPC";
    expect(
      claimBackgroundListenRestart(
        target,
        now + 3 * BACKGROUND_HEAL_INTERVAL_MS,
      ),
    ).toBe(false);
  });

  it("keeps an unknown dispatch failure terminal when stop arrives concurrently", async () => {
    let reject: (error: Error) => void = () => {};
    const unknown = new ListenStateError(
      "Synthetic unknown submission outcome",
    );
    const f = running(async (_signal, ready) => {
      ready();
      await new Promise<void>((_resolve, no) => {
        reject = no;
      });
    });
    const result = expect(f.done).rejects.toBe(unknown);
    f.controller.abort();
    reject(unknown);
    await result;
    expect(backgroundListenStatus(target).phase).toBe("failed");
    expect(readFileSync(stateFile(), "utf8")).not.toContain(unknown.message);
  });

  it("preserves a receiver failure when private stop cleanup also fails", async () => {
    let reject: (error: Error) => void = () => {};
    const primary = new ListenStateError(
      "Synthetic unknown submission outcome",
    );
    const f = running(async (_signal, ready) => {
      ready();
      await new Promise<void>((_resolve, no) => {
        reject = no;
      });
    });
    writeFileSync(join(stateFile(), "..", "stop.json"), "invalid", {
      mode: 0o600,
    });
    const result = expect(f.done).rejects.toBe(primary);
    reject(primary);
    await result;
    expect(backgroundListenStatus(target).phase).toBe("failed");
  });

  it.each(["throws", "returns private text"])(
    "preserves the primary failure and stores only a safe code when classification %s",
    async (mode) => {
      const privateText = `private-detail-${randomUUID()}`;
      const primary = new Error(privateText);
      const f = running(
        async () => {
          throw primary;
        },
        () => false,
        {
          failureCode: () => {
            if (mode === "throws") throw new Error(privateText);
            return privateText as BackgroundListenFailureCode;
          },
        },
      );
      await expect(f.done).rejects.toBe(primary);
      expect(backgroundListenStatus(target)).toMatchObject({
        phase: "failed",
        failureCode: "receiving-failed",
      });
      expect(readFileSync(stateFile(), "utf8")).not.toContain(privateText);
    },
  );

  it("rejects a symlinked lifecycle directory during status and stop", async () => {
    const f = running();
    f.controller.abort();
    await f.done;
    const root = join(directory, "listen-background");
    const moved = join(directory, "moved-background");
    renameSync(root, moved);
    symlinkSync(moved, root, process.platform === "win32" ? "junction" : "dir");
    expect(() => backgroundListenStatus(target)).toThrow();
    await expect(stopBackgroundListen(target)).rejects.toThrow();
  });

  it("never overwrites a replacement token while cleaning up an old worker", async () => {
    const f = running();
    const next = { ...saved(), token: randomUUID() };
    writeFileSync(stateFile(), JSON.stringify(next));
    const result = expect(f.done).rejects.toThrow("ownership changed");
    f.controller.abort();
    await result;
    expect(saved().token).toBe(next.token);
  });

  it("requires a complete parent expectation and compares canonical selection before child state", async () => {
    const token = randomUUID();
    const configuration = createHash("sha256")
      .update("synthetic options")
      .digest("hex");
    const expectation = {
      ...target,
      configDir: realpathSync(target.configDir),
      configuration,
    };
    const env = {
      [BACKGROUND_LISTEN_TOKEN_ENV]: token,
      [BACKGROUND_LISTEN_TARGET_ENV]: JSON.stringify(expectation),
    };
    expect(() =>
      verifyBackgroundListenTarget({ ...target, configuration }, env),
    ).not.toThrow();
    expect(() =>
      verifyBackgroundListenTarget(
        { ...target, configDir: `${directory}/.`, configuration },
        env,
      ),
    ).not.toThrow();
    expect(() => verifyBackgroundListenTarget(target, {})).not.toThrow();
    for (const value of [
      undefined,
      "invalid",
      "{}",
      JSON.stringify({ ...expectation, configuration: 1 }),
    ]) {
      expect(() =>
        verifyBackgroundListenTarget(
          { ...target, configuration },
          {
            ...env,
            [BACKGROUND_LISTEN_TARGET_ENV]: value,
          },
        ),
      ).toThrow("parent expectation is invalid");
    }
    for (const change of [
      { scope: "replaced-profile-scope" },
      { threadId: randomUUID() },
      { configDir: join(directory, "other-config") },
      { configuration: "f".repeat(64) },
    ]) {
      expect(() =>
        verifyBackgroundListenTarget(
          { ...target, configuration, ...change },
          env,
        ),
      ).toThrow("target changed");
    }
    vi.stubEnv(BACKGROUND_LISTEN_TOKEN_ENV, token);
    vi.stubEnv(BACKGROUND_LISTEN_TARGET_ENV, JSON.stringify(expectation));
    const run = vi.fn(async () => {});
    await expect(
      runBackgroundListen({
        ...target,
        scope: "replaced-profile-scope",
        configuration,
        token,
        run,
        retryable: () => false,
      }),
    ).rejects.toThrow("target changed");
    expect(run).not.toHaveBeenCalled();
    expect(existsSync(join(directory, "listen-background"))).toBe(false);
  });

  it("validates child tokens without accepting empty or malformed ownership", () => {
    expect(backgroundListenToken({})).toBeNull();
    const token = randomUUID();
    expect(
      backgroundListenToken({ [BACKGROUND_LISTEN_TOKEN_ENV]: token }),
    ).toBe(token);
    expect(() =>
      backgroundListenToken({ [BACKGROUND_LISTEN_TOKEN_ENV]: "" }),
    ).toThrow();
  });
});

describe("detached synthetic listener processes", () => {
  describe.each([false, true])("saved login: %s", (savedLogin) => {
    it.each([
      ["no override", []],
      ["split empty", ["--api-key", ""]],
      ["split whitespace", ["--api-key", " \t "]],
      ["equals empty", ["--api-key="]],
      ["equals whitespace", ["--api-key= \t "]],
    ])(
      "keeps the parsed parent and detached child identity equal for %s",
      async (_name, keyArgs) => {
        const inherited = ["inert", "inherited"].join("-");
        const stored = ["inert", "stored"].join("-");
        vi.stubEnv("PRIMITIVE_API_KEY", inherited);
        if (savedLogin)
          saveCliCredentials(directory, {
            auth_method: "oauth",
            access_token: stored,
            refresh_token: ["inert", "refresh"].join("-"),
            token_type: "Bearer",
            expires_at: "2099-01-01T00:00:00.000Z",
            oauth_grant_id: randomUUID(),
            oauth_client_id: "fixture",
            org_id: randomUUID(),
            org_name: null,
            api_base_url: "https://example.test/v1",
            created_at: "2026-01-01T00:00:00.000Z",
          });
        if (process.platform !== "win32") chmodSync(directory, 0o755);
        const argv = [
          "--background",
          "--notify-session",
          target.threadId,
          "--sender",
          "owner@example.com",
          ...keyArgs,
        ];
        const parsed = await Parser.parse(argv, { flags: ListenCommand.flags });
        const auth = resolveCliAuth({
          configDir: directory,
          apiKey: parsed.flags["api-key"],
        });
        expect([auth.apiKey, auth.source]).toEqual(
          !keyArgs.length
            ? [inherited, "flag-or-env"]
            : savedLogin
              ? [stored, "stored"]
              : [undefined, "none"],
        );
        const result = await startBackgroundListen({
          ...target,
          argv: [childFiles(), ...argv],
          env: {
            TEST_LISTEN_TARGET: JSON.stringify(target),
            TEST_EXPECT_AUTH: JSON.stringify([
              auth.apiKey ?? null,
              auth.source,
            ]),
          },
          startupTimeoutMs: 5000,
        });
        expect(result.status).toMatchObject({
          phase: "receiving",
          healthy: true,
          detached: true,
        });
        expect(readFileSync(stateFile(), "utf8")).not.toContain(inherited);
        expect(readFileSync(stateFile(), "utf8")).not.toContain(stored);
        expect((await stopBackgroundListen(target)).phase).toBe("stopped");
        if (process.platform !== "win32")
          expect(statSync(directory).mode & 0o777).toBe(0o755);
      },
    );
  });

  it("reports startup policy retries before readiness times out and receives after restoration", async () => {
    const restored = join(directory, "policy-restored");
    const result = await startBackgroundListen({
      ...target,
      argv: [childFiles()],
      env: {
        TEST_LISTEN_TARGET: JSON.stringify(target),
        TEST_LISTEN_MODE: "policy-retry",
        TEST_POLICY_RESTORED: restored,
        TEST_POLICY_DOCUMENT: JSON.stringify(
          emptyContactPolicy("agent@example.com"),
        ),
      },
      startupTimeoutMs: 1500,
    });
    expect(result.status.phase).toBe("reconnecting");
    expect(backgroundListenStatus(target).phase).toBe("reconnecting");
    writeFileSync(restored, "ready");
    await vi.waitFor(
      () =>
        expect(backgroundListenStatus(target)).toMatchObject({
          phase: "receiving",
          healthy: true,
        }),
      { timeout: 3000 },
    );
    expect((await stopBackgroundListen(target)).phase).toBe("stopped");
  }, 10_000);

  it.each([
    ["native-session-unavailable", "same native session"],
    ["notification-outcome-unknown", "do not delete receipts"],
    ["connection-changed", "profile and API origin"],
    ["receiving-failed", "without --background"],
  ] as const)(
    "reports safe %s diagnostics in startup, state and IPC",
    async (code, guidance) => {
      const child = childFiles();
      const privateText = `private-detail-${randomUUID()}`;
      const capture = join(directory, "ipc.jsonl");
      const result = await startBackgroundListen({
        ...target,
        argv: [child],
        env: {
          TEST_LISTEN_TARGET: JSON.stringify(target),
          TEST_LISTEN_MODE: "failed",
          TEST_FAILURE_CODE: code,
          TEST_FAILURE_DETAIL: privateText,
          TEST_IPC_CAPTURE: capture,
        },
        startupTimeoutMs: 5000,
      }).catch((error: unknown) => error);
      expect(result).toBeInstanceOf(ListenStateError);
      expect((result as Error).message).toContain(guidance);
      expect((result as Error).message).not.toContain(privateText);
      expect(backgroundListenStatus(target)).toMatchObject({
        phase: "failed",
        failureCode: code,
        healthy: false,
      });
      expect(readFileSync(stateFile(), "utf8")).not.toContain(privateText);
      const ipc = readFileSync(capture, "utf8");
      expect(ipc).not.toContain(privateText);
      const failure = ipc
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line))
        .find((event) => event.phase === "failed");
      expect(failure).toEqual({
        type: "primitive-listen-state",
        token: saved().token,
        phase: "failed",
        failureCode: code,
      });
    },
    10_000,
  );

  it("serializes concurrent starts, keeps credentials out of argv/state, and reuses one owned worker", async () => {
    const child = childFiles();
    const key = ["inert", "override"].join("-");
    const options = {
      ...target,
      argv: [child, "--background", "--api-key", key],
      env: { TEST_LISTEN_TARGET: JSON.stringify(target), TEST_EXPECT_KEY: key },
      startupTimeoutMs: 5000,
    };
    const results = await Promise.all([
      startBackgroundListen(options),
      startBackgroundListen(options),
    ]);
    expect(results.map((result) => result.started).sort()).toEqual([
      false,
      true,
    ]);
    expect(new Set(results.map((result) => result.status.pid)).size).toBe(1);
    expect(results[0]?.status).toMatchObject({
      phase: "receiving",
      healthy: true,
      detached: true,
    });
    expect(readFileSync(stateFile(), "utf8")).not.toContain(key);
    expect((await stopBackgroundListen(target)).phase).toBe("stopped");
  }, 15_000);

  it("survives the launching parent exiting and reports safe reconnecting truthfully", async () => {
    const child = childFiles();
    const launcher = join(directory, "synthetic-parent.mjs");
    writeFileSync(
      launcher,
      `
      import { startBackgroundListen } from './listen-background.js';
      const target = JSON.parse(process.env.TEST_LISTEN_TARGET);
      const result = await startBackgroundListen({ ...target, argv: [process.env.TEST_LISTEN_CHILD], env: { TEST_LISTEN_MODE: 'retry' } });
      process.stdout.write(JSON.stringify(result));
    `,
    );
    const { stdout } = await promisify(execFile)(process.execPath, [launcher], {
      env: {
        ...process.env,
        TEST_LISTEN_TARGET: JSON.stringify(target),
        TEST_LISTEN_CHILD: child,
      },
      timeout: 10_000,
    });
    expect(JSON.parse(stdout).status.phase).toBe("reconnecting");
    await vi.waitFor(() =>
      expect(backgroundListenStatus(target)).toMatchObject({
        phase: "receiving",
        healthy: true,
        detached: true,
      }),
    );
    expect((await stopBackgroundListen(target)).phase).toBe("stopped");
  }, 15_000);

  it.skipIf(process.platform === "win32")(
    "restarts a worker that exits unexpectedly and stops the supervisor explicitly",
    async () => {
      const child = childFiles();
      const result = await startBackgroundListen({
        ...target,
        argv: [child],
        env: { TEST_LISTEN_TARGET: JSON.stringify(target) },
        startupTimeoutMs: 5000,
      });
      const firstPid = result.status.pid;
      expect(result.status.supervisorPid).toBeGreaterThan(0);
      expect(firstPid).toBeGreaterThan(0);
      process.kill(firstPid as number, "SIGKILL");
      await vi.waitFor(
        () => {
          const current = backgroundListenStatus(target);
          expect(current).toMatchObject({ phase: "receiving", healthy: true });
          expect(current.pid).not.toBe(firstPid);
        },
        { timeout: 5000 },
      );
      expect((await stopBackgroundListen(target)).reason).toBe("stopped");
      const stoppedPid = backgroundListenStatus(target).pid;
      await new Promise((resolve) => setTimeout(resolve, 1200));
      expect(backgroundListenStatus(target).pid).toBe(stoppedPid);
    },
    12_000,
  );

  it.skipIf(process.platform === "win32")(
    "keeps restarting on a slow cooldown after five unexpected exits instead of giving up",
    async () => {
      const child = childFiles();
      const result = await startBackgroundListen({
        ...target,
        argv: [child],
        env: {
          TEST_LISTEN_TARGET: JSON.stringify(target),
          TEST_RESTART_DELAY_MS: "50",
          TEST_COOLDOWN_MS: "2500",
        },
        startupTimeoutMs: 5000,
      });
      const supervisorPid = result.status.supervisorPid;
      let pid = result.status.pid as number;
      for (let exit = 1; exit <= 5; exit++) {
        process.kill(pid, "SIGKILL");
        if (exit < 5) {
          await vi.waitFor(
            () => {
              const current = backgroundListenStatus(target);
              expect(current).toMatchObject({
                phase: "receiving",
                healthy: true,
                failureCode: null,
              });
              expect(current.pid).not.toBe(pid);
            },
            { timeout: 10_000 },
          );
          pid = backgroundListenStatus(target).pid as number;
        }
      }
      // An exit nobody reported is recorded as a crash, and status says the
      // receiver is coming back rather than gone for good.
      await vi.waitFor(
        () =>
          expect(backgroundListenStatus(target)).toMatchObject({
            phase: "reconnecting",
            reason: "restarting",
            healthy: false,
            failureCode: "crashed",
            supervisorPid,
          }),
        { timeout: 2000 },
      );
      expect(backgroundListenStatus(target).detail).toContain("restarting");
      await vi.waitFor(
        () => {
          const current = backgroundListenStatus(target);
          expect(current).toMatchObject({
            phase: "receiving",
            healthy: true,
            failureCode: null,
            supervisorPid,
          });
          expect(current.pid).not.toBe(pid);
        },
        { timeout: 8000 },
      );
      expect((await stopBackgroundListen(target)).phase).toBe("stopped");
    },
    30_000,
  );

  it.skipIf(process.platform === "win32")(
    "replaces a supervisor that was killed while its worker kept receiving",
    async () => {
      const child = childFiles();
      const relaunchLog = join(directory, "relaunch.log");
      const result = await startBackgroundListen({
        ...target,
        argv: [child],
        env: {
          TEST_LISTEN_TARGET: JSON.stringify(target),
          TEST_RELAUNCH_LOG: relaunchLog,
        },
        startupTimeoutMs: 5000,
      });
      const supervisorPid = result.status.supervisorPid as number;
      expect(supervisorPid).toBeGreaterThan(0);
      const startedAt = Date.now();
      // Everything that says why the replacement is not healthy. Built only
      // once a check has failed: reading it on every poll shifts the timing
      // this test depends on.
      const diagnosis = () => {
        const folder = join(stateFile(), "..");
        const read = (name: string) => {
          try {
            return readFileSync(join(folder, name), "utf8");
          } catch {
            return null;
          }
        };
        return JSON.stringify({
          ms: Date.now() - startedAt,
          status: backgroundListenStatus(target),
          supervisor: read("supervisor.json"),
          state: read("state.json"),
          stop: read("stop.json"),
          restart: read("restart.json"),
          relaunch: existsSync(relaunchLog)
            ? readFileSync(relaunchLog, "utf8")
            : null,
        });
      };
      const explained = (check: () => void) => () => {
        try {
          check();
        } catch (error) {
          throw new Error(`${(error as Error).message}\n${diagnosis()}`);
        }
      };
      const relaunched = () =>
        existsSync(relaunchLog) &&
        readFileSync(relaunchLog, "utf8").includes('"started":true');
      process.kill(supervisorPid, "SIGKILL");
      await vi.waitFor(
        explained(() => {
          const current = backgroundListenStatus(target);
          expect(current).toMatchObject({ phase: "receiving", healthy: true });
          expect(current.supervisorPid).toBeGreaterThan(0);
          expect(current.supervisorPid).not.toBe(supervisorPid);
          // The relaunching command checks the new worker after it reports
          // receiving, and stops the new supervisor if that worker is gone by
          // then. Killing the worker before that check has finished tests the
          // relaunch failing, not the replacement restarting its worker.
          expect(relaunched()).toBe(true);
        }),
        { timeout: 15_000 },
      );
      // The replacement is a normal supervisor: it restarts its own worker.
      const replaced = backgroundListenStatus(target);
      process.kill(replaced.pid as number, "SIGKILL");
      await vi.waitFor(
        explained(() => {
          const current = backgroundListenStatus(target);
          expect(current).toMatchObject({ phase: "receiving", healthy: true });
          expect(current.pid).not.toBe(replaced.pid);
          expect(current.supervisorPid).toBe(replaced.supervisorPid);
        }),
        { timeout: 10_000 },
      );
      expect((await stopBackgroundListen(target)).phase).toBe("stopped");
    },
    40_000,
  );

  it.skipIf(process.platform === "win32")(
    "keeps a supervised start whose worker dies between reporting ready and the ownership check",
    async () => {
      const child = childFiles();
      let killed = 0;
      const result = await startBackgroundListen({
        ...target,
        argv: [child],
        env: { TEST_LISTEN_TARGET: JSON.stringify(target) },
        startupTimeoutMs: 5000,
        beforeStartupCheck: async () => {
          killed = saved().pid;
          process.kill(killed, "SIGKILL");
          // Until its supervisor reaps it, a killed worker still looks alive.
          for (;;) {
            try {
              process.kill(killed, 0);
            } catch {
              break;
            }
            await new Promise((resolve) => setTimeout(resolve, 5));
          }
        },
      });
      expect(killed).toBeGreaterThan(0);
      // The supervisor owns the restart; the start no longer stops it.
      expect(result).toMatchObject({
        started: true,
        status: { healthy: false, reason: "restarting" },
      });
      expect(result.status).not.toHaveProperty("lastStartFailure");
      await vi.waitFor(
        () => {
          const current = backgroundListenStatus(target);
          expect(current).toMatchObject({
            phase: "receiving",
            healthy: true,
            supervisorPid: result.status.supervisorPid,
          });
          expect(current.pid).not.toBe(killed);
        },
        { timeout: 8000 },
      );
      expect((await stopBackgroundListen(target)).phase).toBe("stopped");
    },
    15_000,
  );

  it.skipIf(process.platform === "win32")(
    "keeps a running supervisor when its records cannot be read to confirm the start",
    async () => {
      const child = childFiles();
      let supervisorPid = 0;
      const error = await startBackgroundListen({
        ...target,
        argv: [child],
        env: { TEST_LISTEN_TARGET: JSON.stringify(target) },
        startupTimeoutMs: 5000,
        beforeStartupCheck: () => {
          supervisorPid = JSON.parse(
            readFileSync(join(stateFile(), "..", "supervisor.json"), "utf8"),
          ).pid;
          // Only this process's reads fail, as on a briefly failing disk.
          storage.failReads = "EIO";
        },
      }).catch((caught: unknown) => caught);
      storage.failReads = null;
      expect(error).toBeInstanceOf(ListenStateError);
      expect((error as Error).message).toContain(
        "could not be confirmed because its records could not be read. Its supervisor is still running",
      );
      expect(existsSync(join(stateFile(), "..", "stop.json"))).toBe(false);
      // The reason is saved even after a ready report, since ready can mean
      // reconnecting or the worker can exit after it ...
      expect(existsSync(join(stateFile(), "..", "start-failure.json"))).toBe(
        true,
      );
      await vi.waitFor(
        () =>
          expect(backgroundListenStatus(target)).toMatchObject({
            phase: "receiving",
            healthy: true,
            supervisorPid,
          }),
        { timeout: 5000 },
      );
      // ... and the supervisor clears it while its worker is receiving.
      await vi.waitFor(
        () =>
          expect(
            existsSync(join(stateFile(), "..", "start-failure.json")),
          ).toBe(false),
        { timeout: 5000 },
      );
      expect((await stopBackgroundListen(target)).phase).toBe("stopped");
    },
    15_000,
  );

  it.skipIf(process.platform === "win32")(
    "keeps a replacement supervisor whose new worker dies right after it reports ready",
    async () => {
      const child = childFiles();
      const relaunchLog = join(directory, "relaunch.log");
      const result = await startBackgroundListen({
        ...target,
        argv: [child],
        env: {
          TEST_LISTEN_TARGET: JSON.stringify(target),
          TEST_RELAUNCH_LOG: relaunchLog,
          // Read only by the relaunch: kill its first worker inside the window.
          TEST_KILL_READY_WORKER: stateFile(),
        },
        startupTimeoutMs: 5000,
      });
      const lostSupervisor = result.status.supervisorPid as number;
      const firstWorker = result.status.pid;
      process.kill(lostSupervisor, "SIGKILL");
      let killed = 0;
      await vi.waitFor(
        () => {
          const row = relaunchRows(relaunchLog).find((item) => item.killed);
          expect(row, JSON.stringify(relaunchRows(relaunchLog))).toBeDefined();
          killed = Number(row?.killed);
        },
        { timeout: 15_000 },
      );
      expect(killed).not.toBe(firstWorker);
      await vi.waitFor(
        () =>
          expect(relaunchRows(relaunchLog)).toContainEqual(
            expect.objectContaining({ started: true }),
          ),
        { timeout: 5000 },
      );
      await vi.waitFor(
        () => {
          const current = backgroundListenStatus(target);
          expect(current, JSON.stringify(current)).toMatchObject({
            phase: "receiving",
            healthy: true,
          });
          expect(current.supervisorPid).not.toBe(lostSupervisor);
          expect(current.pid).not.toBe(killed);
          expect(current.pid).not.toBe(firstWorker);
        },
        { timeout: 10_000 },
      );
      expect(backgroundListenStatus(target)).not.toHaveProperty(
        "lastStartFailure",
      );
      expect((await stopBackgroundListen(target)).phase).toBe("stopped");
    },
    40_000,
  );

  it.skipIf(process.platform === "win32")(
    "records a failed relaunch where status shows it, and a later start clears it",
    async () => {
      const child = childFiles();
      const relaunchLog = join(directory, "relaunch.log");
      const privateText = `private-detail-${randomUUID()}`;
      const result = await startBackgroundListen({
        ...target,
        argv: [child],
        env: {
          TEST_LISTEN_TARGET: JSON.stringify(target),
          TEST_RELAUNCH_LOG: relaunchLog,
          // Only the replacement's worker fails.
          TEST_RELAUNCH_MODE: "failed",
          TEST_FAILURE_CODE: "native-session-unavailable",
          TEST_FAILURE_DETAIL: privateText,
        },
        startupTimeoutMs: 5000,
      });
      const lostAt = Date.now();
      process.kill(result.status.supervisorPid as number, "SIGKILL");
      // The relaunching process exits with its error unread; the record stays.
      await vi.waitFor(
        () =>
          expect(relaunchRows(relaunchLog)).toContainEqual(
            expect.objectContaining({
              error: expect.stringContaining("did not become ready"),
            }),
          ),
        { timeout: 15_000 },
      );
      await vi.waitFor(
        () =>
          expect(backgroundListenStatus(target)).toMatchObject({
            healthy: false,
            reason: "stopped",
            lastStartFailure: {
              reason: "worker-failed",
              failureCode: "native-session-unavailable",
            },
          }),
        { timeout: 5000 },
      );
      const current = backgroundListenStatus(target);
      expect(current.lastStartFailure?.at).toBeGreaterThanOrEqual(lostAt);
      expect(current.detail).toContain(
        "failed: the receiver reported a failure while starting. Start it again with the same listen command",
      );
      expect(JSON.stringify(current)).not.toContain(privateText);
      expect(
        readFileSync(join(stateFile(), "..", "start-failure.json"), "utf8"),
      ).not.toContain(privateText);
      // A stopped receiver is not restarted on its own; the owner starts it.
      expect(backgroundListenRestartable(current)).toBe(false);
      const again = await startBackgroundListen({
        ...target,
        argv: [child],
        env: { TEST_LISTEN_TARGET: JSON.stringify(target) },
        startupTimeoutMs: 5000,
      });
      expect(again).toMatchObject({
        started: true,
        status: { phase: "receiving", healthy: true },
      });
      expect(again.status).not.toHaveProperty("lastStartFailure");
      expect(existsSync(join(stateFile(), "..", "start-failure.json"))).toBe(
        false,
      );
      expect((await stopBackgroundListen(target)).phase).toBe("stopped");
    },
    40_000,
  );

  it.skipIf(process.platform === "win32")(
    "keeps supervising through a full disk instead of exiting",
    async () => {
      const child = childFiles();
      const token = randomUUID();
      vi.stubEnv(BACKGROUND_LISTEN_TOKEN_ENV, token);
      vi.stubEnv(
        BACKGROUND_LISTEN_TARGET_ENV,
        JSON.stringify({
          scope: target.scope,
          threadId: target.threadId,
          configDir: realpathSync(directory),
          configuration: null,
        }),
      );
      vi.stubEnv("PRIMITIVE_LISTEN_SUPERVISOR_ARGV", JSON.stringify([child]));
      vi.stubEnv("TEST_LISTEN_TARGET", JSON.stringify(target));
      let settled = false;
      const done = runBackgroundListenSupervisor({
        restartDelayMs: 50,
      }).finally(() => {
        settled = true;
      });
      await vi.waitFor(
        () =>
          expect(backgroundListenStatus(target)).toMatchObject({
            phase: "receiving",
            healthy: true,
          }),
        { timeout: 5000 },
      );
      // Only this process's writes fail: the supervisor's heartbeat and its
      // stop handling. Before this was tolerated, the first failed heartbeat
      // ended supervision with nothing recorded.
      storage.failWrites = "ENOSPC";
      await new Promise((resolve) => setTimeout(resolve, 2500));
      expect(settled).toBe(false);
      storage.failWrites = null;
      await vi.waitFor(
        () => {
          const current = backgroundListenStatus(target);
          expect(current).toMatchObject({ phase: "receiving", healthy: true });
          expect(Date.now() - (current.supervisorUpdatedAt ?? 0)).toBeLessThan(
            2000,
          );
        },
        { timeout: 5000 },
      );
      expect((await stopBackgroundListen(target)).phase).toBe("stopped");
      await done;
    },
    20_000,
  );

  it("rejects a profile replaced during child startup before it can create another receiver", async () => {
    const child = childFiles();
    const changed = { ...target, scope: "replaced-profile-scope" };
    const marker = join(directory, "receiver-ran");
    await expect(
      startBackgroundListen({
        ...target,
        argv: [child],
        env: {
          TEST_LISTEN_TARGET: JSON.stringify(changed),
          TEST_RUN_MARKER: marker,
        },
        startupTimeoutMs: 5000,
      }),
    ).rejects.toThrow("profile and API origin");
    expect(existsSync(marker)).toBe(false);
    expect(backgroundListenStatus(changed).reason).toBe("absent");
    // The child reports the changed target as a hold, so its supervisor
    // ends instead of restarting a child that would refuse the same way.
    const current = backgroundListenStatus(target);
    expect(current).toMatchObject({
      lastStartFailure: {
        reason: "worker-failed",
        failureCode: "connection-changed",
      },
    });
    expect(["absent", "failed"]).toContain(current.reason);
    expect(backgroundListenRestartable(current)).toBe(false);
  }, 10_000);

  it.each([
    ["exits once and is then still starting", "once"],
    ["keeps exiting before it reports anything", "always"],
    // As after a CLI upgrade, whose version is part of the options.
    ["runs with options other than its parent selected", "options"],
  ] as const)(
    "never stops a supervisor that holds its start at the deadline when its worker %s",
    async (_name, mode) => {
      const child = childFiles();
      const options = {
        ...target,
        argv: [child],
        ...(mode === "options" ? { configuration: "a".repeat(64) } : {}),
        env: {
          TEST_LISTEN_TARGET: JSON.stringify(target),
          TEST_RESTART_DELAY_MS: "50",
          ...(mode === "once"
            ? {
                TEST_LISTEN_MODE: "blocked",
                TEST_EXIT_ONCE: join(directory, "exited-once"),
              }
            : mode === "always"
              ? { TEST_EXIT_ALWAYS: "1" }
              : { TEST_CONFIGURATION: "b".repeat(64) }),
        },
        startupTimeoutMs: 3000,
      };
      const error = await startBackgroundListen(options).catch(
        (caught: unknown) => caught,
      );
      // Not ready, so not a success, but the supervisor owns the restarts.
      expect(error).toBeInstanceOf(ListenStateError);
      expect((error as Error).message).toContain(
        "not ready before the startup timeout. Its supervisor is still running and keeps the receiver, restarting it if it exits, so it was not stopped.",
      );
      expect((error as Error).message).toContain(
        "exited without reporting a reason",
      );
      expect(existsSync(join(stateFile(), "..", "stop.json"))).toBe(false);
      const current = backgroundListenStatus(target);
      expect(current.supervisorPid).toBeGreaterThan(0);
      // Neither stopped by the start nor held as a changed connection.
      expect(["stopped", "failed"]).not.toContain(current.reason);
      // The supervisor's own code is kept, not only the worker's.
      expect(current.lastStartFailure).toMatchObject({
        reason: "timed-out",
        failureCode: "crashed",
      });
      expect(current.detail).toContain(
        "failed: the receiver was not ready before the startup timeout.",
      );
      // Starting again neither hides the record behind a reuse of a receiver
      // that is still starting, nor replaces it while its supervisor waits
      // to restart the worker.
      if (mode === "once")
        expect(await startBackgroundListen(options)).toMatchObject({
          started: false,
          status: { phase: "starting" },
        });
      else
        await expect(startBackgroundListen(options)).rejects.toThrow(
          "stale or unverifiable",
        );
      expect(backgroundListenStatus(target).lastStartFailure).toMatchObject({
        reason: "timed-out",
        failureCode: "crashed",
      });
      await stopBackgroundListen(target);
      expect(["stopped", "absent"]).toContain(
        backgroundListenStatus(target).reason,
      );
    },
    15_000,
  );

  it("requests token-scoped cleanup and records why when no supervisor holds the start at the deadline", async () => {
    const pidFile = join(directory, "hang.pid");
    const hang = join(directory, "hang.mjs");
    // Stands in for a supervisor that never records ownership.
    writeFileSync(
      hang,
      `import { writeFileSync } from 'node:fs';
      writeFileSync(${JSON.stringify(pidFile)}, String(process.pid));
      setInterval(() => {}, 1000);`,
    );
    const error = await startBackgroundListen({
      ...target,
      argv: [hang],
      startupTimeoutMs: 500,
    }).catch((caught: unknown) => caught);
    try {
      expect(error).toBeInstanceOf(ListenStateError);
      expect((error as Error).message).toContain("did not become ready");
      expect(readMailJson(join(stateFile(), "..", "stop.json"))).toMatchObject({
        token: expect.any(String),
      });
      const current = backgroundListenStatus(target);
      expect(current).toMatchObject({
        reason: "absent",
        lastStartFailure: { reason: "timed-out", failureCode: null },
      });
      expect(current.detail).toContain(
        "failed: the receiver was not ready before the startup timeout.",
      );
    } finally {
      await vi
        .waitFor(() => expect(existsSync(pidFile)).toBe(true), {
          timeout: 5000,
        })
        .catch(() => {});
      if (existsSync(pidFile))
        process.kill(Number(readFileSync(pidFile, "utf8")), "SIGKILL");
    }
  }, 15_000);

  it("saves why it stopped even when the worker record cannot be read", async () => {
    const pidFile = join(directory, "hang.pid");
    const hang = join(directory, "hang.mjs");
    // A supervisor that never records ownership. After the start has given
    // up and asked it to stop, the worker record stops parsing.
    writeFileSync(
      hang,
      `import { mkdirSync, writeFileSync } from 'node:fs';
      writeFileSync(${JSON.stringify(pidFile)}, String(process.pid));
      setTimeout(() => {
        mkdirSync(${JSON.stringify(join(stateFile(), ".."))}, { recursive: true });
        writeFileSync(${JSON.stringify(stateFile())}, '{not json');
      }, 900);
      setInterval(() => {}, 1000);`,
    );
    const error = await startBackgroundListen({
      ...target,
      argv: [hang],
      startupTimeoutMs: 500,
    }).catch((caught: unknown) => caught);
    try {
      expect(error).toBeInstanceOf(ListenStateError);
      expect((error as Error).message).toContain("did not become ready");
      expect(
        readMailJson(join(stateFile(), "..", "start-failure.json")),
      ).toMatchObject({ reason: "timed-out", failureCode: null });
    } finally {
      await vi
        .waitFor(() => expect(existsSync(pidFile)).toBe(true), {
          timeout: 5000,
        })
        .catch(() => {});
      if (existsSync(pidFile))
        process.kill(Number(readFileSync(pidFile, "utf8")), "SIGKILL");
    }
  }, 15_000);
});
