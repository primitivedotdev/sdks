import { describe, expect, it } from "vitest";
import {
  EMAIL_EVENT_TYPES,
  getEventHeader,
  handleWebhookEvent,
  INTERACTION_EVENT_TYPES,
  isEmailReceivedEvent,
  isInteractionX402Event,
  isKnownWebhookEventType,
  isPaymentEvent,
  isPaymentFailedEvent,
  isPaymentSettledEvent,
  PAYMENT_EVENT_TYPES,
  type PaymentSettledEvent,
  parseWebhookEvent,
  WEBHOOK_EVENT_TYPES,
} from "../../src/webhook/index.js";
import { signWebhookPayload } from "../../src/webhook/signing.js";

const SECRET = "whsec_test_secret_for_events";

function sign(body: string): string {
  return signWebhookPayload(body, SECRET).header;
}

describe("header-keyed event parsing", () => {
  it("parses a payment.settled body (name only in the header) to a typed event", () => {
    // The stored payment body carries the name in `type`, not `event`.
    const body = {
      type: "payment.settled",
      id: "pay_1",
      payment: { amount: "100" },
    };

    const event = parseWebhookEvent(body, "payment.settled");

    expect(event.event).toBe("payment.settled");
    expect(isPaymentSettledEvent(event)).toBe(true);
    expect(isPaymentFailedEvent(event)).toBe(false);
    if (isPaymentSettledEvent(event)) {
      const settled: PaymentSettledEvent = event;
      expect(settled.id).toBe("pay_1");
      expect(settled.type).toBe("payment.settled");
    }
  });

  it("parses an interaction.x402.settled body (just { interaction }) to a typed event", () => {
    // Interaction bodies have no event/type field at all.
    const body = { interaction: { protocol: "x402", step: "receipt" } };

    const event = parseWebhookEvent(body, "interaction.x402.settled");

    expect(event.event).toBe("interaction.x402.settled");
    expect(isInteractionX402Event(event)).toBe(true);
  });

  it("returns UnknownEvent for an unknown header type without throwing", () => {
    const body = { foo: "bar" };

    const event = parseWebhookEvent(body, "payment.refunded");

    expect(event.event).toBe("payment.refunded");
    expect(isPaymentSettledEvent(event)).toBe(false);
    expect(isInteractionX402Event(event)).toBe(false);
  });

  it("falls back to a top-level body event field when no header is given", () => {
    const event = parseWebhookEvent({ event: "payment.failed", id: "pay_2" });
    expect(event.event).toBe("payment.failed");
    expect(isPaymentFailedEvent(event)).toBe(true);
  });

  it("exposes the full canonical catalog", () => {
    expect(WEBHOOK_EVENT_TYPES).toContain("payment.settled");
    expect(WEBHOOK_EVENT_TYPES).toContain("payment.failed");
    expect(WEBHOOK_EVENT_TYPES).toContain("interaction.x402.settled");
    expect(WEBHOOK_EVENT_TYPES).toContain("interaction.x402.verify_timeout");
    expect(WEBHOOK_EVENT_TYPES).toContain("interaction.ack.acked");
    expect(WEBHOOK_EVENT_TYPES).toContain("email.received");
    expect(EMAIL_EVENT_TYPES).toContain("email.bounced");
    expect(PAYMENT_EVENT_TYPES).toContain("payment.failed");
    expect(INTERACTION_EVENT_TYPES).toContain("interaction.x402.challenge");
  });
});

describe("event type guards", () => {
  it("isPaymentEvent matches both settled and failed", () => {
    expect(isPaymentEvent({ event: "payment.settled" })).toBe(true);
    expect(isPaymentEvent({ event: "payment.failed" })).toBe(true);
    expect(isPaymentEvent({ event: "email.received" })).toBe(false);
    expect(isPaymentEvent(null)).toBe(false);
    expect(isPaymentEvent("not-an-object")).toBe(false);
  });

  it("isKnownWebhookEventType gates on the catalog", () => {
    expect(isKnownWebhookEventType("payment.settled")).toBe(true);
    expect(isKnownWebhookEventType("interaction.x402.settled")).toBe(true);
    expect(isKnownWebhookEventType("payment.refunded")).toBe(false);
    expect(isKnownWebhookEventType(null)).toBe(false);
    expect(isKnownWebhookEventType(undefined)).toBe(false);
  });

  it("isEmailReceivedEvent requires a schema-valid body", () => {
    // Names itself email.received but is missing required fields: must not narrow.
    expect(isEmailReceivedEvent({ event: "email.received", id: "x" })).toBe(
      false,
    );
    expect(isEmailReceivedEvent({ event: "payment.settled" })).toBe(false);
  });
});

describe("getEventHeader", () => {
  it("reads X-Webhook-Event from a plain object case-insensitively", () => {
    expect(getEventHeader({ "x-webhook-event": "payment.settled" })).toBe(
      "payment.settled",
    );
    expect(getEventHeader({ "X-Webhook-Event": "email.received" })).toBe(
      "email.received",
    );
  });

  it("reads X-Webhook-Event from a Fetch Headers object", () => {
    const headers = new Headers({
      "X-Webhook-Event": "interaction.x402.settled",
    });
    expect(getEventHeader(headers)).toBe("interaction.x402.settled");
  });

  it("returns null when the header is absent", () => {
    expect(getEventHeader({})).toBeNull();
  });
});

describe("handleWebhookEvent verify-then-parse", () => {
  it("verifies the signature on a payment body and returns a typed event", () => {
    const body = JSON.stringify({
      type: "payment.settled",
      id: "pay_3",
      payment: { amount: "250" },
    });
    const headers = {
      "primitive-signature": sign(body),
      "x-webhook-event": "payment.settled",
    };

    const event = handleWebhookEvent({ body, headers, secret: SECRET });

    expect(isPaymentSettledEvent(event)).toBe(true);
    expect(event.event).toBe("payment.settled");
  });

  it("verifies the signature on an interaction body independent of the event type", () => {
    const body = JSON.stringify({ interaction: { protocol: "x402" } });
    const headers = {
      "primitive-signature": sign(body),
      "x-webhook-event": "interaction.x402.settled",
    };

    const event = handleWebhookEvent({ body, headers, secret: SECRET });

    expect(isInteractionX402Event(event)).toBe(true);
  });
});
