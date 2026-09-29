import { randomUUID } from "node:crypto";
import { PrimitiveApiClient } from "@primitivedotdev/api-core";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getEmail: vi.fn(),
  getSentEmail: vi.fn(),
  policy: vi.fn(),
  store: vi.fn(),
  notices: vi.fn(),
  interaction: vi.fn(),
  acceptance: vi.fn(),
  routine: vi.fn(),
  statusContent: vi.fn(),
  reserveStatus: vi.fn(),
  plain: vi.fn(),
  follow: vi.fn(),
  writeFollow: vi.fn(),
}));

vi.mock("@primitivedotdev/api-core", async (original) => ({
  ...(await original<typeof import("@primitivedotdev/api-core")>()),
  getEmail: mocks.getEmail,
  getSentEmail: mocks.getSentEmail,
}));
vi.mock("@primitivedotdev/sdk/webhook", async (original) => ({
  ...(await original<typeof import("@primitivedotdev/sdk/webhook")>()),
  parseWebhookEvent: (event: unknown) => event,
  isEmailReceivedEvent: () => true,
}));
vi.mock("../../src/oclif/api-client.js", () => ({
  createAuthenticatedCliApiClient: async () => ({
    apiClient: { client: {} },
    auth: {
      connectedAgent: { agentAddress: "agent@example.test" },
      apiKey: "test-key",
      apiBaseUrl: "https://example.test/v1",
    },
  }),
}));
vi.mock("../../src/oclif/contact-policy-client.js", () => ({
  apiContactPolicy: mocks.policy,
}));
vi.mock("../../src/oclif/contact-request-state.js", () => ({
  openContactRequestNotices: mocks.notices,
}));
vi.mock("../../src/oclif/shared-mail-receiver.js", async (original) => ({
  ...(await original<
    typeof import("../../src/oclif/shared-mail-receiver.js")
  >()),
  sharedMailScope: () => "test-scope",
}));
vi.mock("../../src/oclif/shared-mail-state.js", async (original) => ({
  ...(await original<typeof import("../../src/oclif/shared-mail-state.js")>()),
  openSharedMailStore: mocks.store,
}));
vi.mock("../../src/oclif/contact-interactions.js", async (original) => ({
  ...(await original<
    typeof import("../../src/oclif/contact-interactions.js")
  >()),
  readContactInteraction: mocks.interaction,
  isContactAcceptance: mocks.acceptance,
}));
vi.mock("../../src/oclif/conversation-follow.js", async (original) => ({
  ...(await original<
    typeof import("../../src/oclif/conversation-follow.js")
  >()),
  readConversationFollow: mocks.follow,
  followEmailConversation: mocks.writeFollow,
}));
vi.mock("../../src/oclif/conversation-status.js", async (original) => ({
  ...(await original<
    typeof import("../../src/oclif/conversation-status.js")
  >()),
  reserveConversationStatus: mocks.reserveStatus,
}));
vi.mock("../../src/oclif/notify-session-content.js", async (original) => ({
  ...(await original<
    typeof import("../../src/oclif/notify-session-content.js")
  >()),
  notificationPartReader: () => async () => new Uint8Array(),
  isRoutineNotificationContent: mocks.routine,
  readConversationStatusContent: mocks.statusContent,
}));
vi.mock("../../src/oclif/scoped-chat.js", async (original) => ({
  ...(await original<typeof import("../../src/oclif/scoped-chat.js")>()),
  scopedChatSenderTrust: () => ({ trusted: true, retryable: false }),
  isPlainChatReply: mocks.plain,
}));

import { createWakeMail } from "../../src/oclif/wake-mail.js";
import { emptyContactPolicy } from "./contact-policy-fixture.js";

function fixture(
  solicited: boolean,
  responseAllowed: boolean,
  kind: "contact" | "chat" = "contact",
) {
  vi.clearAllMocks();
  const emailId = randomUUID();
  const parentId = randomUUID();
  const eventId = randomUUID();
  const sessionId = randomUUID();
  const receivedAt = new Date().toISOString();
  const sender = "peer@example.test";
  const request = {
    status: "bound",
    sentEmailId: parentId,
    peer: sender,
    sessionKey: `claude:${sessionId}`,
    createdAt: new Date(Date.now() - 60_000).toISOString(),
    contactRequest: kind === "contact" ? { stepId: randomUUID() } : undefined,
  };
  mocks.getEmail.mockResolvedValue({
    data: {
      success: true,
      data: {
        id: emailId,
        recipient: "agent@example.test",
        to_email: "agent@example.test",
        from_email: sender,
        received_at: receivedAt,
        status: "accepted",
        parsed: {
          status: "complete",
          attachments: [],
          in_reply_to: ["<sent@example.test>"],
        },
        reply_to_sent_email_id: parentId,
        thread_id: null,
      },
    },
  });
  mocks.getSentEmail.mockResolvedValue({
    data: {
      success: true,
      data: { id: parentId, message_id: "<sent@example.test>" },
    },
  });
  mocks.policy.mockReturnValue({
    admit: vi.fn().mockResolvedValue({ kind: "request" }),
    admitResponse: vi
      .fn()
      .mockResolvedValue(responseAllowed ? { kind: "response" } : null),
    recheck: vi.fn().mockResolvedValue(() => {}),
    members: () => [],
  });
  const store = {
    findWaitByParent: vi.fn().mockResolvedValue(solicited ? request : null),
    wakeDisposition: vi.fn().mockResolvedValue("available"),
  };
  mocks.store.mockResolvedValue(store);
  mocks.notices.mockReturnValue({
    activate: () => "2026-09-28T00:00:00.000Z",
    reserve: vi.fn(() => "reserved"),
  });
  mocks.interaction.mockResolvedValue({ step: "accept" });
  mocks.acceptance.mockReturnValue(true);
  mocks.routine.mockResolvedValue(false);
  mocks.statusContent.mockResolvedValue(null);
  mocks.reserveStatus.mockResolvedValue(true);
  mocks.plain.mockReturnValue(true);
  mocks.follow.mockReturnValue(null);
  mocks.writeFollow.mockReset().mockImplementation(async (context, detail) => {
    const follow = { ...context, threadId: detail.thread_id };
    mocks.follow.mockReturnValue(follow);
    return follow;
  });
  const event = {
    event: "email.received",
    email: {
      id: emailId,
      smtp: { rcpt_to: ["agent@example.test"] },
    },
  };
  return {
    sessionId,
    emailId,
    parentId,
    store,
    delivery: {
      event_type: "email.received",
      event_id: eventId,
      body: JSON.stringify(event),
    },
  };
}

describe("Claude mail wake", () => {
  it.each([
    { failure: 503, solicited: true },
    { failure: "pending", solicited: true },
    { failure: 503, solicited: false },
    { failure: "pending", solicited: false },
  ] as const)("handles solicited=$solicited mail independently of network $failure without admitting unrelated mail", async ({
    failure,
    solicited,
  }) => {
    const f = fixture(solicited, true, "chat");
    const api = new PrimitiveApiClient({
      apiKey: "fixture",
      apiBaseUrl: "https://example.test/v1",
      fetch: async (input, init) => {
        const path = new URL(new Request(input, init).url).pathname;
        if (path.startsWith("/v1/agent-contact-policy/"))
          return Response.json({
            success: true,
            data: emptyContactPolicy("agent@example.test"),
          });
        if (path.startsWith("/v1/agent-contacts/"))
          return Response.json({
            success: true,
            data: [],
            meta: { cursor: null },
          });
        if (path === "/v1/agent-networks/default/contact-admission")
          return failure === 503
            ? Response.json({ success: false }, { status: 503 })
            : Response.json({
                success: true,
                data: { allowed: false, allowed_since: null, pending: true },
              });
        throw new Error("Unexpected fixture route");
      },
    });
    const { apiContactPolicy } = await vi.importActual<
      typeof import("../../src/oclif/contact-policy-client.js")
    >("../../src/oclif/contact-policy-client.js");
    mocks.policy.mockReturnValue(
      apiContactPolicy(api.client, "agent@example.test"),
    );
    const wake = await createWakeMail({
      configDir: "/tmp/test",
      sessionKey: `claude:${f.sessionId}`,
      sessionId: f.sessionId,
      contactRequests: false,
    });
    try {
      const handled = await wake.handler(
        f.delivery as never,
        new AbortController().signal,
      );
      expect(handled.succeeded).toBe(solicited);
      expect(wake.wakeId()).toBe(solicited ? f.emailId : undefined);
    } finally {
      await wake.close();
    }
  });

  it.each([
    "verified",
    "pending",
  ])("keeps %s controls out of model routing while ordinary mail still wakes", async (status) => {
    const f = fixture(true, true, "chat");
    const ordinary = await mocks.getEmail();
    mocks.getEmail
      .mockResolvedValueOnce({
        ...ordinary,
        data: {
          ...ordinary.data,
          data: {
            ...ordinary.data.data,
            presence_control: { status, valid_for_ms: 0 },
          },
        },
      })
      .mockResolvedValue(ordinary);
    const wake = await createWakeMail({
      configDir: "/tmp/test",
      sessionKey: `claude:${f.sessionId}`,
      sessionId: f.sessionId,
      contactRequests: true,
    });
    try {
      const handled = await wake.handler(
        f.delivery as never,
        new AbortController().signal,
      );
      wake.completed();
      expect(handled).toMatchObject({
        succeeded: true,
        countTowardLimit: false,
      });
      expect(wake.wakeId()).toBeUndefined();
      expect(wake.status()).toBeUndefined();
      expect(mocks.policy.mock.results[0]?.value.admit).not.toHaveBeenCalled();
      expect(mocks.routine).not.toHaveBeenCalled();
      expect(mocks.statusContent).not.toHaveBeenCalled();
      await wake.handler(f.delivery as never, new AbortController().signal);
      wake.completed();
      expect(wake.wakeId()).toBe(f.emailId);
    } finally {
      await wake.close();
    }
  });
  it("wakes for an exact solicited contact acceptance even when intake classifies unknown mail as a request", async () => {
    const f = fixture(true, true);
    const signal = new AbortController().signal;
    const wake = await createWakeMail({
      configDir: "/tmp/test",
      sessionKey: `claude:${f.sessionId}`,
      sessionId: f.sessionId,
      contactRequests: true,
    });
    const handled = await wake.handler(f.delivery as never, signal);
    wake.completed();
    expect(handled.succeeded).toBe(true);
    expect(mocks.policy.mock.results[0]?.value.admit).toHaveBeenCalledWith(
      "peer@example.test",
      expect.any(String),
      signal,
      f.emailId,
    );
    expect(
      mocks.policy.mock.results[0]?.value.admitResponse,
    ).toHaveBeenCalledOnce();
    expect(wake.wakeId()).toBe(f.emailId);
    expect(mocks.notices.mock.results[0]?.value.reserve).not.toHaveBeenCalled();
  });

  it("keeps a bare profile's contact acceptance manual-only", async () => {
    const f = fixture(true, true);
    const wait = await f.store.findWaitByParent();
    f.store.findWaitByParent.mockResolvedValue({ ...wait, sessionKey: null });
    mocks.policy.mockReturnValue({
      admit: vi
        .fn()
        .mockResolvedValue({ kind: "allowed", sender: "peer@example.test" }),
      admitResponse: vi.fn().mockResolvedValue({ kind: "response" }),
      recheck: vi.fn().mockResolvedValue(() => {}),
      members: () => ["peer@example.test"],
    });
    const wake = await createWakeMail({
      configDir: "/tmp/test",
      sessionKey: `claude:${f.sessionId}`,
      sessionId: f.sessionId,
      contactRequests: true,
    });
    const handled = await wake.handler(
      f.delivery as never,
      new AbortController().signal,
    );
    wake.completed();
    expect(handled.succeeded).toBe(true);
    expect(wake.wakeId()).toBeUndefined();
    expect(
      mocks.policy.mock.results[0]?.value.admitResponse,
    ).not.toHaveBeenCalled();
  });

  it("wakes for an exact solicited chat reply even when intake classifies unknown mail as a request", async () => {
    const f = fixture(true, true, "chat");
    const wake = await createWakeMail({
      configDir: "/tmp/test",
      sessionKey: `claude:${f.sessionId}`,
      sessionId: f.sessionId,
      contactRequests: true,
    });
    const handled = await wake.handler(
      f.delivery as never,
      new AbortController().signal,
    );
    wake.completed();
    expect(handled.succeeded).toBe(true);
    expect(wake.wakeId()).toBe(f.emailId);
    expect(mocks.notices.mock.results[0]?.value.reserve).not.toHaveBeenCalled();
  });

  it("follows an async chat reply so a later changed-parent reply wakes only its Claude session", async () => {
    const f = fixture(true, true, "chat");
    const response = await mocks.getEmail();
    response.data.data.thread_id = randomUUID();
    mocks.getEmail.mockResolvedValue(response);
    const first = await createWakeMail({
      configDir: "/tmp/test",
      sessionKey: `claude:${f.sessionId}`,
      sessionId: f.sessionId,
      contactRequests: true,
    });
    await first.handler(f.delivery as never, new AbortController().signal);
    first.completed();
    expect(first.wakeId()).toBe(f.emailId);
    expect(mocks.writeFollow).toHaveBeenCalledOnce();
    expect(mocks.writeFollow.mock.calls[0]?.[0]).toMatchObject({
      peer: "peer@example.test",
      sessionKey: `claude:${f.sessionId}`,
    });

    response.data.data.id = randomUUID();
    response.data.data.reply_to_sent_email_id = null;
    mocks.getEmail.mockResolvedValue(response);
    const later = await createWakeMail({
      configDir: "/tmp/test",
      sessionKey: `claude:${f.sessionId}`,
      sessionId: f.sessionId,
      contactRequests: true,
    });
    await later.handler(
      {
        ...f.delivery,
        event_id: randomUUID(),
        body: JSON.stringify({
          event: "email.received",
          email: {
            id: response.data.data.id,
            smtp: { rcpt_to: ["agent@example.test"] },
          },
        }),
      } as never,
      new AbortController().signal,
    );
    later.completed();
    expect(later.wakeId()).toBe(response.data.data.id);
    expect(mocks.writeFollow).toHaveBeenCalledOnce();

    response.data.data.id = randomUUID();
    response.data.data.from_email = "unrelated@example.test";
    const unrelated = await createWakeMail({
      configDir: "/tmp/test",
      sessionKey: `claude:${f.sessionId}`,
      sessionId: f.sessionId,
      contactRequests: true,
    });
    await unrelated.handler(
      {
        ...f.delivery,
        event_id: randomUUID(),
        body: JSON.stringify({
          event: "email.received",
          email: {
            id: response.data.data.id,
            smtp: { rcpt_to: ["agent@example.test"] },
          },
        }),
      } as never,
      new AbortController().signal,
    );
    unrelated.completed();
    expect(unrelated.wakeId()).toBeUndefined();
    expect(mocks.writeFollow).toHaveBeenCalledOnce();
  });

  it("does not wake for an uncorrelated acceptance or bypass a response denial", async () => {
    for (const [solicited, responseAllowed] of [
      [false, true],
      [true, false],
    ] as const) {
      const f = fixture(solicited, responseAllowed);
      const wake = await createWakeMail({
        configDir: "/tmp/test",
        sessionKey: `claude:${f.sessionId}`,
        sessionId: f.sessionId,
        contactRequests: true,
      });
      await wake.handler(f.delivery as never, new AbortController().signal);
      wake.completed();
      expect(wake.wakeId()).toBeUndefined();
    }
  });

  it("does not wake again for a reply already delivered by chat, and holds a live wait", async () => {
    for (const [disposition, succeeded] of [
      ["observed", true],
      ["waiting", false],
    ] as const) {
      const f = fixture(true, true, "chat");
      const wake = await createWakeMail({
        configDir: "/tmp/test",
        sessionKey: `claude:${f.sessionId}`,
        sessionId: f.sessionId,
        contactRequests: true,
      });
      f.store.wakeDisposition.mockResolvedValue(disposition);
      const handled = await wake.handler(
        f.delivery as never,
        new AbortController().signal,
      );
      wake.completed();
      expect(handled.succeeded).toBe(succeeded);
      expect(wake.wakeId()).toBeUndefined();
    }
  });

  it("surfaces exact authenticated activity as status without a new task wake", async () => {
    const f = fixture(true, true, "chat");
    mocks.plain.mockReturnValue(false);
    mocks.statusContent.mockResolvedValue({
      kind: "typing",
      subjectMessageId: "<sent@example.test>",
      interactionDomain: "example.test",
      expiresAt: new Date(Date.now() + 30_000).toISOString(),
    });
    const wake = await createWakeMail({
      configDir: "/tmp/test",
      sessionKey: `claude:${f.sessionId}`,
      sessionId: f.sessionId,
      contactRequests: true,
    });
    const handled = await wake.handler(
      f.delivery as never,
      new AbortController().signal,
    );
    wake.completed();
    expect(handled.succeeded).toBe(true);
    expect(wake.status()).toEqual({
      emailId: f.emailId,
      sentEmailId: f.parentId,
      kind: "typing",
      peer: "peer@example.test",
    });
    expect(wake.wakeId()).toBeUndefined();
    expect(mocks.reserveStatus).toHaveBeenCalledOnce();
    expect(mocks.getSentEmail).toHaveBeenCalledOnce();
    expect(mocks.routine).not.toHaveBeenCalled();
  });

  it("retries a status when the bound sent Message-ID cannot be read", async () => {
    const f = fixture(true, true, "chat");
    mocks.statusContent.mockResolvedValue({
      kind: "typing",
      subjectMessageId: "<sent@example.test>",
      interactionDomain: "example.test",
      expiresAt: new Date(Date.now() + 30_000).toISOString(),
    });
    mocks.getSentEmail.mockRejectedValueOnce(new Error("Unavailable"));
    const wake = await createWakeMail({
      configDir: "/tmp/test",
      sessionKey: `claude:${f.sessionId}`,
      sessionId: f.sessionId,
      contactRequests: true,
    });
    const handled = await wake.handler(
      f.delivery as never,
      new AbortController().signal,
    );
    wake.completed();
    expect(handled.succeeded).toBe(false);
    expect(wake.status()).toBeUndefined();
    expect(mocks.reserveStatus).not.toHaveBeenCalled();
  });

  it("does not surface status after a completed wait but still wakes for a later ordinary followed reply", async () => {
    const f = fixture(true, true, "chat");
    f.store.findWaitByParent.mockResolvedValueOnce({
      status: "completed",
      sentEmailId: f.parentId,
      peer: "peer@example.test",
      sessionKey: `claude:${f.sessionId}`,
      createdAt: new Date(Date.now() - 60_000).toISOString(),
    });
    mocks.plain.mockReturnValue(false);
    mocks.statusContent.mockResolvedValue({
      kind: "working",
      subjectMessageId: "<sent@example.test>",
      interactionDomain: "example.test",
      expiresAt: new Date(Date.now() + 30_000).toISOString(),
    });
    const wake = await createWakeMail({
      configDir: "/tmp/test",
      sessionKey: `claude:${f.sessionId}`,
      sessionId: f.sessionId,
      contactRequests: true,
    });
    await wake.handler(f.delivery as never, new AbortController().signal);
    wake.completed();
    expect(wake.status()).toBeUndefined();
    expect(wake.wakeId()).toBeUndefined();

    const later = fixture(false, true, "chat");
    mocks.statusContent.mockResolvedValue(null);
    mocks.plain.mockReturnValue(true);
    mocks.follow.mockReturnValue({
      peer: "peer@example.test",
      sessionKey: `claude:${later.sessionId}`,
      since: new Date(Date.now() - 60_000).toISOString(),
    });
    const result = await mocks.getEmail();
    result.data.data.thread_id = randomUUID();
    mocks.getEmail.mockResolvedValue(result);
    const followed = await createWakeMail({
      configDir: "/tmp/test",
      sessionKey: `claude:${later.sessionId}`,
      sessionId: later.sessionId,
      contactRequests: true,
    });
    await followed.handler(
      later.delivery as never,
      new AbortController().signal,
    );
    followed.completed();
    expect(followed.wakeId()).toBe(later.emailId);
    expect(followed.status()).toBeUndefined();
  });
});
