import {
  type EmailDetail,
  PrimitiveApiClient,
} from "@primitivedotdev/api-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  inspectTargetedReply,
  readTargetedReplyPage,
} from "../../src/oclif/targeted-replies.js";

const target = {
  sentId: "11111111-1111-4111-8111-111111111111",
  from: "owner@sender.example",
  recipient: "peer@agent.example",
};
function fixture() {
  const requests: URL[] = [];
  const detail = {
    id: "reply-1",
    sender: target.recipient,
    from_email: target.recipient,
    sender_connected_agent_verified: false,
    from_header: `Peer <${target.recipient}>`,
    recipient: target.from,
    to_email: target.from,
    domain: "sender.example",
    status: "accepted",
    created_at: "2026-01-01T00:00:00Z",
    received_at: "2026-02-01T00:00:00Z",
    reply_to_sent_email_id: target.sentId,
    replies: [],
    webhook_attempt_count: 0,
    body_text: "Answer",
    body_html: null,
    parsed: { status: "complete", attachments: [] },
    auth: {
      spf: "pass",
      dmarc: "pass",
      dmarcFromDomain: "agent.example",
      dmarcSpfAligned: true,
      dmarcDkimAligned: true,
      dkimSignatures: [],
      dmarcPolicy: null,
      dmarcSpfStrict: null,
      dmarcDkimStrict: null,
    },
  } satisfies EmailDetail;
  const state: {
    detail: EmailDetail;
    page: unknown;
    status: number;
    retryAfter?: string;
    transportError?: boolean;
    requests: URL[];
  } = {
    detail,
    page: { data: [{ id: detail.id }], meta: { cursor: null } },
    status: 200,
    requests,
  };
  const apiClient = new PrimitiveApiClient({
    apiKey: ["pconn", "fixture"].join("_"),
    apiBaseUrl: "https://example.test/v1",
    fetch: async (input, init) => {
      const request = new Request(input, init),
        url = new URL(request.url);
      requests.push(url);
      expect(request.method).toBe("GET");
      if (url.pathname === "/v1/emails/search") {
        if (state.transportError) throw new Error("Private transport content");
        return Response.json(state.page, {
          status: state.status,
          headers:
            state.retryAfter === undefined
              ? {}
              : { "Retry-After": state.retryAfter },
        });
      }
      if (url.pathname === "/v1/emails/reply-1")
        return Response.json({ data: state.detail });
      throw new Error(`Unexpected request ${url.pathname}`);
    },
  });
  return { state, apiClient };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("targeted reply recovery", () => {
  it.each([
    "verified",
    "pending",
  ])("never completes a chat wait for %s presence controls even with matching reply metadata", async (status) => {
    const { state, apiClient } = fixture();
    Object.assign(state.detail, {
      presence_control: { status, valid_for_ms: 0 },
    });
    const result = await inspectTargetedReply({
      apiClient,
      ...target,
      id: "reply-1",
    });
    expect(result?.kind).toBe(status === "verified" ? "unrelated" : "pending");
    expect(state.requests).toHaveLength(1);
  });
  it("queries the exact parent and peer without reading inbox history", async () => {
    const { state, apiClient } = fixture();
    const page = await readTargetedReplyPage({
      apiClient,
      ...target,
      pageSize: 10,
      since: "2026-02-01T00:00:00Z",
    });
    expect(page).toEqual({ ids: ["reply-1"], cursor: null });
    expect(state.requests).toHaveLength(1);
    const query = state.requests[0].searchParams;
    expect(query.get("reply_to_sent_email_id")).toBe(target.sentId);
    expect(query.get("from")).toBe(target.recipient);
    expect(query.get("to")).toBe(target.from);
    expect(query.get("date_from")).toBe("2026-02-01T00:00:00Z");
    expect(query.get("sort")).toBe("received_at_asc");
    const inspected = await inspectTargetedReply({
      apiClient,
      ...target,
      id: "reply-1",
      since: "2026-02-01T00:00:00Z",
    });
    expect(inspected?.kind).toBe("reply");
  });
  it("returns pagination to the recovery owner and rejects repeated or malformed cursors", async () => {
    const { state, apiClient } = fixture();
    state.page = {
      data: [{ id: "reply-1" }, { id: "reply-1" }],
      meta: { cursor: "next" },
    };
    expect(
      await readTargetedReplyPage({ apiClient, ...target, pageSize: 1 }),
    ).toEqual({ ids: ["reply-1"], cursor: "next" });
    await expect(
      readTargetedReplyPage({
        apiClient,
        ...target,
        pageSize: 1,
        cursor: "next",
      }),
    ).rejects.toThrow("repeated cursor");
    state.page = { data: [{ id: "reply-1" }] };
    await expect(
      readTargetedReplyPage({ apiClient, ...target, pageSize: 1 }),
    ).rejects.toThrow("invalid page");
  });
  it.each([
    [429, "rate limited (HTTP 429)"],
    [500, "temporarily unavailable (HTTP 500)"],
    [503, "temporarily unavailable (HTTP 503)"],
    [401, "access was denied (HTTP 401)"],
    [403, "access was denied (HTTP 403)"],
    [404, "unavailable on this API endpoint (HTTP 404)"],
    [405, "unavailable on this API endpoint (HTTP 405)"],
    [400, "failed (HTTP 400)"],
  ])("reports HTTP %s accurately without bodies, retries, or inbox scans", async (status, message) => {
    const { state, apiClient } = fixture();
    state.page = { error: { message: "Private server content" } };
    state.status = status;
    const error = await readTargetedReplyPage({
      apiClient,
      ...target,
      pageSize: 10,
    }).catch((error: unknown) => error);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain(message);
    expect((error as Error).message).not.toMatch(
      /Private|requires server support/,
    );
    expect(state.requests.map((url) => url.pathname)).toEqual([
      "/v1/emails/search",
    ]);
  });
  it.each([
    ["32", "Retry after 32 seconds"],
    ["Tue, 29 Sep 2026 00:00:32 GMT", "Retry after 32 seconds"],
    ["private-invalid-header", "after the rate limit resets"],
    ["-32", "after the rate limit resets"],
    ["999999999999999999999", "after the rate limit resets"],
  ])("reports only a valid parsed Retry-After delay: %s", async (header, message) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-29T00:00:00Z"));
    const { state, apiClient } = fixture();
    state.status = 429;
    state.retryAfter = header;
    state.page = { error: { message: "Private server content" } };
    const error = await readTargetedReplyPage({
      apiClient,
      ...target,
      pageSize: 10,
    }).catch((error: unknown) => error);
    expect((error as Error).message).toContain(message);
    expect((error as Error).message).not.toMatch(
      /Private|private-invalid-header|requires server support/,
    );
    expect(state.requests).toHaveLength(1);
  });
  it("reports transport failure without exposing its error or retrying", async () => {
    const { state, apiClient } = fixture();
    state.transportError = true;
    const error = await readTargetedReplyPage({
      apiClient,
      ...target,
      pageSize: 10,
    }).catch((error: unknown) => error);
    expect((error as Error).message).toContain(
      "temporarily unavailable (transport failure)",
    );
    expect((error as Error).message).not.toMatch(
      /Private|requires server support/,
    );
    expect(state.requests).toHaveLength(1);
  });
  it("does not accept substring sender matches or wrong parent/recipient details", async () => {
    const { state, apiClient } = fixture();
    const original = state.detail;
    for (const change of [
      { from_header: `other-${target.recipient}` },
      { reply_to_sent_email_id: "another-send" },
      { recipient: "other@sender.example" },
      { to_email: "other@sender.example" },
      { auth: { ...original.auth, dmarcFromDomain: "other.example" } },
    ]) {
      state.detail = { ...original, ...change };
      expect(
        (await inspectTargetedReply({ apiClient, ...target, id: "reply-1" }))
          ?.kind,
      ).toBe("unrelated");
    }
  });
  it("leaves incomplete parsing/auth retryable and separates progress from replies", async () => {
    const { state, apiClient } = fixture();
    const original = state.detail;
    state.detail = {
      ...original,
      parsed: { ...original.parsed, status: "failed" },
    };
    expect(
      (await inspectTargetedReply({ apiClient, ...target, id: "reply-1" }))
        ?.kind,
    ).toBe("pending");
    state.detail = {
      ...original,
      from_header: null,
      parsed: { ...original.parsed, status: "failed" },
    };
    expect(
      (await inspectTargetedReply({ apiClient, ...target, id: "reply-1" }))
        ?.kind,
    ).toBe("pending");
    state.detail = {
      ...original,
      auth: {
        ...original.auth,
        dmarc: "none",
        dmarcSpfAligned: false,
        dmarcDkimAligned: false,
      },
    };
    expect(
      (await inspectTargetedReply({ apiClient, ...target, id: "reply-1" }))
        ?.kind,
    ).toBe("pending");
    state.detail = {
      ...original,
      parsed: {
        ...original.parsed,
        attachments: [{ filename: "interaction.json", size_bytes: 1 }],
      },
    };
    expect(
      (await inspectTargetedReply({ apiClient, ...target, id: "reply-1" }))
        ?.kind,
    ).toBe("inspection");
    state.detail = original;
    expect(
      (await inspectTargetedReply({ apiClient, ...target, id: "reply-1" }))
        ?.kind,
    ).toBe("reply");
  });
  it("rejects mismatched detail identity and honors an elapsed deadline before requesting", async () => {
    const { state, apiClient } = fixture();
    state.detail.id = "other-id";
    await expect(
      inspectTargetedReply({ apiClient, ...target, id: "reply-1" }),
    ).rejects.toThrow("Could not inspect");
    expect(
      await readTargetedReplyPage({
        apiClient,
        ...target,
        pageSize: 1,
        deadline: Date.now() - 1,
      }),
    ).toBeNull();
    expect(state.requests).toHaveLength(1);
  });
});
