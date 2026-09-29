import { createHash } from "node:crypto";
import type {
  EmailAttachment,
  PrimitiveApiClient,
} from "@primitivedotdev/api-core";
import {
  downloadEmailAttachmentPart,
  getEmail,
} from "@primitivedotdev/api-core";
import {
  classifySignalContent,
  MAX_INTERACTION_BYTES,
  type SignalContentResult,
} from "@primitivedotdev/sdk/interactions";
import {
  type EmailReceivedEvent,
  isEmailReceivedEvent,
  parseWebhookEvent,
} from "@primitivedotdev/sdk/webhook";
import { ListenStateError } from "./listen-state.js";

export type ReadNotificationPart = (
  emailId: string,
  partIndex: number,
  signal: AbortSignal,
) => Promise<Uint8Array>;
export class NotificationRetryError extends ListenStateError {}
export type RefreshNotificationEvent = (
  event: EmailReceivedEvent,
  recipient: string,
  signal: AbortSignal,
) => Promise<EmailReceivedEvent>;
export function notificationEventReader(
  client: () => Promise<PrimitiveApiClient["client"]>,
): RefreshNotificationEvent {
  return async (event, recipient, signal) => {
    try {
      const result = await getEmail({
        client: await client(),
        path: { id: event.email.id },
        responseStyle: "fields",
        signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]),
      });
      const current = result.data?.data;
      if (
        result.error ||
        current?.id !== event.email.id ||
        !["accepted", "completed", "rejected"].includes(current.status) ||
        current.recipient.toLowerCase() !== recipient ||
        typeof current.from_header !== "string" ||
        current.parsed?.status !== "complete" ||
        !Array.isArray(current.parsed.attachments)
      )
        throw new Error("incomplete");
      const parsed = current.parsed;
      const refreshed = parseWebhookEvent(
        {
          ...event,
          email: {
            ...event.email,
            headers: { ...event.email.headers, from: current.from_header },
            auth: current.auth,
            parsed: {
              ...parsed,
              error: null,
              body_text: parsed.body_text ?? null,
              body_html: parsed.body_html ?? null,
              reply_to: parsed.reply_to ?? null,
              cc: parsed.cc ?? null,
              bcc: parsed.bcc ?? null,
              to_addresses: parsed.to_addresses ?? null,
              in_reply_to: parsed.in_reply_to ?? null,
              references: parsed.references ?? null,
              attachments_download_url: null,
              attachments: current.parsed.attachments.map((part) => ({
                ...part,
                filename: part.filename ?? null,
                tar_path: "",
              })),
            },
          },
        },
        "email.received",
      );
      if (!isEmailReceivedEvent(refreshed)) throw new Error("invalid");
      return refreshed;
    } catch {
      throw new NotificationRetryError(
        "Email processing is not ready; retrying through the delivery queue.",
      );
    }
  };
}
export function notificationPartReader(
  client: () => Promise<PrimitiveApiClient["client"]>,
): ReadNotificationPart {
  return async (emailId, partIndex, signal) => {
    const result = await downloadEmailAttachmentPart({
      client: await client(),
      path: { id: emailId, part_index: partIndex },
      parseAs: "stream",
      responseStyle: "fields",
      signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]),
    });
    const body: unknown = result.data;
    if (result.error || !(body instanceof ReadableStream))
      throw new NotificationRetryError(
        "Interaction content is unavailable; retrying through the delivery queue.",
      );
    const reader = body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const next = await reader.read();
        if (next.done) break;
        if (!(next.value instanceof Uint8Array))
          throw new ListenStateError("Invalid interaction attachment bytes.");
        size += next.value.byteLength;
        if (size > MAX_INTERACTION_BYTES)
          throw new ListenStateError(
            "Interaction attachment exceeds the notification classification limit.",
          );
        chunks.push(next.value);
      }
    } finally {
      await reader.cancel();
    }
    return Buffer.concat(chunks);
  };
}

export async function isRoutineNotification(
  event: EmailReceivedEvent,
  readPart: ReadNotificationPart | undefined,
  signal: AbortSignal,
): Promise<boolean> {
  return isRoutineNotificationContent(event.email, readPart, signal);
}

// A local projection from an authenticated detail read, not a webhook envelope.
export type NotificationContent = {
  id: string;
  body_text?: string | null;
  body_html?: string | null;
  parsed?: {
    status: string;
    attachments?: EmailAttachment[];
    body_text?: string | null;
    body_html?: string | null;
  } | null;
};
export type ConversationStatusContent = {
  kind: "read" | "ack" | "working" | "typing";
  subjectMessageId: string;
  expiresAt: string | null;
  interactionDomain: string;
};

/** Validated canonical signal only. This is still not sender or conversation authorization. */
export async function readConversationStatusContent(
  email: NotificationContent,
  readPart: ReadNotificationPart | undefined,
  signal: AbortSignal,
): Promise<ConversationStatusContent | null> {
  // A typed status must not hide conflicting content behind duplicated API
  // projections of the same MIME body.
  if (
    email.body_text !== undefined &&
    email.parsed?.body_text !== undefined &&
    email.body_text !== email.parsed.body_text
  )
    return null;
  if (
    email.body_html !== undefined &&
    email.parsed?.body_html !== undefined &&
    email.body_html !== email.parsed.body_html
  )
    return null;
  const result = await classifyNotificationContent(email, readPart, signal);
  if (
    result.classification !== "informational_only" ||
    result.interaction?.status !== "valid"
  )
    return null;
  const envelope = result.interaction.envelope;
  if (!["read", "ack", "working", "typing"].includes(envelope.protocol))
    return null;
  const payload = envelope.payload as { subject_message_id: string };
  return {
    kind: envelope.protocol as ConversationStatusContent["kind"],
    subjectMessageId: payload.subject_message_id,
    expiresAt: envelope.expires_at,
    interactionDomain: envelope.interaction_id
      .slice(envelope.interaction_id.lastIndexOf("@") + 1)
      .toLowerCase(),
  };
}

export async function isRoutineNotificationContent(
  email: NotificationContent,
  readPart: ReadNotificationPart | undefined,
  signal: AbortSignal,
): Promise<boolean> {
  return (
    (await classifyNotificationContent(email, readPart, signal))
      .classification === "informational_only"
  );
}

async function classifyNotificationContent(
  email: NotificationContent,
  readPart: ReadNotificationPart | undefined,
  signal: AbortSignal,
): Promise<SignalContentResult> {
  const parsed = email.parsed;
  if (parsed?.status !== "complete" || !Array.isArray(parsed.attachments))
    throw new NotificationRetryError(
      "Email parsing is incomplete; retrying through the delivery queue.",
    );
  const canonical = parsed.attachments.filter(
    (part) => part.filename?.toLowerCase() === "interaction.json",
  );
  const content = {
    inventory: {
      status: "complete" as const,
      parts: parsed.attachments.map((part) => ({
        filename: part.filename ?? null,
        contentType: part.content_type ?? null,
      })),
    },
    bodies: {
      status: "complete" as const,
      text: email.body_text ?? parsed.body_text ?? null,
      html: email.body_html ?? parsed.body_html ?? null,
    },
  };
  const preliminary = classifySignalContent({
    ...content,
    canonicalPartBytes: null,
  });
  if (preliminary.classification !== "unavailable") return preliminary;
  const part = canonical[0];
  if (!part)
    throw new NotificationRetryError(
      "Interaction classification is unavailable.",
    );
  // Fetch eligibility only: these known non-routine cases must still notify.
  // The shared classifier remains authoritative for suppressing any message.
  if (
    (content.bodies.html !== null && content.bodies.html !== "") ||
    part.content_type?.split(";")[0]?.trim().toLowerCase() !==
      "application/json" ||
    part.size_bytes > MAX_INTERACTION_BYTES
  )
    return preliminary;
  if (
    !readPart ||
    !Number.isSafeInteger(part.part_index) ||
    part.part_index === undefined ||
    part.part_index < 0 ||
    !Number.isSafeInteger(part.size_bytes) ||
    part.size_bytes < 0 ||
    typeof part.sha256 !== "string" ||
    !/^[a-f0-9]{64}$/i.test(part.sha256)
  )
    throw new NotificationRetryError(
      "Interaction classification requires authenticated attachment access.",
    );
  let bytes: Uint8Array;
  try {
    bytes = await readPart(email.id, part.part_index, signal);
  } catch {
    throw new NotificationRetryError(
      "Interaction content is unavailable; retrying through the delivery queue.",
    );
  }
  if (
    bytes.byteLength !== part.size_bytes ||
    createHash("sha256").update(bytes).digest("hex") !==
      part.sha256.toLowerCase()
  )
    throw new NotificationRetryError(
      "Interaction attachment changed; retrying through the delivery queue.",
    );
  const classification = classifySignalContent({
    ...content,
    canonicalPartBytes: bytes,
  });
  if (classification.classification === "unavailable")
    throw new NotificationRetryError(
      "Interaction classification is unavailable; retrying through the delivery queue.",
    );
  return classification;
}
