import { describe, expect, it, vi } from "vitest";
import {
  type Account,
  createAgent,
  type InboundEmail,
  PrimitiveClient,
} from "../../src/index.js";

const BASE = "https://api.example.test/v1";

function listResponse(
  data: unknown[],
  cursor: string | null,
  status = 200,
): Response {
  return new Response(
    JSON.stringify({
      success: true,
      data,
      meta: { cursor, total: data.length },
    }),
    { status, headers: { "content-type": "application/json" } },
  );
}

function dataResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify({ success: true, data }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const SUMMARY = {
  id: "11111111-1111-4111-8111-111111111111",
  message_id: "<m@example.com>",
  status: "completed",
  sender: "alice@example.com",
  recipient: "agent@brave-crow.primitive.email",
  subject: "Hi",
  domain: "brave-crow.primitive.email",
  spam_score: 0.1,
  created_at: "2026-05-01T00:00:00.000000Z",
  received_at: "2026-05-01T00:00:00.000Z",
  webhook_attempt_count: 0,
  thread_id: null,
};

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

describe("client.inbox", () => {
  it("waitForNext long-polls the forward tail and maps the email", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = new URL((input as Request).url);
      expect(url.pathname).toBe("/v1/emails");
      expect(url.searchParams.get("since")).toBe("cursor-0|id0");
      expect(url.searchParams.get("wait")).toBe("30");
      expect(url.searchParams.get("limit")).toBe("1");
      return listResponse(
        [SUMMARY],
        "2026-05-01T00:00:00.000000Z|11111111-1111-4111-8111-111111111111",
      );
    }) as typeof fetch;
    const client = new PrimitiveClient({
      apiKey: "prim_k",
      apiBaseUrl: BASE,
      fetch: fetchMock,
    });

    const email = await client.inbox.waitForNext({ since: "cursor-0|id0" });
    expect(email?.from).toBe("alice@example.com");
    expect(email?.subject).toBe("Hi");
    expect(email?.cursor).toBe(
      "2026-05-01T00:00:00.000000Z|11111111-1111-4111-8111-111111111111",
    );
  });

  it("waitForNext returns null when the wait window yields no mail", async () => {
    const client = new PrimitiveClient({
      apiKey: "prim_k",
      apiBaseUrl: BASE,
      fetch: vi.fn<typeof fetch>(async () =>
        listResponse([], null),
      ) as typeof fetch,
    });
    await expect(
      client.inbox.waitForNext({ since: "c|i" }),
    ).resolves.toBeNull();
  });

  it("stream yields emails with advancing cursors and a bound reply()", async () => {
    let replyUrl = "";
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const req = input as Request;
      const url = new URL(req.url);
      if (req.method === "POST" && url.pathname.endsWith("/reply")) {
        replyUrl = url.pathname;
        expect(await req.json()).toEqual({ body_text: "ack" });
        return dataResponse({
          id: "send-1",
          status: "queued",
          queue_id: null,
          accepted: ["alice@example.com"],
          rejected: [],
          client_idempotency_key: "k",
          request_id: "r",
          content_hash: "h",
          idempotent_replay: false,
        });
      }
      return listResponse([SUMMARY], "cur-1|id1");
    }) as typeof fetch;
    const client = new PrimitiveClient({
      apiKey: "prim_k",
      apiBaseUrl: BASE,
      fetch: fetchMock,
    });

    const controller = new AbortController();
    const got: InboundEmail[] = [];
    for await (const email of client.inbox.stream({
      signal: controller.signal,
    })) {
      got.push(email);
      await email.reply("ack");
      controller.abort();
      break;
    }
    expect(got).toHaveLength(1);
    expect(got[0].cursor).toBe("cur-1|id1");
    expect(replyUrl).toBe(`/v1/emails/${SUMMARY.id}/reply`);
  });

  it("stream throws if the API returns emails without a continuation cursor", async () => {
    const client = new PrimitiveClient({
      apiKey: "prim_k",
      apiBaseUrl: BASE,
      fetch: vi.fn<typeof fetch>(async () =>
        listResponse([SUMMARY], null),
      ) as typeof fetch,
    });
    // A null cursor with rows would re-fetch the same email forever; guard it.
    await expect(client.inbox.stream().next()).rejects.toThrow(
      /without a continuation cursor/,
    );
  });

  it("waitForNext throws if an email arrives without a continuation cursor", async () => {
    const client = new PrimitiveClient({
      apiKey: "prim_k",
      apiBaseUrl: BASE,
      fetch: vi.fn<typeof fetch>(async () =>
        listResponse([SUMMARY], null),
      ) as typeof fetch,
    });
    await expect(client.inbox.waitForNext({ since: "c|i" })).rejects.toThrow(
      /without a continuation cursor/,
    );
  });
});

describe("client.account", () => {
  it("get() returns plan, entitlements, limits, and managed inbox", async () => {
    // Partial mock of the full Account shape; only the fields under assertion.
    const account = {
      id: "00000000-0000-0000-0000-0000000000aa",
      email: null,
      plan: "agent",
      limits: LIMITS,
      entitlements: ["send_mail", "send_to_known_addresses"],
      managed_inbox_address: "brave-crow.primitive.email",
      created_at: "2026-05-01T00:00:00.000Z",
      discard_content_on_webhook_confirmed: false,
    } as unknown as Account;
    const client = new PrimitiveClient({
      apiKey: "prim_k",
      apiBaseUrl: BASE,
      fetch: vi.fn<typeof fetch>(async (input) => {
        expect(new URL((input as Request).url).pathname).toBe("/v1/account");
        return dataResponse(account);
      }) as typeof fetch,
    });
    const got = await client.account.get();
    expect(got.plan).toBe("agent");
    expect(got.entitlements).toEqual(["send_mail", "send_to_known_addresses"]);
    expect(got.managed_inbox_address).toBe("brave-crow.primitive.email");
  });
});

describe("createAgent", () => {
  it("creates an emailless account unauthenticated and returns an authed client", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const req = input as Request;
      const url = new URL(req.url);
      if (url.pathname === "/v1/agent/accounts") {
        // Account creation must be unauthenticated.
        expect(req.headers.get("authorization")).toBeNull();
        return dataResponse({
          api_key: "prim_newagentkey",
          org_id: "00000000-0000-0000-0000-0000000000bb",
          address: "noble-hawk.primitive.email",
          plan: "agent",
          limits: LIMITS,
          upgrade: {
            plan: "developer",
            description: "d",
            claim_path: "/v1/agent/claim/start",
          },
        });
      }
      // A follow-up call must carry the new agent's key.
      expect(req.headers.get("authorization")).toBe("Bearer prim_newagentkey");
      return dataResponse({
        id: "x",
        email: null,
        plan: "agent",
        limits: LIMITS,
        entitlements: ["send_mail", "send_to_known_addresses"],
        managed_inbox_address: "noble-hawk.primitive.email",
        created_at: "2026-05-01T00:00:00.000Z",
        discard_content_on_webhook_confirmed: false,
      });
    }) as typeof fetch;

    const { client, address, account } = await createAgent({
      terms_accepted: true,
      device_name: "test",
      client: { apiBaseUrl: BASE, fetch: fetchMock },
    });
    expect(address).toBe("noble-hawk.primitive.email");
    expect(account.api_key).toBe("prim_newagentkey");
    // The returned client is authed with the new key.
    const acct = await client.account.get();
    expect(acct.managed_inbox_address).toBe("noble-hawk.primitive.email");
  });
});
