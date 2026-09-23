import type { UnknownEvent, WebhookEvent } from "../types.js";
import { validateEmailReceivedEvent } from "../validation.js";
import { WebhookPayloadError } from "./errors.js";
import { isKnownWebhookEventType } from "./events.js";

export function parseWebhookEvent(
  input: unknown,
  eventType?: string | null,
): WebhookEvent {
  // Basic structure validation
  if (input === null) {
    throw new WebhookPayloadError(
      "PAYLOAD_NULL",
      "Received null instead of webhook payload",
      "Check that your request body variable is defined.",
    );
  }

  if (input === undefined) {
    throw new WebhookPayloadError(
      "PAYLOAD_UNDEFINED",
      "Received undefined instead of webhook payload",
      "Make sure you're passing the request body to parseWebhookEvent()",
    );
  }

  if (Array.isArray(input)) {
    throw new WebhookPayloadError(
      "PAYLOAD_IS_ARRAY",
      "Received array instead of webhook payload object",
      "Webhook payloads must be objects, not arrays.",
    );
  }

  if (typeof input !== "object") {
    throw new WebhookPayloadError(
      "PAYLOAD_WRONG_TYPE",
      `Received ${typeof input} instead of webhook payload object`,
      "Webhook payloads must be objects.",
    );
  }

  const obj = input as Record<string, unknown>;

  // The event name is carried in the `X-Webhook-Event` HEADER for every event
  // family. The stored body is sent verbatim with no envelope: email.* bodies
  // carry `event`, payment.* bodies carry the name in `type`, and interaction.*
  // bodies are just `{ interaction: { ... } }` with no event/type field. So the
  // header is the PRIMARY discriminator; we fall back to a top-level `event`
  // string in the body only for backward-compat with any sender that embeds it.
  const resolvedEvent =
    (typeof eventType === "string" && eventType) ||
    (typeof obj.event === "string" ? obj.event : undefined);

  if (!resolvedEvent) {
    // No `X-Webhook-Event` header AND no in-body `event` field: we cannot
    // classify this payload at all. Preserve the legacy contract and throw,
    // so a genuinely malformed call is still surfaced. The real sender always
    // sets the header, so the handle* entry points never hit this.
    throw new WebhookPayloadError(
      "PAYLOAD_MISSING_EVENT",
      "Missing event discriminator: no X-Webhook-Event header and no 'event' field in payload",
      "Pass the X-Webhook-Event header (the canonical discriminator) or call handleWebhookEvent, which reads it for you.",
    );
  }

  // Route to specific handler for known events.
  switch (resolvedEvent) {
    case "email.received":
      return validateEmailReceivedEvent(input);

    case "payment.settled":
    case "payment.failed":
      // Payment bodies carry the name in `type`; overlay a canonical `event`
      // (mirrored from the header) so consumers branch on a single field.
      return { ...obj, event: resolvedEvent } as WebhookEvent;

    default:
      if (isKnownWebhookEventType(resolvedEvent)) {
        // Known interaction.* (and any other catalog) event: the body has no
        // event/type field, so overlay the canonical name from the header.
        return { ...obj, event: resolvedEvent } as WebhookEvent;
      }
      // Unknown event type: return as UnknownEvent for forward compatibility.
      return { ...obj, event: resolvedEvent } as unknown as UnknownEvent;
  }
}
