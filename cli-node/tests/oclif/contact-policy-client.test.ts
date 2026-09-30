import { PrimitiveApiClient } from "@primitivedotdev/api-core";
import { describe, expect, it, vi } from "vitest";
import { apiContactPolicy } from "../../src/oclif/contact-policy-client.js";
import { ListenStateError } from "../../src/oclif/listen-state.js";
import { ContactPolicyReadRetryError } from "../../src/oclif/notification-contact-policy.js";
import { emptyContactPolicy } from "./contact-policy-fixture.js";

const recipient = "agent@example.com";
const sender = "owner@example.com";
const receivedAt = "2026-09-01T10:01:00.000Z";

it("does not query recipient-bound network admission for an org-key listener", async () => {
  const requests = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = new URL(new Request(input, init).url).pathname;
      if (path.startsWith("/v1/agent-contact-policy/"))
        return Response.json({
          success: true,
          data: emptyContactPolicy(recipient),
        });
      if (path.startsWith("/v1/agent-contacts/"))
        return Response.json({
          success: true,
          data: [],
          meta: { cursor: null },
        });
      throw new Error(`Unexpected network admission: ${path}`);
    },
  );
  const api = new PrimitiveApiClient({
    apiKey: "fixture",
    apiBaseUrl: "https://example.test/v1",
    fetch: requests,
  });
  const policy = apiContactPolicy(api.client, recipient, false, false);
  expect(
    await policy.admit(sender, receivedAt, new AbortController().signal),
  ).toBeNull();
  expect(requests).toHaveBeenCalledTimes(2);
});

describe.each([
  "policy",
  "contacts",
])("%s read failure classification", (operation) => {
  it.each([
    429,
    500,
    502,
    503,
    "network",
    "body-reset",
    "body-socket",
  ] as const)("defers a transient %s without exposing response or transport details", async (failure) => {
    const { policy, requests, privateDetail } = fixture(operation, failure);
    const error = await policy
      .admit(sender, receivedAt, new AbortController().signal)
      .catch((error: unknown) => error);
    expect(error).toBeInstanceOf(ContactPolicyReadRetryError);
    expect((error as Error).message).not.toContain(privateDetail);
    expect(requests).toHaveBeenCalledTimes(operation === "policy" ? 1 : 2);
  });

  it.each([
    400,
    401,
    403,
    "invalid-json",
    "invalid-schema",
    "body-unknown",
    "unauthorized-body-reset",
    "forbidden-body-reset",
  ] as const)("keeps %s terminal", async (failure) => {
    const { policy, requests, privateDetail } = fixture(operation, failure);
    const error = await policy
      .admit(sender, receivedAt, new AbortController().signal)
      .catch((error: unknown) => error);
    expect(error).toBeInstanceOf(ListenStateError);
    expect(error).not.toBeInstanceOf(ContactPolicyReadRetryError);
    expect((error as Error).message).not.toContain(privateDetail);
    expect(requests).toHaveBeenCalledTimes(operation === "policy" ? 1 : 2);
  });
});

function fixture(operation: string, failure: number | string) {
  const privateDetail = "private upstream error detail";
  const requests = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      const isPolicy = new URL(request.url).pathname.includes(
        "/agent-contact-policy/",
      );
      if (isPolicy === (operation === "policy")) {
        if (failure === "network") throw new TypeError(privateDetail);
        if (String(failure).includes("body-")) {
          const cause = Object.assign(new Error(privateDetail), {
            code:
              failure === "body-unknown"
                ? "INVALID_RESPONSE"
                : failure === "body-socket"
                  ? "UND_ERR_SOCKET"
                  : "ECONNRESET",
          });
          return new Response(
            new ReadableStream({
              start(controller) {
                controller.error(new TypeError(privateDetail, { cause }));
              },
            }),
            {
              status:
                failure === "unauthorized-body-reset"
                  ? 401
                  : failure === "forbidden-body-reset"
                    ? 403
                    : 200,
              headers: { "content-type": "application/json" },
            },
          );
        }
        if (failure === "invalid-json")
          return new Response("invalid", {
            headers: { "content-type": "application/json" },
          });
        if (failure === "invalid-schema")
          return Response.json({ success: true, data: { privateDetail } });
        return Response.json(
          { success: false, error: { message: privateDetail } },
          { status: Number(failure) },
        );
      }
      return Response.json(
        isPolicy
          ? { success: true, data: emptyContactPolicy(recipient) }
          : { success: true, data: [], meta: { cursor: null } },
      );
    },
  );
  const api = new PrimitiveApiClient({
    apiKey: "fixture",
    apiBaseUrl: "https://example.test/v1",
    fetch: requests,
    // Per-call classification must not depend on the client's global throw mode.
    throwOnError: true,
  });
  return {
    policy: apiContactPolicy(api.client, recipient),
    requests,
    privateDetail,
  };
}

describe("exact-mail proof failures hold all dispatch", () => {
  it.each([
    403, 404, 422,
  ])("holds unsolicited and solicited mail on %s", async (status) => {
    const requests = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = new URL(new Request(input, init).url).pathname;
        if (path.startsWith("/v1/agent-contact-policy/"))
          return Response.json({
            success: true,
            data: emptyContactPolicy(recipient),
          });
        if (path.startsWith("/v1/agent-contacts/"))
          return Response.json({
            success: true,
            data: [],
            meta: { cursor: null },
          });
        if (path === "/v1/agent-networks/default/contact-admission")
          return Response.json(
            { success: false, error: "private upstream response" },
            { status },
          );
        throw new Error("Unexpected fixture route");
      },
    );
    const api = new PrimitiveApiClient({
      apiKey: "fixture",
      apiBaseUrl: "https://example.test/v1",
      fetch: requests,
    });
    const policy = apiContactPolicy(api.client, recipient);
    const signal = new AbortController().signal;
    await expect(
      policy.admit(
        sender,
        receivedAt,
        signal,
        "11111111-1111-4111-8111-111111111111",
      ),
    ).rejects.toThrow("could not be read");
    await expect(
      policy.admitResponse(
        sender,
        receivedAt,
        signal,
        "11111111-1111-4111-8111-111111111111",
      ),
    ).rejects.toThrow("could not be read");
  });
});
