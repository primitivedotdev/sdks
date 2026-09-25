import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type {
  EmailDetail,
  EmailDetailReply,
  SendMailResult,
} from "@primitivedotdev/api-core";
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

import ChatCommand, {
  ChatReplyCommand,
} from "../../src/oclif/commands/chat.js";

const CLI_ROOT = resolve(import.meta.dirname, "../..");
let tempConfigHome: string;
let previousXdgConfigHome: string | undefined;

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

function priorReply(overrides: Partial<EmailDetailReply> = {}) {
  return {
    created_at: "2026-05-25T00:00:05.000Z",
    id: "sent-earlier",
    status: "delivered" as const,
    to_address: "help@agent.example",
    ...overrides,
  };
}

function inboundEmail(overrides: Partial<EmailDetail> = {}): EmailDetail {
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

function searchRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "email-1",
    received_at: "2026-05-25T00:00:02.000Z",
    status: "accepted",
    ...overrides,
  };
}

function apiFailure(status: number | undefined, code = "request_failed") {
  return {
    error: { error: { code, message: `Failure ${code}` } },
    response: status === undefined ? undefined : { status },
  };
}

type RunResult = {
  exitCode: number | string | null | undefined;
  stderr: string;
  stdout: string;
  thrown: unknown;
};

async function run(
  command: "chat" | "chat-reply",
  argv: string[],
): Promise<RunResult> {
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
  let thrown: unknown;
  try {
    if (command === "chat") {
      await ChatCommand.run(argv, { root: CLI_ROOT });
    } else {
      await ChatReplyCommand.run(argv, { root: CLI_ROOT });
    }
  } catch (error) {
    thrown = error;
  } finally {
    logSpy.mockRestore();
    stderrSpy.mockRestore();
  }
  const exitCode =
    thrown === undefined
      ? process.exitCode
      : (thrown as { oclif?: { exit?: number } }).oclif?.exit;
  process.exitCode = previousExitCode;
  return {
    exitCode,
    stderr: stderrChunks.join(""),
    stdout: stdoutChunks.join(""),
    thrown,
  };
}

function freshChatArgs(...extra: string[]): string[] {
  return [
    "help@agent.example",
    "How do I rotate my API key?",
    "--from",
    "agent@sender.example",
    ...extra,
  ];
}

function allFollowUpArgv(envelope: {
  follow_up_commands: Array<{ argv: string[] }>;
}): string[][] {
  return envelope.follow_up_commands.map((entry) => entry.argv);
}

function expectNoResendCommand(envelope: {
  follow_up_commands: Array<{ argv: string[] }>;
}): void {
  for (const argv of allFollowUpArgv(envelope)) {
    expect(["chat", "send", "reply"]).not.toContain(argv[1]);
  }
}

function useFakeClockForTimeout(): () => void {
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
  return () => nowSpy.mockRestore();
}

describe("chat send outcomes", () => {
  beforeEach(() => {
    previousXdgConfigHome = process.env.XDG_CONFIG_HOME;
    tempConfigHome = mkdtempSync(join(tmpdir(), "primitive-chat-outcome-"));
    process.env.XDG_CONFIG_HOME = tempConfigHome;
    vi.clearAllMocks();
    mocks.createAuthenticatedCliApiClient.mockResolvedValue({
      apiClient: { client: {} },
      auth: { kind: "api-key" },
      baseUrlOverridden: false,
    });
    mocks.pickDefaultFromAddress.mockResolvedValue("agent@sender.example");
    mocks.replyToEmail.mockResolvedValue({
      data: { data: sentEmail({ id: "sent-reply-1" }) },
    });
    mocks.sendEmail.mockResolvedValue({ data: { data: sentEmail() } });
    mocks.fetchEmailSearchPage.mockResolvedValue({
      cursor: null,
      ok: true,
      rows: [searchRow()],
    });
    mocks.getEmail.mockResolvedValue({ data: { data: inboundEmail() } });
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
    vi.restoreAllMocks();
  });

  it("reports replied with exit 0 when a reply arrives", async () => {
    const result = await run("chat", freshChatArgs("--json"));
    const envelope = JSON.parse(result.stdout);

    expect(result.exitCode).toBeUndefined();
    expect(envelope).toMatchObject({
      outcome: "replied",
      exit_code: 0,
      outcome_message:
        "Message sent (id sent-1) and a reply arrived from help@agent.example.",
      sent: { id: "sent-1" },
      reply: { id: "email-1" },
      prior_replies: null,
      http_status: null,
      error: null,
    });
  });

  it("emits a JSON envelope and exits 3 when the send succeeded but the reply wait timed out", async () => {
    const restoreClock = useFakeClockForTimeout();
    const result = await run("chat", freshChatArgs("--json", "--timeout", "1"));
    restoreClock();
    const envelope = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(3);
    expect(envelope).toMatchObject({
      outcome: "sent_awaiting_reply",
      exit_code: 3,
      sent: { id: "sent-1" },
      reply: null,
      response_body: null,
      match: null,
      local_chat_id: null,
      error: null,
    });
    expect(envelope.outcome_message).toMatch(
      /^Message sent \(id sent-1\)\. No reply yet after 1s\. Do NOT resend; wait with: primitive emails wait --reply-to-sent-email-id sent-1 /,
    );
    expect(
      envelope.follow_up_commands.map((c: { kind: string }) => c.kind),
    ).toEqual([
      "wait_threaded_reply",
      "wait_fallback_reply",
      "inspect_sent_email",
    ]);
    expectNoResendCommand(envelope);
    expect(result.stderr).toContain("Do NOT resend");
    expect(result.stderr).toContain("Sent message context");
  });

  it("reports sent_awaiting_reply, not a send failure, when polling breaks after the send", async () => {
    mocks.fetchEmailSearchPage.mockResolvedValue({
      ok: false,
      error: { error: { code: "internal_error", message: "search down" } },
    });

    const result = await run("chat", freshChatArgs("--json"));
    const envelope = JSON.parse(result.stdout);

    expect(result.thrown).toBeUndefined();
    expect(result.exitCode).toBe(3);
    expect(envelope.outcome).toBe("sent_awaiting_reply");
    expect(envelope.sent.id).toBe("sent-1");
    expect(envelope.error).toEqual({ message: "Failed to poll for reply." });
    expect(envelope.outcome_message).toContain(
      "Message sent (id sent-1). Waiting for the reply failed: Failed to poll for reply. Do NOT resend",
    );
    expectNoResendCommand(envelope);
  });

  it("prints the awaiting-reply lead line on stdout without --json", async () => {
    mocks.fetchEmailSearchPage.mockResolvedValue({
      ok: false,
      error: { error: { code: "internal_error", message: "search down" } },
    });

    const result = await run("chat", freshChatArgs());

    expect(result.exitCode).toBe(3);
    expect(result.stdout).toMatch(/^Message sent \(id sent-1\)\. /);
    expect(result.stderr).toContain("Error: Failed to poll for reply.");
  });

  it.each([
    400, 401, 402, 403, 404, 413, 422, 429,
  ])("reports not_sent with exit 1 for a definitive HTTP %i rejection", async (status) => {
    mocks.sendEmail.mockResolvedValue(apiFailure(status));

    const result = await run("chat", freshChatArgs("--json"));
    const envelope = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(1);
    expect(envelope).toMatchObject({
      outcome: "not_sent",
      exit_code: 1,
      http_status: status,
      sent: null,
      reply: null,
      follow_up_commands: [],
    });
    expect(envelope.error).toMatchObject({ code: "request_failed" });
    expect(result.stderr).toContain(
      `Message not sent: the API rejected the request (HTTP ${status}). Nothing went out`,
    );
  });

  it("lets a corrected retry through after a definitive rejection", async () => {
    mocks.sendEmail.mockResolvedValueOnce(apiFailure(401, "unauthorized"));
    expect((await run("chat", freshChatArgs("--json"))).exitCode).toBe(1);

    const retry = await run("chat", freshChatArgs("--json"));
    expect(retry.exitCode).toBeUndefined();
    expect(JSON.parse(retry.stdout).outcome).toBe("replied");
    expect(mocks.sendEmail).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["a server error", 500],
    ["a conflict", 409],
    ["a gateway timeout", 504],
    ["a transport error", undefined],
  ])("reports uncertain with exit 4 for %s", async (_label, status) => {
    mocks.sendEmail.mockResolvedValue(apiFailure(status));

    const result = await run("chat", freshChatArgs("--json"));
    const envelope = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(4);
    expect(envelope).toMatchObject({
      outcome: "uncertain",
      exit_code: 4,
      http_status: status ?? null,
      sent: null,
    });
    expect(envelope.follow_up_commands).toEqual([
      expect.objectContaining({
        kind: "list_recent_sent_emails",
        argv: expect.arrayContaining(["primitive", "sent", "list"]),
      }),
    ]);
    expectNoResendCommand(envelope);
    expect(result.stderr).toContain("may or may not have gone out");
  });

  it("keeps an uncertain send uncertain on retry instead of sending again", async () => {
    mocks.sendEmail.mockResolvedValueOnce(apiFailure(503));
    expect((await run("chat", freshChatArgs("--json"))).exitCode).toBe(4);

    const retry = await run("chat", freshChatArgs("--json"));
    const envelope = JSON.parse(retry.stdout);

    expect(retry.exitCode).toBe(4);
    expect(envelope.outcome).toBe("uncertain");
    expect(envelope.error.message).toMatch(/uncertain outcome/);
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1);
  });

  it("reports uncertain when the API accepts the send but returns no record", async () => {
    mocks.sendEmail.mockResolvedValue({ data: {} });

    const result = await run("chat", freshChatArgs("--json"));
    const envelope = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(4);
    expect(envelope.outcome).toBe("uncertain");
    expect(envelope.error.message).toContain("returned no send record");
  });

  it("reports already_sent with exit 0 and no resend advice when a replay has no reply yet", async () => {
    mocks.sendEmail.mockResolvedValue({
      data: { data: sentEmail({ idempotent_replay: true }) },
    });
    mocks.fetchEmailSearchPage.mockResolvedValue({
      cursor: null,
      ok: true,
      rows: [],
    });

    const result = await run(
      "chat",
      freshChatArgs("--json", "--timeout", "30"),
    );
    const envelope = JSON.parse(result.stdout);

    expect(result.exitCode).toBeUndefined();
    expect(envelope).toMatchObject({
      outcome: "already_sent",
      exit_code: 0,
      sent: { id: "sent-1", idempotent_replay: true },
      reply: null,
    });
    expect(envelope.outcome_message).toBe(
      "Already sent: this exact message went out earlier (sent id sent-1, status delivered). Nothing new was sent. No reply to it yet. Do NOT resend; wait with: primitive emails wait --reply-to-sent-email-id sent-1 --to agent@sender.example --include-existing --timeout 30",
    );
    expect(
      envelope.follow_up_commands.map((c: { kind: string }) => c.kind),
    ).toEqual(["wait_existing_reply", "inspect_sent_email"]);
    expectNoResendCommand(envelope);
    expect(`${result.stdout}${result.stderr}`).not.toMatch(
      /vary|fresh send|fresh copy/i,
    );
  });

  it("prints the already_sent message on stdout without --json", async () => {
    mocks.sendEmail.mockResolvedValue({
      data: { data: sentEmail({ idempotent_replay: true }) },
    });
    mocks.fetchEmailSearchPage.mockResolvedValue({
      cursor: null,
      ok: true,
      rows: [],
    });

    const result = await run("chat", freshChatArgs());

    expect(result.exitCode).toBeUndefined();
    expect(result.stdout).toMatch(
      /^Already sent: this exact message went out earlier \(sent id sent-1, status delivered\)\. Nothing new was sent\./,
    );
  });

  it("surfaces the existing reply as already_sent for a replay that was answered", async () => {
    mocks.sendEmail.mockResolvedValue({
      data: { data: sentEmail({ idempotent_replay: true }) },
    });

    const result = await run("chat", freshChatArgs("--json"));
    const envelope = JSON.parse(result.stdout);

    expect(result.exitCode).toBeUndefined();
    expect(envelope).toMatchObject({
      outcome: "already_sent",
      exit_code: 0,
      reply: { id: "email-1" },
      response_body: "Rotate your API key from the dashboard.",
    });
    expect(result.stderr).toContain(
      "Already sent: this exact message went out earlier (sent id sent-1, status delivered). Nothing new was sent.",
    );
  });

  it("reports already_sent when a replay's existing reply cannot be loaded", async () => {
    mocks.sendEmail.mockResolvedValue({
      data: { data: sentEmail({ idempotent_replay: true }) },
    });
    mocks.getEmail.mockResolvedValue(apiFailure(500));

    const result = await run("chat", freshChatArgs("--json"));
    const envelope = JSON.parse(result.stdout);

    expect(result.exitCode).toBeUndefined();
    expect(envelope.outcome).toBe("already_sent");
    expect(envelope.reply).toBeNull();
    expect(envelope.outcome_message).toContain(
      "Loading its reply failed: its existing reply email-1 could not be loaded.",
    );
  });

  it("emits a not_sent envelope when chat fails before sending", async () => {
    mocks.searchEmails.mockResolvedValue({
      data: {
        data: [],
        meta: {
          cursor: null,
          limit: 50,
          sort: "received_at_desc",
          total: 0,
          total_capped: false,
        },
      },
    });

    const result = await run("chat", [
      "help@agent.example",
      "--reply",
      "one more thing",
      "--json",
    ]);
    const envelope = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(1);
    expect(envelope).toMatchObject({
      outcome: "not_sent",
      exit_code: 1,
      sent: null,
    });
    expect(envelope.error.message).toContain("No prior inbound email");
    expect(mocks.replyToEmail).not.toHaveBeenCalled();
  });

  it("emits a not_sent envelope when chat reply has no open chat", async () => {
    const result = await run("chat-reply", ["one more thing", "--json"]);
    const envelope = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(1);
    expect(envelope.outcome).toBe("not_sent");
    expect(envelope.error.message).toContain("No open chat");
  });

  it("warns, but still sends, when the inbound already has a reply that went out", async () => {
    mocks.replyToEmail.mockResolvedValue({ data: { data: sentEmail() } });
    mocks.getEmail.mockImplementation(
      async ({ path }: { path: { id: string } }) =>
        path.id === "parent-1"
          ? {
              data: {
                data: inboundEmail({
                  id: "parent-1",
                  replies: [
                    priorReply({ id: "sent-denied", status: "gate_denied" }),
                    priorReply(),
                  ],
                }),
              },
            }
          : { data: { data: inboundEmail() } },
    );
    mocks.fetchEmailSearchPage.mockResolvedValue({
      cursor: null,
      ok: true,
      rows: [searchRow()],
    });

    const result = await run("chat", [
      "help@agent.example",
      "--reply",
      "one more thing",
      "--reply-to-email-id",
      "parent-1",
      "--json",
    ]);

    expect(result.stderr).toContain(
      "You already replied to this email at 2026-05-25T00:00:05.000Z (sent id sent-earlier). Sending another reply.",
    );
    expect(mocks.replyToEmail).toHaveBeenCalledTimes(1);
    const envelope = JSON.parse(result.stdout);
    expect(envelope.prior_replies).toEqual([priorReply()]);
  });

  it("does not warn about prior replies when none went out", async () => {
    mocks.replyToEmail.mockResolvedValue({ data: { data: sentEmail() } });
    mocks.getEmail.mockResolvedValue({
      data: {
        data: inboundEmail({
          replies: [priorReply({ status: "gate_denied" })],
        }),
      },
    });

    const result = await run("chat", [
      "help@agent.example",
      "--reply",
      "one more thing",
      "--reply-to-email-id",
      "email-1",
      "--json",
    ]);

    expect(result.stderr).not.toContain("You already replied");
    expect(JSON.parse(result.stdout).prior_replies).toEqual([]);
  });
});
