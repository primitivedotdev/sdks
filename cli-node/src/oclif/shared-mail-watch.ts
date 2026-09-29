import { randomUUID } from "node:crypto";
import { watch } from "node:fs";
import { join } from "node:path";
import {
  acquireListenLock,
  compareListenProcessIdentity,
  listenProcessIdentity,
} from "./listen-state.js";
import {
  invalidSharedMail,
  mailId,
  mailLockBusy,
  mailObject,
  mailString,
  readMailJson,
  removeMailFile,
  writeMailJson,
} from "./shared-mail-files.js";
import type { SharedMailStore } from "./shared-mail-state.js";

type OwnerRecord = {
  generation: string;
  pid: number;
  identity: string;
  ready: boolean;
  gapCount: number;
  lastGapReason: string | null;
};
export type SharedMailOwner = OwnerRecord & { alive: boolean };
function ownerRecord(value: unknown): OwnerRecord {
  const o = mailObject(value, [
    "generation",
    "pid",
    "identity",
    "ready",
    "gapCount",
    "lastGapReason",
  ]);
  if (
    typeof o.pid !== "number" ||
    !Number.isSafeInteger(o.pid) ||
    o.pid < 1 ||
    typeof o.ready !== "boolean" ||
    typeof o.gapCount !== "number" ||
    !Number.isSafeInteger(o.gapCount) ||
    o.gapCount < 0
  )
    throw invalidSharedMail();
  return {
    generation: mailId(o.generation),
    pid: o.pid,
    identity: mailString(o.identity),
    ready: o.ready,
    gapCount: o.gapCount,
    lastGapReason:
      o.lastGapReason === null ? null : mailString(o.lastGapReason, 100),
  };
}
export function readSharedMailOwner(
  store: Pick<SharedMailStore, "directory">,
): SharedMailOwner | null {
  const raw = readMailJson(join(store.directory, "owner.json"));
  if (raw === null) return null;
  const owner = ownerRecord(raw);
  return {
    ...owner,
    alive:
      compareListenProcessIdentity(
        owner.identity,
        listenProcessIdentity(owner.pid),
      ) === true,
  };
}

/** The caller stays in the foreground and owns the only remote stream until close. */
export function tryOwnSharedMail(store: Pick<SharedMailStore, "directory">) {
  let release: () => void;
  try {
    release = acquireListenLock(store.directory, "shared-mail-stream");
  } catch (error) {
    if (mailLockBusy(error)) return null;
    throw error;
  }
  const path = join(store.directory, "owner.json"),
    identity = listenProcessIdentity(process.pid);
  if (identity === null) {
    release();
    throw invalidSharedMail();
  }
  let current: OwnerRecord = {
    generation: randomUUID(),
    pid: process.pid,
    identity,
    ready: false,
    gapCount: 0,
    lastGapReason: null,
  };
  let closed = false;
  try {
    writeMailJson(path, current);
  } catch (error) {
    release();
    throw error;
  }
  const markStatus = (status: {
    ready?: boolean;
    gapCount?: number;
    lastGapReason?: string | null;
  }) => {
    if (closed) throw invalidSharedMail();
    const existing = readMailJson(path);
    if (
      existing === null ||
      ownerRecord(existing).generation !== current.generation
    )
      throw invalidSharedMail();
    const next = ownerRecord({ ...current, ...status });
    if (next.gapCount < current.gapCount) throw invalidSharedMail();
    writeMailJson(path, next);
    current = next;
  };
  return {
    generation: current.generation,
    markReady(
      status: { gapCount?: number; lastGapReason?: string | null } = {},
    ) {
      markStatus({ ...status, ready: true });
    },
    markStatus,
    close() {
      if (closed) return;
      closed = true;
      try {
        const existing = readMailJson(path);
        if (
          existing !== null &&
          ownerRecord(existing).generation === current.generation
        )
          removeMailFile(path);
      } finally {
        release();
      }
    },
  };
}

/** Install before reading state. Watches are hints; timeout reconciles local records only. */
export function waitForSharedMailChange(
  store: Pick<SharedMailStore, "directory">,
  options: { signal: AbortSignal; timeoutMs?: number },
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? 1000;
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > 60_000)
    throw new RangeError(
      "Shared mail reconciliation delay must be between 1 and 60000 milliseconds.",
    );
  return new Promise((resolve, reject) => {
    const watchers: ReturnType<typeof watch>[] = [];
    let timer: ReturnType<typeof setTimeout> | undefined;
    let done = false;
    const finish = (error?: unknown) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      options.signal.removeEventListener("abort", abort);
      for (const watcher of watchers) watcher.close();
      if (error !== undefined) reject(error);
      else resolve();
    };
    const abort = () =>
      finish(options.signal.reason ?? new Error("Shared mail wait aborted."));
    options.signal.addEventListener("abort", abort, { once: true });
    if (options.signal.aborted) {
      abort();
      return;
    }
    try {
      for (const path of [
        store.directory,
        join(store.directory, "emails"),
        join(store.directory, "waits"),
      ]) {
        const watcher = watch(path, (_event, filename) => {
          // State reads acquire short lock files. Those must not wake their own
          // watcher and create a busy loop; only published records are hints.
          const name = filename?.toString();
          if (
            name &&
            (path === store.directory
              ? name === "owner.json"
              : name.endsWith(".json") && !name.startsWith(".write-"))
          )
            finish();
        });
        watchers.push(watcher);
        // A lost watcher is recoverable by inspecting durable state at the local deadline.
        watcher.on("error", () => finish());
      }
      timer = setTimeout(() => finish(), timeoutMs);
    } catch (error) {
      finish(error);
    }
  });
}
