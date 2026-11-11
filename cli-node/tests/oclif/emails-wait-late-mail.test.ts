import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAuthenticatedCliApiClient: vi.fn(),
  searchEmails: vi.fn(),
  sleep: vi.fn(),
}));

vi.mock("@primitivedotdev/api-core", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@primitivedotdev/api-core")>();
  return {
    ...actual,
    searchEmails: mocks.searchEmails,
    operations: { ...actual.operations, searchEmails: mocks.searchEmails },
  };
});

vi.mock("../../src/oclif/api-client.js", () => ({
  createAuthenticatedCliApiClient: mocks.createAuthenticatedCliApiClient,
}));

// Waiting between polls moves the clock instead.
vi.mock("../../src/oclif/commands/emails-poll.js", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("../../src/oclif/commands/emails-poll.js")
  >()),
  sleep: mocks.sleep,
}));

import {
  type EmailSearchPageResult,
  fetchRecentEmails,
  LATE_MAIL_MAX_PAGES,
  LATE_MAIL_REREAD_MS,
  LATE_MAIL_WINDOW_MS,
  lateMailReread,
  MAX_EMAIL_POLL_PAGE_SIZE,
} from "../../src/oclif/commands/emails-poll.js";
import { COMMANDS } from "../../src/oclif/index.js";

const CLI_ROOT = resolve(import.meta.dirname, "../..");
const START = Date.parse("2026-11-11T12:00:00.000Z");

type Runnable = {
  run(argv: string[], options: { root: string }): Promise<unknown>;
};

function row(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    sender: "alice@example.com",
    recipient: "agent@example.com",
    subject: `hello ${id}`,
    received_at: new Date(START - 60_000).toISOString(),
    created_at: new Date(START - 60_000).toISOString(),
    status: "completed",
    domain: "example.com",
    webhook_attempt_count: 0,
    thread_id: `thread-${id}`,
    ...overrides,
  };
}

function page(rows: unknown[], cursor: string | null = null) {
  return { data: { success: true, data: rows, meta: { cursor } } };
}

// Run through the registry, as the installed CLI does, and record stdout
// and stderr separately and interleaved (as `2>&1` would see them).
async function runWait(argv: string[]) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const merged: string[] = [];
  const out = (text: string) => {
    stdout.push(text);
    merged.push(text);
  };
  const err = (text: string) => {
    stderr.push(text);
    merged.push(text);
  };
  const spies = [
    vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
      out(String(chunk));
      return true;
    }),
    vi.spyOn(process.stderr, "write").mockImplementation((chunk: unknown) => {
      err(String(chunk));
      return true;
    }),
    vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      out(`${args.map(String).join(" ")}\n`);
    }),
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      err(`${args.map(String).join(" ")}\n`);
    }),
  ];
  const previousExitCode = process.exitCode;
  process.exitCode = undefined;
  let thrown: unknown;
  try {
    await (COMMANDS["emails:wait"] as unknown as Runnable).run(argv, {
      root: CLI_ROOT,
    });
  } catch (error) {
    thrown = error;
  } finally {
    for (const spy of spies) spy.mockRestore();
  }
  const exitCode = process.exitCode;
  process.exitCode = previousExitCode;
  const lines = (chunks: string[]) =>
    chunks
      .join("")
      .split("\n")
      .filter((line) => line.trim() !== "");
  return {
    exitCode,
    merged: lines(merged),
    stderr: stderr.join(""),
    stdout: lines(stdout),
    thrown,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(START);
  mocks.sleep.mockImplementation(async (ms: number) => {
    vi.setSystemTime(Date.now() + ms);
  });
  mocks.createAuthenticatedCliApiClient.mockResolvedValue({
    apiClient: { client: {} },
    auth: { kind: "api-key", source: "flag", apiBaseUrl: "http://x" },
    baseUrlOverridden: false,
  });
});

afterEach(() => {
  vi.useRealTimers();
});

const encode = (r: { received_at: string; id: string }) =>
  Buffer.from(`r|${r.received_at}|${r.id}`).toString("base64url");

/**
 * A search server that pages as the API does: by received_at in the order
 * asked, after the cursor (`r|<received_at>|<id>`, base64url), nothing
 * received before date_from, and a cursor only when there is more. `visible`
 * says which emails each request can read, by request number, so one can
 * become readable after a later one. Records each request and when it came.
 */
function searchServer(
  visible: (call: number) => Array<ReturnType<typeof row>>,
) {
  const requests: Array<{ at: number; sort?: string; limit?: number }> = [];
  const handler = async ({
    query,
  }: {
    query: {
      cursor?: string;
      date_from?: string;
      limit?: number;
      sort?: string;
    };
  }) => {
    requests.push({ at: Date.now(), sort: query.sort, limit: query.limit });
    const desc = query.sort === "received_at_desc";
    const after = query.cursor
      ? Buffer.from(query.cursor, "base64url").toString("utf8").split("|")[1]
      : undefined;
    const from = query.date_from
      ? Date.parse(query.date_from)
      : Number.NEGATIVE_INFINITY;
    const all = visible(requests.length)
      .filter((r) => Date.parse(r.received_at) >= from)
      .filter(
        (r) =>
          after === undefined ||
          (desc ? r.received_at < after : r.received_at > after),
      )
      .sort(
        (a, b) => (a.received_at < b.received_at ? -1 : 1) * (desc ? -1 : 1),
      );
    const limit = query.limit ?? 50;
    const rows = all.slice(0, limit);
    const last = rows.at(-1);
    return page(rows, all.length > limit && last ? encode(last) : null);
  };
  return { handler, requests };
}

describe("an email that becomes readable after a later one", () => {
  // Received a few seconds apart; the earlier one becomes readable only from the second request.
  const EARLIER = new Date(START - 5_000).toISOString();
  const LATER = new Date(START - 3_000).toISOString();
  const lateServer = () =>
    searchServer((call) => [
      ...(call === 1 ? [] : [row("earlier", { received_at: EARLIER })]),
      row("later", { received_at: LATER }),
    ]);

  // Re-reads come one interval after the wait starts and no closer together, newest first and full size.
  const expectThrottledRereads = (
    requests: ReturnType<typeof searchServer>["requests"],
  ) => {
    const rereads = requests.filter((r) => r.sort === "received_at_desc");
    expect(rereads.length).toBeGreaterThan(1);
    expect(rereads[0]?.at).toBeGreaterThanOrEqual(START + LATE_MAIL_REREAD_MS);
    for (let i = 1; i < rereads.length; i += 1)
      expect(
        (rereads[i]?.at ?? 0) - (rereads[i - 1]?.at ?? 0),
      ).toBeGreaterThanOrEqual(LATE_MAIL_REREAD_MS);
    for (const r of rereads) expect(r.limit).toBe(MAX_EMAIL_POLL_PAGE_SIZE);
  };

  it("is reported by emails wait, once, after the later one", async () => {
    const server = lateServer();
    mocks.searchEmails.mockImplementation(server.handler);
    // Asks for three, so the wait runs on past both and would print a repeat.
    const result = await runWait([
      "--json",
      "--include-existing",
      "--number",
      "3",
      "--timeout",
      "60",
      "--interval",
      "2",
    ]);
    const docs = result.stdout.map(
      (l) => JSON.parse(l) as { id?: string; error?: { message?: string } },
    );
    // The emails, then the timeout under --json.
    expect(docs.slice(0, -1).map((d) => d.id)).toEqual(["later", "earlier"]);
    expect(JSON.stringify(docs.at(-1))).toContain("received 2");
    expect(result.exitCode).toBe(1);
    expectThrottledRereads(server.requests);
  });

  it("is reported by emails watch, once, after the later one", async () => {
    const server = lateServer();
    mocks.searchEmails.mockImplementation(server.handler);
    const out: string[] = [];
    const spies = [
      vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
        out.push(args.map(String).join(" "));
      }),
      vi.spyOn(process.stderr, "write").mockImplementation(() => true),
    ];
    try {
      await (COMMANDS["emails:watch"] as unknown as Runnable).run(
        ["--jsonl", "--include-existing", "--seconds", "60", "--interval", "2"],
        { root: CLI_ROOT },
      );
    } finally {
      for (const spy of spies) spy.mockRestore();
    }
    expect(out.map((l) => (JSON.parse(l) as { id?: string }).id)).toEqual([
      "later",
      "earlier",
    ]);
    expectThrottledRereads(server.requests);
  });

  it("is not re-read for while the wait has passed no mail, as each poll reads it all", async () => {
    const server = searchServer(() => []);
    mocks.searchEmails.mockImplementation(server.handler);
    const result = await runWait([
      "--json",
      "--include-existing",
      "--number",
      "2",
      "--timeout",
      "60",
      "--interval",
      "2",
    ]);
    expect(result.exitCode).toBe(1);
    expect(server.requests.length).toBeGreaterThan(10);
    expect(
      server.requests.filter((r) => r.sort === "received_at_desc"),
    ).toEqual([]);
  });
});

describe("fetchRecentEmails", () => {
  const recent = (
    options: {
      since?: string;
      deadline?: number;
      fetchPage?: Parameters<typeof fetchRecentEmails>[0]["fetchPage"];
    } = {},
  ) =>
    fetchRecentEmails({
      apiClient: { client: {} } as never,
      filters: {},
      ...options,
    });
  const query = (call: number) =>
    mocks.searchEmails.mock.calls[call]?.[0].query;

  it("reads the last window, never before since, newest first at the largest page size", async () => {
    mocks.searchEmails.mockResolvedValue(page([]));
    await recent();
    expect(query(0)).toMatchObject({
      date_from: new Date(START - LATE_MAIL_WINDOW_MS).toISOString(),
      limit: MAX_EMAIL_POLL_PAGE_SIZE,
      sort: "received_at_desc",
    });
    const since = new Date(START - 60_000).toISOString();
    await recent({ since });
    expect(query(1)?.date_from).toBe(since);
    // A since older than the window is held to the window; one still to come is kept.
    await recent({ since: new Date(START - 3_600_000).toISOString() });
    expect(query(2)?.date_from).toBe(
      new Date(START - LATE_MAIL_WINDOW_MS).toISOString(),
    );
    const future = new Date(START + 60_000).toISOString();
    await recent({ since: future });
    expect(query(3)?.date_from).toBe(future);
  });

  it("gives the rows oldest first, and pages only while the server says there is more, up to its limit", async () => {
    mocks.searchEmails
      .mockResolvedValueOnce(page([row("c"), row("b")], "next-1"))
      .mockResolvedValueOnce(page([row("a")]));
    expect((await recent()).map((r) => r.id)).toEqual(["a", "b", "c"]);
    expect(query(1)?.cursor).toBe("next-1");
    expect(mocks.searchEmails).toHaveBeenCalledTimes(2);

    // A short page with a cursor goes on; a full page without one stops.
    mocks.searchEmails.mockReset();
    mocks.searchEmails.mockResolvedValue(page([row("x")], "more"));
    expect(await recent()).toHaveLength(LATE_MAIL_MAX_PAGES);
    expect(mocks.searchEmails).toHaveBeenCalledTimes(LATE_MAIL_MAX_PAGES);
    mocks.searchEmails.mockReset();
    mocks.searchEmails.mockResolvedValue(
      page(
        Array.from({ length: MAX_EMAIL_POLL_PAGE_SIZE }, (_, i) =>
          row(`r${i}`),
        ),
      ),
    );
    await recent();
    expect(mocks.searchEmails).toHaveBeenCalledTimes(1);
  });

  it("keeps what it has when a page fails or throws, and reads nothing past the deadline", async () => {
    mocks.searchEmails
      .mockResolvedValueOnce(page([row("b"), row("a")], "next"))
      .mockResolvedValueOnce({
        error: { error: { code: "unauthorized" } },
        response: new Response(null, { status: 401 }),
      });
    expect((await recent()).map((r) => r.id)).toEqual(["a", "b"]);

    const throwing = vi.fn(async (): Promise<EmailSearchPageResult> => {
      throw new Error("this server cannot filter by reply state");
    });
    expect(await recent({ fetchPage: throwing })).toEqual([]);
    expect(throwing).toHaveBeenCalledTimes(1);

    mocks.searchEmails.mockClear();
    expect(await recent({ deadline: START })).toEqual([]);
    expect(mocks.searchEmails).not.toHaveBeenCalled();
  });
});

describe("lateMailReread", () => {
  it("is first due one interval after it is made, then no more often", () => {
    const due = lateMailReread(15_000, 0);
    expect(due(1_000)).toBe(false);
    expect(due(15_000)).toBe(true);
    expect(due(20_000)).toBe(false);
    expect(due(30_000)).toBe(true);
  });
});
