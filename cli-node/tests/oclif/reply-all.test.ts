import { resolve } from "node:path";
import type { SendMailResult } from "@primitivedotdev/api-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAuthenticatedCliApiClient: vi.fn(),
  getEmail: vi.fn(),
  replyToEmail: vi.fn(),
}));

vi.mock("@primitivedotdev/api-core", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@primitivedotdev/api-core")>();
  return {
    ...actual,
    getEmail: mocks.getEmail,
    replyToEmail: mocks.replyToEmail,
  };
});

vi.mock("../../src/oclif/api-client.js", () => ({
  createAuthenticatedCliApiClient: mocks.createAuthenticatedCliApiClient,
}));

import ReplyCommand from "../../src/oclif/commands/reply.js";

const CLI_ROOT = resolve(import.meta.dirname, "../..");

function sendResult(): SendMailResult {
  return {
    accepted: ["alice@example.com", "agent-b@example.test"],
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

async function run(argv: string[]): Promise<{ stdout: string }> {
  const out: string[] = [];
  const logSpy = vi.spyOn(console, "log").mockImplementation((line = "") => {
    out.push(`${String(line)}\n`);
  });
  const stderrSpy = vi
    .spyOn(process.stderr, "write")
    .mockImplementation(() => true);
  try {
    await ReplyCommand.run(argv, { root: CLI_ROOT });
    return { stdout: out.join("") };
  } finally {
    logSpy.mockRestore();
    stderrSpy.mockRestore();
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createAuthenticatedCliApiClient.mockResolvedValue({
    apiClient: { client: { host: "api" } },
    auth: { kind: "api-key" },
    baseUrlOverridden: false,
  });
  mocks.replyToEmail.mockResolvedValue({ data: { data: sendResult() } });
  mocks.getEmail.mockImplementation(async ({ path }) => ({
    data: {
      data: {
        id: path.id,
        message_id: `<${path.id}@mail.example.com>`,
        recipient: "agent@example.test",
        from_email: "alice@example.com",
        replies: [],
        parsed: { status: "complete", attachments: [] },
      },
    },
  }));
});

afterEach(() => {
  process.exitCode = undefined;
});

describe("reply --all", () => {
  it("asks the API to reply to everyone and records it in the envelope", async () => {
    const { stdout } = await run([
      "--id",
      "email-1",
      "--all",
      "--body",
      "Answering everyone.",
      "--json",
    ]);
    const call = mocks.replyToEmail.mock.calls[0]?.[0];
    expect(call.body).toMatchObject({
      body_text: "Answering everyone.",
      reply_all: true,
    });
    expect(JSON.parse(stdout)).toMatchObject({
      outcome: "sent",
      reply_all: true,
    });
  });

  it("keys a reply-all apart from a plain reply with the same body", async () => {
    await run(["--id", "email-1", "--body", "Same body."]);
    await run(["--id", "email-1", "--all", "--body", "Same body."]);
    const [plain, all] = mocks.replyToEmail.mock.calls.map(
      ([options]) => options.headers["Idempotency-Key"],
    );
    expect(plain).toBeTruthy();
    expect(all).toBeTruthy();
    expect(all).not.toBe(plain);
    expect(mocks.replyToEmail.mock.calls[0]?.[0].body).not.toHaveProperty(
      "reply_all",
    );
  });

  it("cannot be combined with --fyi", async () => {
    await expect(
      run(["--id", "email-1", "--all", "--fyi", "--body", "ok"]),
    ).rejects.toThrow(/cannot also be provided/);
    expect(mocks.replyToEmail).not.toHaveBeenCalled();
  });
});
