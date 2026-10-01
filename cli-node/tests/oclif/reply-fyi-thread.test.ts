import { createHash } from "node:crypto";
import { resolve } from "node:path";
import type { SendMailResult } from "@primitivedotdev/api-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAuthenticatedCliApiClient: vi.fn(),
  getEmail: vi.fn(),
  getThread: vi.fn(),
  replyToEmail: vi.fn(),
  sendEmail: vi.fn(),
}));

vi.mock("@primitivedotdev/api-core", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@primitivedotdev/api-core")>();
  return {
    ...actual,
    getEmail: mocks.getEmail,
    getThread: mocks.getThread,
    replyToEmail: mocks.replyToEmail,
    sendEmail: mocks.sendEmail,
  };
});

vi.mock("../../src/oclif/api-client.js", () => ({
  createAuthenticatedCliApiClient: mocks.createAuthenticatedCliApiClient,
}));

import ReplyCommand from "../../src/oclif/commands/reply.js";
import SendCommand from "../../src/oclif/commands/send.js";
import {
  bareMailbox,
  buildFyiMessageContent,
} from "../../src/oclif/fyi-message.js";
import { isRoutineNotificationContent } from "../../src/oclif/notify-session-content.js";

const CLI_ROOT = resolve(import.meta.dirname, "../..");
const abort = new AbortController().signal;

function sendResult(): SendMailResult {
  return {
    accepted: ["alice@example.com"],
    client_idempotency_key: "reply-test",
    content_hash: "sha256:test",
    delivery_status: "delivered",
    id: "sent-reply-1",
    idempotent_replay: false,
    from: "agent@example.test",
    queue_id: "queue-1",
    rejected: [],
    request_id: "req-1",
    status: "delivered",
  };
}

function inbound(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    message_id: `<${id}@mail.example.com>`,
    recipient: "agent@example.test",
    from_email: "alice@example.com",
    replies: [],
    parsed: { status: "complete", attachments: [] },
    ...overrides,
  };
}

type SentBody = {
  body_text?: string;
  body_html?: string;
  attachments?: {
    filename?: string;
    content_type?: string;
    content_base64: string;
  }[];
};

/**
 * Deliver a sent body to the receiver-side classifier exactly as an
 * inbound email detail would present it after parsing.
 */
async function receivedAsRoutine(body: SentBody): Promise<boolean> {
  const parts = (body.attachments ?? []).map((part, index) => ({
    bytes: Buffer.from(part.content_base64, "base64"),
    filename: part.filename ?? null,
    content_type: part.content_type ?? "application/octet-stream",
    index,
  }));
  return isRoutineNotificationContent(
    {
      id: "received-1",
      body_text: body.body_text ?? null,
      body_html: body.body_html ?? null,
      parsed: {
        status: "complete",
        attachments: parts.map((part) => ({
          filename: part.filename,
          content_type: part.content_type,
          part_index: part.index,
          size_bytes: part.bytes.length,
          sha256: createHash("sha256").update(part.bytes).digest("hex"),
        })) as never,
      },
    },
    async (_id, index) => {
      const part = parts[index];
      if (!part) throw new Error("missing part");
      return part.bytes;
    },
    abort,
  );
}

async function run(
  command: {
    run: (argv: string[], opts: { root: string }) => Promise<unknown>;
  },
  argv: string[],
): Promise<{ stdout: string; stderr: string }> {
  const out: string[] = [];
  const err: string[] = [];
  const logSpy = vi.spyOn(console, "log").mockImplementation((line = "") => {
    out.push(`${String(line)}\n`);
  });
  const stderrSpy = vi
    .spyOn(process.stderr, "write")
    .mockImplementation((chunk) => {
      err.push(String(chunk));
      return true;
    });
  try {
    await command.run(argv, { root: CLI_ROOT });
    return { stdout: out.join(""), stderr: err.join("") };
  } finally {
    logSpy.mockRestore();
    stderrSpy.mockRestore();
  }
}

function sentReplyBody(): SentBody {
  return mocks.replyToEmail.mock.calls[0]?.[0]?.body as SentBody;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createAuthenticatedCliApiClient.mockResolvedValue({
    apiClient: { client: { host: "api" } },
    auth: { kind: "api-key" },
    baseUrlOverridden: false,
  });
  mocks.replyToEmail.mockResolvedValue({ data: { data: sendResult() } });
  mocks.sendEmail.mockResolvedValue({ data: { data: sendResult() } });
  mocks.getEmail.mockImplementation(async ({ path }) => ({
    data: { data: inbound(path.id) },
  }));
});

afterEach(() => {
  process.exitCode = undefined;
});

describe("reply --fyi", () => {
  it("sends an ack signal that the receiver classifies as routine", async () => {
    await run(ReplyCommand, [
      "--id",
      "email-1",
      "--fyi",
      "--body",
      "Merged the fix. No action needed.\n",
    ]);
    const body = sentReplyBody();
    expect(body.body_html).toBeUndefined();
    expect(body.body_text).toBe(
      "Received your message.\n\nMerged the fix. No action needed.",
    );
    expect(body.attachments).toHaveLength(1);
    const envelope = JSON.parse(
      Buffer.from(
        body.attachments?.[0]?.content_base64 ?? "",
        "base64",
      ).toString("utf8"),
    );
    expect(envelope).toMatchObject({
      protocol: "ack",
      protocol_version: 1,
      step: "ack",
      prev_step_id: null,
      expires_at: null,
      payload: {
        subject_message_id: "<email-1@mail.example.com>",
        status: "received",
        note: "Merged the fix. No action needed.",
      },
    });
    expect(envelope.interaction_id).toMatch(/@example\.test$/);
    expect(await receivedAsRoutine(body)).toBe(true);
    // A mail hop that appends one terminal line break keeps it routine.
    expect(
      await receivedAsRoutine({ ...body, body_text: `${body.body_text}\n` }),
    ).toBe(true);
  });

  it("is routine without a body", async () => {
    await run(ReplyCommand, ["--id", "email-1", "--fyi"]);
    const body = sentReplyBody();
    expect(body.body_text).toBe("Received your message.");
    expect(await receivedAsRoutine(body)).toBe(true);
  });

  it("a plain reply is not routine", async () => {
    await run(ReplyCommand, ["--id", "email-1", "--body", "Thanks"]);
    expect(await receivedAsRoutine(sentReplyBody())).toBe(false);
  });

  it("marks the --json envelope as informational", async () => {
    const { stdout } = await run(ReplyCommand, [
      "--id",
      "email-1",
      "--fyi",
      "--body",
      "ok",
      "--json",
    ]);
    expect(JSON.parse(stdout)).toMatchObject({
      outcome: "sent",
      informational: true,
    });
  });

  it.each([
    [["--html", "<p>x</p>"]],
    [["--attachment", "./x.pdf"]],
  ])("refuses content that would not stay informational: %j", async (extra) => {
    await expect(
      run(ReplyCommand, ["--id", "email-1", "--fyi", ...extra]),
    ).rejects.toThrow(/cannot also be provided/);
    expect(mocks.replyToEmail).not.toHaveBeenCalled();
  });

  it("refuses a body over the note limit before sending", async () => {
    await expect(
      run(ReplyCommand, [
        "--id",
        "email-1",
        "--fyi",
        "--body",
        "x".repeat(2001),
      ]),
    ).rejects.toThrow(/limited to 2000 characters/);
    expect(mocks.replyToEmail).not.toHaveBeenCalled();
  });

  it("refuses to answer a signal or interaction", async () => {
    mocks.getEmail.mockResolvedValue({
      data: {
        data: inbound("email-1", {
          parsed: {
            status: "complete",
            attachments: [{ filename: "interaction.json" }],
          },
        }),
      },
    });
    await expect(
      run(ReplyCommand, ["--id", "email-1", "--fyi", "--body", "ok"]),
    ).rejects.toThrow(/signal or interaction/);
    expect(mocks.replyToEmail).not.toHaveBeenCalled();
  });

  it("does not send when the parent cannot be read", async () => {
    mocks.getEmail.mockResolvedValue({
      error: { error: { code: "boom" } },
      response: { status: 500 },
    });
    await expect(
      run(ReplyCommand, ["--id", "email-1", "--fyi", "--body", "ok"]),
    ).rejects.toThrow(/No reply was sent/);
    expect(mocks.replyToEmail).not.toHaveBeenCalled();
  });

  it("does not send when the parent has no Message-ID", async () => {
    mocks.getEmail.mockResolvedValue({
      data: { data: inbound("email-1", { message_id: null }) },
    });
    await expect(
      run(ReplyCommand, ["--id", "email-1", "--fyi"]),
    ).rejects.toThrow(/Nothing was sent/);
    expect(mocks.replyToEmail).not.toHaveBeenCalled();
  });
});

describe("send --fyi", () => {
  it("acknowledges the --in-reply-to message as routine content", async () => {
    await run(SendCommand, [
      "--to",
      "alice@example.com",
      "--from",
      "Agent <agent@example.test>",
      "--in-reply-to",
      "<parent@mail.example.com>",
      "--fyi",
      "--body",
      "Deployed.",
    ]);
    const body = mocks.sendEmail.mock.calls[0]?.[0]?.body as SentBody & {
      in_reply_to?: string;
      subject?: string;
    };
    expect(body.in_reply_to).toBe("<parent@mail.example.com>");
    expect(body.subject).toBe("Deployed.");
    expect(await receivedAsRoutine(body)).toBe(true);
  });

  it("requires --in-reply-to", async () => {
    await expect(
      run(SendCommand, ["--to", "alice@example.com", "--fyi", "--body", "x"]),
    ).rejects.toThrow(/in-reply-to/);
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });
});

describe("fyi helpers", () => {
  it("extracts bare mailboxes from header values", () => {
    expect(bareMailbox("Agent <Agent@Example.test>")).toBe(
      "agent@example.test",
    );
    expect(bareMailbox(" agent@example.test ")).toBe("agent@example.test");
  });

  it("wraps preparation failures", () => {
    expect(() =>
      buildFyiMessageContent({
        parentMessageId: "not a message id",
        senderAddress: "agent@example.test",
        recipientAddress: "alice@example.com",
      }),
    ).toThrow(/Nothing was sent/);
  });
});

describe("reply --thread", () => {
  it("replies to latest_inbound_id when the API reports it", async () => {
    mocks.getThread.mockResolvedValue({
      data: {
        data: {
          id: "thread-1",
          latest_inbound_id: "email-9",
          messages: [{ direction: "inbound", id: "email-2" }],
        },
      },
    });
    const { stdout } = await run(ReplyCommand, [
      "--thread",
      "thread-1",
      "--body",
      "Latest answer",
      "--json",
    ]);
    expect(mocks.getThread.mock.calls[0]?.[0]?.path).toEqual({
      id: "thread-1",
    });
    expect(mocks.replyToEmail.mock.calls[0]?.[0]?.path).toEqual({
      id: "email-9",
    });
    expect(JSON.parse(stdout).reply_target).toEqual({
      thread_id: "thread-1",
      email_id: "email-9",
      resolved_by: "latest_inbound_id",
    });
  });

  it("falls back to the newest inbound message in the thread", async () => {
    mocks.getThread.mockResolvedValue({
      data: {
        data: {
          id: "thread-1",
          messages: [
            {
              direction: "inbound",
              id: "email-1",
              timestamp: "2026-10-01T10:00:00Z",
            },
            {
              direction: "inbound",
              id: "email-2",
              timestamp: "2026-10-01T11:00:00Z",
            },
            {
              direction: "outbound",
              id: "sent-1",
              timestamp: "2026-10-01T12:00:00Z",
            },
          ],
        },
      },
    });
    const { stderr } = await run(ReplyCommand, [
      "--thread",
      "thread-1",
      "--body",
      "x",
    ]);
    expect(mocks.replyToEmail.mock.calls[0]?.[0]?.path).toEqual({
      id: "email-2",
    });
    expect(stderr).toContain(
      "Replying to email-2, the newest inbound email in thread thread-1.",
    );
  });

  it("works with --fyi", async () => {
    mocks.getThread.mockResolvedValue({
      data: { data: { id: "thread-1", latest_inbound_id: "email-3" } },
    });
    await run(ReplyCommand, ["--thread", "thread-1", "--fyi"]);
    const body = sentReplyBody();
    const envelope = JSON.parse(
      Buffer.from(
        body.attachments?.[0]?.content_base64 ?? "",
        "base64",
      ).toString("utf8"),
    );
    expect(envelope.payload.subject_message_id).toBe(
      "<email-3@mail.example.com>",
    );
  });

  it.each([
    [{ latest_inbound_id: null, messages: [] }],
    [{ messages: [{ direction: "outbound", id: "sent-1" }] }],
  ])("refuses a thread with no inbound email: %j", async (data) => {
    mocks.getThread.mockResolvedValue({
      data: { data: { id: "thread-1", ...data } },
    });
    await expect(
      run(ReplyCommand, ["--thread", "thread-1", "--body", "x"]),
    ).rejects.toThrow(/no inbound email/);
    expect(mocks.replyToEmail).not.toHaveBeenCalled();
  });

  it.each([
    [[{ direction: "outbound", id: "sent-9" }]],
    [[{ direction: "inbound", id: "email-1" }]],
  ])("refuses a truncated thread without latest_inbound_id: %j", async (messages) => {
    mocks.getThread.mockResolvedValue({
      data: { data: { id: "thread-1", message_count: 250, messages } },
    });
    await expect(
      run(ReplyCommand, ["--thread", "thread-1", "--body", "x"]),
    ).rejects.toThrow(/more messages than the API listed/);
    expect(mocks.replyToEmail).not.toHaveBeenCalled();
  });

  it("refuses when the thread cannot be read", async () => {
    mocks.getThread.mockResolvedValue({
      error: { error: { code: "not_found" } },
      response: { status: 404 },
    });
    await expect(
      run(ReplyCommand, ["--thread", "thread-1", "--body", "x"]),
    ).rejects.toThrow(/HTTP 404/);
    expect(mocks.replyToEmail).not.toHaveBeenCalled();
  });

  it("requires exactly one of --id and --thread", async () => {
    await expect(run(ReplyCommand, ["--body", "x"])).rejects.toThrow(
      /Exactly one/,
    );
    await expect(
      run(ReplyCommand, ["--id", "a", "--thread", "b", "--body", "x"]),
    ).rejects.toThrow();
    expect(mocks.replyToEmail).not.toHaveBeenCalled();
  });
});
