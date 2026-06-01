import {
  closeSync,
  mkdirSync,
  openSync,
  readFileSync,
  unlinkSync,
  writeSync,
} from "node:fs";
import { join } from "node:path";

/**
 * Filesystem mutex around the chat-state read → POST → save sequence.
 *
 * Why this exists. The chat reply flow is read-modify-write across an
 * RTT to the API: `loadActiveChatState` → `replyToEmail` → poll → save.
 * Two concurrent invocations (e.g. the user re-runs `primitive chat
 * reply` before the first cycle finishes its 5–12 s poll) read the
 * same stale `last_reply_email_id` and POST to it, producing a
 * duplicate /v1/emails/{id}/reply that the server deduplicates by
 * content_hash. The second invocation then polls forever for a reply
 * that arrived in response to the *first* send and has already been
 * surfaced by the *first* invocation.
 *
 * The lock is per-process-config-dir, not per-conversation: holding it
 * for a few seconds while one chat reply completes is a reasonable UX
 * constraint and clearly explained on contention. The lock is
 * re-entrant within a single Node process (ChatReplyCommand wraps
 * ChatCommand internally), but rejects cross-process contention.
 *
 * Liveness. The lock file stores the holder's PID. On EEXIST we probe
 * the holder with `process.kill(pid, 0)`; if the holder is gone (e.g.
 * a previous chat invocation crashed without releasing), we steal the
 * lock. This avoids needing a heartbeat or mtime-based stale check,
 * either of which has its own race surface.
 *
 * Releases. The returned function is idempotent. Callers must call it
 * in a finally block. We also register process-exit / signal handlers
 * so a Ctrl-C during the poll loop still cleans up.
 */

const LOCK_FILENAME = "chat-state.lock";

let processHolder: { configDir: string; depth: number } | null = null;

/**
 * Whether we've installed our exit / signal listeners on the
 * `process` object. Done lazily on first acquire and never undone:
 * adding handlers per-acquire would let them accumulate (each
 * acquire registers four listeners, and `process.once` can't be
 * un-once'd), which is harmless in production but produces
 * `MaxListenersExceededWarning` + cascading no-op fires in tests
 * that acquire/release across many `it()` blocks. Greptile P2.
 *
 * The handlers consult the current `processHolder` and act only if
 * a lock is actually held, so leaving them installed across
 * release boundaries is safe: a released or never-acquired lock
 * makes them no-ops.
 */
let exitListenersInstalled = false;

function installExitListenersOnce(): void {
  if (exitListenersInstalled) return;
  exitListenersInstalled = true;

  const cleanup = (): void => {
    if (processHolder === null) return;
    try {
      unlinkSync(lockPath(processHolder.configDir));
    } catch {
      // best-effort: another process may have stolen the lock by now
    }
    processHolder = null;
  };

  process.on("exit", cleanup);

  const signals = ["SIGINT", "SIGTERM", "SIGHUP"] as const;
  for (const signal of signals) {
    const handler = (): void => {
      cleanup();
      // Re-raise with the default handler so the exit code reflects
      // the signal rather than 0. Remove our own listener first so
      // the re-raise doesn't recurse.
      process.removeListener(signal, handler);
      process.kill(process.pid, signal);
    };
    process.on(signal, handler);
  }
}

function lockPath(configDir: string): string {
  return join(configDir, LOCK_FILENAME);
}

/**
 * `process.kill(pid, 0)` returns true if the process exists and we
 * have permission to signal it. Throws ESRCH when the pid is gone,
 * EPERM if it exists but isn't ours. Both "exists" cases mean we
 * should NOT steal the lock; only ESRCH proves the holder is dead.
 */
function pidIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ESRCH") return false;
    // EPERM (or anything else) → process exists but inaccessible.
    // Treat as alive to be safe.
    return true;
  }
}

function readHolderPid(configDir: string): number | null {
  try {
    const raw = readFileSync(lockPath(configDir), "utf8").trim();
    const pid = Number.parseInt(raw, 10);
    return Number.isFinite(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}

export class ChatLockContentionError extends Error {
  constructor(public readonly holderPid: number) {
    super(
      `Another \`primitive chat\` invocation (pid ${holderPid}) is in progress. ` +
        `Wait for it to finish, or kill it before retrying.`,
    );
    this.name = "ChatLockContentionError";
  }
}

/**
 * Acquire the chat-state mutex for this configDir. Returns a release
 * function that is safe to call any number of times. Throws
 * `ChatLockContentionError` if another live process holds the lock.
 */
export function acquireChatLock(configDir: string): () => void {
  if (processHolder?.configDir === configDir) {
    // Re-entrant acquire from inside the same Node process (e.g.
    // ChatReplyCommand delegates to ChatCommand). Bump the depth and
    // return a no-op release that decrements it.
    processHolder.depth += 1;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      if (processHolder !== null) {
        processHolder.depth -= 1;
      }
    };
  }

  mkdirSync(configDir, { mode: 0o700, recursive: true });

  for (let attempt = 0; attempt < 2; attempt++) {
    let fd: number;
    try {
      fd = openSync(lockPath(configDir), "wx", 0o600);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
      const holder = readHolderPid(configDir);
      if (holder === null || !pidIsAlive(holder)) {
        // Stale lock from a crashed invocation. Steal it.
        try {
          unlinkSync(lockPath(configDir));
        } catch (unlinkErr) {
          if ((unlinkErr as NodeJS.ErrnoException).code !== "ENOENT") {
            throw unlinkErr;
          }
        }
        continue;
      }
      throw new ChatLockContentionError(holder);
    }

    writeSync(fd, `${process.pid}\n`);
    closeSync(fd);
    processHolder = { configDir, depth: 1 };
    installExitListenersOnce();

    let released = false;
    return () => {
      if (released) return;
      released = true;
      if (processHolder?.configDir === configDir) {
        processHolder.depth -= 1;
        if (processHolder.depth <= 0) {
          try {
            unlinkSync(lockPath(configDir));
          } catch {
            // ignore
          }
          processHolder = null;
        }
      }
    };
  }

  /* v8 ignore next 4 -- the for-loop returns or throws on every iteration; the unreachable trailer keeps TS happy. */
  throw new Error(
    "acquireChatLock: exhausted retries (this is a bug — should not be reachable)",
  );
}

/**
 * Test-only: clear in-process holder state. Production code must never
 * call this; concurrent tests rely on the module-level state being
 * reset between `it()` blocks.
 */
export function _resetChatLockForTests(): void {
  processHolder = null;
}
