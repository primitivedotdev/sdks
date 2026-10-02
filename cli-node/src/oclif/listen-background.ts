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
const SUPERVISOR_ENV = "PRIMITIVE_LISTEN_SUPERVISOR";
const SUPERVISOR_ARGV_ENV = "PRIMITIVE_LISTEN_SUPERVISOR_ARGV";
const SUPERVISOR_WORKER_ENV = "PRIMITIVE_LISTEN_SUPERVISOR_WORKER";
const STALE_AFTER_MS = 15_000;
const RESTART_WINDOW_MS = 10 * 60_000;
const HEALTHY_RESET_MS = 10 * 60_000;
const MAX_FAILURES = 5;
// After the fast restart budget is spent the supervisor keeps trying, slowly.
// A receiver that stays down is worse than one that retries every few minutes.
const RESTART_COOLDOWN_MS = 5 * 60_000;
// Restarts that come from outside the supervisor (a worker replacing a lost
// supervisor, or a command run from the bound session) share one rate limit.
export const BACKGROUND_HEAL_INTERVAL_MS = 60_000;
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
  "restart-budget-exhausted",
  "disk-full",
  "storage-unavailable",
  "crashed",
  "unrecognized",
] as const;
export type BackgroundListenFailureCode = (typeof failureCodes)[number];
// These hold the receiver on purpose: restarting could repeat a notification
// whose outcome is unknown, or adopt a connection the owner did not choose.
// "unrecognized" is a code from a newer CLI: it may be a hold this version
// cannot recognize, so it is never treated as safe to restart.
const HOLDING_FAILURE_CODES: readonly BackgroundListenFailureCode[] = [
  "notification-outcome-unknown",
  "connection-changed",
  "unrecognized",
];

function knownFailureCode(value: unknown): BackgroundListenFailureCode | null {
  return failureCodes.includes(value as BackgroundListenFailureCode)
    ? (value as BackgroundListenFailureCode)
    : null;
}

/** A newer CLI may record a code this version does not know; keep the record readable. */
function savedFailureCode(value: unknown): BackgroundListenFailureCode | null {
  if (value === null || value === undefined) return null;
  return knownFailureCode(value) ?? "unrecognized";
}

const DISK_FULL_ERRORS = new Set(["ENOSPC", "EDQUOT"]);
const STORAGE_ERRORS = new Set([
  "EIO",
  "EROFS",
  "EMFILE",
  "ENFILE",
  "EAGAIN",
  "EBUSY",
  "ENOMEM",
]);

/** Classify local storage failures that a later retry can outlive. */
export function storageFailureCode(
  error: unknown,
): "disk-full" | "storage-unavailable" | null {
  const errno = (value: unknown) =>
    value && typeof value === "object"
      ? (value as NodeJS.ErrnoException).code
      : undefined;
  // Private reads wrap the filesystem error and keep only its errno as cause.
  const code =
    errno(error) ??
    errno(error && typeof error === "object" ? (error as Error).cause : null);
  if (typeof code !== "string") return null;
  if (DISK_FULL_ERRORS.has(code)) return "disk-full";
  if (STORAGE_ERRORS.has(code)) return "storage-unavailable";
  return null;
}

/** Whether a stopped receiver may be restarted without an explicit owner action. */
export function backgroundListenRestartable(
  status: BackgroundListenStatus,
): boolean {
  if (status.reason === "exited") return true;
  return (
    status.reason === "failed" &&
    status.failureCode !== null &&
    !HOLDING_FAILURE_CODES.includes(status.failureCode)
  );
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
    case "restart-budget-exhausted":
      return "The listener repeatedly exited. Inspect listener status before starting it again.";
    case "disk-full":
      return "The disk was full, so the receiver could not save its state. Free disk space; the receiver retries on its own.";
    case "storage-unavailable":
      return "The receiver could not read or write its local state. Check the config directory's disk and permissions; the receiver retries on its own.";
    case "crashed":
      return "The receiver exited without reporting a reason. It is restarted automatically; inspect status if this repeats.";
    case "unrecognized":
      return "A newer Primitive CLI recorded this receiver's state. Inspect it with that version before restarting.";
  }
}

/** One sentence an owner or agent can act on; never raw error text. */
function statusDetail(
  status: Pick<BackgroundListenStatus, "healthy" | "reason" | "failureCode">,
): string | null {
  if (status.healthy) return null;
  const guidance = status.failureCode
    ? failureGuidance(status.failureCode)
    : "";
  const withGuidance = (text: string) =>
    guidance ? `${text} ${guidance}` : text;
  switch (status.reason) {
    case "exited":
      return "The receiver stopped unexpectedly and new mail is not reaching this session. Any primitive command run from this session restarts it, or start it again with the same listen command.";
    case "restarting":
      return withGuidance(
        "The receiver is restarting; new mail waits until it is back.",
      );
    case "failed":
      return withGuidance(
        "The receiver stopped and new mail is not reaching this session.",
      );
    case "stale":
      return withGuidance(
        "The receiver has not recorded a heartbeat recently. It may be unable to write local state.",
      );
    case "unverifiable":
      return "The receiver's process cannot be verified.";
    case "stopped":
      return "The receiver was stopped.";
    case "absent":
      return "No background receiver is recorded for this session.";
    default:
      return guidance || null;
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
type SupervisorState = {
  version: 1;
  token: string;
  pid: number;
  identity: string;
  phase: "starting" | "running" | "stopped" | "failed";
  updatedAt: number;
  failureCode: BackgroundListenFailureCode | null;
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
    | "restarting"
    | null;
  updatedAt: number | null;
  supervisorPid?: number | null;
  supervisorUpdatedAt?: number | null;
  /** Why the receiver is not healthy, in words; null when healthy. */
  detail?: string | null;
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
    supervisor: join(directory, "supervisor.json"),
  };
}

function readSupervisor(path: string): SupervisorState | null {
  const value = readMailJson(path, 2048);
  if (value === null) return null;
  const row = mailObject(value, [
    "version",
    "token",
    "pid",
    "identity",
    "phase",
    "updatedAt",
    "failureCode",
  ]);
  if (
    row.version !== 1 ||
    !Number.isSafeInteger(row.pid) ||
    Number(row.pid) < 1 ||
    !["starting", "running", "stopped", "failed"].includes(String(row.phase)) ||
    !Number.isSafeInteger(row.updatedAt) ||
    Number(row.updatedAt) < 0 ||
    (row.failureCode !== null && typeof row.failureCode !== "string")
  )
    throw new ListenStateError(
      "Background supervisor state is invalid. Preserve it before retrying.",
    );
  return {
    version: 1,
    token: mailId(row.token),
    pid: Number(row.pid),
    identity: mailString(row.identity),
    phase: row.phase as SupervisorState["phase"],
    updatedAt: Number(row.updatedAt),
    failureCode: savedFailureCode(row.failureCode),
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
      typeof row.failureCode !== "string") ||
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
    failureCode: savedFailureCode(row.failureCode),
    updatedAt: Number(row.updatedAt),
  };
}

function owner(
  state: Pick<State, "pid" | "identity">,
): "verified" | "gone" | "unknown" {
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
      detail: statusDetail({
        healthy: false,
        reason: "absent",
        failureCode: null,
      }),
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
    detail: statusDetail({
      healthy: reason === null,
      reason,
      failureCode: state.failureCode,
    }),
  };
}

/** Absence means no managed record, not proof that an older foreground listener is absent. */
export function backgroundListenStatus(
  target: BackgroundListenTarget,
): BackgroundListenStatus {
  const paths = files(target);
  const worker = status(readState(paths.state));
  const supervisor = readSupervisor(paths.supervisor);
  if (!supervisor) return worker;
  const ownership = owner(supervisor);
  // A heartbeat dated in the future (clock change, corrupt state) is not
  // evidence of a live supervisor.
  const age = Date.now() - supervisor.updatedAt;
  const fresh = age >= 0 && age < STALE_AFTER_MS;
  const active =
    supervisor.phase === "starting" || supervisor.phase === "running";
  const reason =
    supervisor.phase === "failed"
      ? "failed"
      : supervisor.phase === "stopped"
        ? "stopped"
        : ownership === "gone"
          ? "exited"
          : ownership === "unknown"
            ? "unverifiable"
            : !fresh
              ? "stale"
              : worker.healthy
                ? null
                : "restarting";
  const healthy = active && reason === null;
  // A healthy receiver's last recovered failure is history, not its state.
  const failureCode = healthy
    ? null
    : (supervisor.failureCode ?? worker.failureCode);
  return {
    ...worker,
    phase:
      supervisor.phase === "failed"
        ? "failed"
        : reason === "restarting"
          ? "reconnecting"
          : worker.phase,
    healthy,
    reason,
    failureCode,
    supervisorPid: supervisor.pid,
    supervisorUpdatedAt: supervisor.updatedAt,
    detail: statusDetail({ healthy, reason, failureCode }),
  };
}

/**
 * Claim the shared restart slot for one receiver. False means another restart
 * was attempted recently, or the claim could not be recorded (for example on a
 * full disk), so the caller must not start one.
 */
export function claimBackgroundListenRestart(
  target: BackgroundListenTarget,
  now = Date.now(),
): boolean {
  let release: (() => void) | undefined;
  try {
    const paths = files(target, true);
    // Two commands can find the slot free at once; only the lock holder may
    // read and take it.
    release = acquireListenLock(paths.directory, "background-restart-claim");
    const path = join(paths.directory, "restart.json");
    const prior = readMailJson(path, 256);
    const at =
      prior && typeof prior === "object" && !Array.isArray(prior)
        ? (prior as { at?: unknown }).at
        : undefined;
    if (
      typeof at === "number" &&
      at <= now &&
      now - at < BACKGROUND_HEAL_INTERVAL_MS
    )
      return false;
    writeMailJson(path, { at: now });
    return true;
  } catch {
    return false;
  } finally {
    try {
      release?.();
    } catch {
      /* A stale claim lock is recovered by the next claimant. */
    }
  }
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
  const supervisor = readSupervisor(paths.supervisor);
  if (!state && !supervisor) return status(null);
  const token = supervisor?.token ?? state?.token;
  if (!token) return status(null);
  if (expectedToken !== undefined && mailId(expectedToken) !== token)
    throw new ListenStateError(
      "Background listener ownership changed; no stop was requested.",
    );
  if (
    state &&
    !supervisor &&
    (state.phase === "stopped" ||
      state.phase === "failed" ||
      owner(state) === "gone")
  )
    return status(state);
  // An old macOS record cannot prove liveness after clock correction or an
  // upgrade. Its private generation token can still ask only that worker to
  // stop. Never signal its PID or call the unconfirmed request a stopped worker.
  if (supervisor && owner(supervisor) === "unknown")
    throw new ListenStateError(
      "Background supervisor ownership cannot be verified; no stop was requested.",
    );
  if (
    !supervisor &&
    state &&
    owner(state) !== "verified" &&
    !state.identity.startsWith("darwin:")
  )
    throw new ListenStateError(
      "Background listener ownership cannot be verified; no stop was requested.",
    );
  writeMailJson(paths.stop, { token });
  const deadline = Date.now() + 5000;
  for (;;) {
    const current = readState(paths.state);
    const currentSupervisor = readSupervisor(paths.supervisor);
    if (
      currentSupervisor?.token === token &&
      currentSupervisor.phase === "stopped"
    )
      return backgroundListenStatus(target);
    if (
      currentSupervisor?.token === token &&
      currentSupervisor.phase === "failed"
    )
      return backgroundListenStatus(target);
    if (current && current.token !== token)
      return backgroundListenStatus(target);
    if (!current && !currentSupervisor) return backgroundListenStatus(target);
    if (
      !supervisor &&
      current &&
      (current.phase === "stopped" ||
        current.phase === "failed" ||
        owner(current) === "gone")
    )
      return backgroundListenStatus(target);
    if (Date.now() >= deadline) return backgroundListenStatus(target);
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
    /**
     * Start a replacement supervisor after this worker's supervisor died
     * without stopping it. Defaults to relaunching this same command with
     * --background; the replacement stops this worker and supervises a new one.
     */
    relaunchSupervisor?(): void;
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
  let relaunched = false;
  let nextRelaunchCheck = 0;
  const supervised = process.env[SUPERVISOR_WORKER_ENV] === token;
  const watchSupervisor = () => {
    if (
      !supervised ||
      relaunched ||
      controller.signal.aborted ||
      Date.now() < nextRelaunchCheck
    )
      return;
    const supervisor = readSupervisor(paths.supervisor);
    if (!supervisor || supervisor.token !== token) return;
    // The IPC channel closes as soon as the supervisor exits; a stale
    // heartbeat covers a supervisor that started this worker without one.
    if (process.connected && Date.now() - supervisor.updatedAt < STALE_AFTER_MS)
      return;
    const lost =
      supervisor.phase === "starting" ||
      supervisor.phase === "running" ||
      (supervisor.phase === "failed" && supervisor.failureCode === "crashed");
    if (!lost || owner(supervisor) !== "gone") return;
    // A refused claim (full disk, or another restart moments ago) is retried
    // later; this worker must not stay unsupervised for the rest of its life.
    if (!claimBackgroundListenRestart(options)) {
      nextRelaunchCheck = Date.now() + 5000;
      return;
    }
    relaunched = true;
    (options.relaunchSupervisor ?? relaunchSupervisor)();
  };
  const tick = () => {
    try {
      if (stopToken(paths.stop) === token) cancel();
      publish();
    } catch (error) {
      // A full or failing disk must not end receiving: mail can still be
      // delivered, and the heartbeat resumes once the disk recovers. Status
      // reports the missing heartbeat as stale meanwhile.
      if (storageFailureCode(error) === null) {
        failure ??= { error };
        cancel();
        return;
      }
    }
    try {
      watchSupervisor();
    } catch {
      /* Supervision recovery is best effort and never ends receiving. */
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
      const reported =
        knownFailureCode(options.failureCode?.(failure.error)) ??
        "receiving-failed";
      state.failureCode =
        reported === "receiving-failed"
          ? (storageFailureCode(failure.error) ?? reported)
          : reported;
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
      if (
        process.env[SUPERVISOR_WORKER_ENV] !== token &&
        stopToken(paths.stop) === token
      )
        removeMailFile(paths.stop);
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

/** Relaunch this worker's own command detached, with --background restored. */
function relaunchSupervisor(): void {
  const env: NodeJS.ProcessEnv = { ...process.env };
  delete env[BACKGROUND_LISTEN_TOKEN_ENV];
  delete env[BACKGROUND_LISTEN_TARGET_ENV];
  delete env[SUPERVISOR_WORKER_ENV];
  const child = spawn(
    process.execPath,
    [...process.execArgv, ...process.argv.slice(1), "--background"],
    { env, detached: true, windowsHide: true, stdio: "ignore" },
  );
  child.on("error", () => {});
  child.unref();
}

/** Supervise one exact listener generation until a stop or a holding failure. */
export async function runBackgroundListenSupervisor(
  options: { restartDelayMs?: number; cooldownMs?: number } = {},
): Promise<void> {
  const token = mailId(process.env[BACKGROUND_LISTEN_TOKEN_ENV]);
  const expected = mailObject(
    JSON.parse(process.env[BACKGROUND_LISTEN_TARGET_ENV] ?? ""),
    ["scope", "threadId", "configDir", "configuration"],
  );
  const target: BackgroundListenTarget = {
    scope: mailString(expected.scope),
    threadId: mailId(expected.threadId),
    configDir: mailString(expected.configDir, 4096),
  };
  if (realpathSync(target.configDir) !== target.configDir)
    throw new ListenStateError("Background supervisor target changed.");
  const argvValue: unknown = JSON.parse(process.env[SUPERVISOR_ARGV_ENV] ?? "");
  if (
    !Array.isArray(argvValue) ||
    argvValue.length < 1 ||
    argvValue.some((part) => typeof part !== "string" || part.length > 4096)
  )
    throw new ListenStateError("Background supervisor command is invalid.");
  const argv = argvValue as string[];
  const restartDelayMs = options.restartDelayMs ?? 1000;
  const cooldownMs = options.cooldownMs ?? RESTART_COOLDOWN_MS;
  const paths = files(target, true);
  const release = acquireListenLock(paths.directory, "background-supervisor");
  const identity = listenProcessIdentity(process.pid);
  if (!identity) {
    release();
    throw new ListenStateError(
      "Supervisor process ownership cannot be verified.",
    );
  }
  const record: SupervisorState = {
    version: 1,
    token,
    pid: process.pid,
    identity,
    phase: "starting",
    updatedAt: Date.now(),
    failureCode: null,
  };
  const publish = () => {
    const prior = readSupervisor(paths.supervisor);
    if (
      prior &&
      prior.token !== token &&
      owner(prior) !== "gone" &&
      prior.phase !== "stopped" &&
      prior.phase !== "failed"
    )
      throw new ListenStateError("Another supervisor owns this listener.");
    record.updatedAt = Date.now();
    writeMailJson(paths.supervisor, record);
  };
  // Supervision outlives a full or failing disk: a missed write only leaves
  // the record stale until the next heartbeat. Ownership conflicts still end it.
  const tryPublish = () => {
    try {
      publish();
    } catch (error) {
      if (storageFailureCode(error) === null) throw error;
    }
  };
  const stopRequested = () => {
    try {
      return stopToken(paths.stop) === token;
    } catch (error) {
      if (storageFailureCode(error) !== null) return false;
      throw error;
    }
  };
  let child: ReturnType<typeof spawn> | undefined;
  let stopped = false;
  const cancel = () => {
    stopped = true;
    try {
      writeMailJson(paths.stop, { token });
    } catch {
      /* The signal below still reaches the current worker. */
    }
    child?.kill("SIGTERM");
  };
  process.on("SIGTERM", cancel);
  process.on("SIGINT", cancel);
  // Anything this function does not catch would end supervision silently.
  // Record why before exiting so status and the worker can tell a crash from
  // a deliberate stop.
  const crashed = () => {
    record.phase = "failed";
    record.failureCode = "crashed";
    try {
      tryPublish();
    } catch {
      /* Exit regardless. */
    }
    child?.kill("SIGTERM");
    process.exit(1);
  };
  process.on("uncaughtException", crashed);
  process.on("unhandledRejection", crashed);
  const heartbeat = setInterval(() => {
    try {
      if (stopRequested()) {
        stopped = true;
        child?.kill("SIGTERM");
      }
      tryPublish();
    } catch {
      cancel();
    }
  }, 1000);
  const failures: number[] = [];
  try {
    tryPublish();
    while (!stopped) {
      if (stopRequested()) break;
      const env: NodeJS.ProcessEnv = {
        ...process.env,
        [SUPERVISOR_WORKER_ENV]: token,
      };
      delete env[SUPERVISOR_ENV];
      delete env[SUPERVISOR_ARGV_ENV];
      child = spawn(process.execPath, argv, {
        env,
        windowsHide: true,
        stdio: ["ignore", "ignore", "ignore", "ipc"],
      });
      let readyAt: number | null = null;
      // The worker reports its failure over IPC too, so a reason survives a
      // disk too full for the worker to record it.
      let reported: BackgroundListenFailureCode | null = null;
      child.on("message", (message: unknown) => {
        if (!message || typeof message !== "object") return;
        const row = message as Record<string, unknown>;
        if (row.type !== "primitive-listen-state" || row.token !== token)
          return;
        if (row.phase === "receiving") {
          if (readyAt === null) readyAt = Date.now();
          if (record.failureCode !== null) {
            record.failureCode = null;
            tryPublish();
          }
        }
        if (row.phase === "failed")
          reported = knownFailureCode(row.failureCode) ?? "receiving-failed";
        try {
          if (process.connected) process.send?.(message, () => {});
        } catch {
          /* Parent may have exited. */
        }
      });
      record.phase = "running";
      tryPublish();
      const exit = await new Promise<{
        code: number | null;
        signal: NodeJS.Signals | null;
      }>((resolve) => {
        child?.once("exit", (code, signal) => resolve({ code, signal }));
        child?.once("error", () => resolve({ code: null, signal: null }));
      });
      child = undefined;
      if (stopped || stopRequested()) break;
      let worker: State | null = null;
      try {
        worker = readState(paths.state);
      } catch {
        /* An unreadable record is treated as an unreported exit. */
      }
      const recorded =
        worker?.token === token && worker.phase === "failed"
          ? worker.failureCode
          : null;
      const failureCode: BackgroundListenFailureCode =
        reported ??
        recorded ??
        (exit.code === 0 && exit.signal === null
          ? "receiving-failed"
          : "crashed");
      if (HOLDING_FAILURE_CODES.includes(failureCode)) {
        record.phase = "failed";
        record.failureCode = failureCode;
        tryPublish();
        return;
      }
      const now = Date.now();
      if (readyAt !== null && now - readyAt >= HEALTHY_RESET_MS)
        failures.length = 0;
      failures.push(now);
      while (failures.length && (failures[0] ?? now) < now - RESTART_WINDOW_MS)
        failures.shift();
      // Never give up on a receiver the owner still expects to work. Once
      // the fast budget is spent, retry on a slow, fixed cooldown instead.
      const backoff =
        failures.length >= MAX_FAILURES
          ? cooldownMs
          : Math.min(restartDelayMs * 2 ** (failures.length - 1), 30_000);
      record.phase = "starting";
      record.failureCode = failureCode;
      tryPublish();
      const end = Date.now() + backoff;
      while (!stopped && Date.now() < end && !stopRequested())
        await delay(Math.min(200, end - Date.now()));
    }
    record.phase = "stopped";
    record.failureCode = null;
    tryPublish();
  } catch (error) {
    record.phase = "failed";
    record.failureCode = "crashed";
    try {
      publish();
    } catch {
      /* Preserve the first failure. */
    }
    throw error;
  } finally {
    clearInterval(heartbeat);
    process.off("SIGTERM", cancel);
    process.off("SIGINT", cancel);
    process.off("uncaughtException", crashed);
    process.off("unhandledRejection", crashed);
    child?.kill("SIGTERM");
    try {
      if (stopToken(paths.stop) === token) removeMailFile(paths.stop);
      if (record.phase === "stopped" && readState(paths.state) === null)
        removeMailFile(paths.supervisor);
    } catch {
      /* Cleanup never replaces the outcome already recorded. */
    }
    release();
  }
}

/** Ask one worker generation to stop and wait briefly until it has. */
async function stopOrphanedWorker(
  paths: ReturnType<typeof files>,
  token: string,
): Promise<boolean> {
  writeMailJson(paths.stop, { token });
  const deadline = Date.now() + 5000;
  for (;;) {
    const current = readState(paths.state);
    if (
      !current ||
      current.token !== token ||
      current.phase === "stopped" ||
      current.phase === "failed" ||
      owner(current) === "gone"
    )
      return true;
    if (Date.now() >= deadline) return false;
    await delay(50);
  }
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
    const priorSupervisor = readSupervisor(paths.supervisor);
    if (
      priorSupervisor &&
      ["starting", "running"].includes(priorSupervisor.phase) &&
      owner(priorSupervisor) !== "gone"
    ) {
      const current = backgroundListenStatus(options);
      if (!current.healthy)
        throw new ListenStateError(
          "Existing supervisor ownership is stale or unverifiable. Inspect status before restarting.",
        );
      if (prior?.configuration !== configuration)
        throw new ListenStateError(
          "Stop the existing listener before changing receiving options.",
        );
      return { started: false, status: current };
    }
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
      // A supervisor record that is no longer running means this worker
      // lost its restart protection. Stop it and start a supervised one
      // rather than reuse it, even when an upgrade changed its options.
      if (!priorSupervisor) {
        if (prior.configuration !== configuration)
          throw new ListenStateError(
            "Stop the existing listener before changing receiving options.",
          );
        return { started: false, status: current };
      }
      if (!(await stopOrphanedWorker(paths, prior.token)))
        throw new ListenStateError(
          "The existing background listener lost its supervisor and did not stop. Stop it, then start again.",
        );
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
    env[SUPERVISOR_ENV] = "1";
    env[SUPERVISOR_ARGV_ENV] = JSON.stringify(argv);
    const child = spawn(process.execPath, [argv[0] ?? ""], {
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
      const supervisor = readSupervisor(paths.supervisor);
      if (
        current?.token !== token ||
        supervisor?.token !== token ||
        current.configuration !== configuration ||
        !current.detached ||
        !backgroundListenStatus(options).healthy
      )
        throw new ListenStateError(
          "Background listener ownership changed during startup.",
        );
      return { started: true, status: backgroundListenStatus(options) };
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
