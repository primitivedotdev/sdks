import { createHash, randomUUID } from "node:crypto";
import type { EmailDetail } from "@primitivedotdev/api-core";
import {
  type InteractionEnvelope,
  parseInteractionEnvelope,
} from "@primitivedotdev/sdk/interactions";
import { canonicalContactSelector } from "./contact-rule-matcher.js";
import {
  NotificationRetryError,
  type ReadNotificationPart,
} from "./notify-session-content.js";

export const CONTACT_PROTOCOL = "primitive.contact";
export const MAX_CONTACT_BYTES = 8192;
export const MAX_CONTACT_EXPIRY_SECONDS = 7 * 24 * 60 * 60;
export type ContactRequestReference = {
  interactionId: string;
  stepId: string;
  expiresAt: string;
};
export type ContactInteraction = InteractionEnvelope<{ reason?: string }> & {
  step: "request" | "accept";
  expires_at: string;
};

export function prepareContactRequest(
  sender: string,
  reason: string,
  seconds: number,
  now = Date.now(),
): ContactInteraction {
  const address = canonicalContactSelector({
    kind: "address",
    value: sender,
  }).value;
  if (!reason.trim() || Array.from(reason).length > 2000)
    throw new Error("A contact request needs a reason of 1-2000 characters.");
  if (
    !Number.isInteger(seconds) ||
    seconds < 60 ||
    seconds > MAX_CONTACT_EXPIRY_SECONDS
  )
    throw new Error("Contact request expiry must be 60-604800 seconds.");
  const request: ContactInteraction = {
    interaction_version: 1,
    interaction_id: `${randomUUID()}@${address.split("@")[1]}`,
    protocol: CONTACT_PROTOCOL,
    protocol_version: 1,
    step: "request",
    step_id: randomUUID(),
    prev_step_id: null,
    expires_at: new Date(now + seconds * 1000).toISOString(),
    payload: { reason: reason.trim() },
  };
  if (Buffer.byteLength(JSON.stringify(request)) > MAX_CONTACT_BYTES)
    throw new Error(
      "The encoded contact request exceeds 8192 bytes. Shorten its reason.",
    );
  return request;
}
export function contactReference(
  value: ContactInteraction,
): ContactRequestReference {
  return {
    interactionId: value.interaction_id,
    stepId: value.step_id,
    expiresAt: value.expires_at,
  };
}
export function prepareContactAcceptance(
  request: ContactInteraction,
): ContactInteraction {
  if (request.step !== "request")
    throw new Error("Only a contact request can be accepted.");
  return {
    ...request,
    step: "accept",
    step_id: randomUUID(),
    prev_step_id: request.step_id,
    payload: {},
  };
}

/** Strict contact control decoding. Valid generic interactions are not permission. */
export function parseContactInteraction(
  bytes: Uint8Array,
  now = Date.now(),
): ContactInteraction | null {
  if (bytes.byteLength > MAX_CONTACT_BYTES) return null;
  const result = parseInteractionEnvelope(bytes);
  if (result.status !== "valid") return null;
  const e = result.envelope;
  if (
    e.protocol !== CONTACT_PROTOCOL ||
    e.protocol_version !== 1 ||
    !["request", "accept"].includes(e.step) ||
    typeof e.expires_at !== "string" ||
    !Number.isFinite(Date.parse(e.expires_at)) ||
    Date.parse(e.expires_at) <= now ||
    Date.parse(e.expires_at) > now + MAX_CONTACT_EXPIRY_SECONDS * 1000 ||
    !e.payload ||
    typeof e.payload !== "object" ||
    Array.isArray(e.payload)
  )
    return null;
  const payload = e.payload as Record<string, unknown>;
  if (e.step === "request") {
    if (
      e.prev_step_id !== null ||
      Object.keys(payload).length !== 1 ||
      typeof payload.reason !== "string" ||
      !payload.reason.trim() ||
      Array.from(payload.reason).length > 2000
    )
      return null;
  } else if (e.prev_step_id === null || Object.keys(payload).length !== 0)
    return null;
  return e as ContactInteraction;
}

/** Fetch only one bounded canonical part, checking authenticated inventory bytes. */
export async function readContactInteraction(
  detail: EmailDetail,
  readPart: ReadNotificationPart,
  signal: AbortSignal,
  now = Date.now(),
): Promise<ContactInteraction | null> {
  const parts = detail.parsed?.attachments;
  if (detail.parsed?.status !== "complete" || !Array.isArray(parts))
    throw new NotificationRetryError("Contact request parsing is incomplete.");
  const canonical = parts.filter(
    (part) => part.filename?.toLowerCase() === "interaction.json",
  );
  if (canonical.length !== 1) return null;
  const part = canonical[0];
  if (
    !part ||
    part.content_type?.split(";")[0]?.trim().toLowerCase() !==
      "application/json" ||
    !Number.isSafeInteger(part.part_index) ||
    part.part_index === undefined ||
    part.part_index < 0 ||
    !Number.isSafeInteger(part.size_bytes) ||
    part.size_bytes < 1 ||
    part.size_bytes > MAX_CONTACT_BYTES ||
    typeof part.sha256 !== "string" ||
    !/^[a-f0-9]{64}$/i.test(part.sha256)
  )
    return null;
  let bytes: Uint8Array;
  try {
    bytes = await readPart(detail.id, part.part_index, signal);
  } catch {
    throw new NotificationRetryError(
      "Contact interaction content is unavailable; retry this exact email.",
    );
  }
  if (
    bytes.byteLength !== part.size_bytes ||
    createHash("sha256").update(bytes).digest("hex") !==
      part.sha256.toLowerCase()
  )
    throw new NotificationRetryError(
      "Contact request attachment integrity is unavailable.",
    );
  return parseContactInteraction(bytes, now);
}

export function isContactAcceptance(
  value: ContactInteraction | null,
  request: ContactRequestReference,
): boolean {
  return (
    value?.step === "accept" &&
    value.interaction_id === request.interactionId &&
    value.prev_step_id === request.stepId &&
    value.expires_at === request.expiresAt
  );
}
