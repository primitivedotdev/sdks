import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  type EmailDetail,
  PrimitiveApiClient,
} from "@primitivedotdev/api-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ authenticate: vi.fn(), sleep: vi.fn() }));
vi.mock("../../src/oclif/api-client.js", () => ({
  createAuthenticatedCliApiClient: mocks.authenticate,
}));
vi.mock("../../src/oclif/commands/emails-poll.js", async (original) => ({
  ...(await original<
    typeof import("../../src/oclif/commands/emails-poll.js")
  >()),
  sleep: mocks.sleep,
}));

import { openSharedMailStore } from "../../src/oclif/shared-mail-state.js";

vi.mock("../../src/oclif/shared-mail-receiver.js", () => ({
  openSharedMailReceiver: async (options: {
    configDir: string;
    recipient: string;
  }) => {
    const store = await openSharedMailStore({
      ...options,
      scope: "scoped-wait-test",
    });
    return {
      store,
      ready: async () => ({ generation: "one", gapCount: 0 }),
      changed: async () => {
        vi.setSystemTime(Date.now() + 1000);
      },
      close: async () => {},
    };
  },
}));

import EmailsWaitCommand from "../../src/oclif/commands/emails-wait.js";
import { readBeforeDeadline } from "../../src/oclif/scoped-chat.js";

const CLI_ROOT = resolve(import.meta.dirname, "../..");
const sentId = "11111111-1111-4111-8111-111111111111";
const peer = "help@agent.example";
const owner = "agent@sender.example";
const args = ["--reply-to-sent-email-id", sentId, "--from", peer];
let directory: string;
let previousConfig: string | undefined;

function replyEmail(overrides: Partial<EmailDetail> = {}): EmailDetail {
  return {
    body_html: null,
    body_text: "Rotate your API key from the dashboard.",
    created_at: "2026-05-25T00:00:02.000Z",
    domain: "agent.example",
    from_email: "help@agent.example",
    id: "22222222-2222-4222-8222-222222222222",
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

function setup(connected = true) {
  const fixture = {
    sent: {
      id: sentId,
      from_address: owner,
      from_header: `Agent <${owner}>`,
      to_address: peer,
      to_header: peer,
    } as Record<string, unknown>,
    replies: [
      replyEmail({
        reply_to_sent_email_id: sentId,
        from_header: `Helper <${peer}>`,
        auth: { ...replyEmail().auth, dmarcFromDomain: "agent.example" },
      }),
    ],
    pages: [["22222222-2222-4222-8222-222222222222"]],
    requests: [] as URL[],
    error: false,
    stallPath: "",
    aborted: false,
  };
  const apiClient = new PrimitiveApiClient({
    apiKey: [connected ? "pconn" : "prim", "fixture"].join("_"),
    apiBaseUrl: "https://example.test/v1",
    fetch: async (input, init) => {
      const request = new Request(input, init);
      const url = new URL(request.url);
      fixture.requests.push(url);
      if (url.pathname === fixture.stallPath)
        return new Promise<Response>((_resolve, reject) => {
          request.signal.addEventListener(
            "abort",
            () => {
              fixture.aborted = true;
              reject(new DOMException("Aborted", "AbortError"));
            },
            { once: true },
          );
        });
      if (request.method !== "GET")
        throw new Error("Wait must never send mail");
      if (url.pathname === `/v1/sent-emails/${sentId}`)
        return Response.json(
          fixture.error
            ? { error: { message: "unavailable" } }
            : { data: fixture.sent },
          { status: fixture.error ? 404 : 200 },
        );
      if (connected && url.pathname === "/v1/emails/search") {
        const page = Number(url.searchParams.get("cursor") ?? "0");
        return Response.json({
          data: (fixture.pages[page] ?? [])
            .map((id) => fixture.replies.find((email) => email.id === id))
            .filter(
              (email) =>
                !url.searchParams.has("date_from") ||
                (email &&
                  Date.parse(email.received_at) >=
                    Date.parse(url.searchParams.get("date_from") ?? "")),
            ),
          meta: {
            cursor: page + 1 < fixture.pages.length ? String(page + 1) : null,
          },
        });
      }
      if (!connected && url.pathname === "/v1/emails/search")
        return Response.json({ data: fixture.replies, meta: { cursor: null } });
      const id = url.pathname.split("/").at(-1);
      const email = fixture.replies.find((row) => row.id === id);
      if (email) return Response.json({ data: email });
      throw new Error(`Forbidden request ${url.pathname}`);
    },
  });
  mocks.authenticate.mockResolvedValue({
    apiClient,
    auth: {
      apiKey: [connected ? "pconn" : "prim", "fixture"].join("_"),
      apiBaseUrl: "https://example.test/v1",
    },
    baseUrlOverridden: false,
  });
  return fixture;
}
async function run(argv: string[]) {
  const out: string[] = [],
    err: string[] = [];
  const oldExit = process.exitCode;
  process.exitCode = undefined;
  const log = vi.spyOn(console, "log").mockImplementation((message = "") => {
    out.push(String(message));
  });
  const stderr = vi
    .spyOn(process.stderr, "write")
    .mockImplementation((chunk: unknown) => {
      err.push(String(chunk));
      return true;
    });
  let failure: unknown;
  try {
    await EmailsWaitCommand.run(argv, { root: CLI_ROOT });
  } catch (error) {
    failure = error;
  }
  const result = {
    stdout: out.join("\n"),
    stderr: err.join(""),
    exitCode: process.exitCode,
    failure,
  };
  process.exitCode = oldExit;
  log.mockRestore();
  stderr.mockRestore();
  return result;
}
beforeEach(() => {
  vi.clearAllMocks();
  directory = mkdtempSync(join(tmpdir(), "primitive-scoped-wait-"));
  previousConfig = process.env.XDG_CONFIG_HOME;
  process.env.XDG_CONFIG_HOME = directory;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-27T00:00:00Z"));
  mocks.sleep.mockImplementation(async (ms: number) => {
    vi.setSystemTime(Date.now() + ms);
  });
});
afterEach(() => {
  if (previousConfig === undefined) delete process.env.XDG_CONFIG_HOME;
  else process.env.XDG_CONFIG_HOME = previousConfig;
  vi.useRealTimers();
  vi.restoreAllMocks();
  rmSync(directory, { recursive: true, force: true });
});
describe("connected emails wait", () => {
  it("rearms deadlines beyond the maximum Node timer delay", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    const maximumDelay = 2 ** 31 - 1;
    let aborted = false;
    const read = readBeforeDeadline(
      Date.now() + maximumDelay + 100,
      (signal) =>
        new Promise<string>((resolve) => {
          signal?.addEventListener(
            "abort",
            () => {
              aborted = true;
              resolve("late");
            },
            { once: true },
          );
        }),
    );
    await vi.advanceTimersByTimeAsync(maximumDelay);
    expect(aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(100);
    expect(await read).toBeNull();
    expect(aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("derives its receiving address and returns an existing fast reply through targeted search without sends", async () => {
    const fixture = setup();
    const result = await run(args);
    expect(result.failure).toBeUndefined();
    expect(JSON.parse(result.stdout).id).toBe(
      "22222222-2222-4222-8222-222222222222",
    );
    expect(JSON.parse(result.stdout).body_text).toContain(
      "Rotate your API key",
    );
    expect(fixture.requests.map((url) => url.pathname)).toEqual([
      `/v1/sent-emails/${sentId}`,
      "/v1/emails/search",
      "/v1/emails/22222222-2222-4222-8222-222222222222",
    ]);
    expect(fixture.requests[1]?.searchParams.has("date_from")).toBe(false);
  });
  it("allows missing optional raw sender header and validates a supplied receiving address", async () => {
    const fixture = setup();
    delete fixture.sent.from_header;
    const result = await run([
      ...args,
      "--to",
      owner.toUpperCase(),
      "--include-existing",
    ]);
    expect(result.failure).toBeUndefined();
    expect(JSON.parse(result.stdout).id).toBe(
      "22222222-2222-4222-8222-222222222222",
    );
  });
  it.each([
    [],
    ["--from", peer],
    ["--reply-to-sent-email-id", sentId],
    ["--reply-to-sent-email-id", "invalid", "--from", peer],
    ["--reply-to-sent-email-id", sentId, "--from", "agent.example"],
    [...args, "--q", "hello"],
    [...args, "--subject", "hello"],
    [...args, "--spam-score-gte", "0"],
  ])("rejects unsupported or incomplete flags before any request: %j", async (...argv) => {
    const fixture = setup();
    const result = await run(argv);
    expect(result.failure).toBeInstanceOf(Error);
    expect(fixture.requests).toHaveLength(0);
  });
  it("rejects mismatched own address or sent identity without inbox access", async () => {
    const fixture = setup();
    const mismatch = await run([...args, "--to", "other@sender.example"]);
    expect(String(mismatch.failure)).toContain("--to must match");
    fixture.sent.from_header = "other@sender.example";
    const inconsistent = await run(args);
    expect(String(inconsistent.failure)).toContain("sender fields disagree");
    expect(
      fixture.requests.every((url) =>
        url.pathname.startsWith("/v1/sent-emails/"),
      ),
    ).toBe(true);
  });
  it.each([
    `/v1/sent-emails/${sentId}`,
    "/v1/emails/search",
    "/v1/emails/22222222-2222-4222-8222-222222222222",
  ])("cancels a stalled %s read with a clean timeout", async (path) => {
    const fixture = setup();
    fixture.stallPath = path;
    const result = await run([...args, "--timeout", "1"]);
    expect(fixture.aborted).toBe(true);
    expect(result.failure).toBeUndefined();
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("Timed out");
    expect(result.stderr).not.toContain("AbortError");
  });
  it("does not fall back to search when the parent is unavailable", async () => {
    const fixture = setup();
    fixture.error = true;
    const result = await run(args);
    expect(String(result.failure)).toContain("Could not read that sent email");
    expect(fixture.requests).toHaveLength(1);
  });
  it("pages past progress and rejects sender, recipient, and ancestry mismatches", async () => {
    const fixture = setup();
    const good = fixture.replies[0];
    fixture.replies = [
      {
        ...good,
        id: "44444444-4444-4444-8444-444444444444",
        parsed: {
          status: "complete",
          attachments: [{ filename: "interaction.json", size_bytes: 1 }],
        },
      },
      {
        ...good,
        id: "55555555-5555-4555-8555-555555555555",
        reply_to_sent_email_id: "other-send",
      },
      {
        ...good,
        id: "66666666-6666-4666-8666-666666666666",
        from_header: "other@agent.example",
      },
      {
        ...good,
        id: "77777777-7777-4777-8777-777777777777",
        recipient: "other@sender.example",
      },
      good,
    ];
    fixture.pages = [
      [
        "44444444-4444-4444-8444-444444444444",
        "55555555-5555-4555-8555-555555555555",
        "66666666-6666-4666-8666-666666666666",
        "77777777-7777-4777-8777-777777777777",
      ],
      [good.id],
    ];
    const result = await run(args);
    expect(result.failure).toBeUndefined();
    expect(JSON.parse(result.stdout).id).toBe(good.id);
    expect(result.stderr).toContain("contains an interaction attachment");
    expect(
      fixture.requests.some((url) => url.searchParams.get("cursor") === "1"),
    ).toBe(true);
  });
  it("prints each of multiple matching replies once using the existing table shape", async () => {
    const fixture = setup();
    fixture.replies.push({
      ...fixture.replies[0],
      id: "33333333-3333-4333-8333-333333333333",
    });
    fixture.pages = [
      [
        "22222222-2222-4222-8222-222222222222",
        "33333333-3333-4333-8333-333333333333",
      ],
    ];
    const result = await run([...args, "--number", "2", "--table"]);
    expect(result.failure).toBeUndefined();
    expect(result.stdout.split("\n")).toHaveLength(2);
    expect(result.stdout).toContain("22222222-2222-4222-8222-222222222222");
    expect(result.stdout).toContain("33333333-3333-4333-8333-333333333333");
    expect(result.stderr.match(/RECEIVED/g)).toHaveLength(1);
  });
  it("honors explicit received --since using the search receipt cutoff", async () => {
    const fixture = setup();
    const result = await run([
      ...args,
      "--since",
      "2026-09-27",
      "--timeout",
      "1",
    ]);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(fixture.requests[1]?.searchParams.has("date_from")).toBe(true);
  });
  it("includes mail created before --since but received on or after it", async () => {
    const fixture = setup();
    fixture.replies[0] = {
      ...fixture.replies[0],
      received_at: "2026-09-27T00:00:00.000Z",
    };
    const result = await run([
      ...args,
      "--since",
      "2026-09-27",
      "--timeout",
      "1",
    ]);
    expect(result.failure).toBeUndefined();
    expect(JSON.parse(result.stdout).id).toBe(
      "22222222-2222-4222-8222-222222222222",
    );
    expect(fixture.requests[1]?.searchParams.has("date_from")).toBe(true);
  });
  it("keeps progress pending on timeout and lets the same standalone wait recover later", async () => {
    const fixture = setup();
    const reply = fixture.replies[0];
    fixture.replies = [
      {
        ...reply,
        parsed: {
          status: "complete",
          attachments: [{ filename: "interaction.json", size_bytes: 1 }],
        },
      },
    ];
    const pending = await run([...args, "--timeout", "1"]);
    expect(pending.exitCode).toBe(1);
    expect(pending.stdout).toBe("");
    expect(pending.stderr).toContain("Timed out");
    fixture.replies = [reply];
    const recovered = await run(args);
    expect(recovered.failure).toBeUndefined();
    expect(JSON.parse(recovered.stdout).id).toBe(reply.id);
  });
  it("preserves the search-based behavior and default new-arrival window for organization keys", async () => {
    const fixture = setup(false);
    const result = await run(["--subject", "verify"]);
    expect(result.failure).toBeUndefined();
    expect(JSON.parse(result.stdout).id).toBe(
      "22222222-2222-4222-8222-222222222222",
    );
    expect(fixture.requests).toHaveLength(1);
    expect(fixture.requests[0]?.pathname).toBe("/v1/emails/search");
    expect(fixture.requests[0]?.searchParams.get("date_from")).toBe(
      "2026-09-27T00:00:00.000Z",
    );
  });
});
