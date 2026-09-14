import { createHash, randomUUID, scryptSync } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
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
};
export type ChatReceipt = { path: string; data: ReceiptData };

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
    writeFileSync(temporary, `${JSON.stringify(receipt.data)}\n`, {
      mode: 0o600,
    });
    renameSync(temporary, receipt.path);
  } finally {
    rmSync(temporary, { force: true });
  }
}

function parseReceipt(raw: string): ReceiptData {
  const value: ReceiptData = JSON.parse(raw);
  if (
    !value ||
    value.version !== 1 ||
    typeof value.request_hash !== "string" ||
    typeof value.sent_at !== "string" ||
    !Number.isFinite(Date.parse(value.sent_at)) ||
    typeof value.completed !== "boolean" ||
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

/** Caller holds the request/parent lock until completion. Unknown POSTs never retry. */
export function beginChatReceipt(
  configDir: string,
  scope: string,
  requestHash: string,
): ChatReceipt {
  const directory = join(configDir, "chat-receipts");
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const path = join(directory, `${chatRequestHash(scope)}.json`);
  let previous: ReceiptData | undefined;
  try {
    previous = parseReceipt(readFileSync(path, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw new Error(
        `Cannot safely read chat receipt ${path}. Inspect it and sent history before retrying.`,
        { cause: error },
      );
    }
  }
  if (previous && !previous.completed) {
    if (previous.sent === null) {
      throw new Error(
        `A previous send has an uncertain outcome. Inspect sent history before sending again. Receipt: ${path}`,
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
    },
  };
  saveChatReceipt(receipt);
  return receipt;
}
