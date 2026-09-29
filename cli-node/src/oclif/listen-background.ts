import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { lstatSync, realpathSync, type Stats } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import {
  acquireListenLock,
  compareListenProcessIdentity,
  ListenStateError,
  listenProcessIdentity,
} from "./listen-state.js";
import {
  mailId,
  mailLockBusy,
  mailObject,
  mailString,
  privateMailDirectory,
  readMailJson,
  removeMailFile,
  writeMailJson,
} from "./shared-mail-files.js";

export const BACKGROUND_LISTEN_TOKEN_ENV = "PRIMITIVE_LISTEN_BACKGROUND_TOKEN";
export const BACKGROUND_LISTEN_TARGET_ENV =
  "PRIMITIVE_LISTEN_BACKGROUND_TARGET";
const STALE_AFTER_MS = 15_000;
const phases = [
  "starting",
  "receiving",
  "reconnecting",
  "stopped",
  "failed",
] as const;
export type BackgroundListenPhase = (typeof phases)[number];
const failureCodes = [
  "native-session-unavailable",
  "notification-outcome-unknown",
  "connection-changed",
  "receiving-failed",
] as const;
export type BackgroundListenFailureCode = (typeof failureCodes)[number];

function knownFailureCode(value: unknown): BackgroundListenFailureCode | null {
  return failureCodes.includes(value as BackgroundListenFailureCode)
    ? (value as BackgroundListenFailureCode)
    : null;
}

function failureGuidance(code: BackgroundListenFailureCode): string {
  switch (code) {
    case "native-session-unavailable":
      return "Open the same native session with local-session support and check its socket permissions before restarting the listener.";
    case "notification-outcome-unknown":
      return "A notification outcome is unknown and is held. Inspect the exact session and saved receipts before any manual resend; do not delete receipts or send again automatically.";
    case "connection-changed":
      return "The selected connection changed. Check the intended profile and API origin before starting the listener again.";
    case "receiving-failed":
      return "Inspect listener status and run the same command without --background for details.";
  }
}
export type BackgroundListenTarget = {
  configDir: string;
  scope: string;
  threadId: string;
};
type State = {
  version: 1;
  token: string;
  pid: number;
  identity: string;
  phase: BackgroundListenPhase;
  detached: boolean;
  configuration: string | null;
  failureCode: BackgroundListenFailureCode | null;
  updatedAt: number;
};
export type BackgroundListenStatus = {
  phase: BackgroundListenPhase | null;
  pid: number | null;
  detached: boolean | null;
  healthy: boolean;
  failureCode: BackgroundListenFailureCode | null;
  reason:
    | "absent"
    | "stale"
    | "unverifiable"
    | "exited"
    | "stopped"
    | "failed"
    | null;
  updatedAt: number | null;
};

export function backgroundListenToken(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const value = env[BACKGROUND_LISTEN_TOKEN_ENV];
  return value === undefined ? null : mailId(value);
}

function configurationFingerprint(value?: string): string | null {
  if (value === undefined) return null;
  if (!/^[a-f0-9]{64}$/i.test(value))
    throw new ListenStateError(
      "Listener configuration fingerprint is invalid.",
    );
  return value.toLowerCase();
}

/** Verify the parent's selection before a child reads or mutates listener state. */
export function verifyBackgroundListenTarget(
  target: BackgroundListenTarget & { configuration?: string },
  env: NodeJS.ProcessEnv = process.env,
): void {
  if (backgroundListenToken(env) === null) return;
  try {
    const value: unknown = JSON.parse(env[BACKGROUND_LISTEN_TARGET_ENV] ?? "");
    const expected = mailObject(value, [
      "scope",
      "threadId",
      "configDir",
      "configuration",
    ]);
    if (
      expected.configuration !== null &&
      typeof expected.configuration !== "string"
    )
      throw new Error("Invalid configuration fingerprint");
    const configuration = configurationFingerprint(
      expected.configuration === null
        ? undefined
        : String(expected.configuration),
    );
    const configDir = mailString(expected.configDir, 4096);
    if (
      mailString(expected.scope) !== mailString(target.scope) ||
      mailId(expected.threadId) !== mailId(target.threadId) ||
      configDir !== realpathSync(configDir) ||
      configDir !== realpathSync(target.configDir) ||
      configuration !== configurationFingerprint(target.configuration)
    )
      throw new Error("Changed listener target");
  } catch {
    throw new ListenStateError(
      "Background listener target changed or its parent expectation is invalid. No listener was started.",
    );
  }
}

function configDirectory(path: string, create: boolean) {
  let info: Stats;
  try {
    info = lstatSync(path);
  } catch (error) {
    if (!create || (error as NodeJS.ErrnoException).code !== "ENOENT")
      throw error;
    privateMailDirectory(path, true);
    info = lstatSync(path);
  }
  if (
    !info.isDirectory() ||
    (process.platform !== "win32" &&
      (info.uid !== process.getuid?.() || (info.mode & 0o022) !== 0))
  )
    throw new ListenStateError(
      "Listener config directory must be an owned directory without group or other write access, not a symlink.",
    );
}

function files(target: BackgroundListenTarget, create = false) {
  const key = createHash("sha256")
    .update(JSON.stringify([mailString(target.scope), mailId(target.threadId)]))
    .digest("hex");
  const root = join(target.configDir, "listen-background");
  const directory = join(root, key);
  for (const path of [target.configDir, root, directory]) {
    try {
      if (path === target.configDir) configDirectory(path, create);
      else privateMailDirectory(path, create);
    } catch (error) {
      if (!create && (error as NodeJS.ErrnoException).code === "ENOENT") break;
      throw error;
    }
  }
  return {
    directory,
    state: join(directory, "state.json"),
    stop: join(directory, "stop.json"),
  };
}

function readState(path: string): State | null {
  const value = readMailJson(path, 2048);
  if (value === null) return null;
  const row = mailObject(value, [
    "version",
    "token",
    "pid",
    "identity",
    "phase",
    "detached",
    "configuration",
    ...(typeof value === "object" && Object.hasOwn(value, "failureCode")
      ? ["failureCode"]
      : []),
    "updatedAt",
  ]);
  if (
    row.version !== 1 ||
    !Number.isSafeInteger(row.pid) ||
    Number(row.pid) < 1 ||
    !phases.includes(row.phase as BackgroundListenPhase) ||
    typeof row.detached !== "boolean" ||
    (row.configuration !== null && typeof row.configuration !== "string") ||
    (row.failureCode !== undefined &&
      row.failureCode !== null &&
      knownFailureCode(row.failureCode) === null) ||
    !Number.isSafeInteger(row.updatedAt) ||
    Number(row.updatedAt) < 0
  )
    throw new ListenStateError(
      "Background listener state is invalid. Preserve it before retrying.",
    );
  return {
    version: 1,
    token: mailId(row.token),
    pid: Number(row.pid),
    identity: mailString(row.identity),
    phase: row.phase as BackgroundListenPhase,
    detached: row.detached,
    configuration: configurationFingerprint(
      row.configuration === null ? undefined : String(row.configuration),
    ),
    failureCode: knownFailureCode(row.failureCode),
    updatedAt: Number(row.updatedAt),
  };
}

function owner(state: State): "verified" | "gone" | "unknown" {
  const current = listenProcessIdentity(state.pid);
  const matches = compareListenProcessIdentity(state.identity, current);
  if (matches !== null) return matches ? "verified" : "gone";
  try {
    process.kill(state.pid, 0);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ESRCH") return "gone";
  }
  return "unknown";
}

function status(state: State | null): BackgroundListenStatus {
  if (!state)
    return {
      phase: null,
      pid: null,
      detached: null,
      healthy: false,
      failureCode: null,
      reason: "absent",
      updatedAt: null,
    };
  const age = Date.now() - state.updatedAt;
  const ownership = owner(state);
  const reason =
    state.phase === "stopped" || state.phase === "failed"
      ? state.phase
      : ownership === "gone"
        ? "exited"
        : ownership === "unknown"
          ? "unverifiable"
          : age < 0 || age >= STALE_AFTER_MS
            ? "stale"
            : null;
  return {
    phase: state.phase,
    pid: state.pid,
    detached: state.detached,
    healthy: reason === null,
    failureCode: state.failureCode,
    reason,
    updatedAt: state.updatedAt,
  };
}

/** Absence means no managed record, not proof that an older foreground listener is absent. */
export function backgroundListenStatus(
  target: BackgroundListenTarget,
): BackgroundListenStatus {
  return status(readState(files(target).state));
}

function stopToken(path: string): string | null {
  const value = readMailJson(path, 512);
  if (value === null) return null;
  return mailId(mailObject(value, ["token"]).token);
}

/** Signal only the verified generation through its private mailbox, never its PID. */
export async function stopBackgroundListen(
  target: BackgroundListenTarget,
  expectedToken?: string,
): Promise<BackgroundListenStatus> {
  const paths = files(target);
  const state = readState(paths.state);
  if (!state) return status(null);
  if (expectedToken !== undefined && mailId(expectedToken) !== state.token)
    throw new ListenStateError(
      "Background listener ownership changed; no stop was requested.",
    );
  if (
    state.phase === "stopped" ||
    state.phase === "failed" ||
    owner(state) === "gone"
  )
    return status(state);
  // An old macOS record cannot prove liveness after clock correction or an
  // upgrade. Its private generation token can still ask only that worker to
  // stop. Never signal its PID or call the unconfirmed request a stopped worker.
  if (owner(state) !== "verified" && !state.identity.startsWith("darwin:"))
    throw new ListenStateError(
      "Background listener ownership cannot be verified; no stop was requested.",
    );
  writeMailJson(paths.stop, { token: state.token });
  const deadline = Date.now() + 5000;
  for (;;) {
    const current = readState(paths.state);
    if (!current || current.token !== state.token) return status(current);
    if (
      current.phase === "stopped" ||
      current.phase === "failed" ||
      owner(current) === "gone"
    )
      return status(current);
    if (Date.now() >= deadline) return status(current);
    await delay(50);
  }
}

function announce(
  token: string,
  phase: BackgroundListenPhase,
  failureCode: BackgroundListenFailureCode | null = null,
) {
  try {
    if (process.connected && process.send)
      process.send(
        {
          type: "primitive-listen-state",
          token,
          phase,
          ...(phase === "failed" ? { failureCode } : {}),
        },
        () => {},
      );
  } catch {
    // The launching parent may exit between the connection check and send.
  }
}

/** Hold exclusive ownership across safe retries; the caller decides which errors are retryable. */
export async function runBackgroundListen(
  options: BackgroundListenTarget & {
    token: string;
    detached?: boolean;
    configuration?: string;
    run(signal: AbortSignal, onReady: () => void): Promise<void>;
    retryable(error: unknown): boolean;
    failureCode?(error: unknown): BackgroundListenFailureCode;
    signal?: AbortSignal;
    heartbeatMs?: number;
    retryDelayMs?: number;
  },
): Promise<void> {
  verifyBackgroundListenTarget(options);
  const token = mailId(options.token);
  const configuration = configurationFingerprint(options.configuration);
  const paths = files(options, true);
  const identity = listenProcessIdentity(process.pid);
  if (!identity)
    throw new ListenStateError(
      "Listener process ownership cannot be verified.",
    );
  const release = acquireListenLock(paths.directory, "background-runtime");
  const controller = new AbortController();
  const cancel = () => controller.abort();
  const state: State = {
    version: 1,
    token,
    pid: process.pid,
    identity,
    phase: "starting",
    detached: options.detached ?? false,
    configuration,
    failureCode: null,
    updatedAt: Date.now(),
  };
  let failure: { error: unknown } | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;
  let started = false;
  const publish = (phase = state.phase) => {
    const previous = readState(paths.state);
    if (started && previous?.token !== token)
      throw new ListenStateError("Listener process ownership changed.");
    state.phase = phase;
    state.updatedAt = Date.now();
    writeMailJson(paths.state, state);
    started = true;
  };
  const tick = () => {
    try {
      if (stopToken(paths.stop) === token) cancel();
      publish();
    } catch (error) {
      failure ??= { error };
      cancel();
    }
  };
  options.signal?.addEventListener("abort", cancel, { once: true });
  process.on("SIGTERM", cancel);
  process.on("SIGINT", cancel);
  try {
    if (options.signal?.aborted) cancel();
    publish();
    tick();
    timer = setInterval(tick, options.heartbeatMs ?? 1000);
    let attempts = 0;
    while (!controller.signal.aborted) {
      const attempt = new AbortController();
      const signal = AbortSignal.any([controller.signal, attempt.signal]);
      try {
        await options.run(signal, () => {
          signal.throwIfAborted();
          publish("receiving");
          announce(token, "receiving");
        });
        break;
      } catch (error) {
        if (controller.signal.aborted) {
          if (
            error === signal.reason ||
            (error instanceof Error && error.name === "AbortError")
          )
            break;
          // A concurrent stop cannot erase an unknown dispatch or another
          // terminal failure reported by the receiver.
          throw error;
        }
        if (!options.retryable(error)) throw error;
        publish("reconnecting");
        announce(token, "reconnecting");
      } finally {
        attempt.abort();
      }
      await delay(
        Math.min(
          (options.retryDelayMs ?? 1000) * 2 ** Math.min(attempts++, 5),
          30_000,
        ),
        undefined,
        { signal: controller.signal },
      ).catch((error: unknown) => {
        if (!controller.signal.aborted) throw error;
      });
    }
    if (failure) throw failure.error;
    publish("stopped");
  } catch (error) {
    failure ??= { error };
    try {
      state.failureCode =
        knownFailureCode(options.failureCode?.(failure.error)) ??
        "receiving-failed";
    } catch {
      // Diagnostics cannot replace the primary failure or expose raw errors.
      state.failureCode = "receiving-failed";
    }
    try {
      if (readState(paths.state)?.token === token) publish("failed");
    } catch {
      // Preserve the receiver's primary failure if state is also unavailable.
    }
    announce(token, "failed", state.failureCode);
  } finally {
    if (timer) clearInterval(timer);
    options.signal?.removeEventListener("abort", cancel);
    process.off("SIGTERM", cancel);
    process.off("SIGINT", cancel);
    try {
      if (stopToken(paths.stop) === token) removeMailFile(paths.stop);
    } catch (error) {
      failure ??= { error };
    }
    try {
      release();
    } catch (error) {
      failure ??= { error };
    }
  }
  if (failure) throw failure.error;
}

/** Spawn the same CLI entrypoint. Overrides travel only in the child's environment. */
export async function startBackgroundListen(
  options: BackgroundListenTarget & {
    argv: string[];
    configuration?: string;
    env?: NodeJS.ProcessEnv;
    startupTimeoutMs?: number;
    signal?: AbortSignal;
  },
): Promise<{ started: boolean; status: BackgroundListenStatus }> {
  const configuration = configurationFingerprint(options.configuration);
  const paths = files(options, true);
  const timeout = options.startupTimeoutMs ?? 15_000;
  const deadline = Date.now() + timeout;
  let release: (() => void) | undefined;
  while (!release) {
    options.signal?.throwIfAborted();
    try {
      release = acquireListenLock(paths.directory, "background-start");
    } catch (error) {
      if (!mailLockBusy(error) || Date.now() >= deadline) throw error;
      await delay(25, undefined, { signal: options.signal });
    }
  }
  try {
    const prior = readState(paths.state);
    if (
      prior &&
      prior.phase !== "stopped" &&
      prior.phase !== "failed" &&
      owner(prior) !== "gone"
    ) {
      const current = status(prior);
      if (!current.healthy)
        throw new ListenStateError(
          "Existing listener ownership is stale or unverifiable; the worker was retained. Inspect status or request a stop before restarting.",
        );
      if (!prior.detached)
        throw new ListenStateError(
          "An existing foreground listener owns this session. Stop it before restarting with --background.",
        );
      if (prior.configuration !== configuration)
        throw new ListenStateError(
          "Stop the existing listener before changing receiving options.",
        );
      return { started: false, status: current };
    }
    const token = randomUUID();
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      ...options.env,
      [BACKGROUND_LISTEN_TOKEN_ENV]: token,
      [BACKGROUND_LISTEN_TARGET_ENV]: JSON.stringify({
        scope: mailString(options.scope),
        threadId: mailId(options.threadId),
        configDir: realpathSync(options.configDir),
        configuration,
      }),
    };
    const argv: string[] = [];
    for (let index = 0; index < options.argv.length; index++) {
      const arg = options.argv[index];
      if (arg === undefined) continue;
      if (arg === "--background" || arg.startsWith("--background=")) continue;
      if (arg === "--api-key") {
        const key = options.argv[++index];
        if (key === undefined)
          throw new ListenStateError("An API key value is required.");
        env.PRIMITIVE_API_KEY = key.trim();
      } else if (arg.startsWith("--api-key=")) {
        const key = arg.slice("--api-key=".length).trim();
        env.PRIMITIVE_API_KEY = key;
      } else argv.push(arg);
    }
    if (!argv.length)
      throw new ListenStateError("The CLI entrypoint is required.");
    const child = spawn(process.execPath, argv, {
      env,
      detached: true,
      windowsHide: true,
      stdio: ["ignore", "ignore", "ignore", "ipc"],
    });
    let startupFailureCode: BackgroundListenFailureCode | null = null;
    try {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(
          () =>
            finish(
              new ListenStateError("Background listener startup timed out."),
            ),
          timeout,
        );
        const abort = () =>
          finish(
            new ListenStateError("Background listener startup was cancelled."),
          );
        const exit = () =>
          finish(
            new ListenStateError(
              "Background listener stopped before it became ready.",
            ),
          );
        const error = () =>
          finish(
            new ListenStateError("Background listener could not be started."),
          );
        const message = (value: unknown) => {
          if (!value || typeof value !== "object") return;
          const next = value as Record<string, unknown>;
          if (next.type !== "primitive-listen-state" || next.token !== token)
            return;
          if (next.phase === "receiving" || next.phase === "reconnecting")
            finish();
          else if (next.phase === "failed") {
            startupFailureCode = knownFailureCode(next.failureCode);
            error();
          }
        };
        const finish = (failure?: Error) => {
          clearTimeout(timer);
          options.signal?.removeEventListener("abort", abort);
          child.off("exit", exit);
          child.off("error", error);
          child.off("message", message);
          if (failure) reject(failure);
          else resolve();
        };
        child.once("exit", exit);
        child.once("error", error);
        child.on("message", message);
        options.signal?.addEventListener("abort", abort, { once: true });
        if (options.signal?.aborted) abort();
      });
      const current = readState(paths.state);
      if (
        current?.token !== token ||
        current.configuration !== configuration ||
        !current.detached ||
        !status(current).healthy
      )
        throw new ListenStateError(
          "Background listener ownership changed during startup.",
        );
      return { started: true, status: status(current) };
    } catch {
      // The token also reaches a child that has not written its first state yet.
      writeMailJson(paths.stop, { token });
      const until = Date.now() + 2000;
      while (
        Date.now() < until &&
        child.exitCode === null &&
        child.signalCode === null
      )
        await delay(50);
      const current = readState(paths.state);
      const retained =
        current?.token === token &&
        owner(current) !== "gone" &&
        current.phase !== "stopped" &&
        current.phase !== "failed";
      const unconfirmed =
        retained || (child.exitCode === null && child.signalCode === null);
      const code =
        startupFailureCode ??
        (current?.token === token ? current.failureCode : null);
      const guidance = code
        ? unconfirmed && code === "receiving-failed"
          ? ""
          : failureGuidance(code)
        : unconfirmed
          ? ""
          : "Run the same command without --background for details.";
      throw new ListenStateError(
        `${
          unconfirmed
            ? "Background listener did not become ready; a stop was requested, but worker termination is unconfirmed. Inspect status before retrying."
            : "Background listener did not become ready and stopped."
        }${guidance ? ` ${guidance}` : ""}`,
      );
    } finally {
      if (child.connected) child.disconnect();
      child.unref();
    }
  } finally {
    release();
  }
}
