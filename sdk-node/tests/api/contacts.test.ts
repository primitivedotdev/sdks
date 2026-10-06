import { describe, expect, it, vi } from "vitest";
import {
  claimAgentConnection,
  deleteAgentContact,
  deleteContact,
  getContact,
  listAgentContacts,
  listContacts,
  PrimitiveClient,
  putAgentContact,
  putContact,
} from "../../src/api/index.js";
import { openapiDocument } from "../../src/openapi/index.js";

const address = "peer+research@example.com";
const agent = "worker+one@example.com";
const version = "11111111-1111-4111-8111-111111111111";
const key = ["fixture", "credential"].join("-");

describe("public contact operations", () => {
  it.each(["/contacts", "/agent-contacts/{agent_address}"] as const)(
    "requires explicit terminal pagination metadata for %s",
    (path) => {
      expect(openapiDocument).toMatchObject({
        paths: {
          [path]: {
            get: {
              responses: {
                "200": {
                  content: {
                    "application/json": {
                      schema: {
                        allOf: [
                          { required: expect.arrayContaining(["meta"]) },
                          {
                            properties: {
                              meta: {
                                required: expect.arrayContaining(["cursor"]),
                                properties: {
                                  cursor: { type: ["string", "null"] },
                                },
                              },
                            },
                          },
                        ],
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });
    },
  );

  it("preserves exact address paths, pagination and conditional writes", async () => {
    const requests: {
      method: string;
      path: string;
      query: string;
      body: unknown;
    }[] = [];
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const request = input as Request;
      const url = new URL(request.url);
      const body = await request.text();
      expect(request.headers.get("authorization")).toBe(`Bearer ${key}`);
      requests.push({
        method: request.method,
        path: url.pathname,
        query: url.search,
        body: body ? JSON.parse(body) : null,
      });
      return Response.json({
        success: true,
        data: [],
        meta: { count: 0, cursor: null },
      });
    });
    const client = new PrimitiveClient({ apiKey: key, fetch: fetcher }).client;
    await listContacts({ client, query: { limit: 10, cursor: address } });
    await getContact({ client, path: { address } });
    await putContact({
      client,
      path: { address },
      body: { if_absent: true, display_name: "Research" },
    });
    await deleteContact({
      client,
      path: { address },
      query: { if_version: version },
    });
    await listAgentContacts({
      client,
      path: { agent_address: agent },
      query: { limit: 5, cursor: address },
    });
    await putAgentContact({
      client,
      path: { agent_address: agent, contact_address: address },
      body: { if_version: version, notify: true, purpose: "Research" },
    });
    await deleteAgentContact({
      client,
      path: { agent_address: agent, contact_address: address },
      query: { if_version: version },
    });
    expect(requests.map((r) => r.method)).toEqual([
      "GET",
      "GET",
      "PUT",
      "DELETE",
      "GET",
      "PUT",
      "DELETE",
    ]);
    expect(requests.map((r) => r.path)).toEqual([
      "/v1/contacts",
      `/v1/contacts/${encodeURIComponent(address)}`,
      `/v1/contacts/${encodeURIComponent(address)}`,
      `/v1/contacts/${encodeURIComponent(address)}`,
      `/v1/agent-contacts/${encodeURIComponent(agent)}`,
      `/v1/agent-contacts/${encodeURIComponent(agent)}/${encodeURIComponent(address)}`,
      `/v1/agent-contacts/${encodeURIComponent(agent)}/${encodeURIComponent(address)}`,
    ]);
    expect(new URLSearchParams(requests[0].query).get("cursor")).toBe(address);
    expect(new URLSearchParams(requests[4].query).get("cursor")).toBe(address);
    expect(new URLSearchParams(requests[3].query).get("if_version")).toBe(
      version,
    );
    expect(requests[2].body).toEqual({
      if_absent: true,
      display_name: "Research",
    });
    expect(requests[5].body).toEqual({
      if_version: version,
      notify: true,
      purpose: "Research",
    });
  });

  it("returns a stale contact conflict without retrying or changing the write", async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      Response.json(
        {
          success: false,
          error: { code: "contact_conflict", message: "Changed" },
        },
        { status: 409 },
      ),
    );
    const client = new PrimitiveClient({ apiKey: key, fetch: fetcher }).client;
    const result = await putAgentContact({
      client,
      path: { agent_address: agent, contact_address: address },
      body: { if_version: version, notify: false },
    });
    expect(result.response?.status).toBe(409);
    expect(result.error?.error.code).toBe("contact_conflict");
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("claims an invitation once through the public unauthenticated operation", async () => {
    const token = ["inert", "invitation", "x".repeat(32)].join("_");
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const request = input as Request;
      expect(request.method).toBe("POST");
      expect(new URL(request.url).pathname).toBe("/v1/agent-connections/claim");
      expect(await request.json()).toEqual({ token });
      return Response.json(
        {
          success: false,
          error: { code: "unavailable", message: "Unavailable" },
        },
        { status: 503 },
      );
    });
    const client = new PrimitiveClient({ fetch: fetcher }).client;
    const result = await claimAgentConnection({ client, body: { token } });
    expect(result.response?.status).toBe(503);
    expect(fetcher).toHaveBeenCalledOnce();
  });
});
