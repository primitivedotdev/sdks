import { describe, expect, it, vi } from "vitest";
import {
  getAgentContactPolicy,
  getContactPolicy,
  PrimitiveClient,
  putAgentContactPolicy,
  putContactPolicy,
} from "../../src/api/index.js";
import { openapiDocument } from "../../src/openapi/index.js";

const agent = "worker+research@example.com";
const version = "11111111-1111-4111-8111-111111111111";
const key = ["fixture", "credential"].join("-");

describe("contact approval policy API", () => {
  it("documents ASCII selectors while retaining outer trim whitespace", () => {
    const components = openapiDocument.components as {
      schemas: Record<
        "ContactPolicyRule" | "ContactPolicyRuleInput",
        { properties: { pattern: { pattern: string } } }
      >;
    };
    for (const name of [
      "ContactPolicyRule",
      "ContactPolicyRuleInput",
    ] as const) {
      const rule = new RegExp(
        components.schemas[name].properties.pattern.pattern,
      );
      expect(rule.test("*@example.com")).toBe(true);
      expect(rule.test("\u00a0*@example.com\u00a0")).toBe(true);
      for (const pattern of [
        "K@example.com",
        "*@K.example",
        "a\u00a0b@example.com",
      ])
        expect(rule.test(pattern)).toBe(false);
    }
  });
  it("preserves organization versus exact-agent scope and conditional replacement", async () => {
    const requests: { method: string; path: string; body: unknown }[] = [];
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const request = input as Request;
      expect(request.headers.get("authorization")).toBe(`Bearer ${key}`);
      const text = await request.text();
      requests.push({
        method: request.method,
        path: new URL(request.url).pathname,
        body: text ? JSON.parse(text) : null,
      });
      return Response.json({
        success: true,
        data: { rules: [], version: null },
      });
    });
    const client = new PrimitiveClient({ apiKey: key, fetch: fetcher }).client;
    const defaults = {
      if_absent: true as const,
      rules: [{ pattern: "*@example.com", effect: "allow" as const }],
      allow_contact_requests: false,
    };
    const override = {
      if_version: version,
      rules: [
        { pattern: "research-*@example.com", effect: "silence" as const },
      ],
      allow_contact_requests: null,
    };
    await getContactPolicy({ client });
    await putContactPolicy({ client, body: defaults });
    await getAgentContactPolicy({ client, path: { agent_address: agent } });
    await putAgentContactPolicy({
      client,
      path: { agent_address: agent },
      body: override,
    });
    expect(requests).toEqual([
      { method: "GET", path: "/v1/contact-policy", body: null },
      { method: "PUT", path: "/v1/contact-policy", body: defaults },
      {
        method: "GET",
        path: `/v1/agent-contact-policy/${encodeURIComponent(agent)}`,
        body: null,
      },
      {
        method: "PUT",
        path: `/v1/agent-contact-policy/${encodeURIComponent(agent)}`,
        body: override,
      },
    ]);
  });

  it.each([
    403, 409,
  ])("does not retry or broaden a refused policy write (%s)", async (status) => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      Response.json(
        {
          success: false,
          error: {
            code: status === 409 ? "contact_policy_conflict" : "forbidden",
            message: "Refused",
          },
        },
        { status },
      ),
    );
    const client = new PrimitiveClient({ apiKey: key, fetch: fetcher }).client;
    const result = await putAgentContactPolicy({
      client,
      path: { agent_address: agent },
      body: { if_version: version, rules: [], allow_contact_requests: true },
    });
    expect(result.response?.status).toBe(status);
    expect(result.error).toBeDefined();
    expect(fetcher).toHaveBeenCalledOnce();
  });
});
