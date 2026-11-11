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
  LATE_MAIL_REREAD_POLLS,
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

/** How long each newest-first request (a re-read's page) takes on the test clock. */
const REREAD_PAGE_TAKES_MS = 20_000;

/**
 * A search server that pages as the API does: by received_at in the order
 * asked, after the cursor (`r|<received_at>|<id>`, base64url), nothing
 * received before date_from, and a cursor only when there is more. `visible`
 * says which emails a request can read, by request number and time, so one
 * can become readable after a later one. A newest-first request moves the
 * clock on, as a slow re-read would. Records each request and when it came.
 */
function searchServer(
  visible: (call: number, now: number) => Array<ReturnType<typeof row>>,
) {
  const requests: Array<{
    at: number;
    end: number;
    sort?: string;
    limit?: number;
    count?: string;
  }> = [];
  const handler = async ({
    query,
  }: {
    query: {
      count?: string;
      cursor?: string;
      date_from?: string;
      limit?: number;
      sort?: string;
    };
  }) => {
    const at = Date.now();
    const desc = query.sort === "received_at_desc";
    const after = query.cursor
      ? Buffer.from(query.cursor, "base64url").toString("utf8").split("|")[1]
      : undefined;
    const from = query.date_from
      ? Date.parse(query.date_from)
      : Number.NEGATIVE_INFINITY;
    const all = visible(requests.length + 1, at)
      .filter((r) => Date.parse(r.received_at) >= from)
      .filter(
        (r) =>
          after === undefined ||
          (desc ? r.received_at < after : r.received_at > after),
      )
      .sort(
        (a, b) => (a.received_at < b.received_at ? -1 : 1) * (desc ? -1 : 1),
      );
    if (desc) vi.setSystemTime(at + REREAD_PAGE_TAKES_MS);
    requests.push({
      at,
      end: Date.now(),
      sort: query.sort,
      limit: query.limit,
      count: query.count,
    });
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

  // A re-read is a run of newest-first requests (it may read several pages). Each starts one
  // interval after the start and after the previous one ended, at the largest page size and
  // without the total count, which the poll's own requests leave as the server's default.
  const expectThrottledRereads = (
    requests: ReturnType<typeof searchServer>["requests"],
    intervalSeconds: number,
  ) => {
    const runs: Array<{ start: number; end: number }> = [];
    let previousNewestFirst = false;
    for (const r of requests) {
      const newestFirst = r.sort === "received_at_desc";
      if (newestFirst) {
        expect(r.limit).toBe(MAX_EMAIL_POLL_PAGE_SIZE);
        expect(r.count).toBe("false");
        const run = runs.at(-1);
        if (previousNewestFirst && run) run.end = r.end;
        else runs.push({ start: r.at, end: r.end });
      } else expect(r.count).toBeUndefined();
      previousNewestFirst = newestFirst;
    }
    const spacing = Math.max(
      LATE_MAIL_REREAD_MS,
      LATE_MAIL_REREAD_POLLS * intervalSeconds * 1000,
    );
    expect(runs.length).toBeGreaterThan(1);
    expect(runs[0]?.start).toBeGreaterThanOrEqual(START + spacing);
    for (let i = 1; i < runs.length; i += 1)
      expect(
        (runs[i]?.start ?? 0) - (runs[i - 1]?.end ?? 0),
      ).toBeGreaterThanOrEqual(spacing);
  };

  async function runWatch(argv: string[]) {
    const out: string[] = [];
    const spies = [
      vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
        out.push(args.map(String).join(" "));
      }),
      vi.spyOn(process.stderr, "write").mockImplementation(() => true),
    ];
    try {
      await (COMMANDS["emails:watch"] as unknown as Runnable).run(argv, {
        root: CLI_ROOT,
      });
    } finally {
      for (const spy of spies) spy.mockRestore();
    }
    return out.map((l) => (JSON.parse(l) as { id?: string }).id);
  }

  // The emails `emails wait` printed before its timeout document, under --json.
  async function waitIds(argv: string[]) {
    const result = await runWait(argv);
    const docs = result.stdout.map(
      (l) => JSON.parse(l) as { id?: string; error?: { message?: string } },
    );
    expect(result.exitCode).toBe(1);
    return {
      ids: docs.slice(0, -1).map((d) => d.id),
      timeout: JSON.stringify(docs.at(-1)),
    };
  }

  // At the default poll interval the re-read waits its own 15 seconds; at a long one, three polls.
  it.each([2, 30])(
    "is reported by emails wait, once, after the later one (--interval %i)",
    async (interval) => {
      const server = lateServer();
      mocks.searchEmails.mockImplementation(server.handler);
      // Asks for three, so the wait runs on past both and would print a repeat.
      const { ids, timeout } = await waitIds([
        "--json",
        "--include-existing",
        "--number",
        "3",
        "--timeout",
        String(interval * 40),
        "--interval",
        String(interval),
      ]);
      expect(ids).toEqual(["later", "earlier"]);
      expect(timeout).toContain("received 2");
      expectThrottledRereads(server.requests, interval);
    },
  );

  it.each([2, 30])(
    "is reported by emails watch, once, after the later one (--interval %i)",
    async (interval) => {
      const server = lateServer();
      mocks.searchEmails.mockImplementation(server.handler);
      const ids = await runWatch([
        "--jsonl",
        "--include-existing",
        "--seconds",
        String(interval * 40),
        "--interval",
        String(interval),
      ]);
      expect(ids).toEqual(["later", "earlier"]);
      expectThrottledRereads(server.requests, interval);
    },
  );

  // Re-reads 15 minutes apart, each reading from ten minutes before the previous one began:
  // received at 1000s and readable at 1250s, between two re-reads, the email is still read.
  describe("with re-reads further apart than ten minutes (--interval 300)", () => {
    const at = (seconds: number) => new Date(START + seconds * 1000);
    const gapServer = () =>
      searchServer((_call, now) =>
        [
          { id: "later", received: 1100, readable: 1100 },
          { id: "earlier", received: 1000, readable: 1250 },
        ]
          .filter((e) => now >= at(e.readable).getTime())
          .map((e) => row(e.id, { received_at: at(e.received).toISOString() })),
      );

    it("emails wait reports it", async () => {
      mocks.searchEmails.mockImplementation(gapServer().handler);
      const { ids } = await waitIds([
        "--json",
        "--include-existing",
        "--number",
        "3",
        "--timeout",
        "3000",
        "--interval",
        "300",
      ]);
      expect(ids).toEqual(["later", "earlier"]);
    });

    it("emails watch reports it", async () => {
      mocks.searchEmails.mockImplementation(gapServer().handler);
      expect(
        await runWatch([
          "--jsonl",
          "--include-existing",
          "--seconds",
          "3000",
          "--interval",
          "300",
        ]),
      ).toEqual(["later", "earlier"]);
    });
  });

  it("is not re-read while nothing has been reported, as each poll reads from the start", async () => {
    const server = searchServer(() => []);
    mocks.searchEmails.mockImplementation(server.handler);
    await waitIds([
      "--json",
      "--include-existing",
      "--number",
      "2",
      "--timeout",
      "60",
      "--interval",
      "2",
    ]);
    const byWait = server.requests.length;
    expect(byWait).toBeGreaterThan(10);
    await runWatch([
      "--jsonl",
      "--include-existing",
      "--seconds",
      "60",
      "--interval",
      "2",
    ]);
    expect(server.requests.length - byWait).toBeGreaterThan(10);
    expect(
      server.requests.filter((r) => r.sort === "received_at_desc"),
    ).toEqual([]);
  });
});

describe("fetchRecentEmails", () => {
  const recent = (
    options: {
      since?: string;
      from?: number;
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

  it("reads from ten minutes ago or the given time, never before since, newest first at the largest page size", async () => {
    mocks.searchEmails.mockResolvedValue(page([]));
    await recent();
    expect(query(0)).toMatchObject({
      count: "false",
      date_from: new Date(START - LATE_MAIL_WINDOW_MS).toISOString(),
      limit: MAX_EMAIL_POLL_PAGE_SIZE,
      sort: "received_at_desc",
    });
    const since = new Date(START - 60_000).toISOString();
    await recent({ since });
    expect(query(1)?.date_from).toBe(since);
    // A since before the time read from is held to it; one still to come is kept.
    await recent({ since: new Date(START - 3_600_000).toISOString() });
    expect(query(2)?.date_from).toBe(
      new Date(START - LATE_MAIL_WINDOW_MS).toISOString(),
    );
    const future = new Date(START + 60_000).toISOString();
    await recent({ since: future });
    expect(query(3)?.date_from).toBe(future);
    await recent({ from: START - 3_600_000, since });
    expect(query(4)?.date_from).toBe(since);
    await recent({ from: START - 3_600_000 });
    expect(query(5)?.date_from).toBe(new Date(START - 3_600_000).toISOString());
  });

  it("gives the rows oldest first, and pages only while the server says there is more, up to its limit", async () => {
    mocks.searchEmails
      .mockResolvedValueOnce(page([row("c"), row("b")], "next-1"))
      .mockResolvedValueOnce(page([row("a")]));
    const read = await recent();
    expect(read.rows.map((r) => r.id)).toEqual(["a", "b", "c"]);
    expect(read.cutShort).toBe(false);
    expect(query(1)?.cursor).toBe("next-1");
    expect(mocks.searchEmails).toHaveBeenCalledTimes(2);

    // A short page with a cursor goes on; a full page without one stops.
    mocks.searchEmails.mockReset();
    mocks.searchEmails.mockResolvedValue(page([row("x")], "more"));
    const capped = await recent();
    expect(capped.rows).toHaveLength(LATE_MAIL_MAX_PAGES);
    expect(capped.cutShort).toBe(false);
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

  it("keeps what it has when a page fails or throws, and reads nothing past the deadline, each cut short", async () => {
    mocks.searchEmails
      .mockResolvedValueOnce(page([row("b"), row("a")], "next"))
      .mockResolvedValueOnce({
        error: { error: { code: "unauthorized" } },
        response: new Response(null, { status: 401 }),
      });
    expect(await recent()).toEqual({
      rows: [
        expect.objectContaining({ id: "a" }),
        expect.objectContaining({ id: "b" }),
      ],
      cutShort: true,
    });

    const throwing = vi.fn(async (): Promise<EmailSearchPageResult> => {
      throw new Error("this server cannot filter by reply state");
    });
    expect(await recent({ fetchPage: throwing })).toEqual({
      rows: [],
      cutShort: true,
    });
    expect(throwing).toHaveBeenCalledTimes(1);

    mocks.searchEmails.mockClear();
    expect(await recent({ deadline: START })).toEqual({
      rows: [],
      cutShort: true,
    });
    expect(mocks.searchEmails).not.toHaveBeenCalled();
  });
});

describe("lateMailReread", () => {
  const params = { apiClient: { client: {} } as never, filters: {} };
  const readFrom = (call: number) =>
    Date.parse(mocks.searchEmails.mock.calls[call]?.[0].query.date_from);

  it("is first due one interval after it is made, then one interval after the last re-read ended", async () => {
    const reread = lateMailReread(2_000);
    expect(reread.due(START + 1_000)).toBe(false);
    expect(reread.due(START + LATE_MAIL_REREAD_MS)).toBe(true);
    // A re-read that takes 20 seconds: the next is due an interval after it ended.
    mocks.searchEmails.mockImplementation(async () => {
      vi.setSystemTime(Date.now() + 20_000);
      return page([]);
    });
    vi.setSystemTime(START + LATE_MAIL_REREAD_MS);
    await reread.read(params);
    const ended = START + LATE_MAIL_REREAD_MS + 20_000;
    expect(reread.due(ended + LATE_MAIL_REREAD_MS - 1)).toBe(false);
    expect(reread.due(ended + LATE_MAIL_REREAD_MS)).toBe(true);
  });

  it("waits three poll intervals when that is longer", () => {
    const reread = lateMailReread(30_000);
    expect(reread.due(START + 60_000)).toBe(false);
    expect(reread.due(START + LATE_MAIL_REREAD_POLLS * 30_000)).toBe(true);
  });

  it("reads from ten minutes before the last re-read that was not cut short began", async () => {
    const reread = lateMailReread(2_000);
    mocks.searchEmails.mockResolvedValue(page([]));
    vi.setSystemTime(START + 60_000);
    await reread.read(params);
    // The first reads from ten minutes before the poll began.
    expect(readFrom(0)).toBe(START - LATE_MAIL_WINDOW_MS);
    // An hour on, the next still reads from ten minutes before the last began.
    vi.setSystemTime(START + 3_600_000);
    mocks.searchEmails.mockResolvedValueOnce({
      error: { error: { code: "rate_limited" } },
      response: new Response(null, { status: 429 }),
    });
    await reread.read(params);
    expect(readFrom(1)).toBe(START + 60_000 - LATE_MAIL_WINDOW_MS);
    // That one failed, so the one after reads from the same place.
    vi.setSystemTime(START + 3_700_000);
    await reread.read(params);
    expect(readFrom(2)).toBe(START + 60_000 - LATE_MAIL_WINDOW_MS);
    vi.setSystemTime(START + 3_800_000);
    await reread.read(params);
    expect(readFrom(3)).toBe(START + 3_700_000 - LATE_MAIL_WINDOW_MS);
  });
});
