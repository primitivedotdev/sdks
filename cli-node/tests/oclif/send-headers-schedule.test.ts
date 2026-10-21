import { resolve } from "node:path";
import type { SendMailResult } from "@primitivedotdev/api-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAuthenticatedCliApiClient: vi.fn(),
  getEmail: vi.fn(),
  replyToEmail: vi.fn(),
  sendEmail: vi.fn(),
  setMemory: vi.fn(),
  followEmailConversation: vi.fn(),
  haltAutoWorking: vi.fn(),
}));

vi.mock("@primitivedotdev/api-core", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@primitivedotdev/api-core")>();
  return {
    ...actual,
    getEmail: mocks.getEmail,
    replyToEmail: mocks.replyToEmail,
    sendEmail: mocks.sendEmail,
    operations: {
      ...actual.operations,
      sendEmail: mocks.sendEmail,
      setMemory: mocks.setMemory,
    },
  };
});

vi.mock("../../src/oclif/api-client.js", () => ({
  createAuthenticatedCliApiClient: mocks.createAuthenticatedCliApiClient,
}));
vi.mock("../../src/oclif/auto-signals.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../src/oclif/auto-signals.js")>();
  mocks.haltAutoWorking.mockImplementation(actual.haltAutoWorking);
  return { ...actual, haltAutoWorking: mocks.haltAutoWorking };
});
vi.mock("../../src/oclif/conversation-follow.js", () => ({
  followEmailConversation: mocks.followEmailConversation,
}));

import { COMMANDS } from "../../src/oclif/index.js";
import {
  parseHeaderFlags,
  sendOptionsValidationHint,
} from "../../src/oclif/send-options.js";

// Run through the production registry, which applies the --json output
// guard every installed command gets.
type Runnable = {
  run(argv: string[], options: { root: string }): Promise<unknown>;
};

const CLI_ROOT = resolve(import.meta.dirname, "../..");
const SENT_ID = "7f9c24e8-3b1a-4b6e-9c11-0d5f8a2e6c3d";
const SCHEDULED_AT = "2026-10-09T17:00:00Z";

function sendResult(overrides: Partial<SendMailResult> = {}): SendMailResult {
  return {
    accepted: ["alice@example.com"],
    client_idempotency_key: "outcome-test",
    content_hash: "sha256:test",
    id: SENT_ID,
    idempotent_replay: false,
    from: "support@example.com",
    queue_id: null,
    rejected: [],
    request_id: "req-1",
    status: "queued",
    ...overrides,
  };
}

function validationError(message: string) {
  return {
    error: { error: { code: "validation_error", message } },
    response: { status: 400 },
  };
}

type RunResult = {
  exitCode: number | string | null | undefined;
  stderr: string;
  stdout: string;
};

async function run(command: string, argv: string[]): Promise<RunResult> {
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
    await (COMMANDS[command] as unknown as Runnable).run(argv, {
      root: CLI_ROOT,
    });
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

const sendArgs = (...extra: string[]) => [
  "--to",
  "alice@example.com",
  "--from",
  "support@example.com",
  "--body",
  "Hello",
  ...extra,
];
const replyArgs = (...extra: string[]) => [
  "--id",
  "email-1",
  "--body",
  "Thanks, got it.",
  ...extra,
];
const sentBody = () => mocks.sendEmail.mock.calls[0]?.[0].body;
const sentKey = (call = 0) =>
  mocks.sendEmail.mock.calls[call]?.[0].headers["Idempotency-Key"];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createAuthenticatedCliApiClient.mockResolvedValue({
    apiClient: { client: {} },
    auth: { kind: "api-key" },
    baseUrlOverridden: false,
  });
  mocks.getEmail.mockResolvedValue({
    data: { data: { id: "email-1", replies: [] } },
  });
  mocks.replyToEmail.mockResolvedValue({ data: { data: sendResult() } });
  mocks.sendEmail.mockResolvedValue({ data: { data: sendResult() } });
  mocks.setMemory.mockResolvedValue({ data: { data: { key: "k" } } });
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

describe("parseHeaderFlags", () => {
  it("accepts Name: value and Name=value, splitting at the first separator", () => {
    expect(
      parseHeaderFlags([
        "X-Campaign-Id: spring-sale",
        "Auto-Submitted=auto-generated",
        "X-Note: a=b: c",
        "X-Pair=k:v",
      ]),
    ).toEqual({
      "X-Campaign-Id": "spring-sale",
      "Auto-Submitted": "auto-generated",
      "X-Note": "a=b: c",
      "X-Pair": "k:v",
    });
  });

  it("returns undefined without any --header", () => {
    expect(parseHeaderFlags(undefined)).toBeUndefined();
    expect(parseHeaderFlags([])).toBeUndefined();
  });

  it.each([
    ["X-Campaign-Id spring-sale", /expects "Name: value" or "Name=value"/],
    [": value", /is not a header name/],
    ["X_Campaign: a", /is not a header name/],
    ["X--Campaign: a", /is not a header name/],
    ["X-Campaign-Id:   ", /has no value/],
    ["X-Campaign-Id: a\nBcc: b", /control character/],
    ["X-Campaign-Id: sale\n", /control character/],
    ["\nX-Campaign-Id: sale", /control character/],
    ["X-Campaign-Id: sale\r\n", /control character/],
  ])("refuses %j", (entry, message) => {
    expect(() => parseHeaderFlags([entry])).toThrow(message);
  });

  it("refuses a name given twice, comparing case-insensitively", () => {
    expect(() => parseHeaderFlags(["X-Tag: a", "X-Tag: b"])).toThrow(
      "--header X-Tag is given more than once",
    );
    expect(() => parseHeaderFlags(["X-Tag: a", "x-tag=b"])).toThrow(
      "--header X-Tag and x-tag name the same header",
    );
  });
});

describe("sendOptionsValidationHint", () => {
  const error = (message: string) => ({ code: "validation_error", message });

  it("restates a header refusal in one line", () => {
    expect(
      sendOptionsValidationHint(
        error("headers: X-Primitive-Foo is a reserved header name"),
        { headers: { "X-Primitive-Foo": "1" } },
      ),
    ).toBe(
      "The API refused the request: headers: X-Primitive-Foo is a reserved header name Check the --header names and values; --help lists which names are allowed.",
    );
  });

  it("stays quiet for other errors or requests without these options", () => {
    expect(
      sendOptionsValidationHint(
        { code: "forbidden", message: "headers are not allowed" },
        { headers: { "X-Tag": "a" } },
      ),
    ).toBeNull();
    expect(
      sendOptionsValidationHint(error("subject is required"), {}),
    ).toBeNull();
  });
});

describe("send --header", () => {
  it("sends each header in the request's headers object", async () => {
    const result = await run(
      "send",
      sendArgs(
        "--header",
        "X-Campaign-Id: spring-sale",
        "--header",
        "Auto-Submitted=auto-generated",
      ),
    );
    expect(result.exitCode).toBeUndefined();
    expect(sentBody().headers).toEqual({
      "X-Campaign-Id": "spring-sale",
      "Auto-Submitted": "auto-generated",
    });
  });

  it("sends no headers field without --header", async () => {
    await run("send", sendArgs());
    expect(sentBody()).not.toHaveProperty("headers");
  });

  it("gives a send with different headers its own derived idempotency key", async () => {
    await run("send", sendArgs());
    await run("send", sendArgs("--header", "X-Tag: a"));
    await run("send", sendArgs("--header", "X-Tag: b"));
    const keys = [sentKey(0), sentKey(1), sentKey(2)];
    expect(new Set(keys).size).toBe(3);
  });

  it("refuses malformed or duplicate headers before sending", async () => {
    for (const argv of [
      sendArgs("--header", "X-Tag"),
      sendArgs("--header", "X-Tag: a", "--header", "x-TAG: b"),
    ]) {
      const result = await run("send", argv);
      expect(result.exitCode).toBe(2);
    }
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("surfaces the server's validation_error message for a refused header", async () => {
    mocks.sendEmail.mockResolvedValue(
      validationError("headers: X-Primitive-Foo is a reserved header name"),
    );
    const result = await run(
      "send",
      sendArgs("--header", "X-Primitive-Foo: 1"),
    );
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(
      "The API refused the request: headers: X-Primitive-Foo is a reserved header name",
    );
    expect(result.stderr).toContain("Message not sent");
  });

  it("carries the refusal in the --json envelope with nothing on stderr", async () => {
    mocks.sendEmail.mockResolvedValue(
      validationError("headers: X-Primitive-Foo is a reserved header name"),
    );
    const result = await run(
      "send",
      sendArgs("--header", "X-Primitive-Foo: 1", "--json"),
    );
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe("");
    const envelope = JSON.parse(result.stdout);
    expect(envelope).toMatchObject({
      outcome: "not_sent",
      error: {
        code: "validation_error",
        message: "headers: X-Primitive-Foo is a reserved header name",
      },
    });
  });
});

describe("reply --header", () => {
  it("sends each header in the reply body", async () => {
    const result = await run(
      "reply",
      replyArgs("--header", "X-Ticket-Id: 4821"),
    );
    expect(result.exitCode).toBeUndefined();
    expect(mocks.replyToEmail.mock.calls[0]?.[0].body.headers).toEqual({
      "X-Ticket-Id": "4821",
    });
  });

  it("refuses a duplicate header before sending", async () => {
    const result = await run(
      "reply",
      replyArgs("--header", "X-Tag: a", "--header", "X-Tag: b"),
    );
    expect(result.exitCode).toBe(2);
    expect(mocks.replyToEmail).not.toHaveBeenCalled();
  });

  it("surfaces the server's validation_error message", async () => {
    mocks.replyToEmail.mockResolvedValue(
      validationError("headers: X-Session-Id is credential-like"),
    );
    const result = await run("reply", replyArgs("--header", "X-Session-Id: s"));
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(
      "The API refused the request: headers: X-Session-Id is credential-like",
    );
  });
});

describe("send --scheduled-at", () => {
  beforeEach(() => {
    mocks.sendEmail.mockResolvedValue({
      data: {
        data: sendResult({
          status: "scheduled",
          scheduled_at: "2026-10-09T17:00:00.000Z",
          client_idempotency_key: "standup-1",
        }),
      },
    });
  });

  it("sends scheduled_at and says the send is scheduled and how to cancel it", async () => {
    const result = await run(
      "send",
      sendArgs(
        "--scheduled-at",
        SCHEDULED_AT,
        "--idempotency-key",
        "standup-1",
      ),
    );
    expect(result.exitCode).toBeUndefined();
    expect(sentBody().scheduled_at).toBe(SCHEDULED_AT);
    expect(sentKey()).toBe("standup-1");
    expect(result.stderr).toContain(
      `Message scheduled for 2026-10-09T17:00:00.000Z (id ${SENT_ID}). Nothing has gone out yet.`,
    );
    expect(result.stderr).toContain(`primitive sent cancel --id ${SENT_ID}`);
    expect(result.stderr).toContain(
      "primitive sent cancel --idempotency-key standup-1",
    );
    expect(JSON.parse(result.stdout)).toMatchObject({ status: "scheduled" });
  });

  it("names the derived key in the cancel hint when none is passed", async () => {
    const result = await run("send", sendArgs("--scheduled-at", SCHEDULED_AT));
    expect(result.stderr).toContain(
      `primitive sent cancel --idempotency-key ${sentKey()}`,
    );
  });

  it("adds a cancel follow-up to the --json envelope", async () => {
    const result = await run(
      "send",
      sendArgs("--scheduled-at", SCHEDULED_AT, "--json"),
    );
    expect(result.exitCode).toBeUndefined();
    const envelope = JSON.parse(result.stdout);
    expect(envelope.outcome).toBe("sent");
    expect(envelope.outcome_message).toContain("Message scheduled for");
    expect(envelope.follow_up_commands).toContainEqual(
      expect.objectContaining({
        kind: "cancel_scheduled_send",
        argv: ["primitive", "sent", "cancel", "--id", SENT_ID],
      }),
    );
  });

  it("says a retried scheduled send is still pending, never to send again", async () => {
    mocks.sendEmail.mockResolvedValue({
      data: {
        data: sendResult({
          status: "scheduled",
          scheduled_at: "2026-10-09T17:00:00.000Z",
          idempotent_replay: true,
        }),
      },
    });
    const result = await run("send", sendArgs("--scheduled-at", SCHEDULED_AT));
    expect(result.exitCode).toBeUndefined();
    expect(result.stderr).toContain(
      `Message already scheduled for 2026-10-09T17:00:00.000Z (id ${SENT_ID}). Nothing has gone out yet.`,
    );
    expect(result.stderr).not.toContain("new key");
    expect(result.stderr).not.toContain("went out");
    const json = await run(
      "send",
      sendArgs("--scheduled-at", SCHEDULED_AT, "--json"),
    );
    expect(JSON.parse(json.stdout).outcome).toBe("already_sent");
  });

  it("leaves automatic working alone until the message actually goes out", async () => {
    await run("send", sendArgs("--scheduled-at", SCHEDULED_AT));
    expect(mocks.haltAutoWorking).not.toHaveBeenCalled();
    mocks.sendEmail.mockResolvedValue({ data: { data: sendResult() } });
    await run("send", sendArgs());
    expect(mocks.haltAutoWorking).toHaveBeenCalledTimes(1);
  });

  it("accepts a numeric UTC offset as given", async () => {
    await run("send", sendArgs("--scheduled-at", "2026-10-09T13:00:00-04:00"));
    expect(sentBody().scheduled_at).toBe("2026-10-09T13:00:00-04:00");
  });

  it("refuses a time without a zone, or a bare date, before sending", async () => {
    for (const value of ["2026-10-09T17:00:00", "2026-10-09", "tomorrow"]) {
      const result = await run("send", sendArgs("--scheduled-at", value));
      expect(result.exitCode).toBe(2);
    }
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it.each([
    [["--wait"]],
    [["--wait-timeout-ms", "5000"]],
    [["--attachment", "./package.json"]],
    [["--in-reply-to", "<p@example.com>", "--fyi"]],
    [
      [
        "--in-reply-to",
        "<p@example.com>",
        "--if-latest-message-id",
        "11111111-1111-4111-8111-111111111111",
      ],
    ],
  ])("cannot be combined with %j", async (extra) => {
    const result = await run(
      "send",
      sendArgs("--scheduled-at", SCHEDULED_AT, ...extra),
    );
    expect(result.exitCode).toBe(2);
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("leaves a repeat to the server, as the API does not exclude it", async () => {
    await run(
      "send",
      sendArgs("--scheduled-at", SCHEDULED_AT, "--repeat-every", "60"),
    );
    expect(sentBody()).toMatchObject({
      scheduled_at: SCHEDULED_AT,
      repeat: { every_minutes: 60 },
    });
  });

  it("surfaces a refused schedule time", async () => {
    mocks.sendEmail.mockResolvedValue(
      validationError("scheduled_at must be in the future"),
    );
    const result = await run("send", sendArgs("--scheduled-at", SCHEDULED_AT));
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(
      "The API refused the request: scheduled_at must be in the future --scheduled-at must be in the future and at most 30 days out.",
    );
  });

  it("keeps the plain summary for an immediate send", async () => {
    mocks.sendEmail.mockResolvedValue({ data: { data: sendResult() } });
    const result = await run("send", sendArgs());
    expect(result.stderr).toContain(
      `Message sent (queued for delivery, id ${SENT_ID}). Do not resend.`,
    );
    expect(result.stderr).not.toContain("primitive sent cancel");
  });
});

describe("generated operations: declared request headers", () => {
  type FlagMap = Record<string, { description?: string; required?: boolean }>;
  const flagsOf = (id: string) =>
    (COMMANDS[id] as unknown as { flags: FlagMap }).flags;

  it("adds --idempotency-key to sending send-email from the spec", () => {
    expect(flagsOf("sending:send-email")["idempotency-key"]).toBeDefined();
    expect(flagsOf("sending:send-email")["idempotency-key"]?.required).toBe(
      false,
    );
  });

  it("sends --idempotency-key as the Idempotency-Key request header", async () => {
    const result = await run("sending:send-email", [
      "--to",
      "alice@example.com",
      "--from",
      "support@example.com",
      "--subject",
      "Hi",
      "--body-text",
      "Hello",
      "--idempotency-key",
      "order-42",
    ]);
    expect(result.exitCode).toBeUndefined();
    const options = mocks.sendEmail.mock.calls[0]?.[0];
    expect(options.headers).toEqual({ "Idempotency-Key": "order-42" });
    expect(options.body).not.toHaveProperty("idempotency_key");
  });

  it("sends no headers when no header flag is passed", async () => {
    await run("sending:send-email", [
      "--to",
      "alice@example.com",
      "--from",
      "support@example.com",
      "--subject",
      "Hi",
      "--body-text",
      "Hello",
    ]);
    expect(mocks.sendEmail.mock.calls[0]?.[0]).not.toHaveProperty("headers");
  });

  it("refuses an empty header value before the request", async () => {
    const result = await run("sending:send-email", [
      "--raw-body",
      "{}",
      "--idempotency-key",
      " ",
    ]);
    expect(result.exitCode).toBe(2);
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("covers every declared header, not only Idempotency-Key", async () => {
    const functionId = "22222222-2222-4222-8222-222222222222";
    const result = await run("memories:set-memory", [
      "--key",
      "k",
      "--raw-body",
      '{"key":"k","value":1}',
      "--x-primitive-function-id",
      functionId,
    ]);
    expect(result.exitCode).toBeUndefined();
    expect(mocks.setMemory.mock.calls[0]?.[0].headers).toEqual({
      "x-primitive-function-id": functionId,
    });
  });

  it("leaves primitive send's own --idempotency-key working", async () => {
    await run("send", sendArgs("--idempotency-key", "send-key-1"));
    expect(sentKey()).toBe("send-key-1");
  });
});
