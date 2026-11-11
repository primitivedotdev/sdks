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
  LATE_MAIL_CLOCK_SLACK_MS,
  LATE_MAIL_MAX_LOOKBACK_MS,
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
    returned: number;
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
    const limit = query.limit ?? 50;
    const rows = all.slice(0, limit);
    requests.push({
      at,
      end: Date.now(),
      sort: query.sort,
      limit: query.limit,
      count: query.count,
      returned: rows.length,
    });
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

  // A re-read is a run of newest-first requests (it may read several pages), made only after
  // a poll that brought nothing new, at the largest page size and without the total count,
  // which the poll's own requests leave as the server's default. Each starts one interval after
  // the poll first moved its cursor (here the first request) and after the previous one ended,
  // but for one on the last poll before the deadline.
  const expectThrottledRereads = (
    requests: ReturnType<typeof searchServer>["requests"],
    intervalSeconds: number,
    deadline: number,
  ) => {
    const runs: Array<{ start: number; end: number }> = [];
    let previous: (typeof requests)[number] | undefined;
    for (const r of requests) {
      const newestFirst = r.sort === "received_at_desc";
      if (newestFirst) {
        expect(r.limit).toBe(MAX_EMAIL_POLL_PAGE_SIZE);
        expect(r.count).toBe("false");
        const run = runs.at(-1);
        if (previous?.sort === "received_at_desc" && run) run.end = r.end;
        else {
          expect(previous?.returned).toBe(0);
          runs.push({ start: r.at, end: r.end });
        }
      } else expect(r.count).toBeUndefined();
      previous = r;
    }
    const spacing = Math.max(
      LATE_MAIL_REREAD_MS,
      LATE_MAIL_REREAD_POLLS * intervalSeconds * 1000,
    );
    const lastPoll = deadline - intervalSeconds * 1000;
    expect(runs.length).toBeGreaterThan(1);
    expect(runs[0]?.start).toBeGreaterThanOrEqual(START + spacing);
    for (let i = 1; i < runs.length; i += 1) {
      const gap = (runs[i]?.start ?? 0) - (runs[i - 1]?.end ?? 0);
      if (gap < spacing) {
        expect(runs[i]?.start).toBeGreaterThanOrEqual(lastPoll);
        expect(runs[i - 1]?.end).toBeLessThan(lastPoll);
        expect(i).toBe(runs.length - 1);
      }
    }
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
      expectThrottledRereads(
        server.requests,
        interval,
        START + interval * 40_000,
      );
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
      expectThrottledRereads(
        server.requests,
        interval,
        START + interval * 40_000,
      );
    },
  );

  // Re-reads 15 minutes apart. The cursor first moves at 1200s, to an email received at
  // 1100s, and at 2100s to one received at 2000s; re-reads come at 2100s (ending 2120s) and at
  // 3020s, each reading from ten minutes and a minute of clock slack before the previous one
  // began (before 1200s, at first). Behind the cursor, an email received at 1000s and readable at
  // 1250s is read by the first re-read; one received at 1445s and readable at 2105s, during the
  // first re-read, is read by the second.
  describe("with re-reads further apart than ten minutes (--interval 300)", () => {
    const at = (seconds: number) => START + seconds * 1000;
    const gapServer = () =>
      searchServer((_call, now) =>
        [
          { id: "later", received: 1100, readable: 1100 },
          { id: "earlier", received: 1000, readable: 1250 },
          { id: "latest", received: 2000, readable: 2000 },
          { id: "during", received: 1445, readable: 2105 },
        ]
          .filter((e) => now >= at(e.readable))
          .map((e) =>
            row(e.id, { received_at: new Date(at(e.received)).toISOString() }),
          ),
      );
    const rereadStarts = (
      requests: ReturnType<typeof searchServer>["requests"],
    ) =>
      requests
        .filter((r) => r.sort === "received_at_desc")
        .map((r) => (r.at - START) / 1000);

    it("emails wait reports them", async () => {
      const server = gapServer();
      mocks.searchEmails.mockImplementation(server.handler);
      const { ids } = await waitIds([
        "--json",
        "--include-existing",
        "--number",
        "5",
        "--timeout",
        "3300",
        "--interval",
        "300",
      ]);
      expect(ids).toEqual(["later", "latest", "earlier", "during"]);
      expect(rereadStarts(server.requests)).toEqual([2100, 3020]);
    });

    it("emails watch reports them", async () => {
      const server = gapServer();
      mocks.searchEmails.mockImplementation(server.handler);
      expect(
        await runWatch([
          "--jsonl",
          "--include-existing",
          "--seconds",
          "3300",
          "--interval",
          "300",
        ]),
      ).toEqual(["later", "latest", "earlier", "during"]);
      expect(rereadStarts(server.requests)).toEqual([2100, 3020]);
    });
  });

  // Re-reads come 90 seconds apart at --interval 30: one at 90s (ending 110s) misses an email
  // readable from 95s, and the next would be due at 200s, after the deadline at 150s. The last
  // poll, at 140s, re-reads anyway.
  it.each(["wait", "watch"])(
    "is reported by emails %s on its last poll before the deadline",
    async (command) => {
      const server = searchServer((_call, now) => [
        row("later", { received_at: LATER }),
        ...(now >= START + 95_000
          ? [row("late", { received_at: EARLIER })]
          : []),
      ]);
      mocks.searchEmails.mockImplementation(server.handler);
      const ids =
        command === "wait"
          ? (
              await waitIds([
                "--json",
                "--include-existing",
                "--number",
                "3",
                "--timeout",
                "150",
                "--interval",
                "30",
              ])
            ).ids
          : await runWatch([
              "--jsonl",
              "--include-existing",
              "--seconds",
              "150",
              "--interval",
              "30",
            ]);
      expect(ids).toEqual(["later", "late"]);
      expect(
        server.requests
          .filter((r) => r.sort === "received_at_desc")
          .map((r) => (r.at - START) / 1000),
      ).toEqual([90, 140]);
    },
  );

  // New mail on every other poll: a re-read only ever follows a poll that brought none.
  it.each(["wait", "watch"])(
    "emails %s re-reads only after a poll that brought nothing new",
    async (command) => {
      const stream: Array<ReturnType<typeof row>> = [];
      let polls = 0;
      const server = searchServer(() => stream);
      mocks.searchEmails.mockImplementation(
        async (request: Parameters<typeof server.handler>[0]) => {
          if (request.query.sort !== "received_at_desc") {
            polls += 1;
            if (polls % 2 === 1)
              stream.push(
                row(`m${polls}`, {
                  received_at: new Date(Date.now()).toISOString(),
                }),
              );
          }
          return server.handler(request);
        },
      );
      if (command === "wait")
        await waitIds([
          "--json",
          "--number",
          "1000",
          "--timeout",
          "60",
          "--interval",
          "2",
        ]);
      else await runWatch(["--jsonl", "--seconds", "60", "--interval", "2"]);
      expectThrottledRereads(server.requests, 2, START + 60_000);
    },
  );

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

    // A short page with a cursor (a search the server stopped early for time) goes on, and
    // reaching the page limit on such pages is cut short; on full pages it is not.
    mocks.searchEmails.mockReset();
    mocks.searchEmails.mockResolvedValue(page([row("x")], "more"));
    const short = await recent();
    expect(short.rows).toHaveLength(LATE_MAIL_MAX_PAGES);
    expect(short.cutShort).toBe(true);
    expect(mocks.searchEmails).toHaveBeenCalledTimes(LATE_MAIL_MAX_PAGES);
    mocks.searchEmails.mockReset();
    const full = Array.from({ length: MAX_EMAIL_POLL_PAGE_SIZE }, (_, i) =>
      row(`f${i}`),
    );
    mocks.searchEmails.mockResolvedValue(page(full, "more"));
    const capped = await recent();
    expect(capped.rows).toHaveLength(
      LATE_MAIL_MAX_PAGES * MAX_EMAIL_POLL_PAGE_SIZE,
    );
    expect(capped.cutShort).toBe(false);
    // A full page without a cursor stops.
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
  const BACK = LATE_MAIL_WINDOW_MS + LATE_MAIL_CLOCK_SLACK_MS;

  it("is first due one interval after start, then one interval after the last re-read ended", async () => {
    const reread = lateMailReread({
      pollIntervalMs: 2_000,
      deadline: null,
      start: START,
    });
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
    const reread = lateMailReread({
      pollIntervalMs: 30_000,
      deadline: null,
      start: START,
    });
    expect(reread.due(START + 60_000)).toBe(false);
    expect(reread.due(START + LATE_MAIL_REREAD_POLLS * 30_000)).toBe(true);
  });

  it("is due on the last poll before the deadline unless one ended within it", async () => {
    const reread = lateMailReread({
      pollIntervalMs: 2_000,
      deadline: START + 20_000,
      start: START,
    });
    mocks.searchEmails.mockResolvedValue(page([]));
    vi.setSystemTime(START + LATE_MAIL_REREAD_MS);
    await reread.read(params);
    expect(reread.due(START + 17_000)).toBe(false);
    expect(reread.due(START + 18_500)).toBe(true);
    vi.setSystemTime(START + 18_500);
    await reread.read(params);
    expect(reread.due(START + 19_500)).toBe(false);
  });

  it("reads from ten minutes and the clock slack before the last re-read not cut short began", async () => {
    const reread = lateMailReread({
      pollIntervalMs: 2_000,
      deadline: null,
      start: START,
    });
    mocks.searchEmails.mockResolvedValue(page([]));
    vi.setSystemTime(START + 60_000);
    await reread.read(params);
    // The first reads from before the poll that first moved the cursor.
    expect(readFrom(0)).toBe(START - BACK);
    // Half an hour on, the next still reads from before the last began.
    vi.setSystemTime(START + 1_800_000);
    mocks.searchEmails.mockResolvedValueOnce({
      error: { error: { code: "rate_limited" } },
      response: new Response(null, { status: 429 }),
    });
    await reread.read(params);
    expect(readFrom(1)).toBe(START + 60_000 - BACK);
    // That one failed, so the one after reads from the same place.
    vi.setSystemTime(START + 1_900_000);
    await reread.read(params);
    expect(readFrom(2)).toBe(START + 60_000 - BACK);
    vi.setSystemTime(START + 2_000_000);
    await reread.read(params);
    expect(readFrom(3)).toBe(START + 1_900_000 - BACK);
  });

  it("reads back no further than its limit while re-reads are cut short", async () => {
    const reread = lateMailReread({
      pollIntervalMs: 2_000,
      deadline: null,
      start: START,
    });
    mocks.searchEmails.mockResolvedValue({
      error: { error: { code: "rate_limited" } },
      response: new Response(null, { status: 429 }),
    });
    vi.setSystemTime(START + 2 * 3_600_000);
    await reread.read(params);
    expect(readFrom(0)).toBe(
      START +
        2 * 3_600_000 -
        LATE_MAIL_MAX_LOOKBACK_MS -
        LATE_MAIL_CLOCK_SLACK_MS,
    );
  });
});
