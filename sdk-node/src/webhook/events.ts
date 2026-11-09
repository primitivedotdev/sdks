/**
 * The canonical webhook event-type catalog and the typed event shapes a
 * non-email consumer needs.
 *
 * Primitive posts every webhook with the event name in the `X-Webhook-Event`
 * HEADER, not in the body. The stored payload is sent verbatim with no
 * envelope: an `email.*` or `sent_email.*` body carries `event`, and an
 * `interaction.*` body is just
 * `{ interaction: { ... } }` with no event/type field at all. The HEADER is
 * therefore the only reliable discriminator across all the families, which is
 * why the parser keys on it.
 *
 * @packageDocumentation
 */

import type { EmailReceivedEvent } from "../types.js";
import { validateEmailReceivedEvent } from "../validation.js";
import { SENT_EMAIL_EVENT_TYPES } from "./sent-email-events.js";

/**
 * The five first-party email events (subject = an email).
 */
export const EMAIL_EVENT_TYPES = [
  "email.received",
  "email.bounced",
  "email.tls_report",
  "email.dmarc_report",
  "email.dmarc_failure",
] as const;

/**
 * The interaction step events (subject = an interaction). One event per accepted
 * protocol step, named `interaction.<protocolShort>.<suffix>`.
 *
 * These cover the acknowledgement protocols.
 */
export const INTERACTION_EVENT_TYPES = [
  "interaction.ack.acked",
  "interaction.ack.canceled",
  "interaction.ack.expired",
  "interaction.ack.received",
  "interaction.ack.requested",
] as const;

/**
 * The full enumerated catalog of every current webhook event type: the five
 * email.*, the four opt-in sent_email.*, and every
 * interaction.<protocol>.<suffix>.
 */
export const WEBHOOK_EVENT_TYPES = [
  ...EMAIL_EVENT_TYPES,
  ...SENT_EMAIL_EVENT_TYPES,
  ...INTERACTION_EVENT_TYPES,
] as const;

/**
 * Any current catalog value: every `email.*`, `sent_email.*`, and
 * `interaction.ack.*` event the platform emits, surfaced
 * in the `X-Webhook-Event` header. Use this to type a switch over the header.
 */
export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];

const WEBHOOK_EVENT_TYPE_SET = new Set<string>(WEBHOOK_EVENT_TYPES);

/** True if `eventType` is a known current catalog value. */
export function isKnownWebhookEventType(
  eventType: string | null | undefined,
): eventType is WebhookEventType {
  return eventType != null && WEBHOOK_EVENT_TYPE_SET.has(eventType);
}

// -----------------------------------------------------------------------------
// Interaction events
// -----------------------------------------------------------------------------

/**
 * Common shape of an `interaction.*` webhook body. The stored payload is just
 * `{ interaction: { ... } }` with no event/type field; the parser overlays a
 * canonical `event` from the header.
 */
export interface InteractionEvent {
  /** Canonical event name, mirrored from the `X-Webhook-Event` header. */
  event: WebhookEventType;
  /** The interaction state as stored; shape is protocol/step specific. */
  interaction?: Record<string, unknown>;
  id?: string;
  [key: string]: unknown;
}

// -----------------------------------------------------------------------------
// Type guards
// -----------------------------------------------------------------------------

function eventName(event: unknown): string | undefined {
  if (typeof event !== "object" || event === null) return undefined;
  const value = (event as { event?: unknown }).event;
  return typeof value === "string" ? value : undefined;
}

/**
 * Type guard for the `email.received` event. Confirms the discriminator AND
 * that the body validates against the canonical schema, so a payload that names
 * itself `email.received` but is malformed does not narrow.
 */
export function isEmailReceivedEvent(
  event: unknown,
): event is EmailReceivedEvent {
  if (eventName(event) !== "email.received") return false;
  try {
    validateEmailReceivedEvent(event);
    return true;
  } catch {
    return false;
  }
}
