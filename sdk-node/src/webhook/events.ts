/**
 * The canonical webhook event-type catalog and the typed event shapes a
 * payee/payer (or any non-email consumer) needs.
 *
 * Primitive posts every webhook with the event name in the `X-Webhook-Event`
 * HEADER, not in the body. The stored payload is sent verbatim with no
 * envelope: an `email.*` body carries `event`, a `payment.*` body carries the
 * name in `type`, and an `interaction.*` body is just `{ interaction: { ... } }`
 * with no event/type field at all. The HEADER is therefore the only reliable
 * discriminator across all three families, which is why the parser keys on it.
 *
 * @packageDocumentation
 */

import type { EmailReceivedEvent } from "../types.js";
import { validateEmailReceivedEvent } from "../validation.js";

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
 * The two x402 settlement-notification events (subject = a payment). Emitted for
 * both the synthetic API pay flow and the email-native settle path.
 */
export const PAYMENT_EVENT_TYPES = [
  "payment.settled",
  "payment.failed",
] as const;

/**
 * The interaction step events (subject = an interaction). One event per accepted
 * protocol step, named `interaction.<protocolShort>.<suffix>`.
 *
 * The x402 slice covers the payment lifecycle a payee/payer cares about; the ack
 * slice covers the acknowledgement protocols.
 */
export const INTERACTION_EVENT_TYPES = [
  "interaction.ack.acked",
  "interaction.ack.canceled",
  "interaction.ack.expired",
  "interaction.ack.received",
  "interaction.ack.requested",
  "interaction.x402.challenge",
  "interaction.x402.declined",
  "interaction.x402.expired",
  "interaction.x402.payment",
  "interaction.x402.rejected",
  "interaction.x402.settled",
  "interaction.x402.verify_timeout",
] as const;

/**
 * The full enumerated catalog of every current webhook event type: the five
 * email.*, the two payment.*, and every interaction.<protocol>.<suffix>.
 */
export const WEBHOOK_EVENT_TYPES = [
  ...EMAIL_EVENT_TYPES,
  ...PAYMENT_EVENT_TYPES,
  ...INTERACTION_EVENT_TYPES,
] as const;

/**
 * Any current catalog value: every `email.*`, `payment.*`, and
 * `interaction.x402.*` / `interaction.ack.*` event the platform emits, surfaced
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
// Payment events
// -----------------------------------------------------------------------------

/**
 * Common shape of a `payment.*` webhook body. The stored payload is FLAT (no
 * envelope, no nested `payment` object): it carries the event name in `type`,
 * and the parser overlays a canonical `event` mirrored from the
 * `X-Webhook-Event` header so consumers can branch on a single field. All
 * amounts are token base units (USDC has 6 decimals, so `"10000"` is 0.01).
 */
export interface PaymentEvent {
  /** Canonical event name, mirrored from the `X-Webhook-Event` header. */
  event: "payment.settled" | "payment.failed";
  /** The event name as carried in the raw stored body. */
  type: "payment.settled" | "payment.failed";
  /** The challenge this payment settles or fails. */
  challenge_id: string;
  /** The settlement network (e.g. `"base"`, `"base-sepolia"`). */
  network: string;
  /** Amount in token base units (USDC has 6 decimals, so `"10000"` is 0.01). */
  amount: string;
  /** The checksummed token contract address. */
  asset: string;
  /** The paying organization id, or null when not on-net. */
  payer_org: string | null;
  [key: string]: unknown;
}

/** A `payment.settled` webhook event. */
export interface PaymentSettledEvent extends PaymentEvent {
  event: "payment.settled";
  type: "payment.settled";
  /** The on-chain settlement transaction hash. */
  settle_tx: string;
}

/** A `payment.failed` webhook event. */
export interface PaymentFailedEvent extends PaymentEvent {
  event: "payment.failed";
  type: "payment.failed";
  /** Human-readable reason the payment failed. */
  failure_reason: string;
}

// -----------------------------------------------------------------------------
// Interaction events
// -----------------------------------------------------------------------------

/** A single interaction.x402.* event suffix. */
export type InteractionX402Suffix =
  | "challenge"
  | "payment"
  | "settled"
  | "rejected"
  | "declined"
  | "expired"
  | "verify_timeout";

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

/** An `interaction.x402.*` event (the x402-over-email lifecycle). */
export interface InteractionX402Event extends InteractionEvent {
  event: `interaction.x402.${InteractionX402Suffix}`;
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

/** Type guard for any `payment.*` event. */
export function isPaymentEvent(event: unknown): event is PaymentEvent {
  const name = eventName(event);
  return name === "payment.settled" || name === "payment.failed";
}

/** Type guard for the `payment.settled` event. */
export function isPaymentSettledEvent(
  event: unknown,
): event is PaymentSettledEvent {
  return eventName(event) === "payment.settled";
}

/** Type guard for the `payment.failed` event. */
export function isPaymentFailedEvent(
  event: unknown,
): event is PaymentFailedEvent {
  return eventName(event) === "payment.failed";
}

/** Type guard for any `interaction.x402.*` event. */
export function isInteractionX402Event(
  event: unknown,
): event is InteractionX402Event {
  return eventName(event)?.startsWith("interaction.x402.") ?? false;
}
