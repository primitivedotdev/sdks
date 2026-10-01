import { resolve } from "node:path";
import type { SendMailResult } from "@primitivedotdev/api-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAuthenticatedCliApiClient: vi.fn(),
  getEmail: vi.fn(),
  replyToEmail: vi.fn(),
  sendEmail: vi.fn(),
  followEmailConversation: vi.fn(),
}));

vi.mock("@primitivedotdev/api-core", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@primitivedotdev/api-core")>();
  return {
    ...actual,
    getEmail: mocks.getEmail,
    replyToEmail: mocks.replyToEmail,
    sendEmail: mocks.sendEmail,
  };
});

vi.mock("../../src/oclif/api-client.js", () => ({
  createAuthenticatedCliApiClient: mocks.createAuthenticatedCliApiClient,
}));
vi.mock("../../src/oclif/conversation-follow.js", () => ({
  followEmailConversation: mocks.followEmailConversation,
}));

import { COMMANDS } from "../../src/oclif/index.js";

// Run through the production registry, which applies the --json output
// guard every installed command gets.
type Runnable = {
  run(argv: string[], options: { root: string }): Promise<unknown>;
};
const ReplyCommand = COMMANDS.reply as unknown as Runnable;
const SendCommand = COMMANDS.send as unknown as Runnable;

const CLI_ROOT = resolve(import.meta.dirname, "../..");

function sendResult(overrides: Partial<SendMailResult> = {}): SendMailResult {
  return {
    accepted: ["alice@example.com"],
    client_idempotency_key: "outcome-test",
    content_hash: "sha256:test",
    id: "sent-1",
    idempotent_replay: false,
    from: "support@example.com",
    queue_id: null,
    rejected: [],
    request_id: "req-1",
    status: "queued",
    ...overrides,
  };
}

function inboundWithReplies(replies: unknown[]) {
  return { data: { data: { id: "email-1", replies } } };
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
};

async function run(
  command: "reply" | "send",
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
    if (command === "reply") {
      await ReplyCommand.run(argv, { root: CLI_ROOT });
    } else {
      await SendCommand.run(argv, { root: CLI_ROOT });
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
  };
}

const replyArgs = (...extra: string[]) => [
  "--id",
  "email-1",
  "--body",
  "Thanks, got it.",
  ...extra,
];
const sendArgs = (...extra: string[]) => [
  "--to",
  "alice@example.com",
  "--from",
  "support@example.com",
  "--body",
  "Hello",
  ...extra,
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createAuthenticatedCliApiClient.mockResolvedValue({
    apiClient: { client: {} },
    auth: { kind: "api-key" },
    baseUrlOverridden: false,
  });
  mocks.getEmail.mockResolvedValue(inboundWithReplies([]));
  mocks.replyToEmail.mockResolvedValue({ data: { data: sendResult() } });
  mocks.sendEmail.mockResolvedValue({ data: { data: sendResult() } });
  mocks.followEmailConversation.mockReset().mockResolvedValue(null);
});

afterEach(() => {
  process.exitCode = undefined;
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("reply outcomes", () => {
  function connectedSession() {
    vi.stubEnv("CODEX_SESSION_ID", "cccccccc-cccc-4ccc-8ccc-cccccccccccc");
    vi.stubEnv("CODEX_THREAD_ID", "cccccccc-cccc-4ccc-8ccc-cccccccccccc");
    vi.stubEnv("CLAUDE_CODE_SESSION_ID", undefined);
    mocks.createAuthenticatedCliApiClient.mockResolvedValue({
      apiClient: { client: {} },
      auth: {
        apiKey: ["pconn", "fixture"].join("_"),
        apiBaseUrl: "https://example.test/v1",
        connectedAgent: { agentAddress: "support@example.com" },
      },
      baseUrlOverridden: false,
    });
    const detail = {
      id: "email-1",
      from_email: "alice@example.com",
      thread_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      replies: [],
      body_text: "Private incoming message",
    };
    mocks.getEmail.mockResolvedValue({ data: { data: detail } });
    return detail;
  }
  it("registers native conversation receiving before sending using one detail read", async () => {
    const detail = connectedSession();
    const order: string[] = [];
    mocks.followEmailConversation.mockImplementation(async () => {
      order.push("follow");
      return null;
    });
    mocks.replyToEmail.mockImplementation(async () => {
      order.push("send");
      return { data: { data: sendResult() } };
    });
    const result = await run("reply", replyArgs("--json"));
    expect(result.exitCode).toBeUndefined();
    expect(order, result.stdout).toEqual(["follow", "send"]);
    expect(mocks.getEmail).toHaveBeenCalledOnce();
    expect(mocks.followEmailConversation).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: "support@example.com",
        peer: "alice@example.com",
        sessionKey: "codex:cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      }),
      detail,
    );
    expect(result.stdout).not.toContain("Private incoming message");
    expect(JSON.parse(result.stdout).outcome).toBe("sent");
  });
  it("does not send when native conversation ownership cannot be established", async () => {
    connectedSession();
    mocks.followEmailConversation.mockRejectedValue(
      new Error("Conversation belongs to another native session."),
    );
    const result = await run("reply", replyArgs("--json"));
    expect(mocks.replyToEmail).not.toHaveBeenCalled();
    expect(JSON.parse(result.stdout).outcome).toBe("not_sent");
  });
  it("fails before sending on connected-session lookup failure instead of falsely promising receiving", async () => {
    connectedSession();
    mocks.getEmail.mockResolvedValue(apiFailure(503));
    const result = await run("reply", replyArgs("--json"));
    expect(mocks.replyToEmail).not.toHaveBeenCalled();
    expect(mocks.followEmailConversation).not.toHaveBeenCalled();
    expect(JSON.parse(result.stdout).outcome).toBe("not_sent");
  });
  it("never retries an uncertain reply after conversation receiving was registered", async () => {
    connectedSession();
    mocks.replyToEmail.mockResolvedValue(apiFailure(503));
    const result = await run("reply", replyArgs("--json"));
    expect(mocks.followEmailConversation, result.stdout).toHaveBeenCalledOnce();
    expect(mocks.replyToEmail).toHaveBeenCalledOnce();
    expect(JSON.parse(result.stdout).outcome).toBe("uncertain");
  });
  it("keeps stdout byte-compatible and summarises a queued reply as sent on stderr", async () => {
    const result = await run("reply", replyArgs());

    expect(result.exitCode).toBeUndefined();
    expect(result.stdout).toBe(`${JSON.stringify(sendResult(), null, 2)}\n`);
    expect(result.stderr).toBe(
      "Reply sent (queued for delivery, id sent-1). Do not resend.\n",
    );
  });

  it("emits an outcome envelope with --json", async () => {
    const result = await run("reply", replyArgs("--json"));
    const envelope = JSON.parse(result.stdout);

    expect(result.exitCode).toBeUndefined();
    expect(envelope).toEqual({
      outcome: "sent",
      exit_code: 0,
      outcome_message:
        "Reply sent (queued for delivery, id sent-1). Do not resend.",
      sent_email_id: "sent-1",
      idempotency_key: expect.stringMatching(/^primitive-reply-[0-9a-f]{64}$/),
      sent: sendResult(),
      http_status: null,
      error: null,
      follow_up_commands: [
        expect.objectContaining({
          kind: "inspect_sent_email",
          argv: ["primitive", "sent", "get", "--id", "sent-1"],
        }),
      ],
      prior_replies: [],
      prior_replies_check: { status: "checked" },
    });
  });

  it("warns about a prior reply that went out but still sends", async () => {
    mocks.getEmail.mockResolvedValue(
      inboundWithReplies([
        {
          created_at: "2026-09-01T10:00:00.000Z",
          id: "sent-denied",
          status: "gate_denied",
          to_address: "alice@example.com",
        },
        {
          created_at: "2026-09-01T11:00:00.000Z",
          id: "sent-prior",
          status: "delivered",
          to_address: "alice@example.com",
        },
      ]),
    );

    const result = await run("reply", replyArgs("--json"));
    const envelope = JSON.parse(result.stdout);

    expect(mocks.getEmail).toHaveBeenCalledWith(
      expect.objectContaining({ path: { id: "email-1" } }),
    );
    // --json moves the warning from stderr into the envelope.
    expect(result.stderr).toBe("");
    expect(envelope.warnings).toContain(
      "This email already has 1 outgoing email, most recently at 2026-09-01T11:00:00.000Z (sent id sent-prior). These may include activity updates and do not prove a completed answer. Sending this reply.",
    );
    expect(mocks.replyToEmail).toHaveBeenCalledTimes(1);
    expect(result.exitCode).toBeUndefined();
    expect(envelope.outcome).toBe("sent");
    expect(envelope.prior_replies).toEqual([
      expect.objectContaining({ id: "sent-prior" }),
    ]);
  });

  it("counts prior outgoing emails without claiming they are answers", async () => {
    mocks.getEmail.mockResolvedValue(
      inboundWithReplies([
        {
          created_at: "2026-09-01T10:00:00.000Z",
          id: "sent-a",
          status: "queued",
          to_address: "alice@example.com",
        },
        {
          created_at: "2026-09-01T11:00:00.000Z",
          id: "sent-b",
          status: "bounced",
          to_address: "alice@example.com",
        },
      ]),
    );

    const result = await run("reply", replyArgs());

    expect(result.stderr).toContain(
      "This email already has 2 outgoing emails, most recently at 2026-09-01T11:00:00.000Z (sent id sent-b). These may include activity updates and do not prove a completed answer. Sending this reply.",
    );
  });

  it("proceeds with the send and says so when the prior-reply lookup fails", async () => {
    mocks.getEmail.mockResolvedValue(apiFailure(503));

    const result = await run("reply", replyArgs("--json"));
    const envelope = JSON.parse(result.stdout);

    expect(result.stderr).toBe("");
    expect(envelope.warnings).toContain(
      "Could not check whether you already replied to email email-1 (the email lookup returned HTTP 503). Prior-reply check skipped; sending the reply anyway.",
    );
    expect(mocks.replyToEmail).toHaveBeenCalledTimes(1);
    expect(result.exitCode).toBeUndefined();
    expect(envelope.outcome).toBe("sent");
    expect(envelope.prior_replies).toBeNull();
    expect(envelope.prior_replies_check).toEqual({
      status: "skipped",
      reason: "the email lookup returned HTTP 503",
    });
  });

  it("proceeds with the send when the prior-reply lookup throws", async () => {
    mocks.getEmail.mockRejectedValue(new Error("socket hang up"));

    const result = await run("reply", replyArgs());

    expect(result.stderr).toContain(
      "(the email lookup failed: socket hang up). Prior-reply check skipped",
    );
    expect(mocks.replyToEmail).toHaveBeenCalledTimes(1);
    expect(result.exitCode).toBeUndefined();
  });

  it("reports already_sent with exit 0 on an idempotent replay", async () => {
    const replayed = sendResult({
      idempotent_replay: true,
      status: "delivered",
      delivery_status: "delivered",
    });
    mocks.replyToEmail.mockResolvedValue({ data: { data: replayed } });

    const result = await run("reply", replyArgs());

    expect(result.exitCode).toBeUndefined();
    expect(result.stdout).toBe(`${JSON.stringify(replayed, null, 2)}\n`);
    expect(result.stderr).toBe(
      "Already sent: this exact message went out earlier (sent id sent-1, status delivered). Nothing new was sent.\n",
    );
  });

  it("reports not_sent, not already_sent, when a replay returns a gate-denied record", async () => {
    mocks.replyToEmail.mockResolvedValue({
      data: {
        data: sendResult({ idempotent_replay: true, status: "gate_denied" }),
      },
    });

    const result = await run("reply", replyArgs("--json"));
    const envelope = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(1);
    expect(envelope).toMatchObject({
      outcome: "not_sent",
      exit_code: 1,
      sent: { id: "sent-1", status: "gate_denied" },
      outcome_message:
        "Reply not sent: the earlier identical attempt (sent id sent-1) has status gate_denied. Nothing went out; fix the problem before retrying.",
    });
    expect(result.stderr).toBe("");
  });

  it("reports not_sent with exit 1 for a definitive rejection", async () => {
    mocks.replyToEmail.mockResolvedValue(apiFailure(422, "validation_error"));

    const result = await run("reply", replyArgs("--json"));
    const envelope = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(1);
    expect(envelope).toMatchObject({
      outcome: "not_sent",
      exit_code: 1,
      http_status: 422,
      sent: null,
      error: { code: "validation_error" },
      follow_up_commands: [],
      prior_replies: [],
    });
  });

  it("reports already_sent when the API refuses because the earlier reply was deleted", async () => {
    mocks.replyToEmail.mockResolvedValue(apiFailure(410, "sent_email_deleted"));

    const result = await run("reply", replyArgs("--json"));
    const envelope = JSON.parse(result.stdout);

    expect(result.exitCode).toBeUndefined();
    expect(envelope).toMatchObject({
      outcome: "already_sent",
      exit_code: 0,
      http_status: 410,
      sent: null,
      follow_up_commands: [],
    });
    expect(result.stderr).toBe("");
    expect(envelope.outcome_message).toContain("(HTTP 410 sent_email_deleted)");
    expect(envelope.outcome_message).toContain("Nothing new was sent.");
  });

  it("reports uncertain with exit 4 for a server error", async () => {
    mocks.replyToEmail.mockResolvedValue(apiFailure(502));

    const result = await run("reply", replyArgs("--json"));
    const envelope = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(4);
    expect(envelope.outcome).toBe("uncertain");
    expect(envelope.sent_email_id).toBeNull();
    expect(envelope.idempotency_key).toMatch(/^primitive-reply-[0-9a-f]{64}$/);
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
      expect.objectContaining({ kind: "list_recent_sent_emails" }),
    ]);
    expect(result.stderr).toBe("");
    expect(envelope.outcome_message).toContain(
      "Reply send outcome uncertain (HTTP 502): it may or may not have gone out.",
    );
  });

  it("emits a not_sent envelope when the command fails before sending", async () => {
    const result = await run("reply", ["--id", "email-1", "--json"]);
    const envelope = JSON.parse(result.stdout);

    expect(envelope.outcome).toBe("not_sent");
    expect(envelope.exit_code).toBe(result.exitCode);
    expect(mocks.replyToEmail).not.toHaveBeenCalled();
  });
});

describe("send outcomes", () => {
  it("keeps stdout byte-compatible and summarises the send on stderr", async () => {
    const result = await run("send", sendArgs());

    expect(result.exitCode).toBeUndefined();
    expect(result.stdout).toBe(`${JSON.stringify(sendResult(), null, 2)}\n`);
    expect(result.stderr).toBe(
      "Message sent (queued for delivery, id sent-1). Do not resend.\n",
    );
  });

  it("describes a delivered send", async () => {
    mocks.sendEmail.mockResolvedValue({
      data: { data: sendResult({ status: "delivered" }) },
    });

    const result = await run("send", sendArgs("--wait"));

    expect(result.stderr).toBe(
      "Message sent (delivered, id sent-1). Do not resend.\n",
    );
  });

  it("emits an envelope without prior-reply fields", async () => {
    const result = await run("send", sendArgs("--json"));
    const envelope = JSON.parse(result.stdout);

    expect(envelope.outcome).toBe("sent");
    expect(envelope).not.toHaveProperty("prior_replies");
    expect(mocks.getEmail).not.toHaveBeenCalled();
  });

  it("reports already_sent on an idempotent replay", async () => {
    mocks.sendEmail.mockResolvedValue({
      data: { data: sendResult({ idempotent_replay: true }) },
    });

    const result = await run("send", sendArgs("--json"));
    const envelope = JSON.parse(result.stdout);

    expect(result.exitCode).toBeUndefined();
    expect(envelope).toMatchObject({ outcome: "already_sent", exit_code: 0 });
    expect(result.stderr).toBe("");
    expect(envelope.outcome_message).toContain("Nothing new was sent.");
    expect(result.stdout).not.toMatch(/vary|fresh copy/i);
  });

  it.each([
    [429, "not_sent", 1],
    [401, "not_sent", 1],
    [500, "uncertain", 4],
    [409, "uncertain", 4],
    [undefined, "uncertain", 4],
  ])("maps HTTP %s to %s (exit %i)", async (status, outcome, exitCode) => {
    mocks.sendEmail.mockResolvedValue(apiFailure(status));

    const result = await run("send", sendArgs("--json"));
    const envelope = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(exitCode);
    expect(envelope).toMatchObject({
      outcome,
      exit_code: exitCode,
      http_status: status ?? null,
    });
  });

  it("serializes a transport Error payload instead of printing {}", async () => {
    mocks.sendEmail.mockResolvedValue({
      error: new TypeError("fetch failed", {
        cause: { code: "ECONNRESET" },
      }),
      response: undefined,
    });

    const result = await run("send", sendArgs("--json"));
    const envelope = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(4);
    expect(envelope.error).toEqual({
      name: "TypeError",
      message: "fetch failed",
      code: "ECONNRESET",
    });
  });

  it("reports not_sent with exit 1 when the send record shows the agent rejected it", async () => {
    const failed = sendResult({ status: "agent_failed" });
    mocks.sendEmail.mockResolvedValue({ data: { data: failed } });

    const result = await run("send", sendArgs());

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe(`${JSON.stringify(failed, null, 2)}\n`);
    expect(result.stderr).toBe(
      "Message not sent: the send record (id sent-1) has status agent_failed. Nothing went out; fix the problem before retrying.\n",
    );
  });

  it("reports uncertain with exit 4 when the send record status is unknown", async () => {
    mocks.sendEmail.mockResolvedValue({
      data: { data: sendResult({ status: "unknown" }) },
    });

    const result = await run("send", sendArgs("--json"));
    const envelope = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(4);
    expect(envelope).toMatchObject({
      outcome: "uncertain",
      exit_code: 4,
      sent: { id: "sent-1", status: "unknown" },
    });
    expect(
      envelope.follow_up_commands.map((c: { kind: string }) => c.kind),
    ).toEqual(["inspect_sent_email", "list_recent_sent_emails"]);
    expect(result.stderr).toBe("");
    expect(envelope.outcome_message).toContain("may or may not have gone out");
  });

  it("reports uncertain when the API accepts the send but returns no record", async () => {
    mocks.sendEmail.mockResolvedValue({ data: {} });

    const result = await run("send", sendArgs());

    expect(result.exitCode).toBe(4);
    expect(result.stdout).toBe("null\n");
    expect(result.stderr).toContain("returned no send record");
  });
});
