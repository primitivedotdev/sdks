import { createHash, randomUUID, scryptSync } from "node:crypto";
import {
  closeSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import type { SendMailResult } from "@primitivedotdev/api-core";

// Receipts contain send metadata, never message bodies, attachments or credentials.
// Write before POST, then record its acknowledgement before starting the reply wait.
type ReceiptData = {
  version: 1;
  request_hash: string;
  sent_at: string;
  sent: SendMailResult | null;
  completed: boolean;
  reply?: { emailId: string; requestId: string };
  idempotency_key?: string;
  send_attempted?: boolean;
  /**
   * Set on every receipt this version writes. A receipt without it was
   * written by a version that defaulted --from to agent@ at the first active
   * domain, which the legacy check in chat looks for.
   */
  from_rule?: "per_credential";
};
export type ChatReceipt = { path: string; data: ReceiptData };

/** A previous attempt may or may not have sent; the caller must not resend blindly. */
export class UncertainChatSendError extends Error {
  /** When the unresolved attempt started, if the receipt recorded it. */
  readonly sentAtIso?: string;

  constructor(
    message: string,
    options?: ErrorOptions & { sentAtIso?: string },
  ) {
    super(message, options);
    this.name = "UncertainChatSendError";
    this.sentAtIso = options?.sentAtIso;
  }
}

/** Keep API credentials out of request fingerprints, including low-entropy local keys. */
export function chatCredentialIdentity(
  key: string | undefined,
  apiOrigin: string,
): string | undefined {
  return key === undefined
    ? undefined
    : scryptSync(key, apiOrigin, 32).toString("hex");
}

export function chatRequestHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function saveChatReceipt(receipt: ChatReceipt): void {
  const temporary = `${receipt.path}.${process.pid}.${randomUUID()}.tmp`;
  try {
    const file = openSync(temporary, "wx", 0o600);
    try {
      writeFileSync(file, `${JSON.stringify(receipt.data)}\n`);
      fsyncSync(file);
    } finally {
      closeSync(file);
    }
    renameSync(temporary, receipt.path);
    // Windows cannot open directories for fsync through this API.
    if (process.platform !== "win32") {
      for (const path of [
        join(receipt.path, ".."),
        join(receipt.path, "../.."),
      ]) {
        const directory = openSync(path, "r");
        try {
          fsyncSync(directory);
        } finally {
          closeSync(directory);
        }
      }
    }
  } finally {
    rmSync(temporary, { force: true });
  }
}

function parseReceipt(raw: string): ReceiptData {
  const value: ReceiptData = JSON.parse(raw);
  if (
    value?.version !== 1 ||
    typeof value.request_hash !== "string" ||
    typeof value.sent_at !== "string" ||
    !Number.isFinite(Date.parse(value.sent_at)) ||
    typeof value.completed !== "boolean" ||
    (value.reply !== undefined &&
      (!value.reply ||
        typeof value.reply !== "object" ||
        typeof value.reply.emailId !== "string" ||
        !value.reply.emailId ||
        typeof value.reply.requestId !== "string" ||
        !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
          value.reply.requestId,
        ))) ||
    (value.idempotency_key !== undefined &&
      (typeof value.idempotency_key !== "string" ||
        !/^[!-~]{1,255}$/.test(value.idempotency_key))) ||
    (value.send_attempted !== undefined &&
      typeof value.send_attempted !== "boolean") ||
    (value.sent !== null &&
      (!value.sent ||
        typeof value.sent.id !== "string" ||
        !value.sent.id ||
        typeof value.sent.status !== "string"))
  ) {
    throw new Error("Invalid chat receipt");
  }
  return value;
}

/**
 * True when a receipt exists for `scope` and is not completed. An unreadable
 * receipt counts as unfinished: beginChatReceipt then reports it instead of
 * a retry quietly starting a second send beside it.
 */
export function hasUnfinishedChatReceipt(
  configDir: string,
  scope: string,
): boolean {
  const path = join(
    configDir,
    "chat-receipts",
    `${chatRequestHash(scope)}.json`,
  );
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== "ENOENT";
  }
  try {
    return !parseReceipt(raw).completed;
  } catch {
    return true;
  }
}

/**
 * How long after it started an earlier version's unfinished chat is still
 * looked for. Bounds the legacy check in chat so it ends on its own: past a
 * day, a retry of that exact chat is not expected.
 */
export const LEGACY_CHAT_RECEIPT_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Whether a chat an earlier version of this CLI started in the last day is
 * still unfinished: an unfinished receipt without `from_rule`. An unreadable
 * receipt counts. Read from the saved receipts alone, as a cheap first test
 * before asking the API anything.
 */
export function anyUnfinishedLegacyChatReceipt(
  configDir: string,
  now: number = Date.now(),
): boolean {
  const directory = join(configDir, "chat-receipts");
  let names: string[];
  try {
    names = readdirSync(directory);
  } catch {
    return false;
  }
  return names.some((name) => {
    if (!name.endsWith(".json")) return false;
    const path = join(directory, name);
    try {
      const data = parseReceipt(readFileSync(path, "utf8"));
      return (
        !data.completed &&
        data.from_rule === undefined &&
        now - Date.parse(data.sent_at) <= LEGACY_CHAT_RECEIPT_WINDOW_MS
      );
    } catch {
      // Unreadable: counted while recently written, so one damaged file
      // does not keep the check running for good.
      try {
        return now - statSync(path).mtimeMs <= LEGACY_CHAT_RECEIPT_WINDOW_MS;
      } catch {
        return false;
      }
    }
  });
}

/**
 * The unfinished receipt filed under `scope`, or null when there is none or
 * it is finished: its recorded send, when it started, its idempotency key
 * when it kept one, and its path. An unreadable receipt counts as unfinished
 * with nothing recorded.
 */
export function loadUnfinishedChatReceipt(
  configDir: string,
  scope: string,
): {
  path: string;
  sent: SendMailResult | null;
  sentAtIso?: string;
  idempotencyKey?: string;
} | null {
  const path = join(
    configDir,
    "chat-receipts",
    `${chatRequestHash(scope)}.json`,
  );
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "ENOENT"
      ? null
      : { path, sent: null };
  }
  try {
    const data = parseReceipt(raw);
    if (data.completed) return null;
    return {
      path,
      sent: data.sent,
      sentAtIso: data.sent_at,
      ...(data.idempotency_key ? { idempotencyKey: data.idempotency_key } : {}),
    };
  } catch {
    return { path, sent: null };
  }
}

/** Caller holds the request/parent lock until completion. Unknown POSTs never retry. */
export function beginChatReceipt(
  configDir: string,
  scope: string,
  requestHash: string,
  options: { connected?: boolean } = {},
): ChatReceipt {
  const directory = join(configDir, "chat-receipts");
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const path = join(directory, `${chatRequestHash(scope)}.json`);
  let previous: ReceiptData | undefined;
  try {
    previous = parseReceipt(readFileSync(path, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw new UncertainChatSendError(
        `Cannot safely read chat receipt ${path}. Inspect it and sent history before retrying.`,
        { cause: error },
      );
    }
  }
  if (previous && !previous.completed) {
    if (previous.sent === null) {
      if (
        options.connected &&
        previous.idempotency_key &&
        previous.send_attempted !== undefined
      ) {
        if (previous.request_hash !== requestHash)
          throw new UncertainChatSendError(
            "This request has an unresolved send intent. Resume the same message before starting a different reply.",
          );
        return { path, data: previous };
      }
      throw new UncertainChatSendError(
        `A previous send has an uncertain outcome. Inspect sent history before sending again. Receipt: ${path}`,
        { sentAtIso: previous.sent_at },
      );
    }
    if (previous.request_hash !== requestHash) {
      throw new Error(
        `This reply still awaits a response to sent email ${previous.sent.id}. Retry the same message to resume, or inspect that send. Receipt: ${path}`,
      );
    }
    return { path, data: previous };
  }
  const receipt: ChatReceipt = {
    path,
    data: {
      version: 1,
      request_hash: requestHash,
      sent_at: new Date().toISOString(),
      sent: null,
      completed: false,
      from_rule: "per_credential",
      ...(options.connected
        ? {
            idempotency_key: `primitive-chat-${randomUUID()}`,
            send_attempted: false,
          }
        : {}),
    },
  };
  saveChatReceipt(receipt);
  return receipt;
}
