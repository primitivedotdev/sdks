import { createHash } from "node:crypto";
import type { PrimitiveApiClient } from "@primitivedotdev/api-core";
import {
  downloadEmailAttachmentPart,
  getEmail,
} from "@primitivedotdev/api-core";
import {
  classifySignalContent,
  MAX_INTERACTION_BYTES,
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
  const parsed = event.email.parsed;
  if (parsed.status !== "complete")
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
        filename: part.filename,
        contentType: part.content_type,
      })),
    },
    bodies: {
      status: "complete" as const,
      text: parsed.body_text,
      html: parsed.body_html,
    },
  };
  const preliminary = classifySignalContent({
    ...content,
    canonicalPartBytes: null,
  });
  if (preliminary.classification !== "unavailable")
    return preliminary.classification === "informational_only";
  const part = canonical[0];
  if (!part)
    throw new NotificationRetryError(
      "Interaction classification is unavailable.",
    );
  // Fetch eligibility only: these known non-routine cases must still notify.
  // The shared classifier remains authoritative for suppressing any message.
  if (
    (parsed.body_html !== null && parsed.body_html !== "") ||
    part.content_type.split(";")[0]?.trim().toLowerCase() !==
      "application/json" ||
    part.size_bytes > MAX_INTERACTION_BYTES
  )
    return false;
  if (!readPart)
    throw new NotificationRetryError(
      "Interaction classification requires authenticated attachment access.",
    );
  let bytes: Uint8Array;
  try {
    bytes = await readPart(event.email.id, part.part_index, signal);
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
  return classification.classification === "informational_only";
}
