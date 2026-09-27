import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { PrimitiveApiClient } from "@primitivedotdev/api-core";
import {
  type EmailReceivedEvent,
  validateEmailReceivedEvent,
} from "@primitivedotdev/sdk/webhook";
import { describe, expect, it } from "vitest";
import {
  isRoutineNotification,
  notificationEventReader,
  notificationPartReader,
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
