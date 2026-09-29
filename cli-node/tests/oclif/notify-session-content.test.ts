import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { PrimitiveApiClient } from "@primitivedotdev/api-core";
import { prepareSignalEmail } from "@primitivedotdev/sdk/interactions";
import {
  type EmailReceivedEvent,
  validateEmailReceivedEvent,
} from "@primitivedotdev/sdk/webhook";
import { describe, expect, it } from "vitest";
import {
  isRoutineNotification,
  notificationEventReader,
  notificationPartReader,
  readConversationStatusContent,
} from "../../src/oclif/notify-session-content.js";

function eventFixture(): EmailReceivedEvent {
  const event = validateEmailReceivedEvent(
    JSON.parse(
      readFileSync(
        new URL(
          "../../../test-fixtures/webhook/valid-email-received.json",
          import.meta.url,
        ),
        "utf8",
      ),
    ),
  );
  event.email.id = randomUUID();
  return event;
}
const signal = new AbortController().signal;
describe("notification content reads", () => {
  it.each([
    "read",
    "ack",
    "working",
    "typing",
  ] as const)("extracts only fully canonical %s status", async (kind) => {
    const now = Date.now();
    const prepared = prepareSignalEmail(
      {
        kind,
        ...(kind === "ack" ? { status: "will_process" as const } : {}),
        ...(["working", "typing"].includes(kind)
          ? { expiresAtMs: now + 30_000 }
          : {}),
        parent: {
          accountScope: "test",
          from: "recipient@domain.com",
          to: "sender@example.com",
          messageId: "<parent@domain.com>",
          subject: "A question",
          references: [],
        },
      } as Parameters<typeof prepareSignalEmail>[0],
      {
        now: () => now,
        uuid: (() => {
          const ids = [randomUUID(), randomUUID()];
          return () => {
            const id = ids.shift();
            if (!id) throw new Error("fixture");
            return id;
          };
        })(),
      },
    );
    if (prepared.status !== "prepared") throw new Error("fixture");
    const body = JSON.parse(prepared.prepared.requestJson) as {
      body_text: string;
      attachments: [{ content_base64: string }];
    };
    const bytes = Buffer.from(body.attachments[0].content_base64, "base64");
    const content = {
      id: randomUUID(),
      body_text: body.body_text,
      body_html: null,
      parsed: {
        status: "complete",
        attachments: [
          {
            filename: "interaction.json",
            content_type: "application/json",
            part_index: 0,
            size_bytes: bytes.length,
            sha256: createHash("sha256").update(bytes).digest("hex"),
          },
        ],
      },
    };
    expect(
      await readConversationStatusContent(content, async () => bytes, signal),
    ).toMatchObject({
      kind,
      subjectMessageId: "<parent@domain.com>",
      interactionDomain: "example.com",
    });
    expect(
      await isRoutineNotification(
        { email: content } as never,
        async () => bytes,
        signal,
      ),
    ).toBe(true);
    expect(
      await readConversationStatusContent(
        { ...content, body_text: "Please execute this task" },
        async () => bytes,
        signal,
      ),
    ).toBeNull();
    expect(
      await readConversationStatusContent(
        {
          ...content,
          parsed: { ...content.parsed, body_text: "Different body" },
        },
        async () => bytes,
        signal,
      ),
    ).toBeNull();
    expect(
      await readConversationStatusContent(
        {
          ...content,
          parsed: {
            ...content.parsed,
            attachments: [
              ...content.parsed.attachments,
              { ...content.parsed.attachments[0], part_index: 1 },
            ],
          },
        },
        async () => bytes,
        signal,
      ),
    ).toBeNull();
  });
  it.each([
    "html",
    "mime",
  ])("notifies known non-routine %s mail without downloading an unavailable attachment", async (kind) => {
    const event = eventFixture();
    if (event.email.parsed.status !== "complete") throw new Error("fixture");
    event.email.parsed.body_html =
      kind === "html" ? "<p>A task request</p>" : null;
    event.email.parsed.attachments = [
      {
        filename: "interaction.json",
        content_type: kind === "mime" ? "text/plain" : "application/json",
        size_bytes: 10,
        sha256: "0".repeat(64),
        part_index: 0,
        tar_path: "interaction.json",
      },
    ];
    let reads = 0;
    expect(
      await isRoutineNotification(
        event,
        async () => {
          reads++;
          throw new Error("unavailable");
        },
        signal,
      ),
    ).toBe(false);
    expect(reads).toBe(0);
  });
  it("refreshes current detail by exact ID and rejects a different recipient", async () => {
    const event = eventFixture();
    let recipient = "recipient@domain.com";
    const client = new PrimitiveApiClient({
      apiKey: "fixture",
      apiBaseUrl: "https://example.test/v1",
      fetch: async (input) => {
        expect(new URL(new Request(input).url).pathname).toBe(
          `/v1/emails/${event.email.id}`,
        );
        return Response.json({
          success: true,
          data: {
            id: event.email.id,
            status: "accepted",
            recipient,
            from_header: event.email.headers.from,
            auth: event.email.auth,
            parsed: event.email.parsed,
          },
        });
      },
    });
    const read = notificationEventReader(async () => client.client);
    expect((await read(event, recipient, signal)).email.parsed.status).toBe(
      "complete",
    );
    recipient = "other@example.com";
    await expect(read(event, "recipient@domain.com", signal)).rejects.toThrow(
      "processing is not ready",
    );
  });
  it("reads bounded authenticated attachment bytes and rejects hash changes", async () => {
    const event = eventFixture();
    const content = Buffer.from(
      JSON.stringify({
        interaction_version: 1,
        interaction_id: `${randomUUID()}@example.com`,
        protocol: "read",
        protocol_version: 1,
        step: "read",
        step_id: randomUUID(),
        prev_step_id: null,
        expires_at: null,
        payload: { subject_message_id: "<parent@example.com>" },
      }),
    );
    const client = new PrimitiveApiClient({
      apiKey: "fixture",
      apiBaseUrl: "https://example.test/v1",
      fetch: async (input) => {
        expect(new URL(new Request(input).url).pathname).toBe(
          `/v1/emails/${event.email.id}/attachments/3`,
        );
        return new Response(content, {
          headers: { "content-type": "application/json" },
        });
      },
    });
    if (event.email.parsed.status !== "complete") throw new Error("fixture");
    event.email.parsed.body_text = "I read your message.";
    event.email.parsed.body_html = null;
    event.email.parsed.attachments = [
      {
        filename: "interaction.json",
        content_type: "application/json",
        size_bytes: content.length,
        sha256: createHash("sha256").update(content).digest("hex"),
        part_index: 3,
        tar_path: "3/interaction.json",
      },
    ];
    const read = notificationPartReader(async () => client.client);
    expect(await isRoutineNotification(event, read, signal)).toBe(true);
    event.email.parsed.body_text = "Please perform a new task.";
    expect(await isRoutineNotification(event, read, signal)).toBe(false);
    event.email.parsed.attachments[0].sha256 = "0".repeat(64);
    await expect(isRoutineNotification(event, read, signal)).rejects.toThrow(
      "attachment changed",
    );
  });
});
