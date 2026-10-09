/**
 * Typed `sent_email.*` webhook events: what happened to mail you sent.
 *
 * These events are a separate payload family from the inbound `email.*`
 * events, with their own `version`. An endpoint receives them only if its
 * `rules.event_types` lists them by name. The body is validated against the
 * canonical `sent-email-event` JSON schema; the shapes below are generated
 * from it.
 *
 * @packageDocumentation
 */

import type { ErrorObject } from "ajv";
import type {
  SentEmailAcceptedEvent,
  SentEmailCompletedEvent,
  SentEmailEvent,
  SentEmailLegacyMessageResultEvent,
  SentEmailRecipientResultEvent,
  SentEmailRollupResultEvent,
} from "../generated/sent-email-event.types.generated.js";
import {
  validateAccepted,
  validate as validateAnySchema,
  validateCompleted,
  validateLegacyMessageResult,
  validateRecipientResult,
  validateRollupResult,
} from "../generated/sent-email-event.validator.generated.js";
import { createValidationError, type ValidationResult } from "../validation.js";

export type {
  SentEmailAcceptedEvent,
  SentEmailCompletedEvent,
  SentEmailCompletedSummary,
  SentEmailEvent,
  SentEmailEventDelivery,
  SentEmailFailedByKind,
  SentEmailFailureKind,
  SentEmailLegacyMessageResultEvent,
  SentEmailOutcome,
  SentEmailRecipient,
  SentEmailRecipientResultEvent,
  SentEmailRecipientType,
  SentEmailRecord,
  SentEmailRelay,
  SentEmailRolledUpFailure,
  SentEmailRollupOutcome,
  SentEmailRollupResultEvent,
  SentEmailTag,
} from "../generated/sent-email-event.types.generated.js";

/**
 * The four `sent_email.*` events. They are opt-in: an endpoint receives them
 * only when its `rules.event_types` lists them.
 */
export const SENT_EMAIL_EVENT_TYPES = [
  "sent_email.accepted",
  "sent_email.delivered",
  "sent_email.failed",
  "sent_email.completed",
] as const;

/** One of the four `sent_email.*` event names. */
export type SentEmailEventType = (typeof SENT_EMAIL_EVENT_TYPES)[number];

/** A `sent_email.delivered` event: per recipient, a roll-up, or a legacy result. */
export type SentEmailDeliveredEvent = (
  | SentEmailRecipientResultEvent
  | SentEmailRollupResultEvent
  | SentEmailLegacyMessageResultEvent
) & { event: "sent_email.delivered" };

/** A `sent_email.failed` event: per recipient, a roll-up, or a legacy result. */
export type SentEmailFailedEvent = (
  | SentEmailRecipientResultEvent
  | SentEmailRollupResultEvent
  | SentEmailLegacyMessageResultEvent
) & { event: "sent_email.failed" };

/** Any `sent_email.delivered` or `sent_email.failed` event. */
export type SentEmailResultEvent =
  | SentEmailRecipientResultEvent
  | SentEmailRollupResultEvent
  | SentEmailLegacyMessageResultEvent;

const SENT_EMAIL_EVENT_TYPE_SET = new Set<string>(SENT_EMAIL_EVENT_TYPES);

/** True if `eventType` is one of the four `sent_email.*` events. */
export function isSentEmailEventType(
  eventType: string | null | undefined,
): eventType is SentEmailEventType {
  return eventType != null && SENT_EMAIL_EVENT_TYPE_SET.has(eventType);
}

type GeneratedValidator = {
  (input: unknown): boolean;
  errors?: ErrorObject[] | null;
};

/**
 * Pick the event shape a body claims to be, from its `event`, `scope` and
 * `reason`, so a malformed body is reported against that shape. Returns the
 * validator for the whole schema when the body names no known event.
 */
function selectValidator(input: unknown): GeneratedValidator {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return validateAnySchema as GeneratedValidator;
  }
  const body = input as Record<string, unknown>;
  switch (body.event) {
    case "sent_email.accepted":
      return validateAccepted as GeneratedValidator;
    case "sent_email.completed":
      return validateCompleted as GeneratedValidator;
    case "sent_email.delivered":
    case "sent_email.failed":
      if (body.scope === "message") {
        return (
          body.reason === "legacy_message_result"
            ? validateLegacyMessageResult
            : validateRollupResult
        ) as GeneratedValidator;
      }
      return validateRecipientResult as GeneratedValidator;
    default:
      return validateAnySchema as GeneratedValidator;
  }
}

/**
 * Validate a parsed `sent_email.*` webhook body against the canonical schema.
 *
 * @throws WebhookValidationError if the body is not a valid sent_email event
 */
export function validateSentEmailEvent(input: unknown): SentEmailEvent {
  const validator = selectValidator(input);
  if (!validator(input)) {
    throw createValidationError(
      validator.errors ?? [],
      input,
      "sentEmailEventJsonSchema",
    );
  }
  return input as SentEmailEvent;
}

/** Like {@link validateSentEmailEvent}, but returns a result instead of throwing. */
export function safeValidateSentEmailEvent(
  input: unknown,
): ValidationResult<SentEmailEvent> {
  const validator = selectValidator(input);
  if (!validator(input)) {
    return {
      success: false,
      error: createValidationError(
        validator.errors ?? [],
        input,
        "sentEmailEventJsonSchema",
      ),
    };
  }
  return { success: true, data: input as SentEmailEvent };
}

function eventName(event: unknown): string | undefined {
  if (typeof event !== "object" || event === null) return undefined;
  const value = (event as { event?: unknown }).event;
  return typeof value === "string" ? value : undefined;
}

/**
 * Type guard for any `sent_email.*` event. Confirms the event name AND that
 * the body validates against the canonical schema, so a payload that names
 * itself `sent_email.*` but is malformed does not narrow.
 */
export function isSentEmailEvent(event: unknown): event is SentEmailEvent {
  if (!isSentEmailEventType(eventName(event))) return false;
  return safeValidateSentEmailEvent(event).success;
}

/** Type guard for the `sent_email.accepted` event. */
export function isSentEmailAcceptedEvent(
  event: unknown,
): event is SentEmailAcceptedEvent {
  return eventName(event) === "sent_email.accepted" && isSentEmailEvent(event);
}

/** Type guard for any `sent_email.delivered` event. */
export function isSentEmailDeliveredEvent(
  event: unknown,
): event is SentEmailDeliveredEvent {
  return eventName(event) === "sent_email.delivered" && isSentEmailEvent(event);
}

/** Type guard for any `sent_email.failed` event. */
export function isSentEmailFailedEvent(
  event: unknown,
): event is SentEmailFailedEvent {
  return eventName(event) === "sent_email.failed" && isSentEmailEvent(event);
}

/** Type guard for the `sent_email.completed` event. */
export function isSentEmailCompletedEvent(
  event: unknown,
): event is SentEmailCompletedEvent {
  return eventName(event) === "sent_email.completed" && isSentEmailEvent(event);
}

/**
 * Type guard for a `sent_email.delivered` or `sent_email.failed` event about
 * one recipient (`scope: "recipient"`). Every recipient of every send is
 * reported this way, up to 100 per send.
 */
export function isSentEmailRecipientResultEvent(
  event: unknown,
): event is SentEmailRecipientResultEvent {
  return (
    (eventName(event) === "sent_email.delivered" ||
      eventName(event) === "sent_email.failed") &&
    (event as { scope?: unknown }).scope === "recipient" &&
    isSentEmailEvent(event)
  );
}
