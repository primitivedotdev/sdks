import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type EmailDetail,
  PrimitiveApiClient,
} from "@primitivedotdev/api-core";
import { afterEach, describe, expect, it } from "vitest";
import {
  boundConversationStatus,
  readBoundSentMessageId,
  reserveConversationStatus,
} from "../../src/oclif/conversation-status.js";
import type { ConversationStatusContent } from "../../src/oclif/notify-session-content.js";
import type { SharedMailWait } from "../../src/oclif/shared-mail-state.js";

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

function fixture(kind: ConversationStatusContent["kind"] = "typing") {
  const sentEmailId = randomUUID(),
    emailId = randomUUID(),
    sessionKey = `claude:${randomUUID()}`;
  const messageId = "<sent@example.test>",
    now = Date.now();
  const detail = {
    id: emailId,
    from_email: "peer@their-domain.test",
    to_email: "agent@our-domain.test",
    reply_to_sent_email_id: sentEmailId,
    received_at: new Date(now).toISOString(),
    parsed: { status: "complete", in_reply_to: [messageId] },
  } as EmailDetail;
  const wait = {
    status: "bound",
    sentEmailId,
    peer: "peer@their-domain.test",
    sessionKey,
    createdAt: new Date(now - 1000).toISOString(),
  } as SharedMailWait;
  const content: ConversationStatusContent = {
    kind,
    subjectMessageId: messageId,
    interactionDomain: "their-domain.test",
    expiresAt: ["working", "typing"].includes(kind)
      ? new Date(now + 30_000).toISOString()
      : null,
  };
  return { detail, wait, content, sessionKey, messageId, now };
}

describe("exact conversation status", () => {
  it("reads the authoritative sent Message-ID and holds a failed lookup for retry", async () => {
    const f = fixture();
    let unavailable = false;
    const apiClient = new PrimitiveApiClient({
      apiKey: "test-key",
      apiBaseUrl: "https://api.primitive-staging-1.com/v1",
      fetch: (async (input: RequestInfo | URL) => {
        const url = input instanceof Request ? input.url : String(input);
        expect(new URL(url).pathname).toBe(
          `/v1/sent-emails/${f.wait.sentEmailId}`,
        );
        if (unavailable) throw new Error("Temporary outage");
        return Response.json({
          success: true,
          data: { id: f.wait.sentEmailId, message_id: f.messageId },
        });
      }) as typeof fetch,
    });
    const signal = new AbortController().signal;
    expect(await readBoundSentMessageId(apiClient, f.wait, signal)).toBe(
      f.messageId,
    );
    unavailable = true;
    expect(await readBoundSentMessageId(apiClient, f.wait, signal)).toBeNull();
  });
  it.each([
    "read",
    "ack",
    "working",
    "typing",
  ] as const)("accepts canonical %s only for the bound send and session", (kind) => {
    const f = fixture(kind);
    expect(
      boundConversationStatus(
        f.detail,
        f.content,
        f.wait,
        f.messageId,
        f.sessionKey,
        f.now,
      ),
    ).toEqual({
      emailId: f.detail.id,
      sentEmailId: f.wait.sentEmailId,
      kind,
      peer: f.wait.peer,
    });
  });
  it("rejects wrong peer, session, parent, Message-ID, interaction domain and stale activity", () => {
    const f = fixture();
    const check = (
      detail = f.detail,
      content = f.content,
      wait = f.wait,
      sentMessageId: string | null = f.messageId,
      session = f.sessionKey,
    ) =>
      boundConversationStatus(
        detail,
        content,
        wait,
        sentMessageId,
        session,
        f.now,
      );
    expect(check({ ...f.detail, from_email: "other@example.test" })).toBeNull();
    expect(
      check(f.detail, f.content, {
        ...f.wait,
        sessionKey: `claude:${randomUUID()}`,
      }),
    ).toBeNull();
    expect(
      check({ ...f.detail, reply_to_sent_email_id: randomUUID() }),
    ).toBeNull();
    expect(check(f.detail, f.content, f.wait, null)).toBeNull();
    expect(
      check(f.detail, f.content, f.wait, "<different@example.test>"),
    ).toBeNull();
    expect(
      check({
        ...f.detail,
        parsed: { ...f.detail.parsed, in_reply_to: ["<other@example.test>"] },
      }),
    ).toBeNull();
    expect(
      check(
        {
          ...f.detail,
          parsed: {
            ...f.detail.parsed,
            in_reply_to: ["<other@example.test>"],
            references: [f.messageId, "<other@example.test>"],
          },
        },
        { ...f.content, subjectMessageId: "<other@example.test>" },
      ),
    ).toBeNull();
    expect(
      check(f.detail, { ...f.content, interactionDomain: "other.test" }),
    ).toBeNull();
    expect(
      check(f.detail, {
        ...f.content,
        expiresAt: new Date(f.now - 1).toISOString(),
      }),
    ).toBeNull();
    expect(
      check(f.detail, {
        ...f.content,
        expiresAt: new Date(f.now + 120_000).toISOString(),
      }),
    ).toBeNull();
    expect(
      check(f.detail, f.content, { ...f.wait, status: "cancelled" }),
    ).toBeNull();
    expect(
      check(f.detail, f.content, { ...f.wait, status: "completed" }),
    ).toBeNull();
    expect(
      check(f.detail, f.content, { ...f.wait, sessionKey: null }),
    ).toBeNull();
  });
  it("deduplicates the exact email and throttles transient refreshes across hook restarts", async () => {
    const f = fixture();
    const configDir = mkdtempSync(join(tmpdir(), "primitive-status-"));
    directories.push(configDir);
    const context = {
      configDir,
      scope: "bound-account",
      recipient: "agent@example.test",
      sessionKey: f.sessionKey,
    };
    const status = boundConversationStatus(
      f.detail,
      f.content,
      f.wait,
      f.messageId,
      f.sessionKey,
      f.now,
    );
    if (!status) throw new Error("fixture");
    expect(await reserveConversationStatus(context, status, f.now)).toBe(true);
    expect(await reserveConversationStatus(context, status, f.now + 9000)).toBe(
      false,
    );
    const throttledId = randomUUID();
    expect(
      await reserveConversationStatus(
        context,
        { ...status, emailId: throttledId },
        f.now + 7000,
      ),
    ).toBe(false);
    expect(
      await reserveConversationStatus(
        context,
        { ...status, emailId: randomUUID() },
        f.now + 9000,
      ),
    ).toBe(true);
    expect(
      await reserveConversationStatus(
        context,
        { ...status, emailId: throttledId },
        f.now + 20_000,
      ),
    ).toBe(false);
    expect(
      await reserveConversationStatus(
        context,
        { ...status, kind: "working", emailId: randomUUID() },
        f.now + 9000,
      ),
    ).toBe(true);
    expect(
      await reserveConversationStatus(
        context,
        { ...status, kind: "read", emailId: randomUUID() },
        f.now + 9001,
      ),
    ).toBe(true);
  });
});
