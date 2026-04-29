import { describe, expect, it, vi } from "vitest";
import primitive, {
  type EmailReceivedEvent,
  type PrimitiveApiError,
  PrimitiveClient,
  type ReceivedEmail,
} from "../../src/index.js";
import { normalizeReceivedEmail } from "../../src/webhook/received-email.js";

const RECEIVED_EMAIL: ReceivedEmail = {
  id: "email-1",
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
  auth: {} as never,
  analysis: {} as never,
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
      id: "email-1",
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
      analysis: {} as never,
      auth: {} as never,
    },
  } as never,
};

describe("PrimitiveClient", () => {
  it("rejects received emails without SMTP recipients", () => {
    const event = structuredClone(RECEIVED_EMAIL.raw as EmailReceivedEvent);
    event.email.smtp.rcpt_to = [] as unknown as [string, ...string[]];

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
          data: {
            queue_id: "qid-123",
            accepted: ["alice@example.com"],
            rejected: [],
          },
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
    ).resolves.toEqual({
      queueId: "qid-123",
      accepted: ["alice@example.com"],
      rejected: [],
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
            data: { accepted: ["alice@example.com"], rejected: [] },
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

  it("builds threaded replies through send", async () => {
    const client = new PrimitiveClient({
      apiKey: "prim_test",
      baseUrl: "https://example.test/api/v1",
      fetch: vi.fn<typeof fetch>(async (input) => {
        const request = input as Request;
        expect(await request.json()).toEqual({
          from: "support@example.com",
          to: "alice@example.com",
          subject: "Re: Hello",
          body_text: "Thank you for your email.",
          in_reply_to: "<parent@example.com>",
          references: ["<root@example.com>", "<parent@example.com>"],
        });

        return new Response(
          JSON.stringify({
            success: true,
            data: {
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
});
