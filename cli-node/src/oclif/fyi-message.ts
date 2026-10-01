import { createHash, randomUUID } from "node:crypto";
import type { EmailDetail } from "@primitivedotdev/api-core";
import { prepareSignalEmail } from "@primitivedotdev/sdk/interactions";

/** Longest note an ACK signal may carry, in UTF-16 code units. */
export const FYI_NOTE_MAX_LENGTH = 2000;

export const FYI_FLAG_DESCRIPTION =
  "Mark this message as informational so the receiver does not need to act or wake for it. It is sent as an ack signal (status received) whose note is the plain-text body, which receivers classify as informational. Plain text only: no HTML or attachments, and the body is limited to 2000 characters.";

export type FyiMessageContent = {
  body_text: string;
  attachments: {
    filename: string;
    content_type: string;
    content_base64: string;
  }[];
};

export class FyiMessageError extends Error {}

/**
 * Return a UUID source that yields the same sequence of distinct,
 * well-formed version 4 UUIDs for the same seed. Seeding the signal's
 * interaction and step ids with the request's idempotency key makes a
 * retried informational message byte-identical, so the retry replays
 * the original send instead of being refused as a different payload
 * under the same key.
 */
export function uuidsFromSeed(seed: string): () => string {
  let counter = 0;
  return () => {
    const bytes = createHash("sha256")
      .update(`${seed}\u0000${counter++}`)
      .digest()
      .subarray(0, 16);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = bytes.toString("hex");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  };
}

/**
 * Accept a bare mailbox or a `Name <mailbox>` header value and return the
 * lowercased mailbox. Only the domain is used, to scope the interaction id.
 */
export function bareMailbox(value: string): string {
  const bracketed = /<([^<>]+)>\s*$/.exec(value);
  return (bracketed?.[1] ?? value).trim().toLowerCase();
}

/**
 * Build the body and canonical `interaction.json` part for an informational
 * message: an `ack/1` signal with status `received` whose optional note is
 * the caller's text. Receivers classify exactly this content as
 * informational_only, so it does not demand an answer.
 */
export function buildFyiMessageContent(params: {
  parentMessageId: string | null | undefined;
  /** Address the message is sent from. Scopes the interaction id. */
  senderAddress: string;
  /** Address the message is sent to. */
  recipientAddress: string;
  note?: string;
  now?: () => number;
  uuid?: () => string;
}): FyiMessageContent {
  if (!params.parentMessageId)
    throw new FyiMessageError(
      "--fyi needs the parent Message-ID, which is not available yet. Nothing was sent; retry after the email finishes processing.",
    );
  // Trailing whitespace is dropped so the received text matches the
  // canonical form even when a mail hop trims a final line break.
  const note = params.note?.trimEnd();
  if (note !== undefined && note.length > FYI_NOTE_MAX_LENGTH)
    throw new FyiMessageError(
      `--fyi bodies are limited to ${FYI_NOTE_MAX_LENGTH} characters. Nothing was sent; send a normal reply for longer content.`,
    );
  let prepared: ReturnType<typeof prepareSignalEmail>;
  try {
    prepared = prepareSignalEmail(
      {
        kind: "ack",
        status: "received",
        ...(note ? { note } : {}),
        parent: {
          accountScope: "fyi",
          from: bareMailbox(params.recipientAddress),
          to: bareMailbox(params.senderAddress),
          messageId: params.parentMessageId,
          subject: null,
          references: [],
        },
      },
      { now: params.now ?? Date.now, uuid: params.uuid ?? randomUUID },
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new FyiMessageError(
      `Could not prepare the informational message (${detail}). Nothing was sent.`,
    );
  }
  if (prepared.status !== "prepared")
    throw new FyiMessageError(
      "--fyi needs the parent Message-ID, which is not available yet. Nothing was sent.",
    );
  const body = JSON.parse(prepared.prepared.requestJson) as FyiMessageContent;
  return { body_text: body.body_text, attachments: body.attachments };
}

/**
 * True when an inbound email carries an interaction part. An informational
 * reply to a signal or interaction is refused so two agents cannot keep
 * acknowledging each other.
 */
export function carriesInteraction(detail: EmailDetail): boolean {
  const parts = (
    detail.parsed as { attachments?: { filename?: string | null }[] } | null
  )?.attachments;
  return (
    Array.isArray(parts) &&
    parts.some((part) => part.filename?.toLowerCase() === "interaction.json")
  );
}
