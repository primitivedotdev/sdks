import type { EmailDetail } from "@primitivedotdev/api-core";
import { describe, expect, it } from "vitest";

// Round-trip pin for the new fields on EmailDetail (replies,
// from_known_address, body_text, body_html). TS types are erased at
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
  thread_id: "44444444-4444-4444-4444-444444444444",
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
});
