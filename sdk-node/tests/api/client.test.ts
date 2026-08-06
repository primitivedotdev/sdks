import { describe, expect, it, vi } from "vitest";
import primitive, {
  type EmailAnalysis,
  type EmailAuth,
  type MemoryJsonValue,
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
        to_addresses: [{ address: "support@example.com", name: null }],
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
  from: "agent@example.com",
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
  from: "agent@example.com",
  queueId: "qid-123",
  accepted: ["alice@example.com"],
  rejected: [],
  clientIdempotencyKey: "idem-123",
  requestId: "req-123",
  contentHash: "hash-123",
  idempotentReplay: false,
} as const;

const FUNCTION_ID = "11111111-1111-4111-8111-111111111111";

const MEMORY_RECORD = {
  id: "22222222-2222-4222-8222-222222222222",
  key: "state",
  scope: { type: "function", id: FUNCTION_ID },
  value: { step: 2 },
  version: "1",
  created_at: "2026-06-30T00:00:00.000Z",
  updated_at: "2026-06-30T00:00:00.000Z",
  last_read_at: null,
  read_count: "0",
  write_count: "1",
  expires_at: null,
  created_by: "api_key:key-1",
  updated_by: "api_key:key-1",
} as const;

const MEMORY_RECORD_WITHOUT_VALUE = {
  id: "22222222-2222-4222-8222-222222222222",
  key: "state",
  scope: { type: "function", id: FUNCTION_ID },
  version: "1",
  created_at: "2026-06-30T00:00:00.000Z",
  updated_at: "2026-06-30T00:00:00.000Z",
  last_read_at: null,
  read_count: "0",
  write_count: "1",
  expires_at: null,
  created_by: "api_key:key-1",
  updated_by: "api_key:key-1",
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
      apiBaseUrl: "https://api.example.test/v1",
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
      expect(request.url).toBe("https://api.example.test/v1/send-mail");
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
      apiBaseUrl: "https://api.example.test/v1",
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
      apiBaseUrl: "https://api.example.test/v1",
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
      apiBaseUrl: "https://api.example.test/v1",
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
      client.send(
        {
          from: "support@example.com",
          to: "alice@example.com",
          subject: "Hello",
          bodyText: "Hi there",
          wait: true,
          waitTimeoutMs: 5000,
        },
        { idempotencyKey: "customer-key" },
      ),
    ).resolves.toMatchObject({
      status: "delivered",
      deliveryStatus: "delivered",
      smtpResponseCode: 250,
      smtpResponseText: "250 OK",
    });
  });

  it("exposes Primitive Memories on the high-level client", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const request = input as Request;
      const url = new URL(request.url);

      if (request.method === "PUT") {
        expect(url.pathname).toBe("/v1/memories");
        expect(await request.json()).toEqual({
          key: "state",
          value: { step: 2 },
          scope: { type: "function", id: FUNCTION_ID },
        });
        return new Response(
          JSON.stringify({ success: true, data: MEMORY_RECORD }),
          { status: 201, headers: { "content-type": "application/json" } },
        );
      }

      if (request.method === "GET" && url.pathname === "/v1/memories") {
        expect(url.searchParams.get("key")).toBe("state");
        expect(url.searchParams.get("scope_type")).toBe("function");
        expect(url.searchParams.get("scope_id")).toBe(FUNCTION_ID);
        return new Response(
          JSON.stringify({ success: true, data: MEMORY_RECORD }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      if (request.method === "GET" && url.pathname === "/v1/memories/search") {
        const prefix = url.searchParams.get("prefix");
        expect(url.searchParams.get("scope_type")).toBe("function");
        expect(url.searchParams.get("scope_id")).toBe(FUNCTION_ID);

        if (prefix === "st") {
          expect(url.searchParams.get("include_value")).toBe("false");
          return new Response(
            JSON.stringify({
              success: true,
              data: [MEMORY_RECORD_WITHOUT_VALUE],
              meta: { total: 1, limit: 50, cursor: null },
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }

        if (prefix === "state:") {
          expect(url.searchParams.get("include_value")).toBeNull();
          return new Response(
            JSON.stringify({
              success: true,
              data: [MEMORY_RECORD],
              meta: { total: 1, limit: 50, cursor: null },
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }

        throw new Error(
          `Unexpected memory search prefix: ${prefix ?? "(none)"}`,
        );
      }

      if (request.method === "DELETE") {
        expect(url.pathname).toBe("/v1/memories");
        expect(url.searchParams.get("key")).toBe("state");
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              deleted: true,
              key: "state",
              scope: { type: "function", id: FUNCTION_ID },
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      throw new Error(`Unexpected memory request: ${request.method} ${url}`);
    }) as typeof fetch;

    const client = new PrimitiveClient({
      apiKey: "prim_test",
      apiBaseUrl: "https://api.example.test/v1",
      fetch: fetchMock,
    });

    await expect(
      client.memories.set({
        key: "state",
        value: { step: 2 },
        scope: { type: "function", id: FUNCTION_ID },
      }),
    ).resolves.toEqual(MEMORY_RECORD);

    await expect(
      client.memories.get({
        key: "state",
        scope_type: "function",
        scope_id: FUNCTION_ID,
      }),
    ).resolves.toEqual(MEMORY_RECORD);

    await expect(
      client.memories.search({
        prefix: "st",
        includeValue: false,
        scope_type: "function",
        scope_id: FUNCTION_ID,
      }),
    ).resolves.toEqual({
      data: [MEMORY_RECORD_WITHOUT_VALUE],
      meta: { total: 1, limit: 50, cursor: null },
    });

    await expect(
      client.memories.search({
        prefix: "state:",
        scope_type: "function",
        scope_id: FUNCTION_ID,
      }),
    ).resolves.toEqual({
      data: [MEMORY_RECORD],
      meta: { total: 1, limit: 50, cursor: null },
    });

    await expect(client.memories.delete("state")).resolves.toEqual({
      deleted: true,
      key: "state",
      scope: { type: "function", id: FUNCTION_ID },
    });

    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("rejects free-text memory search calls before making a request", async () => {
    const fetchMock = vi.fn<typeof fetch>() as typeof fetch;
    const client = new PrimitiveClient({
      apiKey: "prim_test",
      apiBaseUrl: "https://api.example.test/v1",
      fetch: fetchMock,
    });

    await expect(
      client.memories.search({
        query: "turn protocol",
        limit: 5,
      } as unknown as Parameters<typeof client.memories.search>[0]),
    ).rejects.toThrow(
      "client.memories.search is key-prefix search; pass { prefix } directly",
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects generated operation option objects on the high-level memories client", async () => {
    const fetchMock = vi.fn<typeof fetch>() as typeof fetch;
    const client = new PrimitiveClient({
      apiKey: "prim_test",
      apiBaseUrl: "https://api.example.test/v1",
      fetch: fetchMock,
    });

    await expect(
      client.memories.set({
        body: { key: "state", value: { step: 2 } },
      } as unknown as Parameters<typeof client.memories.set>[0]),
    ).rejects.toThrow("client.memories.set takes the memory fields directly");

    await expect(
      client.memories.search({
        query: { prefix: "st" },
      } as unknown as Parameters<typeof client.memories.search>[0]),
    ).rejects.toThrow(
      "client.memories.search takes the memory fields directly",
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects invalid memory JSON values before making a request", async () => {
    const fetchMock = vi.fn<typeof fetch>() as typeof fetch;
    const client = new PrimitiveClient({
      apiKey: "prim_test",
      apiBaseUrl: "https://api.example.test/v1",
      fetch: fetchMock,
    });

    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    const sparseArray = Array.from({ length: 2 }) as unknown[];
    delete sparseArray[0];
    sparseArray[1] = "hole";
    const valid: MemoryJsonValue = {
      nested: [1, "two", true, null, { ok: false }],
    };
    expect(valid).toEqual({ nested: [1, "two", true, null, { ok: false }] });

    for (const value of [
      undefined,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      BigInt(1),
      Symbol("memory"),
      () => undefined,
      { missing: undefined },
      [undefined],
      sparseArray,
      new Date("2026-01-01T00:00:00.000Z"),
      cyclic,
    ]) {
      await expect(
        client.memories.set({
          key: "bad",
          value: value as MemoryJsonValue,
        }),
      ).rejects.toThrow("JSON value");
    }

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts html-only send payloads", async () => {
    const client = new PrimitiveClient({
      apiKey: "prim_test",
      apiBaseUrl: "https://api.example.test/v1",
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
      apiBaseUrl: "https://api.example.test/v1",
      fetch: vi.fn<typeof fetch>(async (input) => {
        const request = input as Request;
        expect(new URL(request.url).pathname).toBe(
          "/v1/emails/00000000-0000-0000-0000-000000000001/reply",
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

  it("posts reply attachments to the API host", async () => {
    const client = new PrimitiveClient({
      apiKey: "prim_test",
      apiBaseUrl: "https://api.example.test/v1",
      fetch: vi.fn<typeof fetch>(async (input) => {
        const request = input as Request;
        expect(request.url).toBe(
          "https://api.example.test/v1/emails/00000000-0000-0000-0000-000000000001/reply",
        );
        expect(await request.json()).toEqual({
          attachments: [
            {
              content_base64: "aGVsbG8=",
              filename: "report.txt",
            },
          ],
          body_text: "See attached.",
        });

        return new Response(
          JSON.stringify({
            success: true,
            data: {
              ...SEND_RESULT,
              queue_id: "reply-attachment-1",
              accepted: ["alice@example.com"],
              rejected: [],
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }) as typeof fetch,
    });

    await client.reply(RECEIVED_EMAIL, {
      text: "See attached.",
      attachments: [
        {
          content_base64: "aGVsbG8=",
          filename: "report.txt",
        },
      ],
    });
  });

  it("builds forwarded content through send", async () => {
    const client = new PrimitiveClient({
      apiKey: "prim_test",
      apiBaseUrl: "https://api.example.test/v1",
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

  it("forward threads scheduledAt through to the send payload", async () => {
    const scheduledAt = "2100-01-02T03:04:05.000Z";
    const client = new PrimitiveClient({
      apiKey: "prim_test",
      apiBaseUrl: "https://api.example.test/v1",
      fetch: vi.fn<typeof fetch>(async (input) => {
        const request = input as Request;
        const payload = await request.json();

        expect(payload.scheduled_at).toBe(scheduledAt);

        return new Response(
          JSON.stringify({
            success: true,
            data: {
              ...SEND_RESULT,
              status: "scheduled",
              queue_id: null,
              accepted: [],
              rejected: [],
              scheduled_at: scheduledAt,
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }) as typeof fetch,
    });

    const result = await client.forward(RECEIVED_EMAIL, {
      to: "ops@example.com",
      bodyText: "Can you take this one?",
      scheduledAt,
    });
    expect(result.status).toBe("scheduled");
    expect(result.scheduledAt).toBe(scheduledAt);
  });

  it("wraps API failures in PrimitiveApiError", async () => {
    const client = new PrimitiveClient({
      apiKey: "prim_test",
      apiBaseUrl: "https://api.example.test/v1",
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

  it("chains the transport error as cause when fetch rejects", async () => {
    // Mirror the undici shape: a TypeError("fetch failed") whose own
    // `cause` carries the real socket failure (code/errno/syscall).
    const socketError = Object.assign(new Error("connect ENETUNREACH"), {
      code: "ENETUNREACH",
      errno: -51,
      syscall: "connect",
    });
    const transportError = new TypeError("fetch failed", {
      cause: socketError,
    });

    const client = new PrimitiveClient({
      apiKey: "prim_test",
      apiBaseUrl: "https://api.example.test/v1",
      fetch: vi.fn<typeof fetch>(async () => {
        throw transportError;
      }) as typeof fetch,
    });

    const err = await client
      .send({
        from: "support@example.com",
        to: "alice@example.com",
        subject: "Hello",
        bodyText: "Hi there",
      })
      .then(
        () => {
          throw new Error("expected send to reject");
        },
        (e: unknown) => e as PrimitiveApiError,
      );

    expect(err.name).toBe("PrimitiveApiError");
    expect(err.message).toBe("fetch failed");
    // The original transport error is chained so callers logging
    // `err.cause` recover the network detail, not just "fetch failed".
    expect(err.cause).toBe(transportError);
    expect((err.cause as { cause?: { code?: string } }).cause?.code).toBe(
      "ENETUNREACH",
    );
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
        "/v1/emails/00000000-0000-0000-0000-000000000001/reply",
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
      apiBaseUrl: "https://api.example.test/v1",
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
      apiBaseUrl: "https://api.example.test/v1",
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

  it("send: pre-aborted signal rejects with AbortError", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const request = input as Request;
      if (request.signal.aborted) throw request.signal.reason;
      return new Response(
        JSON.stringify({ success: true, data: SEND_RESULT }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    }) as typeof fetch;

    const client = new PrimitiveClient({
      apiKey: "prim_test",
      apiBaseUrl: "https://api.example.test/v1",
      fetch: fetchMock,
    });

    const controller = new AbortController();
    controller.abort();

    await expect(
      client.send(
        {
          from: "support@example.com",
          to: "alice@example.com",
          subject: "Hello",
          bodyText: "Hi",
        },
        { signal: controller.signal },
      ),
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it("send: timeout rejects with AbortError when fetch never resolves", async () => {
    const fetchMock = vi.fn<typeof fetch>(
      (input) =>
        new Promise<Response>((_, reject) => {
          const request = input as Request;
          request.signal.addEventListener("abort", () => {
            reject(request.signal.reason);
          });
        }),
    ) as typeof fetch;

    const client = new PrimitiveClient({
      apiKey: "prim_test",
      apiBaseUrl: "https://api.example.test/v1",
      fetch: fetchMock,
    });

    await expect(
      client.send(
        {
          from: "support@example.com",
          to: "alice@example.com",
          subject: "Hello",
          bodyText: "Hi",
        },
        { timeout: 50 },
      ),
    ).rejects.toMatchObject({ name: "TimeoutError" });
  });

  it("send: per-call headers are merged onto the request", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const request = input as Request;
      expect(request.headers.get("x-custom")).toBe("v");
      return new Response(
        JSON.stringify({ success: true, data: SEND_RESULT }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    }) as typeof fetch;

    const client = new PrimitiveClient({
      apiKey: "prim_test",
      apiBaseUrl: "https://api.example.test/v1",
      fetch: fetchMock,
    });

    await client.send(
      {
        from: "support@example.com",
        to: "alice@example.com",
        subject: "Hello",
        bodyText: "Hi",
      },
      { headers: { "X-Custom": "v" } },
    );
  });

  it("send: idempotencyKey on options sets the Idempotency-Key header", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const request = input as Request;
      expect(request.headers.get("idempotency-key")).toBe("foo");
      return new Response(
        JSON.stringify({ success: true, data: SEND_RESULT }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    }) as typeof fetch;

    const client = new PrimitiveClient({
      apiKey: "prim_test",
      apiBaseUrl: "https://api.example.test/v1",
      fetch: fetchMock,
    });

    await client.send(
      {
        from: "support@example.com",
        to: "alice@example.com",
        subject: "Hello",
        bodyText: "Hi",
      },
      { idempotencyKey: "foo" },
    );
  });

  it("reply: idempotencyKey on options sets the Idempotency-Key header", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const request = input as Request;
      expect(request.headers.get("idempotency-key")).toBe("reply-key");
      return new Response(
        JSON.stringify({ success: true, data: SEND_RESULT }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    }) as typeof fetch;

    const client = new PrimitiveClient({
      apiKey: "prim_test",
      apiBaseUrl: "https://api.example.test/v1",
      fetch: fetchMock,
    });

    await client.reply(RECEIVED_EMAIL, "Thanks", {
      idempotencyKey: "reply-key",
    });
  });

  it("reply: pre-aborted signal rejects with AbortError", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const request = input as Request;
      if (request.signal.aborted) throw request.signal.reason;
      return new Response(
        JSON.stringify({ success: true, data: SEND_RESULT }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    }) as typeof fetch;

    const client = new PrimitiveClient({
      apiKey: "prim_test",
      apiBaseUrl: "https://api.example.test/v1",
      fetch: fetchMock,
    });

    const controller = new AbortController();
    controller.abort();

    await expect(
      client.reply(RECEIVED_EMAIL, "Thanks", { signal: controller.signal }),
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it("reply: timeout rejects when fetch never resolves", async () => {
    const fetchMock = vi.fn<typeof fetch>(
      (input) =>
        new Promise<Response>((_, reject) => {
          const request = input as Request;
          request.signal.addEventListener("abort", () => {
            reject(request.signal.reason);
          });
        }),
    ) as typeof fetch;

    const client = new PrimitiveClient({
      apiKey: "prim_test",
      apiBaseUrl: "https://api.example.test/v1",
      fetch: fetchMock,
    });

    await expect(
      client.reply(RECEIVED_EMAIL, "Thanks", { timeout: 50 }),
    ).rejects.toMatchObject({ name: "TimeoutError" });
  });

  it("forward: pre-aborted signal rejects with AbortError", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const request = input as Request;
      if (request.signal.aborted) throw request.signal.reason;
      return new Response(
        JSON.stringify({ success: true, data: SEND_RESULT }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    }) as typeof fetch;

    const client = new PrimitiveClient({
      apiKey: "prim_test",
      apiBaseUrl: "https://api.example.test/v1",
      fetch: fetchMock,
    });

    const controller = new AbortController();
    controller.abort();

    await expect(
      client.forward(
        RECEIVED_EMAIL,
        { to: "ops@example.com", bodyText: "Take this" },
        { signal: controller.signal },
      ),
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it("forward: timeout rejects when fetch never resolves", async () => {
    const fetchMock = vi.fn<typeof fetch>(
      (input) =>
        new Promise<Response>((_, reject) => {
          const request = input as Request;
          request.signal.addEventListener("abort", () => {
            reject(request.signal.reason);
          });
        }),
    ) as typeof fetch;

    const client = new PrimitiveClient({
      apiKey: "prim_test",
      apiBaseUrl: "https://api.example.test/v1",
      fetch: fetchMock,
    });

    await expect(
      client.forward(
        RECEIVED_EMAIL,
        { to: "ops@example.com", bodyText: "Take this" },
        { timeout: 50 },
      ),
    ).rejects.toMatchObject({ name: "TimeoutError" });
  });

  it("send: when both signal and timeout are set, timeout firing first aborts the request", async () => {
    const fetchMock = vi.fn<typeof fetch>(
      (input) =>
        new Promise<Response>((_, reject) => {
          const request = input as Request;
          request.signal.addEventListener("abort", () => {
            reject(request.signal.reason);
          });
        }),
    ) as typeof fetch;

    const client = new PrimitiveClient({
      apiKey: "prim_test",
      apiBaseUrl: "https://api.example.test/v1",
      fetch: fetchMock,
    });

    const controller = new AbortController();

    await expect(
      client.send(
        {
          from: "support@example.com",
          to: "alice@example.com",
          subject: "Hello",
          bodyText: "Hi",
        },
        { signal: controller.signal, timeout: 50 },
      ),
    ).rejects.toMatchObject({ name: "TimeoutError" });
  });

  it("surfaces retry-after header on 429 rate_limit_exceeded", async () => {
    const client = new PrimitiveClient({
      apiKey: "prim_test",
      apiBaseUrl: "https://api.example.test/v1",
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

describe("PrimitiveClient send-by-reference + sendAttachment", () => {
  const jsonOk = (data: unknown) =>
    new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  it("threads payloadAttachments into the wire body, converting the hex CEK to base64url", async () => {
    const hexCek = "deadbeef";
    const wireCek = Buffer.from(hexCek, "hex").toString("base64url");
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const request = input as Request;
      expect(request.url).toBe("https://api.example.test/v1/send-mail");
      expect(await request.json()).toMatchObject({
        payload_attachments: [
          {
            root: "a".repeat(64),
            filename: "big.bin",
            content_type: "application/octet-stream",
            cek: wireCek,
          },
        ],
      });
      return jsonOk(SEND_RESULT);
    }) as typeof fetch;
    const client = new PrimitiveClient({
      apiKey: "prim_test",
      apiBaseUrl: "https://api.example.test/v1",
      fetch: fetchMock,
    });
    await client.send({
      from: "a@example.com",
      to: "b@example.com",
      subject: "Hi",
      bodyText: "x",
      payloadAttachments: [
        {
          root: "a".repeat(64),
          filename: "big.bin",
          contentType: "application/octet-stream",
          cek: hexCek,
        },
      ],
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("sendAttachment sends small content inline", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const request = input as Request;
      const body = (await request.json()) as {
        attachments?: unknown[];
        payload_attachments?: unknown[];
      };
      expect(body.attachments).toEqual([
        {
          filename: "note.txt",
          content_base64: Buffer.from("hello").toString("base64"),
        },
      ]);
      expect(body.payload_attachments).toBeUndefined();
      return jsonOk(SEND_RESULT);
    }) as typeof fetch;
    const client = new PrimitiveClient({
      apiKey: "prim_test",
      apiBaseUrl: "https://api.example.test/v1",
      fetch: fetchMock,
    });
    await client.sendAttachment({
      from: "a@example.com",
      to: "b@example.com",
      subject: "Hi",
      bodyText: "x",
      attachment: {
        filename: "note.txt",
        content: new TextEncoder().encode("hello"),
      },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("sendAttachment rejects when both content and path are given", async () => {
    const client = new PrimitiveClient({
      apiKey: "prim_test",
      apiBaseUrl: "https://api.example.test/v1",
      fetch: vi.fn<typeof fetch>() as typeof fetch,
    });
    await expect(
      client.sendAttachment({
        from: "a@example.com",
        to: "b@example.com",
        subject: "Hi",
        bodyText: "x",
        attachment: {
          filename: "x.bin",
          content: new Uint8Array([1]),
          path: "/tmp/x.bin",
        },
      }),
    ).rejects.toThrow(/not both/);
  });

  it("sendAttachment uploads large content and sends it by reference", async () => {
    let uploadCalls = 0;
    let sentBody:
      | {
          payload_attachments?: Array<{
            root: string;
            filename: string;
            cek: string;
          }>;
        }
      | undefined;
    const spy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input, init) => {
        const isRequest = typeof input !== "string";
        const url = isRequest ? (input as Request).url : String(input);
        if (url.endsWith("/v1/send-mail")) {
          sentBody = isRequest
            ? await (input as Request).json()
            : JSON.parse(String(init?.body));
          return jsonOk(SEND_RESULT);
        }
        // initiate / chunk PUT / finalize — the push helpers only check res.ok.
        uploadCalls++;
        return new Response(null, {
          status: url.endsWith("/v1/payloads") ? 201 : 200,
        });
      });
    try {
      const client = new PrimitiveClient({
        apiKey: "prim_test",
        apiBaseUrl: "https://api.example.test/v1",
      });
      await client.sendAttachment({
        from: "a@example.com",
        to: "b@example.com",
        subject: "Hi",
        bodyText: "x",
        inlineThreshold: 4,
        attachment: {
          filename: "big.bin",
          content: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]),
        },
      });
    } finally {
      spy.mockRestore();
    }
    // The object was uploaded (initiate + chunk + finalize) before the send.
    expect(uploadCalls).toBeGreaterThanOrEqual(3);
    const ref = sentBody?.payload_attachments?.[0];
    expect(ref?.filename).toBe("big.bin");
    expect(ref?.root).toMatch(/^[0-9a-f]{64}$/);
    // The hex push CEK is converted to base64url for the reference.
    expect(ref?.cek).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});
