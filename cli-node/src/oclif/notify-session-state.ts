import { createHash, randomUUID } from "node:crypto";
import {
  closeSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
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
const invalid = () =>
  new ListenStateError(
    "Notification receipts are unavailable or invalid. Preserve this state to avoid duplicate notifications.",
  );
function stateDirectory(configDir: string, scope: string, threadId: string) {
  const key = createHash("sha256")
    .update(JSON.stringify([scope, threadId]))
    .digest("hex");
  return join(configDir, "session-notifications", key);
}
export function readNotificationReceipts(
  configDir: string,
  scope: string,
  threadId: string,
): NotificationReceipt[] {
  const directory = stateDirectory(configDir, scope, threadId);
  try {
    for (const path of [dirname(directory), directory]) {
      const info = lstatSync(path);
      if (
        !process.getuid ||
        !info.isDirectory() ||
        info.uid !== process.getuid() ||
        info.mode & 0o077
      )
        throw invalid();
    }
    const file = join(directory, "receipts.json");
    const info = lstatSync(file);
    if (
      !info.isFile() ||
      info.uid !== process.getuid?.() ||
      info.mode & 0o077 ||
      info.size > 8 * 1024 * 1024
    )
      throw invalid();
    const value: unknown = JSON.parse(readFileSync(file, "utf8"));
    if (
      !Array.isArray(value) ||
      !value.every(
        (r) =>
          r &&
          typeof r === "object" &&
          SESSION_UUID.test(r.emailId) &&
          SESSION_UUID.test(r.eventId) &&
          SESSION_UUID.test(r.clientId) &&
          ["submitting", "accepted", "unknown"].includes(r.state),
      )
    )
      throw invalid();
    if (
      new Set(value.map((r) => r.emailId)).size !== value.length ||
      new Set(value.map((r) => r.eventId)).size !== value.length
    )
      throw invalid();
    return value;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw invalid();
  }
}

export function openNotificationReceipts(
  configDir: string,
  scope: string,
  threadId: string,
) {
  const directory = stateDirectory(configDir, scope, threadId);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  for (const path of [directory, dirname(directory)]) {
    const info = lstatSync(path);
    if (
      !process.getuid ||
      !info.isDirectory() ||
      info.uid !== process.getuid() ||
      info.mode & 0o077
    )
      throw invalid();
  }
  const release = acquireListenLock(directory, "notifications");
  const file = join(directory, "receipts.json");
  let receipts: NotificationReceipt[] = [];
  try {
    receipts = readNotificationReceipts(configDir, scope, threadId);
  } catch (error) {
    release();
    throw error;
  }
  return {
    release,
    find(emailId: string, eventId: string) {
      return receipts.find(
        (r) => r.emailId === emailId || r.eventId === eventId,
      );
    },
    save(receipt: NotificationReceipt) {
      const updated = [
        ...receipts.filter((r) => r.emailId !== receipt.emailId),
        receipt,
      ];
      const bytes = `${JSON.stringify(updated)}\n`;
      if (Buffer.byteLength(bytes) > 8 * 1024 * 1024) throw invalid();
      const temporary = join(directory, `.receipt-${randomUUID()}`);
      try {
        const fd = openSync(temporary, "wx", 0o600);
        try {
          writeFileSync(fd, bytes);
          fsyncSync(fd);
        } finally {
          closeSync(fd);
        }
        renameSync(temporary, file);
        // Make both the receipt and newly created state directories durable.
        for (const path of [directory, dirname(directory), configDir]) {
          const fd = openSync(path, "r");
          try {
            fsyncSync(fd);
          } finally {
            closeSync(fd);
          }
        }
        receipts = updated;
      } finally {
        try {
          unlinkSync(temporary);
        } catch {
          // A leftover temporary file cannot authorize dispatch or replay.
        }
      }
    },
  };
}
