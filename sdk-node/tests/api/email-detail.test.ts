import type { EmailDetail } from "@primitivedotdev/api-core";
import { describe, expect, it } from "vitest";

// Round-trip pin for the new fields on EmailDetail (replies,
// from_known_address, sender_connected_agent_verified, body_text, body_html). TS types are erased at
// runtime, so the assertion here is the structural-conformance of the
// fixture against the declared type plus a runtime read of each new
// field. A future regen that drops one of these fields fails compile
// at the cast and fails runtime at the field read.

const SAMPLE: EmailDetail = {
  id: "00000000-0000-0000-0000-000000000001",
  message_id: "<msg@example.com>",
  domain_id: "11111111-1111-1111-1111-111111111111",
  org_id: "22222222-2222-2222-2222-222222222222",
  sender: "alice@example.com",
  recipient: "support@example.com",
  subject: "Hello",
  body_text: "Hi there",
  body_html: "<p>Hi there</p>",
  status: "completed",
  domain: "example.com",
  spam_score: 0,
  raw_size_bytes: 1234,
  raw_sha256: "abc",
  created_at: "2026-05-03T00:00:00.000Z",
  received_at: "2026-05-03T00:00:00.000Z",
  rejection_reason: null,
  webhook_status: "fired",
  webhook_attempt_count: 1,
  webhook_last_attempt_at: null,
  webhook_last_status_code: 200,
  webhook_last_error: null,
  webhook_fired_at: "2026-05-03T00:00:00.000Z",
  smtp_helo: "mail.example.com",
  smtp_mail_from: "alice@example.com",
  smtp_rcpt_to: ["support@example.com"],
  from_header: "Alice <alice@example.com>",
  content_discarded_at: null,
  content_discarded_by_delivery_id: null,
  from_email: "alice@example.com",
  to_email: "support@example.com",
  from_known_address: true,
  sender_connected_agent_verified: false,
  thread_id: "44444444-4444-4444-4444-444444444444",
  reply_count: 1,
  last_replied_at: "2026-05-03T00:01:00.000Z",
  awaiting: "them",
  automated: true,
  automated_reasons: ["list_unsubscribe", "list_id"],
  replies: [
    {
      id: "33333333-3333-3333-3333-333333333333",
      status: "submitted_to_agent",
      to_address: "alice@example.com",
      subject: "Re: Hello",
      created_at: "2026-05-03T00:00:01.000Z",
      queue_id: null,
    },
  ],
  parsed: {
    status: "complete",
    body_text: "Hi there",
    body_html: "<p>Hi there</p>",
    reply_to: null,
    cc: [{ name: null, address: "cc@example.com" }],
    bcc: null,
    to_addresses: [{ name: "Support", address: "support@example.com" }],
    in_reply_to: null,
    references: null,
    attachments: [],
  },
  auth: {
    spf: "pass",
    dmarc: "pass",
    dmarcPolicy: "reject",
    dmarcFromDomain: "example.com",
    dmarcSpfAligned: true,
    dmarcDkimAligned: true,
    dmarcSpfStrict: false,
    dmarcDkimStrict: false,
    dkimSignatures: [
      {
        domain: "example.com",
        selector: "default",
        result: "pass",
        aligned: true,
        keyBits: 2048,
        algo: "rsa-sha256",
      },
    ],
  },
};

describe("EmailDetail type contract", () => {
  it("surfaces body_text and body_html (matches the webhook payload shape)", () => {
    expect(SAMPLE.body_text).toBe("Hi there");
    expect(SAMPLE.body_html).toBe("<p>Hi there</p>");
  });

  it("surfaces from_known_address", () => {
    expect(SAMPLE.from_known_address).toBe(true);
  });

  it("surfaces sender_connected_agent_verified", () => {
    expect(SAMPLE.sender_connected_agent_verified).toBe(false);
  });

  it("surfaces the replies array with EmailDetailReply elements", () => {
    expect(SAMPLE.replies).toHaveLength(1);
    const reply = SAMPLE.replies[0];
    expect(reply.id).toBe("33333333-3333-3333-3333-333333333333");
    expect(reply.subject).toBe("Re: Hello");
  });

  it("surfaces thread_id, parsed, and auth (webhook-parity shape)", () => {
    // parsed and auth are required (non-optional) on EmailDetail, so
    // they're accessed without `?.`; the chaining below is only on
    // genuinely nullable/empty-able nested fields (cc, the signatures
    // array element).
    expect(SAMPLE.thread_id).toBe("44444444-4444-4444-4444-444444444444");
    expect(SAMPLE.parsed.status).toBe("complete");
    expect(SAMPLE.parsed.cc?.[0]?.address).toBe("cc@example.com");
    expect(SAMPLE.auth.spf).toBe("pass");
    expect(SAMPLE.auth.dkimSignatures[0]?.result).toBe("pass");
  });

  it("surfaces reply state", () => {
    expect(SAMPLE.reply_count).toBe(1);
    expect(SAMPLE.last_replied_at).toBe("2026-05-03T00:01:00.000Z");
    expect(SAMPLE.awaiting).toBe("them");
  });

  it("surfaces the automated verdict", () => {
    expect(SAMPLE.automated).toBe(true);
    expect(SAMPLE.automated_reasons).toEqual(["list_unsubscribe", "list_id"]);
  });

  it("types relay as an optional, nullable object", () => {
    // SAMPLE omits relay, as responses from servers without the field do.
    expect(SAMPLE.relay).toBeUndefined();
    const withNull: EmailDetail = { ...SAMPLE, relay: null };
    expect(withNull.relay).toBeNull();
    const relayed: EmailDetail = {
      ...SAMPLE,
      relay: { hostname: "relay.example.com", via: "mail_relay" },
    };
    // Reads without a cast: the generated type is the object, not unknown.
    const hostname: string | undefined = relayed.relay?.hostname;
    const via: string | undefined = relayed.relay?.via;
    expect(hostname).toBe("relay.example.com");
    expect(via).toBe("mail_relay");
  });

  it("types relay.delivery as an optional per-recipient list", () => {
    const relayed: EmailDetail = {
      ...SAMPLE,
      relay: { hostname: "relay.example.com", via: "mail_relay" },
    };
    // Servers that predate the field omit it.
    expect(relayed.relay?.delivery).toBeUndefined();

    const delivered: EmailDetail = {
      ...SAMPLE,
      relay: {
        hostname: "relay.example.com",
        via: "mail_relay",
        delivery: [
          {
            recipient: "alice@example.org",
            status: "delivered",
            smtp_code: 250,
            enhanced_status_code: "2.0.0",
            smtp_response: "250 2.0.0 OK",
            at: "2026-05-03T00:00:01.000Z",
          },
          {
            recipient: "bob@example.org",
            // An unfamiliar status must still type-check: status is an
            // open string, not a closed union.
            status: "quarantined",
            smtp_code: null,
            enhanced_status_code: null,
            smtp_response: null,
            at: "2026-05-03T00:00:02.000Z",
          },
        ],
      },
    };
    const delivery = delivered.relay?.delivery ?? [];
    expect(delivery).toHaveLength(2);
    const first = delivery[0];
    const second = delivery[1];
    const status: string | undefined = first?.status;
    const code: number | null | undefined = first?.smtp_code;
    expect(status).toBe("delivered");
    expect(code).toBe(250);
    expect(first?.enhanced_status_code).toBe("2.0.0");
    expect(first?.smtp_response).toBe("250 2.0.0 OK");
    expect(first?.at).toBe("2026-05-03T00:00:01.000Z");
    expect(second?.status).toBe("quarantined");
    expect(second?.smtp_code).toBeNull();

    // relay stays nullable with the new field in place.
    const unrelayed: EmailDetail = { ...SAMPLE, relay: null };
    expect(unrelayed.relay?.delivery).toBeUndefined();
  });
});
