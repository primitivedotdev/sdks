import { createHash, randomUUID } from "node:crypto";
import {
  closeSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  opendirSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { acquireListenLock, ListenStateError } from "./listen-state.js";
import { SESSION_UUID } from "./notify-session-native.js";

export type NotificationReceipt = {
  emailId: string;
  eventId: string;
  clientId: string;
  state: "submitting" | "accepted" | "unknown";
};
type EventIndex = { emailId: string; clientId: string; eventId: string };
type PendingWrite = { receipt: NotificationReceipt; eventId: string };
const invalid = () =>
  new ListenStateError(
    "Notification receipts are unavailable or inconsistent. Preserve this state to avoid duplicate notifications.",
  );
function uuid(value: unknown): string {
  if (typeof value !== "string" || !SESSION_UUID.test(value)) throw invalid();
  return value.toLowerCase();
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw invalid();
  return value as Record<string, unknown>;
}
function receipt(value: unknown): NotificationReceipt {
  const r = object(value);
  if (
    typeof r.state !== "string" ||
    !["submitting", "accepted", "unknown"].includes(r.state) ||
    Object.keys(r).length !== 4
  )
    throw invalid();
  return {
    emailId: uuid(r.emailId),
    eventId: uuid(r.eventId),
    clientId: uuid(r.clientId),
    state: r.state as NotificationReceipt["state"],
  };
}
function index(value: unknown): EventIndex {
  const r = object(value);
  if (Object.keys(r).length !== 3) throw invalid();
  return {
    emailId: uuid(r.emailId),
    eventId: uuid(r.eventId),
    clientId: uuid(r.clientId),
  };
}
function stateDirectory(configDir: string, scope: string, threadId: string) {
  const key = createHash("sha256")
    .update(JSON.stringify([scope, uuid(threadId)]))
    .digest("hex");
  return join(configDir, "session-notifications", key);
}
function privateDirectory(path: string) {
  const info = lstatSync(path);
  if (
    !process.getuid ||
    !info.isDirectory() ||
    info.uid !== process.getuid() ||
    info.mode & 0o077
  )
    throw invalid();
}
function read(path: string): unknown | null {
  try {
    const info = lstatSync(path);
    if (
      !info.isFile() ||
      info.uid !== process.getuid?.() ||
      info.mode & 0o077 ||
      info.size > 1024
    )
      throw invalid();
    const value: unknown = JSON.parse(readFileSync(path, "utf8"));
    if (value === null) throw invalid();
    return value;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw invalid();
  }
}
function readReceipt(
  directory: string,
  id: string,
): NotificationReceipt | null {
  const value = read(join(directory, "emails", `${uuid(id)}.json`));
  if (value === null) return null;
  const result = receipt(value);
  if (result.emailId !== uuid(id)) throw invalid();
  return result;
}
function readIndex(directory: string, id: string): EventIndex | null {
  const value = read(join(directory, "events", `${uuid(id)}.json`));
  if (value === null) return null;
  const result = index(value);
  if (result.eventId !== uuid(id)) throw invalid();
  return result;
}
function pendingWrite(directory: string): PendingWrite | null {
  const value = read(join(directory, "pending.json"));
  if (value === null) return null;
  const pending = object(value);
  if (Object.keys(pending).length !== 2) throw invalid();
  return { receipt: receipt(pending.receipt), eventId: uuid(pending.eventId) };
}
function rejectLegacy(directory: string) {
  try {
    lstatSync(join(directory, "receipts.json"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw invalid();
  }
  throw new ListenStateError(
    "Legacy prerelease receipt state is present. Preserve it; this format cannot be reopened automatically without risking duplicate notifications.",
  );
}
function syncDirectory(path: string) {
  const fd = openSync(path, "r");
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}
function atomicWrite(path: string, value: unknown) {
  const temporary = join(dirname(path), `.write-${randomUUID()}`);
  try {
    const fd = openSync(temporary, "wx", 0o600);
    try {
      writeFileSync(fd, `${JSON.stringify(value)}\n`);
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    renameSync(temporary, path);
    syncDirectory(dirname(path));
  } finally {
    try {
      unlinkSync(temporary);
    } catch {
      /* Stale temporary files never authorize replay. */
    }
  }
}
function checkCoherence(directory: string, update: PendingWrite) {
  const current = readReceipt(directory, update.receipt.emailId);
  const entry = readIndex(directory, update.eventId);
  if (!current && update.receipt.state !== "submitting") throw invalid();
  if (
    current &&
    (current.clientId !== update.receipt.clientId ||
      current.eventId !== update.receipt.eventId ||
      (current.state !== "submitting" &&
        current.state !== update.receipt.state))
  )
    throw invalid();
  if (
    entry &&
    (entry.emailId !== update.receipt.emailId ||
      entry.clientId !== update.receipt.clientId)
  )
    throw invalid();
  if (update.eventId !== update.receipt.eventId) {
    const primary = readIndex(directory, update.receipt.eventId);
    if (
      !current ||
      !primary ||
      primary.emailId !== current.emailId ||
      primary.clientId !== current.clientId
    )
      throw invalid();
  }
}
function applyPending(directory: string, update: PendingWrite) {
  checkCoherence(directory, update);
  atomicWrite(
    join(directory, "emails", `${update.receipt.emailId}.json`),
    update.receipt,
  );
  atomicWrite(join(directory, "events", `${update.eventId}.json`), {
    emailId: update.receipt.emailId,
    clientId: update.receipt.clientId,
    eventId: update.eventId,
  });
  unlinkSync(join(directory, "pending.json"));
  syncDirectory(directory);
}

/** One bounded journal update, under the existing listener lock, repairs torn indexes. */
export function openNotificationReceipts(
  configDir: string,
  scope: string,
  threadId: string,
) {
  const directory = stateDirectory(configDir, scope, threadId);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  privateDirectory(dirname(directory));
  privateDirectory(directory);
  rejectLegacy(directory);
  const release = acquireListenLock(directory, "notifications");
  try {
    for (const path of [join(directory, "emails"), join(directory, "events")]) {
      mkdirSync(path, { mode: 0o700, recursive: true });
      privateDirectory(path);
    }
    for (const path of [directory, dirname(directory), configDir])
      syncDirectory(path);
    const pending = pendingWrite(directory);
    if (pending) applyPending(directory, pending);
  } catch (error) {
    release();
    throw error;
  }
  function saveUpdate(update: PendingWrite) {
    if (pendingWrite(directory)) throw invalid();
    checkCoherence(directory, update);
    // This marker is durable before either index changes. Recovery is never dispatch.
    atomicWrite(join(directory, "pending.json"), update);
    applyPending(directory, update);
  }
  return {
    release,
    find(emailId: string, eventId: string) {
      const email = uuid(emailId),
        event = uuid(eventId);
      const current = readReceipt(directory, email);
      const entry = readIndex(directory, event);
      if (
        entry &&
        (!current ||
          entry.emailId !== email ||
          entry.clientId !== current.clientId)
      )
        throw invalid();
      // A second delivery event for the same email gets its own durable alias.
      if (current && !entry) saveUpdate({ receipt: current, eventId: event });
      return current;
    },
    save(value: NotificationReceipt) {
      const current = receipt(value);
      saveUpdate({ receipt: current, eventId: current.eventId });
    },
  };
}

export function notificationReceiptPage(
  configDir: string,
  scope: string,
  threadId: string,
  options: { limit?: number; cursor?: string } = {},
): { receipts: NotificationReceipt[]; nextCursor: string | null } {
  const limit = options.limit ?? 100;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000)
    throw new ListenStateError("--limit must be between 1 and 1000.");
  const cursor = options.cursor === undefined ? "" : uuid(options.cursor);
  const directory = stateDirectory(configDir, scope, threadId);
  try {
    privateDirectory(dirname(directory));
    privateDirectory(directory);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      return { receipts: [], nextCursor: null };
    throw invalid();
  }
  rejectLegacy(directory);
  for (const path of [join(directory, "emails"), join(directory, "events")])
    privateDirectory(path);
  const pending = pendingWrite(directory);
  if (pending) checkCoherence(directory, pending);
  const selected: string[] = [];
  const consider = (id: string) => {
    if (id <= cursor || selected.includes(id)) return;
    selected.push(id);
    selected.sort();
    if (selected.length > limit + 1) selected.pop();
  };
  if (pending) consider(pending.receipt.emailId);
  const entries = opendirSync(join(directory, "emails"));
  try {
    for (
      let entry = entries.readSync();
      entry !== null;
      entry = entries.readSync()
    ) {
      if (entry.name.startsWith(".write-")) continue;
      if (!entry.isFile() || !/^[a-f0-9-]{36}\.json$/.test(entry.name))
        throw invalid();
      consider(uuid(entry.name.slice(0, -5)));
    }
  } finally {
    entries.closeSync();
  }
  const hasMore = selected.length > limit;
  const ids = selected.slice(0, limit);
  const receipts = ids.map((id) => {
    const current =
      pending?.receipt.emailId === id
        ? pending.receipt
        : readReceipt(directory, id);
    if (!current) throw invalid();
    const matches = (entry: EventIndex | null) =>
      entry?.emailId === id && entry.clientId === current.clientId;
    if (
      !matches(readIndex(directory, current.eventId)) &&
      pending?.receipt.emailId !== id
    ) {
      // A writer can publish the email after our initial journal read. Its
      // durable marker must still exist, or its event index is now complete.
      const latest = pendingWrite(directory);
      if (latest?.receipt.emailId === id) {
        checkCoherence(directory, latest);
        return latest.receipt;
      }
      if (!matches(readIndex(directory, current.eventId))) throw invalid();
    }
    return current;
  });
  return { receipts, nextCursor: hasMore ? (ids.at(-1) ?? null) : null };
}
export function readNotificationReceipts(
  configDir: string,
  scope: string,
  threadId: string,
): NotificationReceipt[] {
  return notificationReceiptPage(configDir, scope, threadId).receipts;
}
