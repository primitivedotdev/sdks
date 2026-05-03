import { describe, expect, it, vi } from "vitest";
import primitive, {
  type EmailAnalysis,
  type EmailAuth,
  type PrimitiveApiError,
  PrimitiveClient,
  type ReceivedEmail,
} from "../../src/index.js";
import { normalizeReceivedEmail } from "../../src/webhook/received-email.js";

const TEST_AUTH: EmailAuth = {
  spf: "pass",
  dmarc: "pass",
  dmarcPolicy: "reject",
  dmarcFromDomain: "example.com",
  dmarcSpfAligned: true,
  dmarcDkimAligned: true,
  dmarcSpfStrict: false,
  dmarcDkimStrict: false,
  dkimSignatures: [],
};

const TEST_ANALYSIS: EmailAnalysis = {};

const RECEIVED_EMAIL: ReceivedEmail = {
  id: "00000000-0000-0000-0000-000000000001",
  eventId: "evt-1",
  receivedAt: "2026-01-01T00:00:00.000Z",
  sender: { address: "alice@example.com", name: "Alice" },
  replyTarget: { address: "alice@example.com", name: "Alice" },
  receivedBy: "support@example.com",
  receivedByAll: ["support@example.com"],
  subject: "Hello",
  replySubject: "Re: Hello",
  forwardSubject: "Fwd: Hello",
  text: "Hi there",
  thread: {
    messageId: "<parent@example.com>",
    inReplyTo: [],
    references: ["<root@example.com>"],
  },
  attachments: [],
  auth: TEST_AUTH,
  analysis: TEST_ANALYSIS,
  raw: {
    id: "evt-1",
    event: "email.received",
    version: "2025-12-14",
    delivery: {
      endpoint_id: "endpoint-1",
      attempt: 1,
      attempted_at: "2026-01-01T00:00:00.000Z",
    },
    email: {
      id: "00000000-0000-0000-0000-000000000001",
      received_at: "2026-01-01T00:00:00.000Z",
      smtp: {
        helo: null,
        mail_from: "bounce@example.com",
        rcpt_to: ["support@example.com"],
      },
      headers: {
        message_id: "<parent@example.com>",
        subject: "Hello",
        from: "Alice <alice@example.com>",
        to: "support@example.com",
        date: "Tue, 01 Jan 2026 00:00:00 +0000",
      },
      content: {
        raw: {
          included: false,
          reason_code: "size_exceeded",
          max_inline_bytes: 0,
          size_bytes: 0,
          sha256: "0".repeat(64),
        },
        download: {
          url: "https://example.test/raw.eml",
          expires_at: "2026-01-01T01:00:00.000Z",
        },
      },
      parsed: {
        status: "complete",
        error: null,
        body_text: "Hi there",
        body_html: null,
        reply_to: [],
        cc: [],
        bcc: [],
        in_reply_to: [],
        references: ["<root@example.com>"],
        attachments: [],
        attachments_download_url: null,
      },
      analysis: TEST_ANALYSIS,
      auth: TEST_AUTH,
    },
  },
};

const SEND_RESULT = {
  id: "sent-123",
  status: "submitted_to_agent",
  queue_id: "qid-123",
  accepted: ["alice@example.com"],
  rejected: [],
  client_idempotency_key: "idem-123",
  request_id: "req-123",
  content_hash: "hash-123",
  idempotent_replay: false,
} as const;

const NORMALIZED_SEND_RESULT = {
  id: "sent-123",
  status: "submitted_to_agent",
  queueId: "qid-123",
  accepted: ["alice@example.com"],
  rejected: [],
  clientIdempotencyKey: "idem-123",
  requestId: "req-123",
  contentHash: "hash-123",
  idempotentReplay: false,
} as const;

describe("PrimitiveClient", () => {
  it("rejects received emails without SMTP recipients", () => {
    const event = structuredClone(RECEIVED_EMAIL.raw);
    // The schema's rcpt_to is a non-empty tuple [string, ...string[]]. To
    // exercise the runtime guard for the invariant violation we have to
    // bypass the type system; this cast is the test-only equivalent of a
    // hand-built malformed event, not silenced production code.
    (event.email.smtp as { rcpt_to: string[] }).rcpt_to = [];

    expect(() => normalizeReceivedEmail(event)).toThrow(
      "email.smtp.rcpt_to must contain at least one recipient",
    );
  });

  it("validates email addresses before making the request", async () => {
    const fetchMock = vi.fn<typeof fetch>() as typeof fetch;
    const client = new PrimitiveClient({
      apiKey: "prim_test",
      baseUrl: "https://example.test/api/v1",
      fetch: fetchMock,
    });

    await expect(
      client.send({
        from: "support@example.com",
        to: "not-an-email",
        subject: "Hello",
        bodyText: "Hi",
      }),
    ).rejects.toThrow("to must be a valid email address");

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts the send payload and returns the normalized send result", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const request = input as Request;
      expect(request.url).toBe("https://example.test/api/v1/send-mail");
      expect(request.headers.get("authorization")).toBe("Bearer prim_test");
      expect(await request.json()).toEqual({
        from: "support@example.com",
        to: "alice@example.com",
        subject: "Hello",
        body_text: "Hi there",
      });

      return new Response(
        JSON.stringify({
          success: true,
          data: SEND_RESULT,
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    }) as typeof fetch;

    const client = new PrimitiveClient({
      apiKey: "prim_test",
      baseUrl: "https://example.test/api/v1",
      fetch: fetchMock,
    });

    await expect(
      client.send({
        from: "support@example.com",
        to: "alice@example.com",
        subject: "Hello",
        bodyText: "Hi there",
      }),
    ).resolves.toEqual(NORMALIZED_SEND_RESULT);
  });

  it("accepts RFC 5322 display-name From headers", async () => {
    const client = new PrimitiveClient({
      apiKey: "prim_test",
      baseUrl: "https://example.test/api/v1",
      fetch: vi.fn<typeof fetch>(async (input) => {
        const request = input as Request;
        expect(await request.json()).toMatchObject({
          from: "Support Team <support@example.com>",
        });
        return new Response(
          JSON.stringify({ success: true, data: SEND_RESULT }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      }) as typeof fetch,
    });

    await client.send({
      from: "Support Team <support@example.com>",
      to: "alice@example.com",
      subject: "Hello",
      bodyText: "Hi there",
    });
  });

  it("sends wait options and idempotency key", async () => {
    const client = new PrimitiveClient({
      apiKey: "prim_test",
      baseUrl: "https://example.test/api/v1",
      fetch: vi.fn<typeof fetch>(async (input) => {
        const request = input as Request;
        expect(request.headers.get("idempotency-key")).toBe("customer-key");
        expect(await request.json()).toMatchObject({
          wait: true,
          wait_timeout_ms: 5000,
        });
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              ...SEND_RESULT,
              status: "delivered",
              delivery_status: "delivered",
              smtp_response_code: 250,
              smtp_response_text: "250 OK",
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }) as typeof fetch,
    });

    await expect(
      client.send({
        from: "support@example.com",
        to: "alice@example.com",
        subject: "Hello",
        bodyText: "Hi there",
        wait: true,
        waitTimeoutMs: 5000,
        idempotencyKey: "customer-key",
      }),
    ).resolves.toMatchObject({
      status: "delivered",
      deliveryStatus: "delivered",
      smtpResponseCode: 250,
      smtpResponseText: "250 OK",
    });
  });

  it("posts html-only send payloads", async () => {
    const client = new PrimitiveClient({
      apiKey: "prim_test",
      baseUrl: "https://example.test/api/v1",
      fetch: vi.fn<typeof fetch>(async (input) => {
        const request = input as Request;
        expect(await request.json()).toMatchObject({
          body_html: "<p>Hello</p>",
        });
        return new Response(
          JSON.stringify({
            success: true,
            data: SEND_RESULT,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }) as typeof fetch,
    });

    await client.send({
      from: "support@example.com",
      to: "alice@example.com",
      subject: "Hello",
      bodyHtml: "<p>Hello</p>",
    });
  });

  it("posts to /emails/{id}/reply with the new ReplyInput shape", async () => {
    // The high-level reply() now forwards to the server's
    // /emails/{id}/reply endpoint. Threading derivation, recipient
    // lookup, and Re: prefix are all server-side. The captured
    // request body is the small ReplyInput shape, not the synthesized
    // send-mail payload the SDK used to build itself.
    const client = new PrimitiveClient({
      apiKey: "prim_test",
      baseUrl: "https://example.test/api/v1",
      fetch: vi.fn<typeof fetch>(async (input) => {
        const request = input as Request;
        expect(new URL(request.url).pathname).toBe(
          "/api/v1/emails/00000000-0000-0000-0000-000000000001/reply",
        );
        expect(await request.json()).toEqual({
          body_text: "Thank you for your email.",
        });

        return new Response(
          JSON.stringify({
            success: true,
            data: {
              ...SEND_RESULT,
              queue_id: "reply-1",
              accepted: ["alice@example.com"],
              rejected: [],
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }) as typeof fetch,
    });

    await client.reply(RECEIVED_EMAIL, "Thank you for your email.");
  });

  it("builds forwarded content through send", async () => {
    const client = new PrimitiveClient({
      apiKey: "prim_test",
      baseUrl: "https://example.test/api/v1",
      fetch: vi.fn<typeof fetch>(async (input) => {
        const request = input as Request;
        const payload = await request.json();

        expect(payload.from).toBe("support@example.com");
        expect(payload.to).toBe("ops@example.com");
        expect(payload.subject).toBe("Fwd: Hello");
        expect(payload.body_text).toContain("Can you take this one?");
        expect(payload.body_text).toContain(
          "---------- Forwarded message ----------",
        );
        expect(payload.body_text).toContain("From: Alice <alice@example.com>");

        return new Response(
          JSON.stringify({
            success: true,
            data: {
              ...SEND_RESULT,
              queue_id: "forward-1",
              accepted: ["ops@example.com"],
              rejected: [],
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }) as typeof fetch,
    });

    await client.forward(RECEIVED_EMAIL, {
      to: "ops@example.com",
      bodyText: "Can you take this one?",
    });
  });

  it("wraps API failures in PrimitiveApiError", async () => {
    const client = new PrimitiveClient({
      apiKey: "prim_test",
      baseUrl: "https://example.test/api/v1",
      fetch: vi.fn<typeof fetch>(
        async () =>
          new Response(
            JSON.stringify({
              success: false,
              error: {
                code: "validation_error",
                message:
                  "We haven't received an authenticated email from this address yet",
              },
            }),
            {
              status: 400,
              headers: { "content-type": "application/json" },
            },
          ),
      ) as typeof fetch,
    });

    await expect(
      client.send({
        from: "support@example.com",
        to: "alice@example.com",
        subject: "Hello",
        bodyText: "Hi there",
      }),
    ).rejects.toMatchObject({
      name: "PrimitiveApiError",
      message:
        "We haven't received an authenticated email from this address yet",
      status: 400,
    } satisfies Partial<PrimitiveApiError>);
  });

  it("exposes a small default root surface", () => {
    expect(typeof primitive.receive).toBe("function");
    expect(typeof primitive.client).toBe("function");
  });

  it("forwards a from override to the reply endpoint", async () => {
    // Server-side reply derives from from inbound.recipient by default;
    // the customer can override (display-name addition, multi-team
    // routing). The SDK forwards the override verbatim. Subject stays
    // server-derived; the ReplyInput type doesn't accept it.
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const request = input as Request;
      expect(new URL(request.url).pathname).toBe(
        "/api/v1/emails/00000000-0000-0000-0000-000000000001/reply",
      );
      expect(await request.json()).toEqual({
        body_text: "Thanks!",
        from: "notifications@example.com",
      });
      return new Response(
        JSON.stringify({
          success: true,
          data: { ...SEND_RESULT, queue_id: "reply-2" },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as typeof fetch;

    const client = new PrimitiveClient({
      apiKey: "prim_test",
      baseUrl: "https://example.test/api/v1",
      fetch: fetchMock,
    });

    await client.reply(RECEIVED_EMAIL, {
      text: "Thanks!",
      from: "notifications@example.com",
    });
  });

  it("surfaces gates, code, requestId, and details on 403 recipient_not_allowed", async () => {
    const errorBody = {
      success: false,
      error: {
        code: "recipient_not_allowed",
        message: "cannot send to alice@example.com",
        request_id: "req_test_123",
        details: {
          sent_email_id: "se_abc",
          required_entitlements: ["send_to_confirmed_domains"],
        },
        gates: [
          {
            name: "send_to_known_addresses",
            reason: "recipient_not_known",
            subject: "alice@example.com",
            message: "alice@example.com has not previously sent mail",
            fix: { action: "wait_for_inbound", subject: "alice@example.com" },
          },
        ],
      },
    } as const;

    const client = new PrimitiveClient({
      apiKey: "prim_test",
      baseUrl: "https://example.test/api/v1",
      fetch: vi.fn<typeof fetch>(
        async () =>
          new Response(JSON.stringify(errorBody), {
            status: 403,
            headers: { "content-type": "application/json" },
          }),
      ) as typeof fetch,
    });

    let captured: PrimitiveApiError | undefined;
    try {
      await client.send({
        from: "support@example.com",
        to: "alice@example.com",
        subject: "Hello",
        bodyText: "Hi",
      });
    } catch (err) {
      captured = err as PrimitiveApiError;
    }

    expect(captured).toBeDefined();
    expect(captured?.status).toBe(403);
    expect(captured?.code).toBe("recipient_not_allowed");
    expect(captured?.requestId).toBe("req_test_123");
    expect(captured?.gates).toHaveLength(1);
    expect(captured?.gates?.[0]?.reason).toBe("recipient_not_known");
    expect(captured?.details?.sent_email_id).toBe("se_abc");
  });

  it("surfaces retry-after header on 429 rate_limit_exceeded", async () => {
    const client = new PrimitiveClient({
      apiKey: "prim_test",
      baseUrl: "https://example.test/api/v1",
      fetch: vi.fn<typeof fetch>(
        async () =>
          new Response(
            JSON.stringify({
              success: false,
              error: {
                code: "rate_limit_exceeded",
                message: "Rate limit exceeded",
              },
            }),
            {
              status: 429,
              headers: {
                "content-type": "application/json",
                "retry-after": "12",
              },
            },
          ),
      ) as typeof fetch,
    });

    await expect(
      client.send({
        from: "support@example.com",
        to: "alice@example.com",
        subject: "Hello",
        bodyText: "Hi",
      }),
    ).rejects.toMatchObject({
      name: "PrimitiveApiError",
      status: 429,
      code: "rate_limit_exceeded",
      retryAfter: 12,
    } satisfies Partial<PrimitiveApiError>);
  });
});
