import { resolve } from "node:path";
import type { SendMailResult } from "@primitivedotdev/api-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAuthenticatedCliApiClient: vi.fn(),
  getEmail: vi.fn(),
  replyToEmail: vi.fn(),
  sendEmail: vi.fn(),
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

import ReplyCommand from "../../src/oclif/commands/reply.js";
import SendCommand from "../../src/oclif/commands/send.js";

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
});

afterEach(() => {
  process.exitCode = undefined;
  vi.restoreAllMocks();
});

describe("reply outcomes", () => {
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
    expect(result.stderr).toContain(
      "You already replied to this email at 2026-09-01T11:00:00.000Z (sent id sent-prior). Sending another reply.",
    );
    expect(mocks.replyToEmail).toHaveBeenCalledTimes(1);
    expect(result.exitCode).toBeUndefined();
    expect(envelope.outcome).toBe("sent");
    expect(envelope.prior_replies).toEqual([
      expect.objectContaining({ id: "sent-prior" }),
    ]);
  });

  it("counts several prior replies in the warning", async () => {
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
      "You already replied to this email 2 times, most recently at 2026-09-01T11:00:00.000Z (sent id sent-b). Sending another reply.",
    );
  });

  it("proceeds with the send and says so when the prior-reply lookup fails", async () => {
    mocks.getEmail.mockResolvedValue(apiFailure(503));

    const result = await run("reply", replyArgs("--json"));
    const envelope = JSON.parse(result.stdout);

    expect(result.stderr).toContain(
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
    expect(result.stderr).toContain("(HTTP 410 sent_email_deleted)");
    expect(result.stderr).toContain("Nothing new was sent.");
  });

  it("reports uncertain with exit 4 for a server error", async () => {
    mocks.replyToEmail.mockResolvedValue(apiFailure(502));

    const result = await run("reply", replyArgs("--json"));
    const envelope = JSON.parse(result.stdout);

    expect(result.exitCode).toBe(4);
    expect(envelope.outcome).toBe("uncertain");
    expect(envelope.follow_up_commands[0]).toMatchObject({
      kind: "list_recent_sent_emails",
    });
    expect(result.stderr).toContain(
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
    expect(result.stderr).toContain("Nothing new was sent.");
    expect(result.stderr).not.toMatch(/vary|fresh copy/i);
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

  it("reports uncertain when the API accepts the send but returns no record", async () => {
    mocks.sendEmail.mockResolvedValue({ data: {} });

    const result = await run("send", sendArgs());

    expect(result.exitCode).toBe(4);
    expect(result.stdout).toBe("null\n");
    expect(result.stderr).toContain("returned no send record");
  });
});
