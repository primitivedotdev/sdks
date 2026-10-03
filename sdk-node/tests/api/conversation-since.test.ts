import { describe, expect, it, vi } from "vitest";
import { getConversation, PrimitiveClient } from "../../src/api/index.js";

const key = ["fixture", "credential"].join("-");
const EMAIL_ID = "11111111-1111-4111-8111-111111111111";
const SENT_ID = "22222222-2222-4222-8222-222222222222";
const FIRST_CURSOR = "2026-10-03T12:00:00.123456Z";
const NEXT_CURSOR = "2026-10-03T12:05:00.654321Z";

function conversation(
  messages: Record<string, unknown>[],
  cursor?: string,
): Record<string, unknown> {
  return {
    success: true,
    data: {
      thread_id: "33333333-3333-4333-8333-333333333333",
      subject: "Plan",
      message_count: 2,
      truncated: false,
      messages,
      ...(cursor === undefined ? {} : { cursor }),
    },
  };
}

const inbound = {
  role: "user",
  direction: "inbound",
  id: EMAIL_ID,
  message_id: "<in@example.test>",
  from: "alice@example.test",
  to: "agent@example.test",
  subject: "Plan",
  text: "hello",
  timestamp: "2026-10-03T11:59:00Z",
};

function outbound(status: string): Record<string, unknown> {
  return {
    role: "assistant",
    direction: "outbound",
    id: SENT_ID,
    message_id: "<out@example.test>",
    from: "agent@example.test",
    to: "alice@example.test",
    subject: "Re: Plan",
    text: "on it",
    timestamp: "2026-10-03T11:59:30Z",
    status,
  };
}

describe("conversation since reads", () => {
  it("reads from start, then sends the returned cursor back verbatim", async () => {
    const urls: URL[] = [];
    const bodies = [
      conversation([inbound, outbound("queued")], FIRST_CURSOR),
      conversation([outbound("delivered")], NEXT_CURSOR),
    ];
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      urls.push(new URL((input as Request).url));
      return Response.json(bodies[urls.length - 1]);
    });
    const client = new PrimitiveClient({ apiKey: key, fetch: fetcher });

    const first = await getConversation({
      client: client.client,
      path: { id: EMAIL_ID },
      query: { since: "start" },
    });
    expect(urls[0]?.pathname).toBe(`/v1/emails/${EMAIL_ID}/conversation`);
    expect(urls[0]?.searchParams.get("since")).toBe("start");
    const cursor = first.data?.data?.cursor;
    expect(cursor).toBe(FIRST_CURSOR);
    expect(first.data?.data?.messages.map((m) => m.status)).toEqual([
      undefined,
      "queued",
    ]);

    const next = await getConversation({
      client: client.client,
      path: { id: EMAIL_ID },
      query: { since: cursor },
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(urls[1]?.searchParams.get("since")).toBe(FIRST_CURSOR);
    const data = next.data?.data;
    expect(data?.cursor).toBe(NEXT_CURSOR);
    // Thread fields describe the whole conversation, not the delta.
    expect(data?.message_count).toBe(2);
    expect(data?.messages).toHaveLength(1);
    expect(data?.messages[0]).toMatchObject({
      id: SENT_ID,
      direction: "outbound",
      status: "delivered",
    });
  });

  it("omits since when it is not asked for", async () => {
    const urls: URL[] = [];
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      urls.push(new URL((input as Request).url));
      return Response.json(conversation([inbound]));
    });
    const client = new PrimitiveClient({ apiKey: key, fetch: fetcher });

    const result = await getConversation({
      client: client.client,
      path: { id: EMAIL_ID },
    });
    expect(urls[0]?.searchParams.has("since")).toBe(false);
    expect(result.data?.data?.cursor).toBeUndefined();
  });
});
