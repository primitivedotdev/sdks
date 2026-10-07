import { randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { EmailDetail } from "@primitivedotdev/api-core";
import { afterEach, expect, it, vi } from "vitest";
import { openSessionNotifications } from "../../src/oclif/notify-session.js";
import type { WakeContext } from "../../src/oclif/wake-context.js";

const directories: string[] = [];
const resources: Array<{ close(): void }> = [];
afterEach(() => {
  for (const resource of resources.splice(0)) resource.close();
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

async function setup(
  describe?: () => Promise<WakeContext | undefined>,
  profileName?: string,
) {
  const directory = mkdtempSync(join(tmpdir(), "primitive-notify-context-"));
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
  const sender = "sender@example.com";
  const detail = {
    id: randomUUID(),
    recipient,
    to_email: recipient,
    from_email: sender,
    from_header: sender,
    status: "completed",
    subject: "Secret subject text",
    parsed: event.email.parsed,
    auth: event.email.auth,
    body_text: "Secret body text",
    received_at: "2026-09-01T10:01:00.000Z",
  } as EmailDetail;
  const queue = vi.fn(
    async (_text: string, _id: string, beforeDispatch: () => void) => {
      beforeDispatch();
    },
  );
  const notifications = await openSessionNotifications({
    configDir: directory,
    scope: "wake-context-fixture",
    threadId: randomUUID(),
    senders: [sender],
    signal: new AbortController().signal,
    connect: async () => ({ queue, close() {} }),
    readPart: async () => new Uint8Array(),
    ...(describe ? { describe: vi.fn(describe) } : {}),
    ...(profileName ? { profileName } : {}),
  });
  notifications.bindRecipient(recipient);
  resources.push(notifications);
  return { detail, notifications, queue };
}

it("adds server-derived wake metadata and the --context read command", async () => {
  const thread = "44444444-4444-4444-8444-444444444444";
  const f = await setup(async () => ({
    sender: "sender@example.com",
    relationship: "contact",
    threadId: thread,
    inThread: false,
    attachments: true,
    newer: 3,
  }));
  expect(
    await f.notifications.handleDetail(
      f.detail,
      randomUUID(),
      new AbortController().signal,
    ),
  ).toEqual({ disposition: "notified" });
  const text = String(f.queue.mock.calls[0]?.[0]);
  const payload = JSON.parse(
    text.split("\n").find((line) => line.startsWith("{")) ?? "{}",
  );
  expect(payload).toMatchObject({
    email_id: f.detail.id,
    sender: "sender@example.com",
    relationship: "contact",
    thread_id: thread,
    in_thread: false,
    attachments: true,
    newer_inbound_count: 3,
  });
  expect(text).toContain(`primitive emails get --id ${f.detail.id} --context`);
  expect(text).not.toContain("Secret subject text");
  expect(text).not.toContain("Secret body text");
});

it("omits metadata it does not have instead of failing the notification", async () => {
  const f = await setup(async () => undefined);
  await f.notifications.handleDetail(
    f.detail,
    randomUUID(),
    new AbortController().signal,
  );
  const text = String(f.queue.mock.calls[0]?.[0]);
  const payload = JSON.parse(
    text.split("\n").find((line) => line.startsWith("{")) ?? "{}",
  );
  expect(payload).not.toHaveProperty("relationship");
  expect(payload).not.toHaveProperty("newer_inbound_count");
});

it("names a server-classified interaction in the wake", async () => {
  const f = await setup(async () => ({
    sender: "sender@example.com",
    relationship: "contact",
    threadId: null,
    inThread: false,
    attachments: true,
    interaction: "x402.payment/1",
  }));
  await f.notifications.handleDetail(
    f.detail,
    randomUUID(),
    new AbortController().signal,
  );
  const text = String(f.queue.mock.calls[0]?.[0]);
  const payload = JSON.parse(
    text.split("\n").find((line) => line.startsWith("{")) ?? "{}",
  );
  expect(payload.interaction).toBe("x402.payment/1");
  expect(text).toContain(
    "Primitive classifies this email as x402.payment/1. It is an interaction a plain reply does not complete; that read names the command that answers it.",
  );
});

it("says fyi mail needs no reply in the wake", async () => {
  const f = await setup(async () => ({
    sender: "sender@example.com",
    relationship: "contact",
    threadId: null,
    inThread: false,
    attachments: false,
    interaction: "fyi",
  }));
  await f.notifications.handleDetail(
    f.detail,
    randomUUID(),
    new AbortController().signal,
  );
  const text = String(f.queue.mock.calls[0]?.[0]);
  expect(text).toContain(
    "Primitive classifies this email as fyi. It needs no reply.",
  );
});

it("says a repeat-stopped notice needs no reply, like the brief", async () => {
  const f = await setup(async () => ({
    sender: "sender@example.com",
    relationship: "contact",
    threadId: null,
    inThread: false,
    attachments: true,
    interaction: "repeat.stop/1",
  }));
  await f.notifications.handleDetail(
    f.detail,
    randomUUID(),
    new AbortController().signal,
  );
  const text = String(f.queue.mock.calls[0]?.[0]);
  expect(text).toContain(
    "Primitive classifies this email as repeat.stop/1. It needs no reply.",
  );
  expect(text).not.toContain("names the command");
});

it("names the receiving address and selects its profile in the read command", async () => {
  // A session can carry several connected profiles; an email is readable
  // only under the one that received it.
  const f = await setup(async () => undefined, "session-work");
  await f.notifications.handleDetail(
    f.detail,
    randomUUID(),
    new AbortController().signal,
  );
  const text = String(f.queue.mock.calls[0]?.[0]);
  const payload = JSON.parse(
    text.split("\n").find((line) => line.startsWith("{")) ?? "{}",
  );
  expect(payload).toMatchObject({
    to: "recipient@domain.com",
    profile: "session-work",
  });
  expect(text).toContain(
    `Inspect only when relevant: PRIMITIVE_AGENT_PROFILE=session-work primitive emails get --id ${f.detail.id} --context`,
  );
});

it("names the receiving address even without a profile name", async () => {
  const f = await setup(async () => undefined);
  await f.notifications.handleDetail(
    f.detail,
    randomUUID(),
    new AbortController().signal,
  );
  const text = String(f.queue.mock.calls[0]?.[0]);
  const payload = JSON.parse(
    text.split("\n").find((line) => line.startsWith("{")) ?? "{}",
  );
  expect(payload.to).toBe("recipient@domain.com");
  expect(payload).not.toHaveProperty("profile");
});
