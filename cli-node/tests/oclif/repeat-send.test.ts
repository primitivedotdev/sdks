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
  vi.stubEnv("CLAUDE_CODE_SESSION_ID", undefined);
  vi.stubEnv("CODEX_THREAD_ID", undefined);
  vi.stubEnv("CODEX_SESSION_ID", undefined);
});

afterEach(() => {
  process.exitCode = undefined;
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

const REPEAT_ID = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";

describe("send --repeat-every", () => {
  it("adds repeat to the send and names the repeat", async () => {
    mocks.sendEmail.mockResolvedValue({
      data: { data: { ...sendResult(), repeat_id: REPEAT_ID } },
    });
    const result = await run(
      "send",
      sendArgs(
        "--repeat-every",
        "30",
        "--only-if-idle",
        "15",
        "--no-recipient-stop",
        "--max-sends",
        "10",
        "--until",
        "2026-10-09T17:00:00Z",
      ),
    );
    expect(result.exitCode).toBeUndefined();
    expect(mocks.sendEmail.mock.calls[0]?.[0].body.repeat).toEqual({
      every_minutes: 30,
      only_if_recipient_idle_minutes: 15,
      stoppable_by_recipient: false,
      max_sends: 10,
      until: "2026-10-09T17:00:00.000Z",
    });
    expect(result.stderr).toContain(
      `Repeating every 30 min as repeat ${REPEAT_ID}.`,
    );
  });

  it("sends no repeat field without --repeat-every", async () => {
    await run("send", sendArgs());
    expect(mocks.sendEmail.mock.calls[0]?.[0].body).not.toHaveProperty(
      "repeat",
    );
  });

  it("gives a repeating send its own idempotency key", async () => {
    await run("send", sendArgs());
    await run("send", sendArgs("--repeat-every", "30"));
    const keys = mocks.sendEmail.mock.calls.map(
      (call) => call[0].headers["Idempotency-Key"],
    );
    expect(keys[0]).not.toBe(keys[1]);
  });

  it("refuses repeat options without --repeat-every and out-of-range values", async () => {
    for (const argv of [
      sendArgs("--only-if-idle", "5"),
      sendArgs("--max-sends", "3"),
      sendArgs("--repeat-every", "4"),
      sendArgs("--repeat-every", "30", "--cc", "bob@example.com"),
    ]) {
      const result = await run("send", argv);
      expect(result.exitCode).not.toBeUndefined();
    }
    const badUntil = await run(
      "send",
      sendArgs("--repeat-every", "30", "--until", "next week"),
    );
    expect(badUntil.exitCode).not.toBeUndefined();
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("explains a refused external recipient", async () => {
    mocks.sendEmail.mockResolvedValue(
      apiFailure(403, "repeat_recipient_external"),
    );
    const result = await run("send", sendArgs("--repeat-every", "30"));
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(
      "Repeating sends can only go to addresses in your own organization.",
    );
  });
});

describe("repeat flag help", () => {
  it("states each command's own requirement", () => {
    const flags = (name: "send" | "reply") =>
      (
        COMMANDS[name] as unknown as {
          flags: Record<string, { description?: string }>;
        }
      ).flags["repeat-every"]?.description ?? "";
    expect(flags("send")).toContain("exactly one --to recipient");
    expect(flags("reply")).toContain("The email you reply to must come from");
    expect(flags("reply")).not.toContain("--to");
  });
});

describe("reply --repeat-every", () => {
  it("adds repeat to the reply", async () => {
    mocks.replyToEmail.mockResolvedValue({
      data: { data: { ...sendResult(), repeat_id: REPEAT_ID } },
    });
    const result = await run("reply", replyArgs("--repeat-every", "60"));
    expect(mocks.replyToEmail.mock.calls[0]?.[0].body.repeat).toEqual({
      every_minutes: 60,
    });
    expect(result.stderr).toContain(`as repeat ${REPEAT_ID}`);
  });

  it("refuses --repeat-every with --fyi", async () => {
    const result = await run(
      "reply",
      replyArgs("--fyi", "--repeat-every", "60"),
    );
    expect(result.exitCode).not.toBeUndefined();
    expect(mocks.replyToEmail).not.toHaveBeenCalled();
  });
});
