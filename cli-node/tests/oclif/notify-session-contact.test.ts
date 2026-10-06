import { randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { EmailDetail } from "@primitivedotdev/api-core";
import { afterEach, expect, it, vi } from "vitest";
import {
  CONTACT_POLICY_MAX_AGE_MS,
  createNotificationContactPolicy,
} from "../../src/oclif/notification-contact-policy.js";
import { openSessionNotifications } from "../../src/oclif/notify-session.js";
import { readNotificationReceipts } from "../../src/oclif/notify-session-state.js";
import { isScopedChatReply } from "../../src/oclif/scoped-chat.js";
import { emptyContactPolicy } from "./contact-policy-fixture.js";

const resources: Array<{ close(): void }> = [];
const directories: string[] = [];
afterEach(() => {
  for (const resource of resources.splice(0)) resource.close();
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

const stagingSender = "agent@neutral.primitive-staging.email";
function stagingAuth(): EmailDetail["auth"] {
  return {
    spf: "pass",
    dmarc: "pass",
    dmarcFromDomain: "primitive-staging.email",
    dmarcDkimAligned: true,
    dmarcSpfAligned: true,
    dkimSignatures: [
      {
        domain: "primitive-staging.email",
        selector: "default",
        result: "pass",
        aligned: true,
        keyBits: 2048,
        algo: "rsa-sha256",
      },
    ],
  };
}

async function setup(
  sender = "sender@example.com",
  auth?: EmailDetail["auth"],
) {
  const directory = mkdtempSync(
    join(tmpdir(), "primitive-contact-notification-"),
  );
  directories.push(directory);
  const event = JSON.parse(
    readFileSync(
      new URL(
        "../../../test-fixtures/webhook/valid-email-received.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const recipient = "recipient@domain.com";
  const detail = {
    id: randomUUID(),
    recipient,
    to_email: recipient,
    from_email: sender,
    from_header: sender,
    status: "completed",
    parsed: event.email.parsed,
    auth: auth ?? {
      ...event.email.auth,
      dmarc: "pass",
      dmarcFromDomain: "example.com",
      dmarcDkimAligned: true,
    },
    body_text: event.email.parsed.body_text,
    body_html: event.email.parsed.body_html,
    received_at: "2026-09-01T10:01:00.000Z",
  } as EmailDetail;
  let enabled = true;
  let clock = 0;
  let preflightDelay = 0;
  const generation = randomUUID();
  const policy = createNotificationContactPolicy({
    readPolicy: async () => emptyContactPolicy(recipient),
    recipient,
    now: () => clock,
    readPage: async () => ({
      cursor: null,
      data: [
        {
          agent_address: recipient,
          contact_address: sender,
          notify: enabled,
          notify_since: enabled ? "2026-09-01T10:00:00.000Z" : null,
          notification_generation: enabled ? generation : null,
          version: randomUUID(),
        },
      ],
    }),
  });
  const signal = new AbortController().signal;
  const admission = await policy.admit(sender, detail.received_at, signal);
  if (!admission) throw new Error("Expected contact admission");
  const dispatch = vi.fn();
  const queue = vi.fn(
    async (_text: string, _id: string, beforeDispatch: () => void) => {
      clock += preflightDelay;
      beforeDispatch();
      dispatch();
    },
  );
  const threadId = randomUUID();
  const notifications = await openSessionNotifications({
    configDir: directory,
    scope: "contact-policy-fixture",
    threadId,
    senders: [],
    contactPreferences: true,
    signal,
    connect: async () => ({ queue, close() {} }),
  });
  notifications.bindRecipient(recipient);
  resources.push(notifications);
  const authorize = {
    sender,
    recheck: (nextSignal: AbortSignal) => policy.recheck(admission, nextSignal),
  };
  const eventId = randomUUID();
  return {
    detail,
    notifications,
    signal,
    queue,
    dispatch,
    eventId,
    authorize,
    disable: () => {
      enabled = false;
    },
    delay: (ms: number) => {
      preflightDelay = ms;
    },
    handle: () =>
      notifications.handleDetail(detail, eventId, signal, authorize),
    receipts: () =>
      readNotificationReceipts(directory, "contact-policy-fixture", threadId),
  };
}

it("accepts a currently authorized contact once and retains ordinary receipt deduplication", async () => {
  const f = await setup();
  expect(await f.handle()).toEqual({ disposition: "notified" });
  expect(await f.handle()).toEqual({ disposition: "notified" });
  expect(f.dispatch).toHaveBeenCalledOnce();
  expect(f.receipts()).toMatchObject([{ state: "accepted" }]);
});

it.each([false, true])(
  "authenticates managed staging mail through scoped reply and native policy paths (request: %s)",
  async (contactRequest) => {
    const f = await setup(stagingSender, stagingAuth());
    const sentId = randomUUID();
    f.detail.reply_to_sent_email_id = sentId;
    const scope = {
      from: f.detail.recipient,
      recipient: stagingSender,
      sentId,
    };
    expect(isScopedChatReply(f.detail, scope)).toBe(true);
    expect(
      isScopedChatReply(f.detail, {
        ...scope,
        recipient: "other@neutral.primitive-staging.email",
      }),
    ).toBe(false);
    expect(
      isScopedChatReply(f.detail, { ...scope, sentId: randomUUID() }),
    ).toBe(false);
    const authorize = { ...f.authorize, contactRequest, reserve: () => true };
    expect(
      await f.notifications.handleDetail(
        f.detail,
        f.eventId,
        f.signal,
        authorize,
      ),
    ).toEqual({ disposition: "notified" });
    expect(
      await f.notifications.handleDetail(
        f.detail,
        f.eventId,
        f.signal,
        authorize,
      ),
    ).toEqual({ disposition: "notified" });
    expect(f.dispatch).toHaveBeenCalledOnce();
    expect(f.receipts()).toMatchObject([{ state: "accepted" }]);
    expect(f.queue.mock.calls[0]?.[0]).toContain(stagingSender);
    expect(f.queue.mock.calls[0]?.[0].includes("first-contact request")).toBe(
      contactRequest,
    );
  },
);

it.each([
  { contactRequest: false, mismatch: "sender" },
  { contactRequest: true, mismatch: "sender" },
  { contactRequest: false, mismatch: "signer" },
  { contactRequest: true, mismatch: "signer" },
])(
  "rejects managed staging $mismatch mismatch before native dispatch (request: $contactRequest)",
  async ({ contactRequest, mismatch }) => {
    const auth = stagingAuth();
    if (mismatch === "signer")
      auth.dkimSignatures[0].domain = "primitive.email";
    const f = await setup(stagingSender, auth);
    if (mismatch === "sender")
      f.detail.from_header = "other@neutral.primitive-staging.email";
    expect(
      isScopedChatReply(f.detail, {
        from: f.detail.recipient,
        recipient: stagingSender,
      }),
    ).toBe(false);
    expect(
      await f.notifications.handleDetail(f.detail, f.eventId, f.signal, {
        ...f.authorize,
        contactRequest,
        reserve: () => true,
      }),
    ).toEqual({ disposition: "skipped" });
    expect(f.queue).not.toHaveBeenCalled();
    expect(f.receipts()).toEqual([]);
  },
);

it("does not queue or create a submitting receipt after notification is disabled", async () => {
  const f = await setup();
  f.disable();
  await expect(f.handle()).rejects.toThrow("changed or expired");
  expect(f.queue).not.toHaveBeenCalled();
  expect(f.receipts()).toEqual([]);
});

it("checks freshness after native preflight and before creating the durable receipt", async () => {
  const f = await setup();
  f.delay(CONTACT_POLICY_MAX_AGE_MS);
  await expect(f.handle()).rejects.toThrow("changed or expired");
  expect(f.queue).toHaveBeenCalledOnce();
  expect(f.dispatch).not.toHaveBeenCalled();
  expect(f.receipts()).toEqual([]);
});

it("cannot bypass contact policy by omitting per-detail authorization", async () => {
  const f = await setup();
  await expect(
    f.notifications.handleDetail(f.detail, f.eventId, f.signal),
  ).rejects.toThrow("authorization is missing");
  expect(f.queue).not.toHaveBeenCalled();
  expect(f.receipts()).toEqual([]);
});

it("settles suppressed first-contact admission before the durable native receipt and queue write", async () => {
  const f = await setup();
  const reserve = vi.fn(() => false);
  expect(
    await f.notifications.handleDetail(f.detail, f.eventId, f.signal, {
      sender: "sender@example.com",
      contactRequest: true,
      recheck: async () => () => {},
      reserve,
    }),
  ).toEqual({ disposition: "skipped" });
  expect(reserve).toHaveBeenCalledOnce();
  expect(f.dispatch).not.toHaveBeenCalled();
  expect(f.receipts()).toEqual([]);
});

it("tells the agent to read owner or member mail with --no-signal when it will not act", async () => {
  for (const senderRelation of ["owner", "member"] as const) {
    const f = await setup();
    await f.notifications.handleDetail(f.detail, f.eventId, f.signal, {
      sender: "sender@example.com",
      senderRelation,
      recheck: async () => () => {},
    });
    expect(f.queue.mock.calls[0]?.[0]).toContain(
      "If you will not act on it, add --no-signal to that read command.",
    );
  }
  // A contact gets no automatic working report, so no hint.
  const f = await setup();
  await f.handle();
  expect(f.queue.mock.calls[0]?.[0]).not.toContain("--no-signal");
});

it("queues only IDs and sender for a request, with no request body or private-context grant", async () => {
  const f = await setup();
  f.detail.body_text =
    "External request reason must not enter the native queue";
  await f.notifications.handleDetail(f.detail, f.eventId, f.signal, {
    sender: "sender@example.com",
    contactRequest: true,
    recheck: async () => () => {},
    reserve: () => true,
  });
  const text = f.queue.mock.calls[0]?.[0];
  expect(text).toContain("first-contact request");
  expect(text).toContain(f.detail.id);
  expect(text).toContain(
    "No contact relationship, task permission, private history, or tool authority",
  );
  expect(text).not.toContain(f.detail.body_text);
});

it("defers capacity-limited requests without creating a native receipt or dispatching", async () => {
  const f = await setup();
  expect(
    await f.notifications.handleDetail(f.detail, f.eventId, f.signal, {
      sender: "sender@example.com",
      contactRequest: true,
      recheck: async () => () => {},
      reserve: () => "deferred",
    }),
  ).toEqual({ disposition: "deferred" });
  expect(f.dispatch).not.toHaveBeenCalled();
  expect(f.receipts()).toEqual([]);
});
