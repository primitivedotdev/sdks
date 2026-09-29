import { randomUUID } from "node:crypto";
import {
  mkdtempSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { EmailDetail } from "@primitivedotdev/api-core";
import { afterEach, describe, expect, it } from "vitest";
import {
  followEmailConversation,
  readConversationFollow,
} from "../../src/oclif/conversation-follow.js";
import { openSharedMailStore } from "../../src/oclif/shared-mail-state.js";

const directories: string[] = [];
afterEach(() => {
  for (const dir of directories.splice(0))
    rmSync(dir, { recursive: true, force: true });
});
function fixture() {
  const configDir = mkdtempSync(join(tmpdir(), "conversation-follow-"));
  directories.push(configDir);
  const context = {
    configDir,
    scope: "credential-and-origin",
    recipient: "agent@example.com",
    peer: "peer@example.net",
    sessionKey: `codex:${randomUUID()}`,
    since: new Date().toISOString(),
  };
  const detail: EmailDetail = {
    id: randomUUID(),
    thread_id: randomUUID(),
    sender: context.peer,
    recipient: context.recipient,
    to_email: context.recipient,
    from_email: context.peer,
    sender_connected_agent_verified: false,
    from_header: context.peer,
    domain: "example.com",
    status: "completed",
    received_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    replies: [],
    webhook_attempt_count: 0,
    body_text: "I need owner approval first.",
    parsed: { status: "complete", attachments: [] },
    auth: {
      dmarc: "pass",
      dmarcFromDomain: "example.net",
      dmarcDkimAligned: true,
      dmarcSpfAligned: true,
      spf: "pass",
      dkimSignatures: [],
    },
  };
  return { context, detail, threadId: detail.thread_id as string };
}

describe("durable native conversation following", () => {
  it("retains an exact Claude session for follow-up mail", async () => {
    const f = fixture();
    const context = { ...f.context, sessionKey: `claude:${randomUUID()}` };
    const saved = await followEmailConversation(context, f.detail);
    expect(readConversationFollow(context, f.threadId)).toEqual(saved);
  });
  it("retains authenticated peer, exact session and initial arrival across repeated replies and restarts", async () => {
    const f = fixture();
    const saved = await followEmailConversation(f.context, f.detail);
    expect(saved).toMatchObject({
      threadId: f.threadId,
      peer: f.context.peer,
      sessionKey: f.context.sessionKey,
      since: f.context.since,
    });
    expect(
      await followEmailConversation(f.context, {
        ...f.detail,
        id: randomUUID(),
        reply_to_sent_email_id: randomUUID(),
        received_at: new Date(Date.now() + 1000).toISOString(),
      }),
    ).toEqual(saved);
    expect(readConversationFollow(f.context, f.threadId)).toEqual(saved);
    expect(
      readConversationFollow(
        { ...f.context, scope: "another-credential" },
        f.threadId,
      ),
    ).toBeNull();
    expect(
      readConversationFollow(
        { ...f.context, recipient: "other@example.com" },
        f.threadId,
      ),
    ).toBeNull();
    const parent = join(f.context.configDir, "conversation-follows");
    const dir = join(parent, readdirSync(parent)[0]);
    expect(statSync(dir).mode & 0o077).toBe(0);
    expect(statSync(join(dir, `${f.threadId}.json`)).mode & 0o077).toBe(0);
  });
  it("gives concurrent competing sessions one owner without replacing identity", async () => {
    const f = fixture();
    const results = await Promise.allSettled([
      followEmailConversation(f.context, f.detail),
      followEmailConversation(
        { ...f.context, sessionKey: `codex:${randomUUID()}` },
        f.detail,
      ),
    ]);
    expect(results.filter((row) => row.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((row) => row.status === "rejected")).toHaveLength(1);
  });
  it.each([
    "sender",
    "recipient",
    "authentication",
  ])("cannot learn from mismatched %s evidence", async (caseName) => {
    const f = fixture();
    if (caseName === "sender") f.detail.from_header = "someone@example.net";
    if (caseName === "recipient") f.detail.to_email = "someone@example.com";
    if (caseName === "authentication")
      f.detail.auth = { ...f.detail.auth, dmarc: "fail" };
    await expect(followEmailConversation(f.context, f.detail)).rejects.toThrow(
      "authenticated",
    );
    expect(readConversationFollow(f.context, f.threadId)).toBeNull();
  });
  it("does not infer a missing thread from references or turn contact interactions into follows", async () => {
    const f = fixture();
    expect(
      await followEmailConversation(f.context, {
        ...f.detail,
        thread_id: null,
        parsed: { ...f.detail.parsed, references: ["<original@example.net>"] },
      }),
    ).toBeNull();
    expect(
      await followEmailConversation(f.context, {
        ...f.detail,
        parsed: {
          status: "complete",
          attachments: [
            {
              filename: "interaction.json",
              content_type: "application/json",
              size_bytes: 10,
            },
          ],
        },
      }),
    ).toBeNull();
    expect(readConversationFollow(f.context, f.threadId)).toBeNull();
  });
  it("rejects corrupted ownership rather than resetting it", async () => {
    const f = fixture();
    await followEmailConversation(f.context, f.detail);
    const parent = join(f.context.configDir, "conversation-follows");
    const dir = join(parent, readdirSync(parent)[0]);
    writeFileSync(join(dir, `${f.threadId}.json`), "{}", { mode: 0o600 });
    await expect(followEmailConversation(f.context, f.detail)).rejects.toThrow(
      "inconsistent",
    );
  });
  it("starting a follow from an old email uses the current registration cutoff", async () => {
    const f = fixture();
    f.detail.received_at = "2020-01-01T00:00:00.000Z";
    const started = Date.now();
    const followed = await followEmailConversation(
      { ...f.context, since: undefined },
      f.detail,
    );
    expect(Date.parse(followed?.since ?? "")).toBeGreaterThanOrEqual(started);
  });
  it("protects changed-parent replies atomically without creating an uncertain peer hold", async () => {
    const f = fixture();
    await followEmailConversation(f.context, f.detail);
    const store = await openSharedMailStore(f.context);
    const emailId = randomUUID();
    await store.ingest({
      emailId,
      eventId: randomUUID(),
      receivedAt: f.detail.received_at,
    });
    await store.hydrate(emailId, {
      recipient: f.context.recipient,
      peer: f.context.peer,
      threadId: f.threadId,
      replyToSentEmailId: randomUUID(),
      receivedAt: f.detail.received_at,
      authorization: "trusted",
    });
    expect(
      (await store.claimForNotification(emailId, `codex:${randomUUID()}`))
        .status,
    ).toBe("held");
    expect(
      (await store.claimForNotification(emailId, f.context.sessionKey)).status,
    ).toBe("claimed");
    expect(await store.findWaitByParent(randomUUID())).toBeNull();
    // Hydration by an older consumer can omit the thread but cannot change it.
    await store.hydrate(emailId, {
      recipient: f.context.recipient,
      peer: f.context.peer,
      replyToSentEmailId:
        (await store.readEmail(emailId))?.details?.replyToSentEmailId ?? null,
      receivedAt: f.detail.received_at,
      authorization: "trusted",
    });
    expect((await store.readEmail(emailId))?.details?.threadId).toBe(
      f.threadId,
    );
  });
});
