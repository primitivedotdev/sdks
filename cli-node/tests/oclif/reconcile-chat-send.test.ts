import { PrimitiveApiClient } from "@primitivedotdev/api-core";
import { describe, expect, it } from "vitest";
import { reconcileChatSend } from "../../src/oclif/reconcile-chat-send.js";

const target = {
  idempotencyKey: "intent-fixture",
  from: "owner@sender.example",
  recipient: "peer@agent.example",
};
function fixture() {
  const record = {
    id: "sent-1",
    status: "queued",
    client_idempotency_key: target.idempotencyKey,
    from_address: target.from,
    to_address: target.recipient,
  };
  const state: { page: unknown; status: number; requests: URL[] } = {
    page: { data: [record], meta: { cursor: null } },
    status: 200,
    requests: [],
  };
  const apiClient = new PrimitiveApiClient({
    apiKey: ["pconn", "fixture"].join("_"),
    apiBaseUrl: "https://example.test/v1",
    fetch: async (input, init) => {
      const request = new Request(input, init),
        url = new URL(request.url);
      state.requests.push(url);
      expect(request.method).toBe("GET");
      expect(url.pathname).toBe("/v1/sent-emails");
      return Response.json(state.page, { status: state.status });
    },
  });
  return { apiClient, state, record };
}
describe("uncertain chat send reconciliation", () => {
  it("looks up only the saved idempotency key without resending", async () => {
    const { apiClient, state, record } = fixture();
    expect(await reconcileChatSend({ apiClient, ...target })).toEqual(record);
    expect(state.requests).toHaveLength(1);
    expect(state.requests[0].searchParams.get("idempotency_key")).toBe(
      target.idempotencyKey,
    );
  });
  it("leaves an empty lookup unknown and refuses ambiguous or conflicting results", async () => {
    const { apiClient, state, record } = fixture();
    state.page = { data: [], meta: { cursor: null } };
    expect(await reconcileChatSend({ apiClient, ...target })).toBeNull();
    for (const page of [
      { data: [record, { ...record, id: "sent-2" }], meta: { cursor: null } },
      { data: [record], meta: { cursor: "next" } },
      { data: [record] },
      {
        data: [{ ...record, client_idempotency_key: "another-key" }],
        meta: { cursor: null },
      },
      {
        data: [{ ...record, from_address: "other@sender.example" }],
        meta: { cursor: null },
      },
      {
        data: [{ ...record, to_address: "other@agent.example" }],
        meta: { cursor: null },
      },
    ]) {
      state.page = page;
      await expect(
        reconcileChatSend({ apiClient, ...target }),
      ).rejects.toThrow();
    }
  });
});
