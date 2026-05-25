import type { EmailDetail, SendMailResult } from "@primitivedotdev/api-core";
import { describe, expect, it } from "vitest";
import ChatCommand, {
  buildChatFollowUpCommands,
  buildChatJsonEnvelope,
  ChatProgressIndicator,
  formatChatResponse,
} from "../../src/oclif/commands/chat.js";
import { COMMANDS } from "../../src/oclif/index.js";

function sentEmail(overrides: Partial<SendMailResult> = {}): SendMailResult {
  return {
    accepted: ["help@agent.example"],
    client_idempotency_key: "chat-test",
    content_hash: "sha256:test",
    delivery_status: "delivered",
    id: "sent-1",
    idempotent_replay: false,
    from: "agent@sender.example",
    queue_id: "queue-1",
    rejected: [],
    request_id: "req-1",
    status: "delivered",
    ...overrides,
  };
}

function replyEmail(overrides: Partial<EmailDetail> = {}): EmailDetail {
  return {
    body_html: null,
    body_text: "Rotate your API key from the dashboard.",
    created_at: "2026-05-25T00:00:02.000Z",
    domain: "agent.example",
    from_email: "help@agent.example",
    id: "email-1",
    message_id: "<reply-1@agent.example>",
    recipient: "agent@sender.example",
    received_at: "2026-05-25T00:00:02.000Z",
    replies: [],
    sender: "help@agent.example",
    status: "accepted",
    subject: "Re: API key help",
    to_email: "agent@sender.example",
    webhook_attempt_count: 1,
    webhook_status: "fired",
    ...overrides,
  };
}

function outputContext() {
  return {
    from: "agent@sender.example",
    matchStrategy: "strict" as const,
    recipient: "help@agent.example",
    reply: replyEmail(),
    sent: sentEmail(),
    subject: "API key help",
    timeoutSeconds: 120,
  };
}

describe("chat command", () => {
  it("registers the first-party chat command", () => {
    expect(COMMANDS.chat).toBe(ChatCommand);
  });

  it("keeps JSON mode explicit", () => {
    const flags = ChatCommand.flags as Record<string, unknown>;

    expect(flags.json).toBeDefined();
  });

  it("formats a reply with context and follow-up commands by default", () => {
    const output = formatChatResponse(outputContext());

    expect(output).toContain("Reply received");
    expect(output).toContain("Sent email id: sent-1");
    expect(output).toContain("Email id: email-1");
    expect(output).toContain("Response\nRotate your API key");
    expect(output).toContain("Helpful follow-up commands");
    expect(output).toContain("primitive chat help@agent.example '<message>'");
    expect(output).toContain("primitive reply --id email-1 --body '<message>'");
    expect(output).not.toBe("Rotate your API key from the dashboard.\n");
  });

  it("includes follow-up commands in JSON mode without changing stdout shape to prose", () => {
    const envelope = buildChatJsonEnvelope(outputContext());

    expect(envelope.sent.id).toBe("sent-1");
    expect(envelope.reply.id).toBe("email-1");
    expect(envelope.match.strategy).toBe("strict");
    expect(envelope.follow_up_commands.map((entry) => entry.command)).toContain(
      "primitive emails get --id email-1",
    );
  });

  it("quotes shell-sensitive follow-up command values", () => {
    const commands = buildChatFollowUpCommands({
      ...outputContext(),
      recipient: "agent support@example.com",
      subject: "quoted ' subject",
    }).map((entry) => entry.command);

    expect(commands[0]).toContain("'agent support@example.com'");
    expect(commands[0]).toContain("'quoted '\\'' subject'");
  });

  it("writes non-TTY progress lines while waiting", () => {
    const writes: string[] = [];
    const progress = new ChatProgressIndicator(
      {
        isTTY: false,
        write(chunk: string) {
          writes.push(chunk);
        },
      },
      () => 0,
    );

    progress.start("Sending message to help@agent.example");
    progress.update("Message sent; waiting for reply from help@agent.example");
    progress.succeed("Reply received from help@agent.example");

    expect(writes.join("")).toContain("Sending message");
    expect(writes.join("")).toContain("waiting for reply");
    expect(writes.join("")).toContain("Reply received");
  });
});
