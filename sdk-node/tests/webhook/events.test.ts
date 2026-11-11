import { describe, expect, it } from "vitest";
import {
  EMAIL_EVENT_TYPES,
  EMAIL_RULE_REQUEST_EVENT_TYPES,
  getEventHeader,
  handleWebhookEvent,
  INTERACTION_EVENT_TYPES,
  isEmailReceivedEvent,
  isEmailRuleRequestEvent,
  isKnownWebhookEventType,
  parseWebhookEvent,
  WEBHOOK_EVENT_TYPES,
} from "../../src/webhook/index.js";
import { signWebhookPayload } from "../../src/webhook/signing.js";

const SECRET = "whsec_test_secret_for_events";

function sign(body: string): string {
  return signWebhookPayload(body, SECRET).header;
}

describe("header-keyed event parsing", () => {
  it("parses an interaction.ack.acked body (just { interaction }) with the header name", () => {
    // Interaction bodies have no event/type field at all.
    const body = { interaction: { protocol: "ack", step: "ack" } };

    const event = parseWebhookEvent(body, "interaction.ack.acked");

    expect(event.event).toBe("interaction.ack.acked");
    expect({ ...event }).toMatchObject({
      interaction: { protocol: "ack", step: "ack" },
    });
  });

  it("returns an unknown event for a type outside the catalog without throwing", () => {
    const body = { type: "payment.settled", challenge_id: "chl_1" };

    const event = parseWebhookEvent(body, "payment.settled");

    expect(event.event).toBe("payment.settled");
    expect(isKnownWebhookEventType(event.event)).toBe(false);
    expect({ ...event }).toMatchObject({ challenge_id: "chl_1" });
  });

  it("falls back to a top-level body event field when no header is given", () => {
    const event = parseWebhookEvent({
      event: "interaction.ack.requested",
      id: "evt_2",
    });
    expect(event.event).toBe("interaction.ack.requested");
  });

  it("exposes the full canonical catalog", () => {
    expect(WEBHOOK_EVENT_TYPES).toContain("interaction.ack.acked");
    expect(WEBHOOK_EVENT_TYPES).toContain("email.received");
    expect(WEBHOOK_EVENT_TYPES).toContain("sent_email.delivered");
    expect(EMAIL_EVENT_TYPES).toContain("email.bounced");
    expect(INTERACTION_EVENT_TYPES).toContain("interaction.ack.expired");
  });

  it("lists the opt-in rule request events and parses one by its header", () => {
    expect([...EMAIL_RULE_REQUEST_EVENT_TYPES]).toEqual([
      "email_rule_request.created",
      "email_rule_request.accepted",
      "email_rule_request.declined",
      "email_rule_request.withdrawn",
    ]);
    for (const type of EMAIL_RULE_REQUEST_EVENT_TYPES) {
      expect(WEBHOOK_EVENT_TYPES).toContain(type);
      expect(isKnownWebhookEventType(type)).toBe(true);
    }
    const body = {
      id: "evt_1",
      type: "email_rule_request.created",
      occurred_at: "2026-11-11T03:16:16.848Z",
      email_rule_request: {
        id: "req_1",
        name: "Vendor billing",
        status: "pending",
        created_at: "2026-11-11T03:16:16.848Z",
        decided_at: null,
        message: "For the vendor invoices only, please.",
        decline_reason: null,
      },
      proposer: { user_id: "user_1", name: "Sam Rivera" },
    };
    const event = parseWebhookEvent(body, "email_rule_request.created");
    expect(isEmailRuleRequestEvent(event)).toBe(true);
    if (isEmailRuleRequestEvent(event)) {
      expect(event.email_rule_request.name).toBe("Vendor billing");
      expect(event.email_rule_request.message).toBe(
        "For the vendor invoices only, please.",
      );
      expect(event.email_rule_request.decline_reason).toBeNull();
      expect(event.proposer?.name).toBe("Sam Rivera");
    }
    for (const notAnEvent of [
      null,
      undefined,
      "email_rule_request.created",
      42,
    ]) {
      expect(isEmailRuleRequestEvent(notAnEvent)).toBe(false);
    }
    expect(
      isEmailRuleRequestEvent(
        parseWebhookEvent({ interaction: {} }, "interaction.ack.acked"),
      ),
    ).toBe(false);
  });

  it("no longer lists the payment events", () => {
    expect(WEBHOOK_EVENT_TYPES).not.toContain("payment.settled");
    expect(WEBHOOK_EVENT_TYPES).not.toContain("payment.failed");
  });
});

describe("event type guards", () => {
  it("isKnownWebhookEventType gates on the catalog", () => {
    expect(isKnownWebhookEventType("interaction.ack.acked")).toBe(true);
    expect(isKnownWebhookEventType("sent_email.failed")).toBe(true);
    expect(isKnownWebhookEventType("payment.settled")).toBe(false);
    expect(isKnownWebhookEventType(null)).toBe(false);
    expect(isKnownWebhookEventType(undefined)).toBe(false);
  });

  it("isEmailReceivedEvent requires a schema-valid body", () => {
    // Names itself email.received but is missing required fields: must not narrow.
    expect(isEmailReceivedEvent({ event: "email.received", id: "x" })).toBe(
      false,
    );
    expect(isEmailReceivedEvent({ event: "interaction.ack.acked" })).toBe(
      false,
    );
  });
});

describe("getEventHeader", () => {
  it("reads X-Webhook-Event from a plain object case-insensitively", () => {
    expect(getEventHeader({ "x-webhook-event": "interaction.ack.acked" })).toBe(
      "interaction.ack.acked",
    );
    expect(getEventHeader({ "X-Webhook-Event": "email.received" })).toBe(
      "email.received",
    );
  });

  it("reads X-Webhook-Event from a Fetch Headers object", () => {
    const headers = new Headers({
      "X-Webhook-Event": "interaction.ack.received",
    });
    expect(getEventHeader(headers)).toBe("interaction.ack.received");
  });

  it("returns null when the header is absent", () => {
    expect(getEventHeader({})).toBeNull();
  });
});

describe("handleWebhookEvent verify-then-parse", () => {
  it("verifies the signature on an interaction body independent of the event type", () => {
    const body = JSON.stringify({ interaction: { protocol: "ack" } });
    const headers = {
      "primitive-signature": sign(body),
      "x-webhook-event": "interaction.ack.acked",
    };

    const event = handleWebhookEvent({ body, headers, secret: SECRET });

    expect(event.event).toBe("interaction.ack.acked");
  });
});
