import { describe, expect, it, vi } from "vitest";
import {
  type AgentAccountResult,
  type AgentClaimResult,
  PrimitiveClient,
} from "../../src/index.js";

const BASE = "https://api.example.test/v1";

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify({ success: true, data }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const LIMITS = {
  storage_mb: 1024,
  send_per_hour: 10,
  send_per_day: 50,
  api_per_minute: 60,
  webhooks_max_global: 1,
  webhooks_per_domain: false,
  filters_per_domain: false,
  spam_thresholds_per_domain: false,
};

const ACCOUNT: AgentAccountResult = {
  api_key: "prim_agentkey",
  org_id: "00000000-0000-0000-0000-0000000000aa",
  address: "brave-crow.primitive.email",
  plan: "agent",
  limits: LIMITS,
  upgrade: {
    plan: "developer",
    description: "Confirm an email to lift the send cap.",
    claim_path: "/v1/agent/claim/start",
  },
};

describe("client.agent", () => {
  it("createAccount posts to /agent/accounts unauthenticated and returns the account", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const request = input as Request;
      expect(request.url).toBe(`${BASE}/agent/accounts`);
      expect(request.method).toBe("POST");
      // Unauthenticated endpoint: no API key configured, so no auth header.
      expect(request.headers.get("authorization")).toBeNull();
      expect(await request.json()).toEqual({
        terms_accepted: true,
        device_name: "test-agent",
      });
      return jsonResponse(ACCOUNT);
    }) as typeof fetch;

    const client = new PrimitiveClient({ apiBaseUrl: BASE, fetch: fetchMock });
    await expect(
      client.agent.createAccount({
        terms_accepted: true,
        device_name: "test-agent",
      }),
    ).resolves.toEqual(ACCOUNT);
  });

  it("claimStart posts to /agent/claim/start with the agent key", async () => {
    const startData = {
      claim_session_id: "sess-1",
      resend_after_seconds: 60,
      expires_in_seconds: 1800,
    };
    const client = new PrimitiveClient({
      apiKey: "prim_agentkey",
      apiBaseUrl: BASE,
      fetch: vi.fn<typeof fetch>(async (input) => {
        const request = input as Request;
        expect(request.url).toBe(`${BASE}/agent/claim/start`);
        expect(request.headers.get("authorization")).toBe(
          "Bearer prim_agentkey",
        );
        expect(await request.json()).toEqual({ email: "human@example.com" });
        return jsonResponse(startData);
      }) as typeof fetch,
    });
    await expect(
      client.agent.claimStart({ email: "human@example.com" }),
    ).resolves.toEqual(startData);
  });

  it("claimVerify upgrades the account to developer", async () => {
    const result: AgentClaimResult = {
      org_id: "00000000-0000-0000-0000-0000000000aa",
      plan: "developer",
      email: "human@example.com",
      limits: LIMITS,
    };
    const client = new PrimitiveClient({
      apiKey: "prim_agentkey",
      apiBaseUrl: BASE,
      fetch: vi.fn<typeof fetch>(async (input) => {
        const request = input as Request;
        expect(request.url).toBe(`${BASE}/agent/claim/verify`);
        expect(await request.json()).toEqual({ verification_code: "123456" });
        return jsonResponse(result);
      }) as typeof fetch,
    });
    await expect(
      client.agent.claimVerify({ verification_code: "123456" }),
    ).resolves.toEqual(result);
  });

  it("claimLink posts an empty body by default", async () => {
    const linkData = {
      claim_token: "tok",
      claim_url: "https://www.primitive.dev/claim?token=tok",
      expires_in_seconds: 604800,
    };
    const client = new PrimitiveClient({
      apiKey: "prim_agentkey",
      apiBaseUrl: BASE,
      fetch: vi.fn<typeof fetch>(async (input) => {
        const request = input as Request;
        expect(request.url).toBe(`${BASE}/agent/claim/link`);
        expect(await request.json()).toEqual({});
        return jsonResponse(linkData);
      }) as typeof fetch,
    });
    await expect(client.agent.claimLink()).resolves.toEqual(linkData);
  });

  it("maps an error envelope to a PrimitiveApiError with code and status", async () => {
    const client = new PrimitiveClient({
      apiKey: "prim_agentkey",
      apiBaseUrl: BASE,
      fetch: vi.fn<typeof fetch>(
        async () =>
          new Response(
            JSON.stringify({
              success: false,
              error: {
                code: "email_in_use",
                message: "Email already in use",
                request_id: "req-1",
              },
            }),
            { status: 409, headers: { "content-type": "application/json" } },
          ),
      ) as typeof fetch,
    });
    await expect(
      client.agent.claimStart({ email: "taken@example.com" }),
    ).rejects.toMatchObject({
      name: "PrimitiveApiError",
      status: 409,
      code: "email_in_use",
    });
  });
});
