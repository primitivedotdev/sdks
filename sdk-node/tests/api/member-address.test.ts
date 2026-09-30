import type { ListAgentConnectionsData } from "@primitivedotdev/api-core";
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import {
  createAgentConnection,
  inviteAgentConnection,
  listAgentConnections,
  PrimitiveClient,
  provisionMemberAddress,
  whoami,
} from "../../src/api/index.js";

const address = "person_123456789@example.test";
const credential = ["fixture", "credential"].join("-");

describe("personal address choice", () => {
  it("keeps the owner query limited to self in the public contract and typed client", async () => {
    expectTypeOf<
      NonNullable<ListAgentConnectionsData["query"]>["owner"]
    >().toEqualTypeOf<"self" | undefined>();
    const { openapiDocument } = await import("../../src/openapi/index.js");
    const owner = openapiDocument.paths[
      "/agent-connections"
    ].get.parameters.find(
      (parameter) => "name" in parameter && parameter.name === "owner",
    );
    expect(owner).toMatchObject({ schema: { type: "string", enum: ["self"] } });
  });
  it("requires explicit history confirmation and does not retry or choose another address", async () => {
    const bodies: unknown[] = [];
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const request = input as Request;
      expect(request.method).toBe("PUT");
      expect(new URL(request.url).pathname).toBe("/v1/account/member-address");
      bodies.push(await request.json());
      return bodies.length === 1
        ? Response.json(
            {
              success: false,
              error: {
                code: "member_address_history_confirmation_required",
                message: "Confirm existing mail",
              },
            },
            { status: 409 },
          )
        : Response.json({ success: true, data: { address, name: null } });
    });
    const client = new PrimitiveClient({ apiKey: credential, fetch: fetcher })
      .client;
    const first = await provisionMemberAddress({ client, body: { address } });
    expect(first.response?.status).toBe(409);
    expect(first.error?.error.code).toBe(
      "member_address_history_confirmation_required",
    );
    expect(fetcher).toHaveBeenCalledOnce();
    const confirmed = await provisionMemberAddress({
      client,
      body: { address, confirm_existing_mail: true },
    });
    expect(confirmed.data?.data.address).toBe(address);
    expect(bodies).toEqual([
      { address },
      { address, confirm_existing_mail: true },
    ]);
  });
  it("reads the suggestion without allocating and scopes ownership before paging", async () => {
    const calls: string[] = [];
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const request = input as Request;
      const url = new URL(request.url);
      expect(request.method).toBe("GET");
      calls.push(url.pathname + url.search);
      return url.pathname.endsWith("whoami")
        ? Response.json({
            success: true,
            data: {
              member_address: null,
              member_address_suggestion: address,
              org_id: "11111111-1111-4111-8111-111111111111",
              user_id: "member",
              role: "member",
              request_id: "request",
              auth_method: "oauth",
              key_id: null,
            },
          })
        : Response.json({ success: true, data: [], meta: { cursor: null } });
    });
    const client = new PrimitiveClient({ apiKey: credential, fetch: fetcher })
      .client;
    const identity = await whoami({ client });
    expect(identity.data?.data.member_address).toBe(null);
    expect(identity.data?.data.member_address_suggestion).toBe(address);
    await listAgentConnections({ client, query: { owner: "self", limit: 50 } });
    expect(calls).toEqual([
      "/v1/whoami",
      "/v1/agent-connections?owner=self&limit=50",
    ]);
  });
  it("types recovery and pending-only setup without replaying invitation secrets", async () => {
    const bodies: unknown[] = [];
    const requestId = "11111111-1111-4111-8111-111111111111";
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const request = input as Request;
      bodies.push(await request.json());
      expect(request.headers.get("Idempotency-Key")).toBeNull();
      return bodies.length === 1
        ? Response.json({
            success: true,
            data: {
              connection: { address, name: "Research", status: "claimed" },
              recovered: true,
              invitation: null,
            },
          })
        : Response.json(
            {
              success: false,
              error: { code: "connection_already_claimed", message: "Claimed" },
            },
            { status: 409 },
          );
    });
    const client = new PrimitiveClient({ apiKey: credential, fetch: fetcher })
      .client;
    const recovered = await createAgentConnection({
      client,
      body: { name: "Research", create_request_id: requestId },
    });
    if (!recovered.data || !("recovered" in recovered.data.data))
      throw new Error("Expected typed recovery response");
    expect(recovered.data.data.recovered).toBe(true);
    expect(recovered.data.data.invitation).toBeNull();
    const refused = await inviteAgentConnection({
      client,
      path: { address },
      body: { pending_only: true },
    });
    expect(refused.response?.status).toBe(409);
    expect(bodies).toEqual([
      { name: "Research", create_request_id: requestId },
      { pending_only: true },
    ]);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
