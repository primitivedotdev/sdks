import { randomUUID } from "node:crypto";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type {
  EmailDetail,
  EmailDetailReply,
  SendMailResult,
} from "@primitivedotdev/api-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  agentProfileDirectory,
  saveConnectedAgentProfile,
} from "../../src/oclif/connected-agent-profile.js";
import { writeMailJson } from "../../src/oclif/shared-mail-files.js";

const mocks = vi.hoisted(() => ({
  createAuthenticatedCliApiClient: vi.fn(),
  fetchEmailSearchPage: vi.fn(),
  getEmail: vi.fn(),
  pickDefaultFromAddress: vi.fn(),
  replyToEmail: vi.fn(),
  searchEmails: vi.fn(),
  saveChatReceiptFailure: { error: null as Error | null },
  sendEmail: vi.fn(),
  sleep: vi.fn(),
  openConnectedReplyWait: vi.fn(),
}));

vi.mock("../../src/oclif/connected-reply-wait.js", () => ({
  openConnectedReplyWait: mocks.openConnectedReplyWait,
}));

vi.mock("../../src/oclif/chat-receipt.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../src/oclif/chat-receipt.js")>();
  return {
    ...actual,
    saveChatReceipt: (
      receipt: Parameters<typeof actual.saveChatReceipt>[0],
    ) => {
      const failure = mocks.saveChatReceiptFailure.error;
      if (failure !== null && receipt.data.completed) throw failure;
      actual.saveChatReceipt(receipt);
    },
  };
});

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
    reply_count: 0,
    last_replied_at: null,
    awaiting: "you",
    automated: false,
    automated_reasons: [],
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
    sender_connected_agent_verified:
      overrides.sender_connected_agent_verified ?? false,
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

function connectedExternalChatFixture() {
  const configDir = join(tempConfigHome, "primitive");
  const apiKey = ["pconn", "chat-test"].join("_");
  const sessionId = randomUUID();
  const invitationHash = "a".repeat(64);
  const identity = {
    profileName: "work",
    orgId: randomUUID(),
    agentAddress: "agent@sender.example",
    ownerAddress: "owner@sender.example",
    apiBaseUrl: "https://api.primitive.dev/v1",
  };
  saveConnectedAgentProfile(configDir, identity.profileName, {
    version: 1,
    auth_method: "agent_connection",
    api_key: apiKey,
    api_base_url: identity.apiBaseUrl,
    org_id: identity.orgId,
    agent_address: identity.agentAddress,
    owner_address: identity.ownerAddress,
    invitation_hash: invitationHash,
    created_at: new Date().toISOString(),
  });
  const setupPath = join(
    agentProfileDirectory(configDir, identity.profileName),
    "setup.json",
  );
  writeMailJson(setupPath, {
    version: 1,
    session: sessionId,
    receiverMode: "external",
    invitationHash,
    phase: "sent",
    receipt: { id: randomUUID(), status: "delivered" },
  });
  mocks.createAuthenticatedCliApiClient.mockResolvedValue({
    apiClient: { client: {} },
    auth: {
      apiKey,
      apiBaseUrl: identity.apiBaseUrl,
      source: "connected-profile",
      credentials: null,
      connectedAgent: identity,
    },
    baseUrlOverridden: false,
  });
  mocks.openConnectedReplyWait.mockResolvedValue({
    receiver: { signal: new AbortController().signal },
    ready: vi.fn(async () => true),
    bind: vi.fn(async () => undefined),
    uncertain: vi.fn(async () => undefined),
    cancelBeforeSend: vi.fn(async () => undefined),
    cancelRejectedSend: vi.fn(async () => undefined),
    finish: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
  });
  return { sessionId, setupPath };
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
    mocks.saveChatReceiptFailure.error = null;
  });

  afterEach(() => {
    process.exitCode = undefined;
    if (previousXdgConfigHome === undefined) {
      delete process.env.XDG_CONFIG_HOME;
    } else {
      process.env.XDG_CONFIG_HOME = previousXdgConfigHome;
    }
    rmSync(tempConfigHome, { force: true, recursive: true });
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("sends async chat from a verified external Claude setup when Bash omits its session ID", async () => {
    const { sessionId } = connectedExternalChatFixture();
    vi.stubEnv("CODEX_THREAD_ID", "");
    vi.stubEnv("CODEX_SESSION_ID", "");
    vi.stubEnv("CLAUDE_CODE_SESSION_ID", "");
    const result = await run("chat", freshChatArgs("--async", "--json"));
    expect(result.exitCode).toBeUndefined();
    expect(JSON.parse(result.stdout).outcome).toBe("sent");
    expect(mocks.openConnectedReplyWait).toHaveBeenCalledWith(
      expect.objectContaining({ sessionKey: `claude:${sessionId}` }),
    );
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1);
  });

  it.each([
    "wrong Claude",
    "mixed runtime",
  ])("refuses async chat before sending for %s identity", async (identityKind) => {
    const { sessionId } = connectedExternalChatFixture();
    vi.stubEnv(
      "CLAUDE_CODE_SESSION_ID",
      identityKind === "wrong Claude" ? randomUUID() : sessionId,
    );
    vi.stubEnv(
      "CODEX_THREAD_ID",
      identityKind === "mixed runtime" ? randomUUID() : "",
    );
    vi.stubEnv("CODEX_SESSION_ID", "");
    const result = await run("chat", freshChatArgs("--async", "--json"));
    expect(JSON.parse(result.stdout).outcome).toBe("not_sent");
    expect(mocks.openConnectedReplyWait).not.toHaveBeenCalled();
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("refuses async chat when the selected profile lacks a verified external setup", async () => {
    const { setupPath } = connectedExternalChatFixture();
    vi.stubEnv("CODEX_THREAD_ID", "");
    vi.stubEnv("CODEX_SESSION_ID", "");
    vi.stubEnv("CLAUDE_CODE_SESSION_ID", "");
    rmSync(setupPath);
    const result = await run("chat", freshChatArgs("--async", "--json"));
    expect(JSON.parse(result.stdout).outcome).toBe("not_sent");
    expect(mocks.openConnectedReplyWait).not.toHaveBeenCalled();
    expect(mocks.sendEmail).not.toHaveBeenCalled();
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
      sent_email_id: null,
      idempotency_key: expect.stringMatching(/^primitive-send-[0-9a-f]{64}$/),
    });
    expect(envelope.follow_up_commands).toEqual([
      expect.objectContaining({
        kind: "find_sent_email_by_idempotency_key",
        argv: [
          "primitive",
          "sent",
          "get",
          "--idempotency-key",
          envelope.idempotency_key,
        ],
      }),
      expect.objectContaining({
        kind: "list_recent_sent_emails",
        argv: expect.arrayContaining(["primitive", "sent", "list"]),
      }),
    ]);
    // The key the envelope reports is the one the request carried.
    expect(mocks.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: { "Idempotency-Key": envelope.idempotency_key },
      }),
    );
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
      "Loading its reply failed: its existing reply email-1 could not be loaded. Do NOT resend; read the reply with: primitive emails get --id email-1",
    );
    expect(envelope.follow_up_commands[0]).toMatchObject({
      kind: "inspect_reply",
      argv: ["primitive", "emails", "get", "--id", "email-1"],
    });
    expectNoResendCommand(envelope);
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
      "This email already has 1 outgoing email, most recently at 2026-05-25T00:00:05.000Z (sent id sent-earlier). These may include activity updates and do not prove a completed answer. Sending this reply.",
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

    expect(result.stderr).not.toContain("outgoing email");
    expect(JSON.parse(result.stdout).prior_replies).toEqual([]);
  });

  it("reports already_sent, not uncertain, when the API refuses because the earlier send was deleted", async () => {
    mocks.sendEmail.mockResolvedValue(apiFailure(410, "sent_email_deleted"));

    const result = await run("chat", freshChatArgs("--json"));
    const envelope = JSON.parse(result.stdout);

    expect(result.exitCode).toBeUndefined();
    expect(envelope).toMatchObject({
      outcome: "already_sent",
      exit_code: 0,
      http_status: 410,
      sent: null,
      follow_up_commands: [],
    });
    expect(envelope.outcome_message).toContain("Nothing new was sent.");
    expect(envelope.outcome_message).toContain("Do not resend");

    // Nothing is left pending, so the same request is refused again by
    // the API rather than stopped as an unresolved local send.
    const retry = await run("chat", freshChatArgs("--json"));
    expect(JSON.parse(retry.stdout).outcome).toBe("already_sent");
    expect(mocks.sendEmail).toHaveBeenCalledTimes(2);
  });

  it("keeps other HTTP 410 errors uncertain", async () => {
    mocks.sendEmail.mockResolvedValue(apiFailure(410, "gone"));

    const result = await run("chat", freshChatArgs("--json"));

    expect(result.exitCode).toBe(4);
    expect(JSON.parse(result.stdout).outcome).toBe("uncertain");
  });

  it("reports uncertain, not not_sent, when an earlier receipt cannot be read", async () => {
    mocks.sendEmail.mockResolvedValueOnce(apiFailure(503));
    expect((await run("chat", freshChatArgs("--json"))).exitCode).toBe(4);
    const receiptDir = join(tempConfigHome, "primitive", "chat-receipts");
    for (const file of readdirSync(receiptDir)) {
      writeFileSync(join(receiptDir, file), "not json");
    }

    const retry = await run("chat", freshChatArgs("--json"));
    const envelope = JSON.parse(retry.stdout);

    expect(retry.exitCode).toBe(4);
    expect(envelope.outcome).toBe("uncertain");
    expect(envelope.error.message).toContain("Cannot safely read chat receipt");
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1);
  });

  it("points an uncertain retry at sent history from the earlier attempt's start", async () => {
    mocks.sendEmail.mockResolvedValueOnce(apiFailure(503));
    const first = JSON.parse(
      (await run("chat", freshChatArgs("--json"))).stdout,
    );
    const firstHistory = first.follow_up_commands.find(
      (c: { kind: string }) => c.kind === "list_recent_sent_emails",
    );
    expect(firstHistory).toBeDefined();

    const retry = await run("chat", freshChatArgs("--json"));
    const envelope = JSON.parse(retry.stdout);

    expect(retry.exitCode).toBe(4);
    expect(envelope.outcome).toBe("uncertain");
    // The retry reports the same content-derived key as the first attempt.
    expect(envelope.idempotency_key).toBe(first.idempotency_key);
    expect(envelope.follow_up_commands).toEqual([
      expect.objectContaining({
        kind: "find_sent_email_by_idempotency_key",
      }),
      expect.objectContaining({
        kind: "list_recent_sent_emails",
        argv: firstHistory.argv,
      }),
    ]);
    expectNoResendCommand(envelope);
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1);
  });

  it("says the reply lookup failed, not that there is no reply, when a replay's search fails", async () => {
    mocks.sendEmail.mockResolvedValue({
      data: { data: sentEmail({ idempotent_replay: true }) },
    });
    mocks.fetchEmailSearchPage.mockResolvedValue({
      ok: false,
      error: { error: { code: "internal_error", message: "search down" } },
    });

    const result = await run("chat", freshChatArgs("--json"));
    const envelope = JSON.parse(result.stdout);

    expect(result.exitCode).toBeUndefined();
    expect(envelope).toMatchObject({
      outcome: "already_sent",
      exit_code: 0,
      reply: null,
      error: {
        message: "the reply search failed (search down)",
        detail: { code: "internal_error", message: "search down" },
      },
    });
    expect(envelope.outcome_message).toContain(
      "Loading its reply failed: the reply search failed (search down).",
    );
    expect(envelope.outcome_message).not.toContain("No reply to it yet");
    expect(
      envelope.follow_up_commands.map((c: { kind: string }) => c.kind),
    ).toEqual(["wait_existing_reply", "inspect_sent_email"]);
    expect(mocks.getEmail).not.toHaveBeenCalled();
  });

  it.each([
    ["agent_failed", false],
    ["gate_denied", false],
    ["canceled", false],
    ["agent_failed", true],
  ] as const)("reports not_sent, without waiting for a reply, for a %s send record (replay: %s)", async (status, replay) => {
    mocks.sendEmail.mockResolvedValue({
      data: {
        data: sentEmail({
          delivery_status: undefined,
          idempotent_replay: replay,
          queue_id: null,
          status,
        }),
      },
    });

    const result = await run("chat", freshChatArgs("--json"));
    const envelope = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(1);
    expect(envelope).toMatchObject({
      outcome: "not_sent",
      exit_code: 1,
      sent: { id: "sent-1", status },
      reply: null,
      http_status: null,
      error: null,
    });
    expect(envelope.outcome_message).toContain(`has status ${status}`);
    expect(envelope.outcome_message).toContain("Nothing went out");
    expect(
      envelope.follow_up_commands.map((c: { kind: string }) => c.kind),
    ).toEqual(["inspect_sent_email"]);
    expect(mocks.fetchEmailSearchPage).not.toHaveBeenCalled();
    expect(`${result.stdout}${result.stderr}`).not.toContain("Already sent");
  });

  it("still reports not_sent when saving the receipt fails after a not-sent record", async () => {
    mocks.sendEmail.mockResolvedValue({
      data: { data: sentEmail({ status: "agent_failed" }) },
    });
    mocks.saveChatReceiptFailure.error = new Error("ENOSPC: no space left");

    const result = await run("chat", freshChatArgs("--json"));
    const envelope = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(1);
    expect(envelope).toMatchObject({
      outcome: "not_sent",
      exit_code: 1,
      sent: { id: "sent-1", status: "agent_failed" },
    });
    expect(result.stderr).toContain("Warning: could not update chat receipt");
    expect(result.stderr).toContain("ENOSPC: no space left");
    expect(result.stderr).toContain(
      "retrying the same message will stop as uncertain. After confirming with primitive sent get --id sent-1 that it did not go out, delete",
    );
  });

  it("lets a retry through after a send record showed the message did not go out", async () => {
    mocks.sendEmail.mockResolvedValueOnce({
      data: { data: sentEmail({ status: "agent_failed" }) },
    });
    expect((await run("chat", freshChatArgs("--json"))).exitCode).toBe(1);

    const retry = await run("chat", freshChatArgs("--json"));
    expect(retry.exitCode).toBeUndefined();
    expect(JSON.parse(retry.stdout).outcome).toBe("replied");
    expect(mocks.sendEmail).toHaveBeenCalledTimes(2);
  });

  it("reports uncertain for an unknown send record and does not send again on retry", async () => {
    mocks.sendEmail.mockResolvedValue({
      data: {
        data: sentEmail({ delivery_status: undefined, status: "unknown" }),
      },
    });

    const result = await run("chat", freshChatArgs("--json"));
    const envelope = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(4);
    expect(envelope).toMatchObject({
      outcome: "uncertain",
      exit_code: 4,
      sent: { id: "sent-1", status: "unknown" },
      reply: null,
    });
    expect(envelope.outcome_message).toContain("may or may not have gone out");
    expect(
      envelope.follow_up_commands.map((c: { kind: string }) => c.kind),
    ).toEqual(["inspect_sent_email", "list_recent_sent_emails"]);
    expectNoResendCommand(envelope);
    expect(mocks.fetchEmailSearchPage).not.toHaveBeenCalled();

    const retry = await run("chat", freshChatArgs("--json"));
    expect(retry.exitCode).toBe(4);
    expect(JSON.parse(retry.stdout).outcome).toBe("uncertain");
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1);
  });

  it("still reports the fetched reply when local bookkeeping fails afterwards", async () => {
    mocks.saveChatReceiptFailure.error = new Error("ENOSPC: no space left");

    const result = await run("chat", freshChatArgs("--json"));
    const envelope = JSON.parse(result.stdout);

    expect(result.exitCode).toBeUndefined();
    expect(envelope).toMatchObject({
      outcome: "replied",
      reply: { id: "email-1" },
    });
    expect(result.stderr).toContain("Warning: ENOSPC: no space left");
  });
});
