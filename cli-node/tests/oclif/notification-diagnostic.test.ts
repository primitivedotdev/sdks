import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { EmailDetail } from "@primitivedotdev/api-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { followEmailConversation } from "../../src/oclif/conversation-follow.js";
import { currentMailSessionKey } from "../../src/oclif/mail-session.js";
import {
  explainNotification,
  notificationDecision,
} from "../../src/oclif/notification-diagnostic.js";
import { sharedMailScope } from "../../src/oclif/shared-mail-receiver.js";
import type {
  SharedMailEmail,
  SharedMailWait,
} from "../../src/oclif/shared-mail-state.js";
import { openSharedMailStore } from "../../src/oclif/shared-mail-state.js";

const hooks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  getEmail: vi.fn(),
  admit: vi.fn(),
  admitResponse: vi.fn(),
}));
vi.mock("../../src/oclif/api-client.js", () => ({
  createAuthenticatedCliApiClient: hooks.authenticate,
}));
vi.mock("../../src/oclif/contact-policy-client.js", () => ({
  apiContactPolicy: () => ({
    admit: hooks.admit,
    admitResponse: hooks.admitResponse,
  }),
}));
vi.mock("@primitivedotdev/api-core", async (original) => ({
  ...(await original<typeof import("@primitivedotdev/api-core")>()),
  getEmail: hooks.getEmail,
}));

const directories: string[] = [];
afterEach(() => {
  for (const dir of directories.splice(0))
    rmSync(dir, { recursive: true, force: true });
  vi.clearAllMocks();
});

const sessionKey = "codex:11111111-1111-4111-8111-111111111111";
const detail: EmailDetail = {
  id: "22222222-2222-4222-8222-222222222222",
  status: "completed",
  sender: "peer@example.com",
  recipient: "agent@example.com",
  to_email: "agent@example.com",
  domain: "example.com",
  created_at: "2026-01-01T00:00:00Z",
  received_at: "2026-01-01T00:00:00Z",
  webhook_attempt_count: 0,
  replies: [],
  reply_count: 0,
  last_replied_at: null,
  awaiting: "you",
  automated: false,
  automated_reasons: [],
  from_email: "peer@example.com",
  sender_connected_agent_verified: false,
  from_header: "peer@example.com",
  parsed: { status: "complete", attachments: [] },
  auth: {
    spf: "pass",
    dmarc: "pass",
    dmarcFromDomain: "example.com",
    dmarcSpfAligned: true,
    dmarcDkimAligned: true,
    dkimSignatures: [],
  },
};
const row: SharedMailEmail = {
  emailId: detail.id,
  eventId: "33333333-3333-4333-8333-333333333333",
  receivedAt: "2026-01-01T00:00:00Z",
  firstSeenAt: "2026-01-01T00:00:00Z",
  details: null,
  route: null,
};
const base = {
  detail,
  row,
  requested: null,
  sessionKey,
  policy: "response" as const,
};
describe("content-free notification diagnosis", () => {
  it("distinguishes missing local observation from current eligibility", () => {
    expect(notificationDecision({ ...base, row: null })).toBe(
      "not_observed_locally",
    );
    expect(notificationDecision(base)).toBe("eligible_now");
    expect(notificationDecision({ ...base, policy: "silent" })).toBe(
      "sender_not_enabled_or_explicitly_silenced",
    );
    expect(notificationDecision({ ...base, policy: "request" })).toBe(
      "contact_request_policy_only",
    );
  });
  it("reports delivered wait and native outcomes without claiming model reading", () => {
    expect(
      notificationDecision({
        ...base,
        row: {
          ...row,
          route: { kind: "wait", requestId: row.eventId, observed: true },
        },
      }),
    ).toBe("returned_to_reply_wait");
    expect(
      notificationDecision({
        ...base,
        row: {
          ...row,
          route: { kind: "notification", sessionKey, state: "accepted" },
        },
      }),
    ).toBe("native_event_accepted");
    expect(
      notificationDecision({
        ...base,
        row: {
          ...row,
          route: { kind: "notification", sessionKey, state: "unknown" },
        },
      }),
    ).toBe("native_event_unknown");
  });
  it("explains wrong-session correlation without changing it", () => {
    const requested = { sessionKey: "codex:another" } as SharedMailWait;
    expect(notificationDecision({ ...base, requested })).toBe(
      "conversation_belongs_to_other_session",
    );
    expect(requested.sessionKey).toBe("codex:another");
  });
  it("explains thread ownership when the reply has a new immediate parent", () => {
    expect(
      notificationDecision({
        ...base,
        followed: {
          threadId: row.eventId,
          recipient: detail.recipient,
          peer: detail.from_email,
          sessionKey: "codex:44444444-4444-4444-8444-444444444444",
          since: detail.received_at,
        },
      }),
    ).toBe("conversation_belongs_to_other_session");
  });
  it("does not call invalid authenticated sender evidence eligible", () => {
    expect(
      notificationDecision({
        ...base,
        detail: { ...detail, from_header: "other@example.net" },
      }),
    ).toBe("sender_authentication_failed");
  });
  it("only accepts runtime-supplied exact session IDs", () => {
    expect(currentMailSessionKey({})).toBeNull();
    expect(
      currentMailSessionKey({ CODEX_SESSION_ID: "guess-latest" }),
    ).toBeNull();
    expect(
      currentMailSessionKey({ CODEX_SESSION_ID: sessionKey.slice(6) }),
    ).toBe(sessionKey);
    expect(
      currentMailSessionKey({ CODEX_THREAD_ID: sessionKey.slice(6) }),
    ).toBe(sessionKey);
  });
});

describe("followed thread diagnostic integration", () => {
  it.each([
    "allowed",
    "muted",
    "old",
    "other-session",
    "other-peer",
    "other-thread",
  ])("explains %s new-parent replies using saved conversation context without dispatch", async (scenario) => {
    const configDir = mkdtempSync(join(tmpdir(), "notification-diagnostic-"));
    directories.push(configDir);
    const apiKey = ["pconn", "fixture"].join("_"),
      apiBaseUrl = "https://example.test/v1";
    const scope = sharedMailScope(apiKey, apiBaseUrl),
      threadId = randomUUID();
    const email = {
      ...detail,
      thread_id: threadId,
      reply_to_sent_email_id: randomUUID(),
      body_text: "Private email content",
    };
    await followEmailConversation(
      {
        configDir,
        scope,
        recipient: detail.recipient,
        peer: detail.from_email,
        sessionKey,
        since: detail.received_at,
      },
      email,
    );
    if (scenario === "old") email.received_at = "2025-12-31T23:59:59.000Z";
    if (scenario === "other-peer")
      email.from_email = email.from_header = "other@example.com";
    if (scenario === "other-thread") email.thread_id = randomUUID();
    const store = await openSharedMailStore({
      configDir,
      scope,
      recipient: detail.recipient,
    });
    await store.ingest({
      emailId: detail.id,
      eventId: randomUUID(),
      receivedAt: email.received_at,
    });
    hooks.authenticate.mockResolvedValue({
      auth: {
        apiKey,
        apiBaseUrl,
        connectedAgent: { agentAddress: detail.recipient },
      },
      apiClient: { client: {} },
    });
    hooks.getEmail.mockResolvedValue({ data: { data: email } });
    hooks.admit.mockResolvedValue(undefined);
    hooks.admitResponse.mockResolvedValue(
      scenario === "muted" ? undefined : { kind: "response" },
    );
    const output = await explainNotification({
      configDir,
      emailId: detail.id,
      sessionId:
        scenario === "other-session" ? randomUUID() : sessionKey.slice(6),
    });
    expect(output.reason).toBe(
      scenario === "allowed"
        ? "eligible_now"
        : scenario === "other-session"
          ? "conversation_belongs_to_other_session"
          : "sender_not_enabled_or_explicitly_silenced",
    );
    expect(hooks.admitResponse).toHaveBeenCalledTimes(
      ["allowed", "muted"].includes(scenario) ? 1 : 0,
    );
    expect(output.replyWait).toBeNull();
    expect(output.conversationFollow).toEqual(
      scenario === "other-thread"
        ? null
        : { threadId, sessionKey, since: "2026-01-01T00:00:00.000Z" },
    );
    expect(JSON.stringify(output)).not.toContain(email.body_text);
    expect((await store.readEmail(detail.id))?.route).toBeNull();
    expect(hooks.getEmail).toHaveBeenCalledOnce();
  });
});
