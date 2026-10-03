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

  it("adds the server's interaction label and drops a malformed one", () => {
    const base = {
      sender: "peer@example.com",
      relationship: "agent" as const,
      threadId: null,
      inThread: false,
      attachments: true,
    };
    expect(formatWakeContext({ ...base, interaction: "x402.payment/1" })).toBe(
      "from=peer@example.com relationship=agent thread=none in_thread=no attachments=yes interaction=x402.payment/1",
    );
    expect(formatWakeContext({ ...base, interaction: "fyi" })).toContain(
      " interaction=fyi",
    );
    expect(
      formatWakeContext({ ...base, interaction: "pay now; rm -rf ~" }),
    ).not.toContain("interaction=");
  });

  it("labels a wake only from the server's hint, never from part names", async () => {
    const c = client(() => threadBody({ newer_inbound_count: 0 }));
    const wake = (extra: Record<string, unknown>) =>
      describeWake({
        client: c.client,
        detail: {
          id: email,
          from_email: "peer@example.com",
          thread_id: null,
          parsed: {
            status: "complete",
            attachments: [{ filename: "interaction.json" }],
          },
          ...extra,
        } as unknown as EmailDetail,
        self,
        relationship: "contact",
        localInThread: false,
        signal,
      });
    expect(
      (
        await wake({
          interaction_hint: "card",
          interaction_kind: "x402.payment/1",
        })
      ).interaction,
    ).toBe("x402.payment/1");
    expect(
      (await wake({ interaction_hint: "status", fyi: true })).interaction,
    ).toBe("fyi");
    expect(
      (
        await wake({
          interaction_hint: "none",
          interaction_candidate: true,
          headers: { "x-primitive-interaction": "x402.payment/1" },
        })
      ).interaction,
    ).toBeUndefined();
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
    expect(
      serverRelationship(withCollaboration({ sender_relationship: "other" })),
    ).toBe("other");
    // Unknown values and an absent field leave the CLI's derivation in charge.
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
    // Contradictory facts: local admission says contact or network agent,
    // the server says other. The server wins.
    for (const local of ["contact", "agent"] as const) {
      const contradicted = await describeWake({
        client: down.client,
        detail: {
          ...detail,
          collaboration: { sender_relationship: "other" },
        } as unknown as EmailDetail,
        self,
        relationship: local,
        localInThread: false,
        signal,
      });
      expect(contradicted.relationship).toBe("other");
    }
    const absent = await describeWake({
      client: down.client,
      detail: {
        ...detail,
        collaboration: { sender_relationship: "unknown" },
      } as unknown as EmailDetail,
      self,
      relationship: "contact",
      localInThread: false,
      signal,
    });
    expect(absent.relationship).toBe("contact");
  });
});
