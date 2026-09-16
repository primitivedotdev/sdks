import { createHash, randomUUID } from "node:crypto";
import {
  closeSync,
  constants,
  fstatSync,
  linkSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

/**
 * Conversation locks cover one request/reply cycle. The default lock retains
 * its historical filename and protects short shared chat-state transactions.
 * Scope names are hashed so addresses and other identifiers stay out of paths.
 */
const LOCK_FILENAME = "chat-state.lock";
const STATE_LOCK_TIMEOUT_MS = 5_000;
const STATE_LOCK_RETRY_MS = 25;

type Snapshot = { device: number; inode: number; contents: string };
type Holder = Snapshot & { path: string; depth: number };
const processHolders = new Map<string, Holder>();
let exitListenersInstalled = false;

function lockPath(configDir: string, scope?: string): string {
  const name =
    scope === undefined
      ? LOCK_FILENAME
      : `chat-${createHash("sha256").update(scope).digest("hex")}.lock`;
  return join(resolve(configDir), name);
}

function readSnapshot(path: string): Snapshot | null {
  let fd: number;
  try {
    // A lock is a regular file. Do not follow an unexpected symlink.
    if (!lstatSync(path).isFile()) return null;
    fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  try {
    const stat = fstatSync(fd);
    return {
      device: stat.dev,
      inode: stat.ino,
      contents: stat.size <= 128 ? readFileSync(fd, "utf8") : "",
    };
  } finally {
    closeSync(fd);
  }
}

function matchesSnapshot(path: string, snapshot: Snapshot): boolean {
  const current = readSnapshot(path);
  return (
    current !== null &&
    current.device === snapshot.device &&
    current.inode === snapshot.inode &&
    current.contents === snapshot.contents
  );
}

function removeOwnedLock(holder: Holder): void {
  try {
    if (matchesSnapshot(holder.path, holder)) unlinkSync(holder.path);
  } catch {
    // Cleanup is best effort, and must never remove an unverified replacement.
  }
}

function installExitListenersOnce(): void {
  if (exitListenersInstalled) return;
  exitListenersInstalled = true;
  const cleanup = (): void => {
    for (const holder of processHolders.values()) removeOwnedLock(holder);
    processHolders.clear();
  };
  process.on("exit", cleanup);
  const signals = ["SIGINT", "SIGTERM", "SIGHUP"] as const;
  for (const signal of signals) {
    const handler = (): void => {
      cleanup();
      process.removeListener(signal, handler);
      process.kill(process.pid, signal);
    };
    process.on(signal, handler);
  }
}

function pidIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM and unknown errors are not proof that the holder is dead.
    return (error as NodeJS.ErrnoException).code !== "ESRCH";
  }
}

function holderPid(snapshot: Snapshot | null): number | null {
  const lines = snapshot?.contents.trim().split("\n");
  if (!lines || lines.length > 2 || !/^[1-9]\d*$/.test(lines[0] ?? ""))
    return null;
  if (lines.length === 2 && !/^[0-9a-f-]{36}$/.test(lines[1] ?? ""))
    return null;
  const pid = Number(lines[0]);
  return Number.isSafeInteger(pid) && pid > 0 ? pid : null;
}

function reclaimStaleLock(
  path: string,
  previous: Snapshot,
  temporary: string,
  contender: Snapshot,
): void {
  const guards: Array<{ path: string; snapshot: Snapshot }> = [];
  const visited = new Set<string>();
  let target = previous;
  // Each successor is elected against an immutable record. Never unlink a dead
  // guard to take it over: that would recreate the stale-lock deletion race.
  // A crashed successor is recovered in exactly the same way on the next try.
  for (;;) {
    const identity = createHash("sha256")
      .update(`${target.device}:${target.inode}:${target.contents}`)
      .digest("hex");
    const guardPath = `${path}.reclaim-${identity}`;
    if (visited.has(guardPath)) throw new ChatLockContentionError(0);
    visited.add(guardPath);
    try {
      linkSync(temporary, guardPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      const guard = readSnapshot(guardPath);
      const pid = holderPid(guard);
      if (!guard || pid === null || pidIsAlive(pid))
        throw new ChatLockContentionError(pid ?? 0);
      guards.push({ path: guardPath, snapshot: guard });
      target = guard;
      continue;
    }
    guards.push({ path: guardPath, snapshot: contender });
    let removed = false;
    try {
      const pid = holderPid(previous);
      if (matchesSnapshot(path, previous) && pid !== null && !pidIsAlive(pid))
        unlinkSync(path);
      // Cleanup is safe only once the original record is gone. New lock
      // generations use different guards; delayed contenders must recheck it.
      removed = !matchesSnapshot(path, previous);
    } finally {
      if (removed) {
        for (const guard of guards) {
          try {
            if (matchesSnapshot(guard.path, guard.snapshot))
              unlinkSync(guard.path);
          } catch {
            // Leftover records contain a PID and remain recoverable after exit.
          }
        }
      }
    }
    return;
  }
}

export class ChatLockContentionError extends Error {
  constructor(public readonly holderPid: number) {
    super(
      holderPid > 0
        ? `Another \`primitive chat\` invocation (pid ${holderPid}) is in progress. ` +
            "Wait for it to finish, or kill it before retrying."
        : "The chat lock holder could not be verified. Retry after the current invocation finishes.",
    );
    this.name = "ChatLockContentionError";
  }
}

function releaseHolder(holder: Holder): () => void {
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (processHolders.get(holder.path) !== holder) return;
    holder.depth -= 1;
    if (holder.depth === 0) {
      removeOwnedLock(holder);
      processHolders.delete(holder.path);
    }
  };
}

/** Acquire synchronously; the same scope is reentrant within this process. */
export function acquireChatLock(configDir: string, scope?: string): () => void {
  const path = lockPath(configDir, scope);
  const held = processHolders.get(path);
  if (held) {
    if (!matchesSnapshot(path, held)) throw new ChatLockContentionError(0);
    held.depth += 1;
    return releaseHolder(held);
  }
  mkdirSync(resolve(configDir), { mode: 0o700, recursive: true });

  // Publish an already complete record atomically. Other readers never see
  // an empty file between exclusive creation and writing the PID.
  const contents = `${process.pid}\n${randomUUID()}\n`;
  const temporary = `${path}.${randomUUID()}.tmp`;
  const fd = openSync(temporary, "wx", 0o600);
  let snapshot: Snapshot;
  try {
    writeFileSync(fd, contents);
    const stat = fstatSync(fd);
    snapshot = { device: stat.dev, inode: stat.ino, contents };
  } catch (error) {
    closeSync(fd);
    unlinkSync(temporary);
    throw error;
  }
  closeSync(fd);

  const publish = (): boolean => {
    try {
      linkSync(temporary, path);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") return false;
      throw error;
    }
  };
  try {
    let acquired = publish();
    if (!acquired) {
      const previous = readSnapshot(path);
      const pid = holderPid(previous);
      // Empty/malformed records can belong to a writer still initializing.
      // Neither age nor a missing PID establishes that the file is abandoned.
      if (!previous || pid === null || pidIsAlive(pid)) {
        throw new ChatLockContentionError(pid ?? 0);
      }

      reclaimStaleLock(path, previous, temporary, snapshot);
      acquired = publish();
      if (!acquired)
        throw new ChatLockContentionError(holderPid(readSnapshot(path)) ?? 0);
    }
    const holder: Holder = { ...snapshot, path, depth: 1 };
    processHolders.set(path, holder);
    installExitListenersOnce();
    return releaseHolder(holder);
  } finally {
    try {
      unlinkSync(temporary);
    } catch {
      /* Best-effort temporary-file cleanup. */
    }
  }
}

/**
 * Serialize short state transactions, including independent callers in this
 * process. Do not nest this API or hold its release function across network IO.
 */
export async function acquireChatStateLock(
  configDir: string,
): Promise<() => void> {
  const deadline = performance.now() + STATE_LOCK_TIMEOUT_MS;
  const path = lockPath(configDir);
  for (;;) {
    try {
      if (processHolders.has(path))
        throw new ChatLockContentionError(process.pid);
      return acquireChatLock(configDir);
    } catch (error) {
      if (!(error instanceof ChatLockContentionError)) throw error;
      const remaining = deadline - performance.now();
      if (remaining <= 0) throw error;
      await delay(Math.min(STATE_LOCK_RETRY_MS, remaining));
    }
  }
}

/** Test-only: discard process bookkeeping without deleting filesystem locks. */
export function _resetChatLockForTests(): void {
  processHolders.clear();
}
