import type {
  EmailDetail,
  PrimitiveApiClient,
} from "@primitivedotdev/api-core";
import { describe, expect, it, vi } from "vitest";
import {
  bareAddress,
  describeWake,
  formatWakeContext,
  latestOwnOutbound,
  readThreadContext,
  sentInThread,
  serverMuted,
  serverRelationship,
  wakeRelationship,
} from "../../src/oclif/wake-context.js";

const thread = "44444444-4444-4444-8444-444444444444";
const email = "22222222-2222-4222-8222-222222222222";
const self = "agent@example.com";
const signal = new AbortController().signal;

type Client = PrimitiveApiClient["client"];

function client(
  respond: (options: { query?: Record<string, unknown> }) => unknown,
) {
  const get = vi.fn(async (options: { query?: Record<string, unknown> }) =>
    respond(options),
  );
  return { get, client: { get } as unknown as Client };
}

function threadBody(extra: Record<string, unknown> = {}) {
  return {
    data: {
      success: true,
      data: {
        id: thread,
        message_count: 2,
        created_at: "2026-10-01T00:00:00.000Z",
        messages: [
          {
            direction: "outbound",
            id: "33333333-3333-4333-8333-333333333333",
            from: `Agent <${self}>`,
            message_id: "<sent@example.com>",
          },
          {
            direction: "inbound",
            id: email,
            from: "peer@example.com",
          },
        ],
        ...extra,
      },
    },
  };
}

describe("wake metadata", () => {
  it("formats only fixed server-derived fields and withholds unusual addresses", () => {
    expect(
      formatWakeContext({
        sender: "peer@example.com",
        relationship: "agent",
        threadId: thread.toUpperCase(),
        inThread: true,
        attachments: false,
        newer: 2,
      }),
    ).toBe(
      `from=peer@example.com relationship=agent thread=${thread} in_thread=yes attachments=no newer=2`,
    );
    expect(
      formatWakeContext({
        sender: '"quoted words"@example.com',
        relationship: "other",
        threadId: null,
        inThread: false,
        attachments: true,
      }),
    ).toBe(
      "from=unavailable relationship=other thread=none in_thread=no attachments=yes",
    );
  });

  it("maps server relationship facts in priority order", () => {
    expect(wakeRelationship({ senderRelation: "owner", contact: true })).toBe(
      "owner",
    );
    expect(wakeRelationship({ senderRelation: "member" })).toBe("member");
    expect(wakeRelationship({ connectedAgentVerified: true })).toBe("agent");
    expect(wakeRelationship({ network: true, contact: true })).toBe("agent");
    expect(wakeRelationship({ contact: true })).toBe("contact");
    expect(wakeRelationship({})).toBe("other");
  });

  it("reads the server's sender relationship and mute when present", () => {
    const withCollaboration = (collaboration: unknown) => ({ collaboration });
    expect(
      serverRelationship(withCollaboration({ sender_relationship: "owner" })),
    ).toBe("owner");
    expect(
      serverRelationship(
        withCollaboration({ sender_relationship: "org_agent" }),
      ),
    ).toBe("agent");
    expect(
      serverRelationship(withCollaboration({ sender_relationship: "member" })),
    ).toBe("member");
    expect(
      serverRelationship(withCollaboration({ sender_relationship: "contact" })),
    ).toBe("contact");
    // "other" and unknown values leave the CLI's own derivation in charge.
    expect(
      serverRelationship(withCollaboration({ sender_relationship: "other" })),
    ).toBeUndefined();
    expect(
      serverRelationship(withCollaboration({ sender_relationship: "boss" })),
    ).toBeUndefined();
    expect(serverRelationship({})).toBeUndefined();
    expect(serverMuted(withCollaboration({ muted: true }))).toBe(true);
    expect(serverMuted({ muted: true })).toBe(true);
    expect(serverMuted(withCollaboration({ muted: false }))).toBe(false);
    expect(serverMuted({})).toBe(false);
  });

  it("parses bare and display-name addresses", () => {
    expect(bareAddress("Peer <PEER@Example.com>")).toBe("peer@example.com");
    expect(bareAddress("peer@example.com")).toBe("peer@example.com");
    expect(bareAddress("not an address")).toBeNull();
    expect(bareAddress(null)).toBeNull();
  });
});

describe("thread context", () => {
  it("asks for newer mail and reports it when the API provides the fields", async () => {
    const c = client(() =>
      threadBody({
        newer_inbound_count: 1,
        newer_inbound: [
          {
            id: "55555555-5555-4555-8555-555555555555",
            from: "Peer <peer@example.com>",
            received_at: "2026-10-01T01:00:00.000Z",
          },
        ],
      }),
    );
    const context = await readThreadContext(c.client, thread, email, signal);
    expect(c.get).toHaveBeenCalledOnce();
    expect(c.get.mock.calls[0]?.[0].query).toEqual({ after: email });
    expect(context?.newerInboundCount).toBe(1);
    expect(context?.newerInbound).toEqual([
      {
        id: "55555555-5555-4555-8555-555555555555",
        from: "peer@example.com",
        received_at: "2026-10-01T01:00:00.000Z",
      },
    ]);
    expect(sentInThread(context, self)).toBe(true);
    expect(latestOwnOutbound(context, self)?.message_id).toBe(
      "<sent@example.com>",
    );
  });

  it("omits newer mail when the API does not return it", async () => {
    const c = client(() => threadBody());
    const context = await readThreadContext(c.client, thread, email, signal);
    expect(context).not.toBeNull();
    expect(context?.newerInboundCount).toBeUndefined();
  });

  it("falls back once to a plain read when the API rejects the after query, then stops asking", async () => {
    const c = client(({ query }) =>
      query
        ? {
            error: { error: { code: "invalid_request" } },
            response: { status: 400 },
          }
        : threadBody(),
    );
    expect(
      await readThreadContext(c.client, thread, email, signal),
    ).not.toBeNull();
    expect(c.get).toHaveBeenCalledTimes(2);
    await readThreadContext(c.client, thread, email, signal);
    expect(c.get).toHaveBeenCalledTimes(3);
    expect(c.get.mock.calls[2]?.[0].query).toBeUndefined();
  });

  it("returns null instead of throwing when the thread cannot be read", async () => {
    const failing = {
      get: vi.fn(async () => {
        throw new Error("network down");
      }),
    } as unknown as Client;
    expect(await readThreadContext(failing, thread, email, signal)).toBeNull();
    const c = client(() => ({
      error: { error: {} },
      response: { status: 404 },
    }));
    expect(await readThreadContext(c.client, thread, email, signal)).toBeNull();
    expect(
      await readThreadContext(c.client, "not-a-uuid", email, signal),
    ).toBeNull();
  });

  it("reports unknown participation for a truncated thread without our message", () => {
    expect(
      sentInThread({ threadId: thread, messages: [], truncated: true }, self),
    ).toBeUndefined();
    expect(
      sentInThread({ threadId: thread, messages: [], truncated: false }, self),
    ).toBe(false);
  });

  it("describes a wake from one thread read, falling back to local evidence", async () => {
    const detail = {
      id: email,
      from_email: " Peer@Example.com ",
      thread_id: thread,
      parsed: { status: "complete", attachments: [{ filename: "a.txt" }] },
    } as unknown as EmailDetail;
    const c = client(() => threadBody({ newer_inbound_count: 0 }));
    expect(
      await describeWake({
        client: c.client,
        detail,
        self,
        relationship: "contact",
        localInThread: false,
        signal,
      }),
    ).toEqual({
      sender: "peer@example.com",
      relationship: "contact",
      threadId: thread,
      inThread: true,
      attachments: true,
      newer: 0,
    });
    const down = client(() => ({ error: {}, response: { status: 500 } }));
    const fallback = await describeWake({
      client: down.client,
      detail,
      self,
      relationship: "other",
      localInThread: true,
      signal,
    });
    expect(fallback.inThread).toBe(true);
    expect(fallback.newer).toBeUndefined();
    const owned = await describeWake({
      client: down.client,
      detail: {
        ...detail,
        collaboration: { sender_relationship: "org_agent" },
      } as unknown as EmailDetail,
      self,
      relationship: "other",
      localInThread: false,
      signal,
    });
    expect(owned.relationship).toBe("agent");
  });
});
