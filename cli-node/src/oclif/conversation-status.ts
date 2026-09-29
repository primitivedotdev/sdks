import { createHash } from "node:crypto";
import { join } from "node:path";
import {
  type EmailDetail,
  getSentEmail,
  type PrimitiveApiClient,
} from "@primitivedotdev/api-core";
import type { ConversationStatusContent } from "./notify-session-content.js";
import {
  mailId,
  mailObject,
  privateMailDirectory,
  readMailJson,
  withMailLock,
  writeMailJson,
} from "./shared-mail-files.js";
import type { SharedMailWait } from "./shared-mail-state.js";

export type ConversationStatus = {
  emailId: string;
  sentEmailId: string;
  kind: ConversationStatusContent["kind"];
  peer: string;
};

/** A References-derived parent ID cannot prove which Message-ID a signal names. */
export async function readBoundSentMessageId(
  apiClient: PrimitiveApiClient,
  wait: SharedMailWait,
  signal: AbortSignal,
): Promise<string | null> {
  if (!wait.sentEmailId) return null;
  try {
    const result = await getSentEmail({
      client: apiClient.client,
      path: { id: wait.sentEmailId },
      signal,
      responseStyle: "fields",
    });
    const sent = result.data?.data;
    if (
      result.error ||
      result.data?.success !== true ||
      sent?.id !== wait.sentEmailId ||
      typeof sent.message_id !== "string" ||
      sent.message_id.length < 3 ||
      sent.message_id.length > 1000 ||
      /[\r\n]/.test(sent.message_id)
    )
      return null;
    return sent.message_id;
  } catch {
    return null;
  }
}

/** An email interaction is only session status when it names this exact bound send. */
export function boundConversationStatus(
  detail: EmailDetail,
  content: ConversationStatusContent | null,
  wait: SharedMailWait | null,
  sentMessageId: string | null,
  sessionKey: string,
  now = Date.now(),
): ConversationStatus | null {
  if (!content || !wait || wait.status !== "bound") return null;
  const peer = detail.from_email.trim().toLowerCase();
  const receivedAt = Date.parse(detail.received_at);
  if (
    !wait.sentEmailId ||
    !sentMessageId ||
    detail.reply_to_sent_email_id !== wait.sentEmailId ||
    wait.peer !== peer ||
    wait.sessionKey !== sessionKey ||
    !Number.isFinite(receivedAt) ||
    receivedAt < Date.parse(wait.createdAt) ||
    detail.parsed?.in_reply_to?.length !== 1 ||
    detail.parsed.in_reply_to[0] !== sentMessageId ||
    content.subjectMessageId !== sentMessageId ||
    content.interactionDomain !== peer.slice(peer.lastIndexOf("@") + 1)
  )
    return null;
  if (content.kind === "working" || content.kind === "typing") {
    const expires = Date.parse(content.expiresAt ?? "");
    if (
      !Number.isFinite(expires) ||
      expires <= now ||
      expires > receivedAt + 60_000
    )
      return null;
  }
  return {
    emailId: detail.id,
    sentEmailId: wait.sentEmailId,
    kind: content.kind,
    peer,
  };
}

type Entry = { key: string; emailIds: string[]; at: number };
function entries(value: unknown): Entry[] {
  if (value === null) return [];
  const row = mailObject(value, ["version", "entries"]);
  if (
    row.version !== 1 ||
    !Array.isArray(row.entries) ||
    row.entries.length > 256
  )
    throw new Error(
      "Conversation status state is invalid; preserve it before retrying.",
    );
  return row.entries.map((value) => {
    const entry = mailObject(value, ["key", "emailIds", "at"]);
    if (
      typeof entry.key !== "string" ||
      !/^[a-f0-9]{64}$/.test(entry.key) ||
      !Number.isSafeInteger(entry.at) ||
      Number(entry.at) < 0 ||
      !Array.isArray(entry.emailIds) ||
      entry.emailIds.length > 16
    )
      throw new Error(
        "Conversation status state is invalid; preserve it before retrying.",
      );
    return {
      key: entry.key,
      emailIds: entry.emailIds.map(mailId),
      at: Number(entry.at),
    };
  });
}

/** Suppress duplicate IDs and rapid activity refreshes across hook restarts. */
export async function conversationStatusDue(
  context: {
    configDir: string;
    scope: string;
    recipient: string;
    sessionKey: string;
  },
  status: ConversationStatus,
  now = Date.now(),
): Promise<boolean> {
  const directory = statusDirectory(context);
  privateMailDirectory(directory, true);
  return withMailLock(directory, () => {
    const retained = entries(
      readMailJson(join(directory, "state.json")),
    ).filter((entry) => entry.at >= now - 86_400_000);
    return statusDue(retained, status, now);
  });
}

function statusDirectory(context: {
  configDir: string;
  scope: string;
  recipient: string;
  sessionKey: string;
}): string {
  return join(
    context.configDir,
    "conversation-status",
    createHash("sha256")
      .update(
        JSON.stringify([context.scope, context.recipient, context.sessionKey]),
      )
      .digest("hex"),
  );
}

function statusKey(status: ConversationStatus): string {
  return createHash("sha256")
    .update(JSON.stringify([status.sentEmailId, status.peer, status.kind]))
    .digest("hex");
}

function statusDue(
  retained: Entry[],
  status: ConversationStatus,
  now: number,
): boolean {
  const previous = retained.find((entry) => entry.key === statusKey(status));
  const emailId = mailId(status.emailId);
  if (previous?.emailIds.includes(emailId)) return false;
  const interval =
    status.kind === "typing" ? 8_000 : status.kind === "working" ? 15_000 : 0;
  return !(previous && now >= previous.at && now - previous.at < interval);
}

export async function reserveConversationStatus(
  context: {
    configDir: string;
    scope: string;
    recipient: string;
    sessionKey: string;
  },
  status: ConversationStatus,
  now = Date.now(),
): Promise<boolean> {
  const directory = statusDirectory(context);
  privateMailDirectory(directory, true);
  const key = statusKey(status);
  return withMailLock(directory, () => {
    const path = join(directory, "state.json");
    const retained = entries(readMailJson(path)).filter(
      (entry) => entry.at >= now - 86_400_000,
    );
    const due = statusDue(retained, status, now);
    const previous = retained.find((entry) => entry.key === key);
    const emailId = mailId(status.emailId);
    if (previous?.emailIds.includes(emailId)) return false;
    const next = [
      ...retained.filter((entry) => entry.key !== key),
      {
        key,
        emailIds: [...(previous?.emailIds ?? []), emailId].slice(-16),
        at: due ? now : (previous?.at ?? now),
      },
    ].slice(-256);
    writeMailJson(path, { version: 1, entries: next });
    return due;
  });
}
