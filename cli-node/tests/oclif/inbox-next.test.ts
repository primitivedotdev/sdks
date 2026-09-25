import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAuthenticatedCliApiClient: vi.fn(),
  getConversation: vi.fn(),
  getEmail: vi.fn(),
  listEmails: vi.fn(),
}));

vi.mock("@primitivedotdev/api-core", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@primitivedotdev/api-core")>();
  return {
    ...actual,
    getConversation: mocks.getConversation,
    getEmail: mocks.getEmail,
    listEmails: mocks.listEmails,
  };
});

vi.mock("../../src/oclif/api-client.js", () => ({
  createAuthenticatedCliApiClient: mocks.createAuthenticatedCliApiClient,
}));

import InboxNextCommand, {
  automatedInputFromEmail,
  baselineCursor,
  EPOCH_CURSOR,
  errorJson,
  findNextAwaiting,
  formatTranscript,
  INBOX_NEXT_EXIT_CODES,
  type InboxNextApi,
  toJson,
  waitForActivity,
} from "../../src/oclif/commands/inbox-next.js";
import { COMMANDS } from "../../src/oclif/index.js";
import { ReplyStateUnsupportedError } from "../../src/oclif/reply-state.js";

const CLI_ROOT = resolve(import.meta.dirname, "../..");
const AGENT = "agent@acme.primitive.email";

type FakeEmail = {
  id: string;
  created_at: string;
  awaiting: "you" | "them";
  reply_count: number;
  sender: string;
  from_header: string;
  subject: string;
  body_text: string;
  status?: string;
  automation_headers?: Record<string, string> | null;
};

type ServerMode = "current" | "old-strict" | "old-lenient";

// In-memory stand-in for the three endpoints `inbox next` reads, with
// the same forward-tail and long-poll semantics as the real API.
class FakeInbox {
  emails: FakeEmail[] = [];
  mode: ServerMode = "current";
  detailOverride: Partial<Record<string, Record<string, unknown>>> = {};
  onWait: (() => void) | null = null;
  calls: Array<{ op: string; query?: Record<string, unknown>; id?: string }> =
    [];

  add(email: Partial<FakeEmail> & { id: string; created_at: string }) {
    this.emails.push({
      awaiting: "you",
      reply_count: 0,
      sender: "alice@example.com",
      from_header: "Alice <alice@example.com>",
      subject: `Subject ${email.id}`,
      body_text: `Body of ${email.id}`,
      status: "completed",
      automation_headers: null,
      ...email,
    });
  }

  private row(email: FakeEmail): Record<string, unknown> {
    const base: Record<string, unknown> = {
      id: email.id,
      created_at: email.created_at,
      received_at: email.created_at,
      sender: email.sender,
      from_header: email.from_header,
      from_email: email.sender,
      recipient: AGENT,
      to_addresses: [AGENT],
      subject: email.subject,
      status: email.status,
      domain: "acme.primitive.email",
      thread_id: `thread-${email.id}`,
      message_id: `<${email.id}@example.com>`,
      webhook_attempt_count: 0,
      automation_headers: email.automation_headers,
    };
    if (this.mode === "current") {
      base.awaiting = email.awaiting;
      base.reply_count = email.reply_count;
      base.last_replied_at = email.reply_count > 0 ? email.created_at : null;
    }
    return base;
  }

  private cursorOf(email: FakeEmail): string {
    return `${email.created_at}|${email.id}`;
  }

  api(): InboxNextApi {
    const listEmails = (async (options: {
      query?: Record<string, unknown>;
    }) => {
      const query = options.query ?? {};
      this.calls.push({ op: "list", query });
      if (this.mode === "old-strict" && query.awaiting !== undefined) {
        return {
          error: {
            success: false,
            error: {
              code: "validation_error",
              message: "Unrecognized key(s) in object: 'awaiting'",
            },
          },
        };
      }
      const filterAwaiting =
        this.mode === "current" ? query.awaiting : undefined;
      const limit = Number(query.limit ?? 50);
      if (typeof query.since === "string") {
        const since = query.since;
        const select = () =>
          [...this.emails]
            .sort((a, b) => this.cursorOf(a).localeCompare(this.cursorOf(b)))
            .filter((e) => this.cursorOf(e) > since)
            .filter((e) => !filterAwaiting || e.awaiting === filterAwaiting);
        let matched = select();
        if (matched.length === 0 && Number(query.wait ?? 0) > 0) {
          this.onWait?.();
          matched = select();
        }
        const page = matched.slice(0, limit);
        const last = page.at(-1);
        return {
          data: {
            success: true,
            data: page.map((e) => this.row(e)),
            meta: {
              total: matched.length,
              limit,
              cursor: last ? this.cursorOf(last) : null,
            },
          },
        };
      }
      const page = [...this.emails]
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .filter((e) => !filterAwaiting || e.awaiting === filterAwaiting)
        .slice(0, limit);
      return {
        data: {
          success: true,
          data: page.map((e) => this.row(e)),
          meta: { total: page.length, limit, cursor: null },
        },
      };
    }) as unknown as InboxNextApi["listEmails"];

    const getEmail = (async (options: { path: { id: string } }) => {
      this.calls.push({ op: "get", id: options.path.id });
      const email = this.emails.find((e) => e.id === options.path.id);
      if (!email) {
        return {
          error: {
            success: false,
            error: { code: "not_found", message: "Email not found" },
          },
        };
      }
      return {
        data: {
          success: true,
          data: {
            ...this.row(email),
            smtp_mail_from: email.sender,
            body_text: email.body_text,
            replies: [],
            ...(this.detailOverride[email.id] ?? {}),
          },
        },
      };
    }) as unknown as InboxNextApi["getEmail"];

    const getConversation = (async (options: { path: { id: string } }) => {
      this.calls.push({ op: "conversation", id: options.path.id });
      const email = this.emails.find((e) => e.id === options.path.id);
      return {
        data: {
          success: true,
          data: {
            thread_id: `thread-${options.path.id}`,
            subject: email?.subject ?? null,
            message_count: 2,
            truncated: false,
            messages: [
              {
                role: "user",
                direction: "inbound",
                id: "m-1",
                message_id: null,
                from: "alice@example.com",
                to: AGENT,
                subject: "Question",
                text: "First question",
                timestamp: "2026-09-20T00:00:00.000Z",
              },
              {
                role: "assistant",
                direction: "outbound",
                id: "m-2",
                message_id: null,
                from: AGENT,
                to: "alice@example.com",
                subject: "Re: Question",
                text: "First answer",
                timestamp: "2026-09-20T00:01:00.000Z",
              },
            ],
          },
        },
      };
    }) as unknown as InboxNextApi["getConversation"];

    return { listEmails, getEmail, getConversation };
  }
}

const apiClient = { client: {} } as never;

describe("findNextAwaiting", () => {
  let inbox: FakeInbox;
  beforeEach(() => {
    inbox = new FakeInbox();
  });

  it("returns the oldest email awaiting you with its conversation", async () => {
    inbox.add({ id: "b", created_at: "2026-09-21T00:00:00.000Z" });
    inbox.add({ id: "a", created_at: "2026-09-20T00:00:00.000Z" });
    inbox.add({
      id: "c",
      created_at: "2026-09-19T00:00:00.000Z",
      awaiting: "them",
      reply_count: 1,
    });

    const result = await findNextAwaiting({
      apiClient,
      includeAutomated: false,
      api: inbox.api(),
    });

    expect(result.outcome).toBe("email");
    if (result.outcome !== "email") return;
    expect(result.email.id).toBe("a");
    expect(result.email.awaiting).toBe("you");
    expect(result.email.reply_count).toBe(0);
    expect(result.email.body_text).toBe("Body of a");
    expect(result.automated).toEqual({
      automated: false,
      reasons: [],
      automation_headers_known: false,
    });
    expect(result.conversation.messages.map((m) => m.role)).toEqual([
      "user",
      "assistant",
    ]);
    expect(inbox.calls[0]).toEqual({
      op: "list",
      query: { awaiting: "you", limit: 100, since: EPOCH_CURSOR },
    });
  });

  it("reports empty when nothing awaits you", async () => {
    inbox.add({
      id: "a",
      created_at: "2026-09-20T00:00:00.000Z",
      awaiting: "them",
      reply_count: 1,
    });
    const result = await findNextAwaiting({
      apiClient,
      includeAutomated: false,
      api: inbox.api(),
    });
    expect(result).toEqual({ outcome: "empty", skipped_automated: [] });
  });

  it("skips automated mail by default and reports why", async () => {
    inbox.add({
      id: "bounce",
      created_at: "2026-09-18T00:00:00.000Z",
      sender: "",
      from_header: "MAILER-DAEMON@mx.example",
    });
    inbox.add({
      id: "news",
      created_at: "2026-09-19T00:00:00.000Z",
      automation_headers: { list_unsubscribe: "<mailto:u@news.example>" },
    });
    inbox.add({
      id: "self",
      created_at: "2026-09-19T12:00:00.000Z",
      sender: AGENT,
      from_header: AGENT,
    });
    inbox.add({ id: "human", created_at: "2026-09-20T00:00:00.000Z" });

    const result = await findNextAwaiting({
      apiClient,
      includeAutomated: false,
      api: inbox.api(),
    });
    expect(result.outcome).toBe("email");
    if (result.outcome !== "email") return;
    expect(result.email.id).toBe("human");
    expect(result.skipped_automated).toEqual([
      {
        id: "bounce",
        reasons: ["null_envelope_sender", "mailer_daemon"],
      },
      { id: "news", reasons: ["list_unsubscribe"] },
      { id: "self", reasons: ["own_address"] },
    ]);
    // Automated rows are skipped from the list alone: no detail reads.
    expect(inbox.calls.filter((c) => c.op === "get").map((c) => c.id)).toEqual([
      "human",
    ]);
  });

  it("returns automated mail with its verdict under includeAutomated", async () => {
    inbox.add({
      id: "auto",
      created_at: "2026-09-18T00:00:00.000Z",
      automation_headers: { auto_submitted: "auto-replied" },
    });
    const result = await findNextAwaiting({
      apiClient,
      includeAutomated: true,
      api: inbox.api(),
    });
    expect(result.outcome).toBe("email");
    if (result.outcome !== "email") return;
    expect(result.email.id).toBe("auto");
    expect(result.automated).toEqual({
      automated: true,
      reasons: ["auto_submitted"],
      automation_headers_known: true,
    });
  });

  it("returns empty with the skipped list when only automated mail awaits", async () => {
    inbox.add({
      id: "auto",
      created_at: "2026-09-18T00:00:00.000Z",
      automation_headers: { precedence: "bulk" },
    });
    const result = await findNextAwaiting({
      apiClient,
      includeAutomated: false,
      api: inbox.api(),
    });
    expect(result).toEqual({
      outcome: "empty",
      skipped_automated: [{ id: "auto", reasons: ["precedence"] }],
    });
  });

  it("uses detail-only automation signals the list did not carry", async () => {
    inbox.add({ id: "a", created_at: "2026-09-18T00:00:00.000Z" });
    inbox.add({ id: "b", created_at: "2026-09-19T00:00:00.000Z" });
    inbox.detailOverride.a = { smtp_mail_from: "<>" };
    const result = await findNextAwaiting({
      apiClient,
      includeAutomated: false,
      api: inbox.api(),
    });
    expect(result.outcome === "email" && result.email.id).toBe("b");
    expect(result.skipped_automated).toEqual([
      { id: "a", reasons: ["null_envelope_sender"] },
    ]);
  });

  it("moves on when the detail shows it was answered since the list", async () => {
    inbox.add({ id: "a", created_at: "2026-09-18T00:00:00.000Z" });
    inbox.add({ id: "b", created_at: "2026-09-19T00:00:00.000Z" });
    inbox.detailOverride.a = { awaiting: "them", reply_count: 1 };
    const result = await findNextAwaiting({
      apiClient,
      includeAutomated: false,
      api: inbox.api(),
    });
    expect(result.outcome === "email" && result.email.id).toBe("b");
  });

  it("skips rejected mail", async () => {
    inbox.add({
      id: "a",
      created_at: "2026-09-18T00:00:00.000Z",
      status: "rejected",
    });
    const result = await findNextAwaiting({
      apiClient,
      includeAutomated: false,
      api: inbox.api(),
    });
    expect(result.outcome).toBe("empty");
  });

  it("pages past a full page of automated mail", async () => {
    for (let i = 0; i < 150; i++) {
      inbox.add({
        id: `n${String(i).padStart(3, "0")}`,
        created_at: `2026-09-01T00:00:00.${String(i).padStart(3, "0")}Z`,
        automation_headers: { list_unsubscribe: "<mailto:u@x.example>" },
      });
    }
    inbox.add({ id: "human", created_at: "2026-09-02T00:00:00.000Z" });
    const result = await findNextAwaiting({
      apiClient,
      includeAutomated: false,
      api: inbox.api(),
    });
    expect(result.outcome === "email" && result.email.id).toBe("human");
    expect(result.skipped_automated).toHaveLength(150);
    expect(inbox.calls.filter((c) => c.op === "list")).toHaveLength(2);
  });

  it("fails loudly when an older server rejects the awaiting filter", async () => {
    inbox.mode = "old-strict";
    inbox.add({ id: "a", created_at: "2026-09-18T00:00:00.000Z" });
    await expect(
      findNextAwaiting({
        apiClient,
        includeAutomated: false,
        api: inbox.api(),
      }),
    ).rejects.toThrow(ReplyStateUnsupportedError);
  });

  it("fails loudly when an older server returns rows without reply state", async () => {
    inbox.mode = "old-lenient";
    inbox.add({ id: "a", created_at: "2026-09-18T00:00:00.000Z" });
    await expect(
      findNextAwaiting({
        apiClient,
        includeAutomated: false,
        api: inbox.api(),
      }),
    ).rejects.toThrow(/does not support reply state yet/);
  });

  it("fails loudly when the detail lacks reply state", async () => {
    inbox.add({ id: "a", created_at: "2026-09-18T00:00:00.000Z" });
    inbox.detailOverride.a = { awaiting: undefined };
    await expect(
      findNextAwaiting({
        apiClient,
        includeAutomated: false,
        api: inbox.api(),
      }),
    ).rejects.toThrow(ReplyStateUnsupportedError);
  });
});

describe("--wait helpers", () => {
  it("builds the baseline from the newest email, or the epoch when empty", async () => {
    const inbox = new FakeInbox();
    expect(await baselineCursor({ apiClient, api: inbox.api() })).toBe(
      EPOCH_CURSOR,
    );
    inbox.add({ id: "a", created_at: "2026-09-18T00:00:00.000Z" });
    inbox.add({ id: "b", created_at: "2026-09-19T00:00:00.000Z" });
    expect(await baselineCursor({ apiClient, api: inbox.api() })).toBe(
      "2026-09-19T00:00:00.000Z|b",
    );
  });

  it("long-polls from the cursor and advances on arrival", async () => {
    const inbox = new FakeInbox();
    inbox.add({ id: "a", created_at: "2026-09-18T00:00:00.000Z" });
    inbox.onWait = () =>
      inbox.add({ id: "b", created_at: "2026-09-19T00:00:00.000Z" });
    const next = await waitForActivity({
      apiClient,
      since: "2026-09-18T00:00:00.000Z|a",
      seconds: 120,
      api: inbox.api(),
    });
    expect(next).toBe("2026-09-19T00:00:00.000Z|b");
    const waitCall = inbox.calls.find((c) => c.op === "list");
    expect(waitCall?.query).toEqual({
      limit: 100,
      since: "2026-09-18T00:00:00.000Z|a",
      wait: 30,
    });
  });

  it("keeps the cursor when the hold ends with nothing", async () => {
    const inbox = new FakeInbox();
    const next = await waitForActivity({
      apiClient,
      since: EPOCH_CURSOR,
      seconds: 5,
      api: inbox.api(),
    });
    expect(next).toBe(EPOCH_CURSOR);
  });
});

describe("output", () => {
  it("builds a stable JSON envelope for an email", async () => {
    const inbox = new FakeInbox();
    inbox.add({ id: "a", created_at: "2026-09-18T00:00:00.000Z" });
    const result = await findNextAwaiting({
      apiClient,
      includeAutomated: false,
      api: inbox.api(),
    });
    const json = toJson(result, "primitive");
    expect(Object.keys(json)).toEqual([
      "version",
      "outcome",
      "email",
      "automated",
      "conversation",
      "reply_command",
      "skipped_automated",
    ]);
    expect(json.version).toBe(1);
    expect(json.reply_command).toBe("primitive reply --id a");
    expect(json.email?.from).toBe("Alice <alice@example.com>");
  });

  it("builds the empty and error envelopes", () => {
    expect(toJson({ outcome: "empty", skipped_automated: [] }, "p")).toEqual({
      version: 1,
      outcome: "empty",
      email: null,
      automated: null,
      conversation: null,
      reply_command: null,
      skipped_automated: [],
    });
    expect(errorJson("reply_state_unsupported", "old").error).toEqual({
      code: "reply_state_unsupported",
      message: "old",
    });
  });

  it("renders a readable transcript with the reply command", async () => {
    const inbox = new FakeInbox();
    inbox.add({ id: "a", created_at: "2026-09-18T00:00:00.000Z" });
    const result = await findNextAwaiting({
      apiClient,
      includeAutomated: false,
      api: inbox.api(),
    });
    if (result.outcome !== "email") throw new Error("expected email");
    const text = formatTranscript(result, "primitive");
    expect(text).toContain("Awaiting your reply:");
    expect(text).toContain("id:        a");
    expect(text).toContain("automated: no (no automation headers recorded");
    expect(text).toContain("Conversation (2 of 2 messages, oldest first)");
    expect(text).toContain("--- [1] user (them) alice@example.com");
    expect(text).toContain("--- [2] assistant (you)");
    expect(text).toContain('primitive reply --id a --body "..."');
    expect(text).not.toContain(String.fromCharCode(0x2014));
  });

  it("reads to_addresses objects and smtp recipients for own-address checks", () => {
    const input = automatedInputFromEmail({
      sender: "x@y.example",
      to_addresses: [{ address: "a@b.example" }, "c@d.example"],
      smtp_rcpt_to: ["e@f.example"],
      automation_headers: "bogus",
    });
    expect(input.inboundAddresses).toEqual([
      null,
      null,
      "a@b.example",
      "c@d.example",
      "e@f.example",
    ]);
    expect(input.automationHeaders).toBeNull();
  });
});

type Runnable = {
  run(argv: string[], options: { root: string }): Promise<unknown>;
};

async function runCommand(argv: string[]) {
  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];
  const previousExitCode = process.exitCode;
  process.exitCode = undefined;
  const logSpy = vi.spyOn(console, "log").mockImplementation((message = "") => {
    stdoutChunks.push(`${String(message)}\n`);
  });
  const stderrSpy = vi
    .spyOn(process.stderr, "write")
    .mockImplementation((chunk) => {
      stderrChunks.push(String(chunk));
      return true;
    });
  try {
    await (InboxNextCommand as unknown as Runnable).run(argv, {
      root: CLI_ROOT,
    });
    return {
      exitCode: process.exitCode,
      stdout: stdoutChunks.join(""),
      stderr: stderrChunks.join(""),
    };
  } finally {
    logSpy.mockRestore();
    stderrSpy.mockRestore();
    process.exitCode = previousExitCode;
  }
}

describe("inbox next command", () => {
  let inbox: FakeInbox;
  beforeEach(() => {
    vi.clearAllMocks();
    inbox = new FakeInbox();
    const api = inbox.api();
    mocks.listEmails.mockImplementation(api.listEmails);
    mocks.getEmail.mockImplementation(api.getEmail);
    mocks.getConversation.mockImplementation(api.getConversation);
    mocks.createAuthenticatedCliApiClient.mockResolvedValue({
      apiClient: { client: {} },
      auth: { kind: "api-key", source: "flag" },
      baseUrlOverridden: false,
    });
  });

  it("is registered as inbox:next", () => {
    expect(COMMANDS["inbox:next"]).toBe(InboxNextCommand);
  });

  it("documents that it is not a work queue and its exit codes", () => {
    const description = InboxNextCommand.description;
    expect(description).toContain("NOT A WORK QUEUE");
    expect(description).toContain("get the same email");
    expect(description).toContain("- 5: nothing awaits your reply");
    expect(description).toContain("primitive reply --id <id>");
  });

  it("exits 0 with the transcript when an email awaits", async () => {
    inbox.add({ id: "a", created_at: "2026-09-18T00:00:00.000Z" });
    const result = await runCommand([]);
    expect(result.exitCode).toBe(INBOX_NEXT_EXIT_CODES.email);
    expect(result.stdout).toContain("Awaiting your reply:");
    expect(result.stdout).toMatch(/reply --id a --body/);
  });

  it("exits 5 when the inbox has nothing awaiting", async () => {
    const result = await runCommand([]);
    expect(result.exitCode).toBe(5);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("Nothing awaits your reply.");
  });

  it("exits 5 with the empty envelope under --json", async () => {
    const result = await runCommand(["--json"]);
    expect(result.exitCode).toBe(5);
    expect(JSON.parse(result.stdout)).toMatchObject({
      outcome: "empty",
      email: null,
    });
  });

  it("mentions skipped automated mail on an empty result", async () => {
    inbox.add({
      id: "auto",
      created_at: "2026-09-18T00:00:00.000Z",
      automation_headers: { precedence: "list" },
    });
    const result = await runCommand([]);
    expect(result.exitCode).toBe(5);
    expect(result.stderr).toContain("Skipped 1 automated email");
    const included = await runCommand(["--include-automated", "--json"]);
    expect(included.exitCode).toBe(0);
    expect(JSON.parse(included.stdout).automated).toEqual({
      automated: true,
      reasons: ["precedence"],
      automation_headers_known: true,
    });
  });

  it("exits 1 with reply_state_unsupported against an older server", async () => {
    inbox.mode = "old-lenient";
    inbox.add({ id: "a", created_at: "2026-09-18T00:00:00.000Z" });
    const result = await runCommand(["--json"]);
    expect(result.exitCode).toBe(1);
    const json = JSON.parse(result.stdout);
    expect(json.outcome).toBe("error");
    expect(json.error.code).toBe("reply_state_unsupported");
    expect(result.stderr).toContain("does not support reply state yet");

    inbox.mode = "old-strict";
    const strict = await runCommand([]);
    expect(strict.exitCode).toBe(1);
    expect(strict.stdout).toBe("");
    expect(strict.stderr).toContain("rejected the `awaiting` filter");
  });

  it("exits 1 and prints the API error on other failures", async () => {
    mocks.listEmails.mockResolvedValueOnce({
      error: {
        success: false,
        error: { code: "unauthorized", message: "Invalid API key" },
      },
    });
    const result = await runCommand(["--json"]);
    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stdout).error).toEqual({
      code: "unauthorized",
      message: "Invalid API key",
    });
    expect(result.stderr).toContain("unauthorized");
  });

  it("--wait takes the baseline first, then returns mail that arrives", async () => {
    inbox.add({
      id: "old",
      created_at: "2026-09-18T00:00:00.000Z",
      awaiting: "them",
      reply_count: 1,
    });
    inbox.onWait = () =>
      inbox.add({ id: "new", created_at: "2026-09-19T00:00:00.000Z" });
    const result = await runCommand(["--wait", "--timeout", "60", "--json"]);
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout).email.id).toBe("new");
    const lists = inbox.calls.filter((c) => c.op === "list");
    // 1: baseline (newest row), 2: state check, 3: long-poll from the
    // baseline, 4: state check after the wake.
    expect(lists[0]?.query).toEqual({ limit: 1 });
    expect(lists[1]?.query).toMatchObject({ awaiting: "you" });
    expect(lists[2]?.query).toMatchObject({
      since: "2026-09-18T00:00:00.000Z|old",
      wait: expect.any(Number),
    });
    expect(lists[3]?.query).toMatchObject({ awaiting: "you" });
  });

  it("--wait returns at once when something already awaits", async () => {
    inbox.add({ id: "a", created_at: "2026-09-18T00:00:00.000Z" });
    const result = await runCommand(["--wait", "--json"]);
    expect(result.exitCode).toBe(0);
    expect(inbox.calls.some((c) => c.query?.wait !== undefined)).toBe(false);
  });

  it("--wait exits 5 when the timeout elapses", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const start = Date.now();
      inbox.onWait = () => {
        vi.setSystemTime(start + 5_000);
      };
      const result = await runCommand(["--wait", "--timeout", "2"]);
      expect(result.exitCode).toBe(5);
      expect(result.stderr).toContain("waiting up to 2s");
    } finally {
      vi.useRealTimers();
    }
  });
});
