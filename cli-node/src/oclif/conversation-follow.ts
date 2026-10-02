import { createHash } from "node:crypto";
import { join } from "node:path";
import type { EmailDetail } from "@primitivedotdev/api-core";
import { otherParticipants } from "./email-participants.js";
import { isPlainChatReply, scopedChatSenderTrust } from "./scoped-chat.js";
import {
  mailAddress,
  mailId,
  mailObject,
  mailTime,
  privateMailDirectory,
  readMailJson,
  withMailLock,
  writeMailJson,
} from "./shared-mail-files.js";

type Context = { configDir: string; scope: string; recipient: string };
export type ConversationFollow = {
  threadId: string;
  recipient: string;
  peer: string;
  sessionKey: string;
  since: string;
};

function directory(context: Context): string {
  const key = createHash("sha256")
    .update(JSON.stringify([context.scope, mailAddress(context.recipient)]))
    .digest("hex");
  return join(context.configDir, "conversation-follows", key);
}

function session(value: string): string {
  const separator = value.indexOf(":");
  const runtime = value.slice(0, separator);
  if (!["codex", "claude"].includes(runtime))
    throw new Error(
      "Conversation receiving requires an exact runtime session.",
    );
  return `${runtime}:${mailId(value.slice(separator + 1))}`;
}

/** Read one exact server thread, never scan mail or infer a thread from a subject. */
export function readConversationFollow(
  context: Context,
  threadId: string,
): ConversationFollow | null {
  const id = mailId(threadId),
    dir = directory(context);
  try {
    privateMailDirectory(dir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  const value = readMailJson(join(dir, `${id}.json`));
  if (value === null) return null;
  const row = mailObject(value, [
    "threadId",
    "recipient",
    "peer",
    "sessionKey",
    "since",
  ]);
  const follow = {
    threadId: mailId(row.threadId),
    recipient: mailAddress(row.recipient),
    peer: mailAddress(row.peer),
    sessionKey: session(String(row.sessionKey)),
    since: mailTime(row.since),
  };
  if (
    follow.threadId !== id ||
    follow.recipient !== mailAddress(context.recipient)
  )
    throw new Error(
      "Saved conversation identity does not match this connection.",
    );
  return follow;
}

/** Local receiving interest has no active waiter and never holds unrelated peer mail. */
export async function followEmailConversation(
  context: Context & { sessionKey: string; peer: string; since?: string },
  detail: EmailDetail,
): Promise<ConversationFollow | null> {
  // Legacy email and structured contact/activity exchanges retain their existing
  // exact-parent behavior. A contact acceptance cannot create an ongoing follow.
  if (detail.thread_id == null || !isPlainChatReply(detail)) return null;
  const recipient = mailAddress(context.recipient),
    peer = mailAddress(context.peer);
  // A follow binds one thread to one peer. A group email (addressed to others
  // besides this agent and its sender) has several, and every copy of a
  // conversation shares one thread, so following it would claim the whole
  // group for this peer. Group mail keeps the ordinary receiving path.
  if (otherParticipants(detail, recipient).length > 0) return null;
  if (
    !["accepted", "completed"].includes(detail.status) ||
    mailAddress(detail.recipient) !== recipient ||
    mailAddress(detail.to_email) !== recipient ||
    mailAddress(detail.from_email) !== peer ||
    !scopedChatSenderTrust(detail, peer).trusted
  )
    throw new Error(
      "Conversation receiving requires an authenticated email addressed to this connected agent.",
    );
  const follow: ConversationFollow = {
    threadId: mailId(detail.thread_id),
    recipient,
    peer,
    sessionKey: session(context.sessionKey),
    since: mailTime(context.since ?? new Date().toISOString()),
  };
  const dir = directory(context);
  privateMailDirectory(dir, true);
  return withMailLock(dir, () => {
    const existing = readConversationFollow(context, follow.threadId);
    if (existing) {
      if (existing.peer !== peer || existing.sessionKey !== follow.sessionKey)
        throw new Error(
          "This conversation is already followed by another peer or native session. No receiving ownership was changed.",
        );
      return existing;
    }
    writeMailJson(join(dir, `${follow.threadId}.json`), follow);
    return follow;
  });
}
