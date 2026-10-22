import { PrimitiveApiClient } from "@primitivedotdev/api-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sleep: vi.fn() }));
vi.mock("../../src/oclif/commands/emails-poll.js", async (original) => ({
  ...(await original<
    typeof import("../../src/oclif/commands/emails-poll.js")
  >()),
  sleep: mocks.sleep,
}));

import { waitForReply } from "../../src/oclif/commands/chat.js";

const sentId = "11111111-1111-4111-8111-111111111111";
const replyId = "22222222-2222-4222-8222-222222222222";
const owner = "agent@sender.example";
const peer = "help@agent.example";

type Handler = (url: URL) => Response | undefined;

function row() {
  return {
    id: replyId,
    status: "accepted",
    received_at: "2026-09-27T00:00:01.000Z",
    created_at: "2026-09-27T00:00:01.000Z",
    sender: peer,
    recipient: owner,
    subject: "Re: hello",
  };
}

function detail() {
  return { ...row(), from_email: peer, reply_to_sent_email_id: null };
}

function setup(handler: Handler) {
  const searches: Array<{ at: number; strict: boolean }> = [];
  const apiClient = new PrimitiveApiClient({
    apiKey: ["prim", "fixture"].join("_"),
    apiBaseUrl: "https://example.test/v1",
    fetch: async (input, init) => {
      const url = new URL(new Request(input, init).url);
      if (url.pathname === "/v1/emails/search")
        searches.push({
          at: Date.now(),
          strict: url.searchParams.has("reply_to_sent_email_id"),
        });
      const special = handler(url);
      if (special) return special;
      if (url.pathname === "/v1/emails/search")
        return Response.json({
          data: url.searchParams.has("cursor") ? [] : [row()],
          meta: { cursor: null },
        });
      if (url.pathname === `/v1/emails/${replyId}`)
        return Response.json({ data: detail() });
      throw new Error(`Unexpected request ${url.pathname}`);
    },
  });
  return { apiClient, searches };
}

function params(apiClient: PrimitiveApiClient, notices: string[]) {
  return {
    apiClient,
    authFailureContext: {
      auth: { apiKey: "prim_fixture" } as never,
      baseUrlOverridden: false,
      configDir: "/nonexistent",
    },
    from: owner,
    interval: 1,
    notice: (message: string) => notices.push(message),
    pageSize: 10,
    recipient: peer,
    sentAtIso: "2026-09-27T00:00:00.000Z",
    sentId,
    strictOnly: false,
    strictPhaseSeconds: 10,
    timeoutSeconds: 120,
  };
}

const start = Date.parse("2026-09-27T00:00:00Z");

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(start);
  mocks.sleep.mockImplementation(async (ms: number) => {
    vi.setSystemTime(Date.now() + ms);
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("chat reply wait with transient API failures", () => {
  it("does not start the fallback search before a strict-phase Retry-After allows it", async () => {
    const { apiClient, searches } = setup((url) =>
      url.searchParams.has("reply_to_sent_email_id")
        ? Response.json(
            { error: { code: "rate_limit_exceeded", message: "slow" } },
            { status: 429, headers: { "Retry-After": "30" } },
          )
        : undefined,
    );
    const notices: string[] = [];
    const result = await waitForReply(params(apiClient, notices));
    expect(result?.matchStrategy).toBe("fallback");
    expect(result?.reply.id).toBe(replyId);
    expect(notices[0]).toContain("rate limited (retry after 30 s)");
    const fallback = searches.find((search) => !search.strict);
    expect(fallback?.at).toBeGreaterThanOrEqual(start + 30_000);
  });

  it("moves on to the fallback phase when a strict candidate's read stays unavailable", async () => {
    const { apiClient, searches } = setup((url) =>
      url.pathname === `/v1/emails/${replyId}` && Date.now() < start + 10_000
        ? Response.json(
            { error: { code: "service_unavailable", message: "later" } },
            { status: 503 },
          )
        : undefined,
    );
    const notices: string[] = [];
    const result = await waitForReply(params(apiClient, notices));
    expect(result?.matchStrategy).toBe("fallback");
    expect(searches.some((search) => !search.strict)).toBe(true);
    expect(notices.some((n) => n.includes("API unavailable (HTTP 503)"))).toBe(
      true,
    );
  });

  it("does not reread a candidate in fallback before its Retry-After allows it", async () => {
    const reads: number[] = [];
    const { apiClient } = setup((url) => {
      if (url.pathname !== `/v1/emails/${replyId}`) return undefined;
      reads.push(Date.now());
      return Date.now() < start + 10_000
        ? Response.json(
            { error: { code: "rate_limit_exceeded", message: "slow" } },
            { status: 429, headers: { "Retry-After": "60" } },
          )
        : undefined;
    });
    const result = await waitForReply(params(apiClient, []));
    expect(result?.matchStrategy).toBe("fallback");
    expect(reads).toHaveLength(2);
    expect(reads[1]).toBeGreaterThanOrEqual(start + 60_000);
  });
});
