import { describe, expect, it, vi } from "vitest";
import primitive, {
  type PrimitiveApiError,
  PrimitiveClient,
  type ReceivedEmail,
} from "../../src/index.js";

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
        text: "Hi",
      }),
    ).rejects.toThrow("to must be a valid email address");

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts the send payload and returns the normalized send result", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const request = input as Request;
      expect(request.url).toBe("https://example.test/api/v1/send");
      expect(request.headers.get("authorization")).toBe("Bearer prim_test");
      expect(await request.json()).toEqual({
        from: "support@example.com",
        to: "alice@example.com",
        subject: "Hello",
        text: "Hi there",
      });

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            id: "00000000-0000-0000-0000-000000000001",
            status: "accepted",
            smtp_code: 250,
            smtp_message: "queued",
            remote_host: "mx.example.net",
            service_message_id: "svc-123",
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
        text: "Hi there",
      }),
    ).resolves.toEqual({
      id: "00000000-0000-0000-0000-000000000001",
      status: "accepted",
      smtpCode: 250,
      smtpMessage: "queued",
      remoteHost: "mx.example.net",
      serviceMessageId: "svc-123",
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
          text: "Thank you for your email.",
          in_reply_to: "<parent@example.com>",
          references: ["<root@example.com>", "<parent@example.com>"],
        });

        return new Response(
          JSON.stringify({
            success: true,
            data: {
              id: "reply-1",
              status: "accepted",
              smtp_code: 250,
              smtp_message: "queued",
              remote_host: "mx.example.net",
              service_message_id: "svc-123",
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
        expect(payload.text).toContain("Can you take this one?");
        expect(payload.text).toContain(
          "---------- Forwarded message ----------",
        );
        expect(payload.text).toContain("From: Alice <alice@example.com>");

        return new Response(
          JSON.stringify({
            success: true,
            data: {
              id: "forward-1",
              status: "accepted",
              smtp_code: 250,
              smtp_message: "queued",
              remote_host: "mx.example.net",
              service_message_id: "svc-123",
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }) as typeof fetch,
    });

    await client.forward(RECEIVED_EMAIL, {
      to: "ops@example.com",
      text: "Can you take this one?",
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
        text: "Hi there",
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
