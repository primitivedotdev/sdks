import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { EmailDetail, SendMailResult } from "@primitivedotdev/api-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAuthenticatedCliApiClient: vi.fn(),
  fetchEmailSearchPage: vi.fn(),
  getEmail: vi.fn(),
  pickDefaultFromAddress: vi.fn(),
  replyToEmail: vi.fn(),
  searchEmails: vi.fn(),
  sendEmail: vi.fn(),
  sleep: vi.fn(),
}));

vi.mock("@primitivedotdev/api-core", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@primitivedotdev/api-core")>();
  return {
    ...actual,
    getEmail: mocks.getEmail,
    replyToEmail: mocks.replyToEmail,
    searchEmails: mocks.searchEmails,
    sendEmail: mocks.sendEmail,
  };
});

vi.mock("../../src/oclif/api-client.js", () => ({
  createAuthenticatedCliApiClient: mocks.createAuthenticatedCliApiClient,
}));

vi.mock("../../src/oclif/outbound-defaults.js", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("../../src/oclif/outbound-defaults.js")
    >();
  return {
    ...actual,
    pickDefaultFromAddress: mocks.pickDefaultFromAddress,
  };
});

vi.mock("../../src/oclif/commands/emails-poll.js", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("../../src/oclif/commands/emails-poll.js")
    >();
  return {
    ...actual,
    fetchEmailSearchPage: mocks.fetchEmailSearchPage,
    sleep: mocks.sleep,
  };
});

import {
  chatStatePath,
  saveActiveChatState,
} from "../../src/oclif/chat-state.js";
import ChatCommand, {
  buildChatFollowUpCommands,
  buildChatJsonEnvelope,
  buildChatRecoveryCommands,
  ChatProgressIndicator,
  ChatReplyCommand,
  formatChatRecoveryContext,
  formatChatResponse,
  resolveChatResponseBody,
} from "../../src/oclif/commands/chat.js";
import { COMMANDS } from "../../src/oclif/index.js";

const CLI_ROOT = resolve(import.meta.dirname, "../..");
let tempConfigHome: string;
let previousXdgConfigHome: string | undefined;

function testConfigDir(): string {
  return join(tempConfigHome, "primitive");
}

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
    reply_to_sent_email_id: "sent-1",
    replies: [],
    sender: "help@agent.example",
    status: "accepted",
    subject: "Re: API key help",
    thread_id: "thread-1",
    to_email: "agent@sender.example",
    webhook_attempt_count: 1,
    webhook_status: "fired",
    parsed: {
      status: "complete",
      body_text: "Rotate your API key from the dashboard.",
      body_html: null,
      reply_to: null,
      cc: null,
      bcc: null,
      to_addresses: null,
      in_reply_to: null,
      references: null,
      attachments: [],
    },
    auth: {
      spf: "pass",
      dmarc: "pass",
      dmarcPolicy: null,
      dmarcFromDomain: null,
      dmarcSpfAligned: true,
      dmarcDkimAligned: true,
      dmarcSpfStrict: null,
      dmarcDkimStrict: null,
      dkimSignatures: [],
    },
    ...overrides,
  };
}

function outputContext() {
  return {
    from: "agent@sender.example",
    json: false,
    matchStrategy: "strict" as const,
    quiet: false,
    recipient: "help@agent.example",
    reply: replyEmail(),
    sent: sentEmail(),
    sentAtIso: "2026-05-25T00:00:00.000Z",
    strictOnly: false,
    strictPhaseSeconds: 60,
    subject: "API key help",
    timeoutSeconds: 120,
    localChatId: 0,
  };
}

function searchRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "email-1",
    received_at: "2026-05-25T00:00:02.000Z",
    status: "accepted",
    ...overrides,
  };
}

async function runOclifCommand(
  command: typeof ChatCommand | typeof ChatReplyCommand,
  argv: string[],
): Promise<{
  exitCode: NodeJS.Process["exitCode"];
  stderr: string;
  stdout: string;
}> {
  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];
  const previousExitCode = process.exitCode;
  process.exitCode = undefined;
  const logSpy = vi.spyOn(console, "log").mockImplementation((message = "") => {
    stdoutChunks.push(`${String(message)}\n`);
  });
  const stderrSpy = vi
    .spyOn(process.stderr, "write")
    .mockImplementation((chunk: unknown) => {
      stderrChunks.push(String(chunk));
      return true;
    });

  try {
    await command.run(argv, { root: CLI_ROOT });
    return {
      exitCode: process.exitCode,
      stderr: stderrChunks.join(""),
      stdout: stdoutChunks.join(""),
    };
  } finally {
    logSpy.mockRestore();
    stderrSpy.mockRestore();
    process.exitCode = previousExitCode;
  }
}

async function runChatCommand(
  argv: string[],
): ReturnType<typeof runOclifCommand> {
  return runOclifCommand(ChatCommand, argv);
}

async function runChatReplyCommand(
  argv: string[],
): ReturnType<typeof runOclifCommand> {
  return runOclifCommand(ChatReplyCommand, argv);
}

describe("chat command", () => {
  beforeEach(() => {
    previousXdgConfigHome = process.env.XDG_CONFIG_HOME;
    tempConfigHome = mkdtempSync(join(tmpdir(), "primitive-chat-test-"));
    process.env.XDG_CONFIG_HOME = tempConfigHome;
    vi.clearAllMocks();
    mocks.createAuthenticatedCliApiClient.mockResolvedValue({
      apiClient: { _sendClient: {}, client: {} },
      auth: { kind: "api-key" },
      baseUrlOverridden: false,
    });
    mocks.pickDefaultFromAddress.mockResolvedValue("agent@sender.example");
    mocks.replyToEmail.mockResolvedValue({
      data: { data: sentEmail({ id: "sent-reply-1" }) },
    });
    mocks.searchEmails.mockResolvedValue({
      data: {
        data: [searchRow()],
        meta: {
          cursor: null,
          limit: 50,
          sort: "received_at_desc",
          total: 1,
          total_capped: false,
        },
      },
    });
    mocks.sendEmail.mockResolvedValue({ data: { data: sentEmail() } });
    mocks.fetchEmailSearchPage.mockResolvedValue({
      cursor: null,
      ok: true,
      rows: [searchRow()],
    });
    mocks.getEmail.mockResolvedValue({ data: { data: replyEmail() } });
    mocks.sleep.mockResolvedValue(undefined);
  });

  afterEach(() => {
    process.exitCode = undefined;
    if (previousXdgConfigHome === undefined) {
      delete process.env.XDG_CONFIG_HOME;
    } else {
      process.env.XDG_CONFIG_HOME = previousXdgConfigHome;
    }
    rmSync(tempConfigHome, { force: true, recursive: true });
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("registers the first-party chat command", () => {
    expect(COMMANDS.chat).toBe(ChatCommand);
    expect(COMMANDS["chat:reply"]).toBe(ChatReplyCommand);
  });

  it("keeps JSON mode explicit", () => {
    const flags = ChatCommand.flags as Record<string, unknown>;

    expect(flags.json).toBeDefined();
  });

  it("exposes first-party reply continuation flags", () => {
    const flags = ChatCommand.flags as Record<string, unknown>;

    expect(flags.reply).toBeDefined();
    expect(flags["reply-to-email-id"]).toBeDefined();
  });

  it("keeps the subject override as a hidden compatibility escape hatch", () => {
    const flags = ChatCommand.flags as Record<
      string,
      { hidden?: boolean } | undefined
    >;

    expect(flags.subject).toBeDefined();
    expect(flags.subject?.hidden).toBe(true);
    expect(ChatCommand.examples.join("\n")).not.toContain("--subject");
  });

  it("formats a reply with context and follow-up commands by default", () => {
    const output = formatChatResponse(outputContext());

    expect(output).toContain("Reply received");
    expect(output).toContain("Sent email id: sent-1");
    expect(output).toContain("Email id: email-1");
    expect(output).toContain(
      "Match: strict, matched by reply_to_sent_email_id",
    );
    expect(output).toContain("Helpful follow-up commands");
    expect(output).toContain("Replace <message> before running");
    expect(output).toContain("use --json for parse-safe output");
    expect(output).toContain(
      "--strict-only prefers timing out over matching the wrong reply",
    );
    expect(output).toContain("Local chat id: 0");
    expect(output).toContain("primitive chat reply 0 '<message>'");
    expect(output).toContain("primitive chat reply '<message>'");
    expect(output).toContain(
      "primitive chat help@agent.example --reply '<message>' --from agent@sender.example --reply-to-email-id email-1 --timeout 120 --strict-only",
    );
    expect(output).not.toContain("--in-reply-to");
    expect(output).not.toContain("--subject 'API key help'");
    expect(output).toContain(
      "primitive reply --id email-1 --from agent@sender.example --body '<message>'",
    );
    expect(output).toContain(
      "primitive emails wait --reply-to-sent-email-id sent-1 --to agent@sender.example --since 2026-05-25T00:00:02.000Z --timeout 120",
    );
    expect(output).toContain("Response body (text; use --json for parsing)");
    expect(output).toContain("----- BEGIN RESPONSE -----\nRotate your API key");
    expect(output).toContain("----- END RESPONSE -----");
    expect(output).not.toBe("Rotate your API key from the dashboard.\n");
  });

  it("includes follow-up commands in JSON mode without changing stdout shape to prose", () => {
    const envelope = buildChatJsonEnvelope({
      ...outputContext(),
      json: true,
    });

    expect(envelope.sent.id).toBe("sent-1");
    expect(envelope.reply.id).toBe("email-1");
    expect(envelope.response_body).toBe(
      "Rotate your API key from the dashboard.",
    );
    expect(envelope.response_body_format).toBe("text");
    expect(envelope.match.strategy).toBe("strict");
    expect(envelope.match.description).toBe(
      "strict, matched by reply_to_sent_email_id",
    );
    expect(envelope.local_chat_id).toBe(0);
    expect(envelope.follow_up_commands.map((entry) => entry.command)).toContain(
      "primitive emails get --id email-1",
    );
    expect(envelope.follow_up_commands[0]).toMatchObject({
      kind: "continue_chat",
      requires_message: true,
    });
    expect(envelope.follow_up_commands[0]?.argv).toEqual([
      "primitive",
      "chat",
      "reply",
      "0",
      "<message>",
      "--json",
    ]);
    expect(envelope.follow_up_commands[0]?.placeholders).toEqual([
      {
        description: "Replace with the message body before running.",
        token: "<message>",
      },
    ]);
    expect(
      envelope.follow_up_commands.find(
        (entry) => entry.kind === "wait_for_more",
      )?.argv,
    ).toEqual(
      expect.arrayContaining([
        "--since",
        "2026-05-25T00:00:02.000Z",
        "--timeout",
        "120",
      ]),
    );
  });

  it("does not suggest local chat reply when state was not saved", () => {
    const commands = buildChatFollowUpCommands({
      ...outputContext(),
      localChatId: undefined,
    });

    expect(commands[0]).toMatchObject({
      kind: "continue_chat",
      requires_message: true,
    });
    expect(commands[0]?.command).toContain(
      "primitive chat help@agent.example --reply '<message>'",
    );
    expect(commands[0]?.command).not.toContain("primitive chat reply");
    expect(commands.map((entry) => entry.kind)).not.toContain(
      "continue_active_chat",
    );
  });

  it("quotes shell-sensitive follow-up command values", () => {
    const commands = buildChatFollowUpCommands({
      ...outputContext(),
      recipient: "agent support@example.com",
      from: "Agent's Support <agent support@example.com>",
    }).map((entry) => entry.command);

    expect(commands[2]).toContain("'agent support@example.com'");
    expect(commands[2]).toContain(
      "--from 'Agent'\\''s Support <agent support@example.com>'",
    );
  });

  it("does not force strict-only into fallback-match continuation commands", () => {
    const commands = buildChatFollowUpCommands({
      ...outputContext(),
      matchStrategy: "fallback",
    }).map((entry) => entry.command);

    expect(commands[0]).not.toContain("--strict-only");
  });

  it("preserves custom strict phase settings in continuation commands", () => {
    const commands = buildChatFollowUpCommands({
      ...outputContext(),
      strictPhaseSeconds: 30,
    }).map((entry) => entry.command);

    expect(commands[2]).toContain("--strict-phase-seconds 30");
    expect(commands[2]).not.toContain("--strict-only");
  });

  it("falls back to HTML response body when text is empty", () => {
    expect(
      resolveChatResponseBody(
        replyEmail({ body_html: "<p>Hello</p>", body_text: "" }),
      ),
    ).toEqual({
      body: "<p>Hello</p>",
      format: "html",
    });
  });

  it("formats recovery commands after a send without a reply", () => {
    const output = formatChatRecoveryContext(outputContext());
    const commands = buildChatRecoveryCommands(outputContext());

    expect(output).toContain("Sent message context");
    expect(output).toContain("Sent email id: sent-1");
    expect(output).toContain("Helpful recovery commands");
    expect(commands.map((entry) => entry.command)).toContain(
      "primitive emails wait --reply-to-sent-email-id sent-1 --to agent@sender.example --since 2026-05-25T00:00:00.000Z --timeout 120",
    );
    expect(commands.map((entry) => entry.command)).toContain(
      "primitive emails wait --from help@agent.example --to agent@sender.example --since 2026-05-25T00:00:00.000Z --timeout 120",
    );
    expect(commands.map((entry) => entry.command).join("\n")).not.toContain(
      "--table",
    );
    expect(commands[0]).toMatchObject({
      kind: "wait_threaded_reply",
      requires_message: false,
    });
  });

  it("does not suggest fallback recovery after a strict-only timeout", () => {
    const commands = buildChatRecoveryCommands({
      ...outputContext(),
      strictOnly: true,
    });

    expect(commands.map((entry) => entry.kind)).toEqual([
      "wait_threaded_reply",
      "inspect_sent_email",
    ]);
    expect(commands.map((entry) => entry.command).join("\n")).not.toContain(
      "--from help@agent.example --to agent@sender.example",
    );
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

  it("writes non-TTY heartbeat lines while waiting", () => {
    vi.useFakeTimers();
    let now = 0;
    const writes: string[] = [];
    const progress = new ChatProgressIndicator(
      {
        isTTY: false,
        write(chunk: string) {
          writes.push(chunk);
        },
      },
      () => now,
    );

    try {
      progress.update("Message sent; waiting for reply", {
        heartbeatMs: 1000,
        timeoutSeconds: 3,
      });
      now = 1000;
      vi.advanceTimersByTime(1000);
      progress.succeed("Reply received");
    } finally {
      vi.useRealTimers();
    }

    expect(writes.join("")).toContain(
      "Message sent; waiting for reply (1s elapsed, timeout 3s)",
    );
  });

  it("invokes the command with human stdout and stderr progress on success", async () => {
    const result = await runChatCommand([
      "help@agent.example",
      "How do I rotate my API key?",
      "--from",
      "agent@sender.example",
      "--subject",
      "API key help",
      "--timeout",
      "17",
    ]);

    expect(result.exitCode).toBeUndefined();
    expect(result.stderr).toContain("Sending message to help@agent.example");
    expect(result.stderr).toContain(
      "Message sent; waiting for reply from help@agent.example",
    );
    expect(result.stderr).toContain(
      "Reply received from help@agent.example after",
    );
    expect(result.stdout).toContain("Reply received");
    expect(result.stdout).toContain(
      "Response body (text; use --json for parsing)",
    );
    expect(result.stdout).toContain(
      "primitive chat help@agent.example --reply '<message>' --from agent@sender.example --reply-to-email-id email-1 --timeout 17 --strict-only",
    );
    expect(result.stdout).toContain("primitive chat reply 0 '<message>'");
    expect(result.stdout).toContain("primitive chat reply '<message>'");
  });

  it("saves the latest inbound reply as the active chat", async () => {
    const result = await runChatCommand([
      "help@agent.example",
      "How do I rotate my API key?",
      "--from",
      "agent@sender.example",
    ]);

    expect(result.exitCode).toBeUndefined();
    const state = JSON.parse(
      readFileSync(chatStatePath(testConfigDir()), "utf8"),
    );
    expect(state).toMatchObject({
      active_local_id: 0,
      next_local_id: 1,
      version: 2,
    });
    expect(state.conversations).toHaveLength(1);
    expect(state.conversations[0]).toMatchObject({
      from: "agent@sender.example",
      last_reply_email_id: "email-1",
      last_sent_email_id: "sent-1",
      local_id: 0,
      recipient: "help@agent.example",
      strict_only: true,
      strict_phase_seconds: 60,
      thread_id: "thread-1",
      timeout_seconds: 120,
    });
  });

  it("continues an exact chat thread with --reply-to-email-id", async () => {
    mocks.getEmail.mockImplementation(async ({ path }) => {
      if (path.id === "email-2") {
        return {
          data: {
            data: replyEmail({
              body_text: "Follow-up answer.",
              id: "email-2",
              received_at: "2026-05-25T00:00:04.000Z",
              reply_to_sent_email_id: "sent-reply-1",
            }),
          },
        };
      }
      return { data: { data: replyEmail() } };
    });
    mocks.fetchEmailSearchPage.mockResolvedValue({
      cursor: null,
      ok: true,
      rows: [
        searchRow({
          id: "email-2",
          received_at: "2026-05-25T00:00:04.000Z",
        }),
      ],
    });

    const result = await runChatCommand([
      "help@agent.example",
      "--reply",
      "Can you explain?",
      "--reply-to-email-id",
      "email-1",
    ]);

    expect(result.exitCode).toBeUndefined();
    expect(result.stderr).toContain("Loading reply context for email-1");
    expect(result.stderr).toContain("Sending reply to help@agent.example");
    expect(mocks.pickDefaultFromAddress).not.toHaveBeenCalled();
    expect(mocks.sendEmail).not.toHaveBeenCalled();
    expect(mocks.replyToEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        body: {
          body_text: "Can you explain?",
          from: "agent@sender.example",
        },
        path: { id: "email-1" },
        responseStyle: "fields",
      }),
    );
    expect(result.stdout).toContain("Follow-up answer.");
  });

  it("continues an exact chat thread with reply attachments", async () => {
    const attachmentPath = join(tempConfigHome, "report.txt");
    writeFileSync(attachmentPath, "hello");
    mocks.getEmail.mockImplementation(async ({ path }) => {
      if (path.id === "email-2") {
        return {
          data: {
            data: replyEmail({
              body_text: "Follow-up answer.",
              id: "email-2",
              received_at: "2026-05-25T00:00:04.000Z",
              reply_to_sent_email_id: "sent-reply-1",
            }),
          },
        };
      }
      return { data: { data: replyEmail() } };
    });
    mocks.fetchEmailSearchPage.mockResolvedValue({
      cursor: null,
      ok: true,
      rows: [
        searchRow({
          id: "email-2",
          received_at: "2026-05-25T00:00:04.000Z",
        }),
      ],
    });

    const result = await runChatCommand([
      "help@agent.example",
      "--reply",
      "Can you review this?",
      "--reply-to-email-id",
      "email-1",
      "--attachment",
      attachmentPath,
    ]);

    expect(result.exitCode).toBeUndefined();
    expect(mocks.replyToEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        body: {
          attachments: [
            {
              content_base64: "aGVsbG8=",
              filename: "report.txt",
            },
          ],
          body_text: "Can you review this?",
          from: "agent@sender.example",
        },
        path: { id: "email-1" },
      }),
    );
    expect(result.stdout).toContain("Follow-up answer.");
  });

  it("continues the latest inbound from the recipient with --reply", async () => {
    mocks.getEmail.mockImplementation(async ({ path }) => {
      if (path.id === "email-2") {
        return {
          data: {
            data: replyEmail({
              body_text: "Latest follow-up.",
              id: "email-2",
              received_at: "2026-05-25T00:00:04.000Z",
              reply_to_sent_email_id: "sent-reply-1",
            }),
          },
        };
      }
      return { data: { data: replyEmail() } };
    });
    mocks.fetchEmailSearchPage.mockResolvedValue({
      cursor: null,
      ok: true,
      rows: [
        searchRow({
          id: "email-2",
          received_at: "2026-05-25T00:00:04.000Z",
        }),
      ],
    });

    const result = await runChatCommand([
      "help@agent.example",
      "--reply",
      "Can you explain?",
      "--from",
      "agent@sender.example",
    ]);

    expect(result.exitCode).toBeUndefined();
    expect(result.stderr).toContain(
      "Finding latest inbound email from help@agent.example",
    );
    expect(mocks.searchEmails).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({
          from: "help@agent.example",
          sort: "received_at_desc",
          to: "agent@sender.example",
        }),
      }),
    );
    expect(mocks.replyToEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        body: {
          body_text: "Can you explain?",
          from: "agent@sender.example",
        },
        path: { id: "email-1" },
      }),
    );
    expect(result.stdout).toContain("Latest follow-up.");
  });

  it("continues the active chat with chat reply", async () => {
    mkdirSync(testConfigDir(), { recursive: true });
    saveActiveChatState(testConfigDir(), {
      from: "agent@sender.example",
      last_reply_email_id: "email-1",
      last_reply_received_at: "2026-05-25T00:00:02.000Z",
      last_sent_email_id: "sent-1",
      recipient: "help@agent.example",
      strict_only: true,
      strict_phase_seconds: 60,
      thread_id: "thread-1",
      timeout_seconds: 17,
    });
    mocks.getEmail.mockImplementation(async ({ path }) => {
      if (path.id === "email-2") {
        return {
          data: {
            data: replyEmail({
              body_text: "Active chat follow-up.",
              id: "email-2",
              received_at: "2026-05-25T00:00:04.000Z",
              reply_to_sent_email_id: "sent-reply-1",
            }),
          },
        };
      }
      return { data: { data: replyEmail() } };
    });
    mocks.fetchEmailSearchPage.mockResolvedValue({
      cursor: null,
      ok: true,
      rows: [
        searchRow({
          id: "email-2",
          received_at: "2026-05-25T00:00:04.000Z",
        }),
      ],
    });

    const result = await runChatReplyCommand(["Can you explain?"]);

    expect(result.exitCode).toBeUndefined();
    expect(result.stderr).toContain("Loading reply context for email-1");
    expect(result.stderr).toContain("Sending reply to help@agent.example");
    expect(mocks.sendEmail).not.toHaveBeenCalled();
    expect(mocks.replyToEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        body: {
          body_text: "Can you explain?",
          from: "agent@sender.example",
        },
        path: { id: "email-1" },
      }),
    );
    expect(mocks.fetchEmailSearchPage).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: { replyToSentEmailId: "sent-reply-1" },
      }),
    );
    expect(result.stdout).toContain("Active chat follow-up.");
  });

  it("continues the active chat with chat reply attachments", async () => {
    const attachmentPath = join(tempConfigHome, "notes.txt");
    writeFileSync(attachmentPath, "notes");
    mkdirSync(testConfigDir(), { recursive: true });
    saveActiveChatState(testConfigDir(), {
      from: "agent@sender.example",
      last_reply_email_id: "email-1",
      last_reply_received_at: "2026-05-25T00:00:02.000Z",
      last_sent_email_id: "sent-1",
      recipient: "help@agent.example",
      strict_only: true,
      strict_phase_seconds: 60,
      thread_id: "thread-1",
      timeout_seconds: 17,
    });
    mocks.getEmail.mockImplementation(async ({ path }) => {
      if (path.id === "email-2") {
        return {
          data: {
            data: replyEmail({
              body_text: "Active chat follow-up.",
              id: "email-2",
              received_at: "2026-05-25T00:00:04.000Z",
              reply_to_sent_email_id: "sent-reply-1",
            }),
          },
        };
      }
      return { data: { data: replyEmail() } };
    });
    mocks.fetchEmailSearchPage.mockResolvedValue({
      cursor: null,
      ok: true,
      rows: [
        searchRow({
          id: "email-2",
          received_at: "2026-05-25T00:00:04.000Z",
        }),
      ],
    });

    const result = await runChatReplyCommand([
      "Can you review this?",
      "--attachment",
      attachmentPath,
    ]);

    expect(result.exitCode).toBeUndefined();
    expect(mocks.replyToEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        body: {
          attachments: [
            {
              content_base64: "bm90ZXM=",
              filename: "notes.txt",
            },
          ],
          body_text: "Can you review this?",
          from: "agent@sender.example",
        },
        path: { id: "email-1" },
      }),
    );
    expect(result.stdout).toContain("Active chat follow-up.");
  });

  it("continues a specific local chat id with chat reply", async () => {
    mkdirSync(testConfigDir(), { recursive: true });
    saveActiveChatState(testConfigDir(), {
      from: "agent@sender.example",
      last_reply_email_id: "email-0",
      last_reply_received_at: "2026-05-25T00:00:02.000Z",
      last_sent_email_id: "sent-0",
      recipient: "first@agent.example",
      strict_only: true,
      strict_phase_seconds: 60,
      thread_id: "thread-0",
      timeout_seconds: 17,
    });
    saveActiveChatState(testConfigDir(), {
      from: "agent@sender.example",
      last_reply_email_id: "email-1",
      last_reply_received_at: "2026-05-25T00:00:03.000Z",
      last_sent_email_id: "sent-1",
      recipient: "second@agent.example",
      strict_only: true,
      strict_phase_seconds: 60,
      thread_id: "thread-1",
      timeout_seconds: 17,
    });
    mocks.getEmail.mockImplementation(async ({ path }) => {
      if (path.id === "email-2") {
        return {
          data: {
            data: replyEmail({
              body_text: "Specific chat follow-up.",
              from_email: "first@agent.example",
              id: "email-2",
              received_at: "2026-05-25T00:00:04.000Z",
              reply_to_sent_email_id: "sent-reply-1",
              thread_id: "thread-0",
            }),
          },
        };
      }
      if (path.id === "email-0") {
        return {
          data: {
            data: replyEmail({
              from_email: "first@agent.example",
              id: "email-0",
              thread_id: "thread-0",
            }),
          },
        };
      }
      return { data: { data: replyEmail() } };
    });
    mocks.fetchEmailSearchPage.mockResolvedValue({
      cursor: null,
      ok: true,
      rows: [
        searchRow({
          id: "email-2",
          received_at: "2026-05-25T00:00:04.000Z",
        }),
      ],
    });

    const result = await runChatReplyCommand(["0", "Can you explain?"]);

    expect(result.exitCode).toBeUndefined();
    expect(result.stderr).toContain("Loading reply context for email-0");
    expect(result.stderr).toContain("Sending reply to first@agent.example");
    expect(mocks.replyToEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        body: {
          body_text: "Can you explain?",
          from: "agent@sender.example",
        },
        path: { id: "email-0" },
      }),
    );
    expect(result.stdout).toContain("Specific chat follow-up.");
    expect(result.stdout).toContain("Local chat id: 0");
  });

  it("uses reply-specific guidance when chat reply needs stdin", async () => {
    mkdirSync(testConfigDir(), { recursive: true });
    saveActiveChatState(testConfigDir(), {
      from: "agent@sender.example",
      last_reply_email_id: "email-1",
      last_reply_received_at: "2026-05-25T00:00:02.000Z",
      last_sent_email_id: "sent-1",
      recipient: "help@agent.example",
      strict_only: true,
      strict_phase_seconds: 60,
      thread_id: "thread-1",
      timeout_seconds: 17,
    });
    const stdinIsTTYDescriptor = Object.getOwnPropertyDescriptor(
      process.stdin,
      "isTTY",
    );
    Object.defineProperty(process.stdin, "isTTY", {
      configurable: true,
      value: true,
    });

    try {
      await expect(
        ChatReplyCommand.run(["--id", "0"], { root: CLI_ROOT }),
      ).rejects.toThrow(
        "No reply body provided. Pass the reply body as a positional argument or pipe it via stdin.",
      );
    } finally {
      if (stdinIsTTYDescriptor) {
        Object.defineProperty(process.stdin, "isTTY", stdinIsTTYDescriptor);
      } else {
        delete (process.stdin as { isTTY?: boolean }).isTTY;
      }
    }
    expect(mocks.createAuthenticatedCliApiClient).not.toHaveBeenCalled();
  });

  it("fails chat reply before auth when no active chat exists", async () => {
    await expect(
      ChatReplyCommand.run(["Can you explain?"], { root: CLI_ROOT }),
    ).rejects.toThrow(
      "No open chat. Start one with `primitive chat <email> '<message>'`.",
    );
    expect(mocks.createAuthenticatedCliApiClient).not.toHaveBeenCalled();
  });

  it("rejects subject overrides in reply mode", async () => {
    await expect(
      ChatCommand.run(
        [
          "help@agent.example",
          "--reply",
          "Can you explain?",
          "--subject",
          "No",
        ],
        { root: CLI_ROOT },
      ),
    ).rejects.toThrow(
      "--subject is not used with --reply. Primitive derives the reply subject from the inbound email.",
    );
  });

  it("invokes the command with JSON stdout and stderr progress", async () => {
    const result = await runChatCommand([
      "help@agent.example",
      "How do I rotate my API key?",
      "--json",
    ]);
    const parsed = JSON.parse(result.stdout);

    expect(result.exitCode).toBeUndefined();
    expect(result.stderr).toContain("Sending message to help@agent.example");
    expect(parsed.response_body).toBe(
      "Rotate your API key from the dashboard.",
    );
    expect(parsed.response_body_format).toBe("text");
    expect(parsed.follow_up_commands[0]).toMatchObject({
      kind: "continue_chat",
      requires_message: true,
    });
    expect(parsed.local_chat_id).toBe(0);
    expect(parsed.follow_up_commands[0].argv).toEqual([
      "primitive",
      "chat",
      "reply",
      "0",
      "<message>",
      "--json",
    ]);
  });

  it("invokes the command with recovery context on timeout after send", async () => {
    let now = 0;
    const nowSpy = vi.spyOn(Date, "now").mockImplementation(() => now);
    mocks.fetchEmailSearchPage.mockResolvedValue({
      cursor: null,
      ok: true,
      rows: [],
    });
    mocks.sleep.mockImplementation(async () => {
      now += 2000;
    });

    const result = await runChatCommand([
      "help@agent.example",
      "Is anybody there?",
      "--from",
      "agent@sender.example",
      "--subject",
      "Timeout test",
      "--timeout",
      "1",
    ]);

    nowSpy.mockRestore();
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain(
      "Timed out after 1s waiting for a reply from help@agent.example.",
    );
    expect(result.stderr).toContain("Sent message context");
    expect(result.stderr).toContain("Sent email id: sent-1");
    expect(result.stderr).toMatch(
      /primitive emails wait --reply-to-sent-email-id sent-1 --to agent@sender\.example --since \S+ --timeout 1/,
    );
    expect(result.stderr).not.toContain("--table");
  });
});
