import {
  type EmailDetail,
  PrimitiveApiClient,
} from "@primitivedotdev/api-core";
import { describe, expect, it } from "vitest";
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
      if (url.pathname === "/v1/emails/search")
        return Response.json(state.page, { status: state.status });
      if (url.pathname === "/v1/emails/reply-1")
        return Response.json({ data: state.detail });
      throw new Error(`Unexpected request ${url.pathname}`);
    },
  });
  return { state, apiClient };
}

describe("targeted reply recovery", () => {
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
  it("fails on unsupported scoped search without falling back to inbox scans", async () => {
    const { state, apiClient } = fixture();
    state.page = { error: { code: "forbidden", message: "Not available" } };
    state.status = 403;
    await expect(
      readTargetedReplyPage({ apiClient, ...target, pageSize: 10 }),
    ).rejects.toThrow("Targeted reply search is unavailable");
    expect(state.requests.map((url) => url.pathname)).toEqual([
      "/v1/emails/search",
    ]);
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
      ).not.toBe("reply");
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
