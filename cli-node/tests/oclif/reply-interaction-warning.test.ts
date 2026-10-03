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
import { replyInteractionWarning } from "../../src/oclif/interaction-actions.js";

const CLI_ROOT = resolve(import.meta.dirname, "../..");
const emailId = "6f1e2d3c-4b5a-4968-8776-655443322110";

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

function parent(overrides: Record<string, unknown> = {}) {
  return {
    id: emailId,
    message_id: "<parent@mail.example.com>",
    recipient: "agent@example.test",
    from_email: "alice@example.com",
    replies: [],
    parsed: { status: "complete", attachments: [] },
    ...overrides,
  };
}

async function reply(argv: string[]) {
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
    await ReplyCommand.run(["--id", emailId, ...argv], { root: CLI_ROOT });
    return { stdout: out.join(""), stderr: err.join("") };
  } finally {
    logSpy.mockRestore();
    stderrSpy.mockRestore();
  }
}

function warningLines(stderr: string): string[] {
  return stderr.split("\n").filter((line) => line.startsWith("Warning: "));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createAuthenticatedCliApiClient.mockResolvedValue({
    apiClient: { client: { host: "api" } },
    auth: { kind: "api-key" },
    baseUrlOverridden: false,
  });
  mocks.replyToEmail.mockResolvedValue({ data: { data: sendResult() } });
});

afterEach(() => {
  process.exitCode = undefined;
});

describe("reply to an interaction", () => {
  it("warns once on stderr for a prose reply to a payment request, and still sends", async () => {
    mocks.getEmail.mockResolvedValue({
      data: {
        data: parent({
          interaction_hint: "card",
          interaction_kind: "x402.payment/1",
        }),
      },
    });
    const { stderr } = await reply(["--body", "I will pay later."]);
    expect(warningLines(stderr)).toEqual([
      `Warning: email ${emailId} is a payment interaction (x402.payment/1). A plain reply does not pay or decline it; sending anyway. To pay: primitive payments pay-email --in-reply-to ${emailId}`,
    ]);
    expect(mocks.replyToEmail).toHaveBeenCalledTimes(1);
  });

  it("adds interaction_warning to --json output instead of stderr", async () => {
    mocks.getEmail.mockResolvedValue({
      data: {
        data: parent({
          interaction_hint: "card",
          interaction_kind: "primitive.contact/1",
        }),
      },
    });
    const { stdout, stderr } = await reply(["--body", "Hello", "--json"]);
    expect(warningLines(stderr)).toEqual([]);
    const envelope = JSON.parse(stdout);
    expect(envelope.outcome).toBe("sent");
    expect(envelope.interaction_warning).toMatchObject({
      code: "interaction_not_answered",
      email_id: emailId,
      kind: "primitive.contact/1",
      category: "contact",
    });
    expect(
      envelope.interaction_warning.expected.map(
        (action: { command: string }) => action.command,
      ),
    ).toEqual([`primitive contacts accept --id ${emailId}`]);
    expect(mocks.replyToEmail).toHaveBeenCalledTimes(1);
  });

  it("warns that fyi mail needs no reply", async () => {
    mocks.getEmail.mockResolvedValue({
      data: {
        data: parent({
          interaction_hint: "status",
          interaction_kind: "ack/1",
          fyi: true,
        }),
      },
    });
    const { stderr } = await reply(["--body", "Thanks!"]);
    expect(warningLines(stderr)).toEqual([
      `Warning: email ${emailId} is informational (fyi) and needs no reply; sending anyway.`,
    ]);
    const json = await reply(["--body", "Thanks!", "--json"]);
    expect(JSON.parse(json.stdout).interaction_warning).toMatchObject({
      code: "reply_not_needed",
      category: "fyi",
      expected: [],
    });
  });

  it("warns that an unknown card kind is not completed by a reply", async () => {
    mocks.getEmail.mockResolvedValue({
      data: {
        data: parent({
          interaction_hint: "card",
          interaction_kind: "ack-request/1",
        }),
      },
    });
    const { stderr } = await reply(["--body", "Got it"]);
    expect(warningLines(stderr)).toEqual([
      `Warning: email ${emailId} is an interaction (ack-request/1) that this CLI cannot answer. A plain reply does not complete it; sending anyway.`,
    ]);
  });

  it("does not warn for ordinary mail or a repeating message", async () => {
    for (const fields of [
      { interaction_hint: "none", interaction_kind: null },
      { interaction_hint: "card", interaction_kind: "repeat.tick/1" },
      {},
    ]) {
      mocks.getEmail.mockResolvedValue({ data: { data: parent(fields) } });
      const { stderr } = await reply(["--body", "Answer"]);
      expect(warningLines(stderr)).toEqual([]);
      const json = await reply(["--body", "Answer", "--json"]);
      expect(JSON.parse(json.stdout).interaction_warning).toBeNull();
    }
  });

  it("never warns from headers, part names or sender text alone", async () => {
    mocks.getEmail.mockResolvedValue({
      data: {
        data: parent({
          interaction_hint: "none",
          interaction_kind: null,
          interaction_candidate: true,
          subject: "Payment request: x402.payment",
          headers: { "x-primitive-interaction": "x402.payment/1" },
          parsed: {
            status: "complete",
            attachments: [{ filename: "interaction.json" }],
          },
        }),
      },
    });
    const { stderr } = await reply(["--body", "Answer"]);
    expect(warningLines(stderr)).toEqual([]);
  });
});

describe("replyInteractionWarning", () => {
  it("covers status signals and repeat stop notices", () => {
    expect(
      replyInteractionWarning(
        { interaction_hint: "status", interaction_kind: "read/1" },
        emailId,
      )?.message,
    ).toBe(
      `Warning: email ${emailId} is a status signal (read/1) and needs no reply; sending anyway.`,
    );
    expect(
      replyInteractionWarning(
        { interaction_hint: "card", interaction_kind: "repeat.stop/1" },
        emailId,
      )?.code,
    ).toBe("reply_not_needed");
  });

  it("returns null without the server's hint or for a non-UUID id", () => {
    expect(replyInteractionWarning({}, emailId)).toBeNull();
    expect(
      replyInteractionWarning(
        { interaction_hint: "card", interaction_kind: "x402.payment/1" },
        "not-an-id",
      ),
    ).toBeNull();
  });
});
