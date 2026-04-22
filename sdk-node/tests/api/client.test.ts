import { describe, expect, it, vi } from "vitest";
import { type PrimitiveApiError, PrimitiveClient } from "../../src/index.js";

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
        body: "Hi",
      }),
    ).rejects.toThrow("to must be a valid email address");

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts the send payload and returns the inner send result", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const request = input as Request;
      expect(request.url).toBe("https://example.test/api/v1/send");
      expect(request.headers.get("authorization")).toBe("Bearer prim_test");
      expect(await request.json()).toEqual({
        from: "support@example.com",
        to: "alice@example.com",
        subject: "Hello",
        body: "Hi there",
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
        body: "Hi there",
      }),
    ).resolves.toEqual({
      id: "00000000-0000-0000-0000-000000000001",
      status: "accepted",
      smtp_code: 250,
      smtp_message: "queued",
      remote_host: "mx.example.net",
      service_message_id: "svc-123",
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
        body: "Hi there",
      }),
    ).rejects.toMatchObject({
      name: "PrimitiveApiError",
      message:
        "We haven't received an authenticated email from this address yet",
      status: 400,
    } satisfies Partial<PrimitiveApiError>);
  });
});
