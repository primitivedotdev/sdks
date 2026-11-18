import { resolve } from "node:path";
import { PrimitiveApiClient } from "@primitivedotdev/api-core";
import { afterEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("../../src/oclif/api-client.js", async (original) => ({
  ...(await original<typeof import("../../src/oclif/api-client.js")>()),
  createAuthenticatedCliApiClient: auth.create,
}));
// A retry's backoff is not waited out in tests.
const sleeps = vi.hoisted(() => ({ sleep: vi.fn(async () => {}) }));
vi.mock("../../src/oclif/commands/emails-poll.js", async (original) => ({
  ...(await original<
    typeof import("../../src/oclif/commands/emails-poll.js")
  >()),
  sleep: sleeps.sleep,
}));

import {
  ACTIVITY_ATTEMPTS,
  ActivityAskedCommand,
  ActivityConcerningCommand,
  ActivityCreatedCommand,
  type ActivityItem,
  ALL_PAGES_LIMIT,
  formatActivityRows,
  formatAskedRows,
  formatConcerningRows,
  formatWithheld,
  NETWORK_ERROR_MESSAGE,
  resumeCommand,
  throughLabel,
} from "../../src/oclif/commands/activity.js";
import { COMMANDS } from "../../src/oclif/index.js";

const root = resolve(import.meta.dirname, "../..");

const item = (overrides: Partial<ActivityItem> = {}): ActivityItem => ({
  kind: "endpoint",
  id: "0b0f6a43-3c1c-4d4e-9b1a-1f2d3c4b5a69",
  name: "invoices hook",
  state: "enabled",
  created_at: "2026-11-10T12:34:56.000Z",
  ended_at: null,
  owned_now: "you",
  created_through: { kind: "member", id: null, name: null },
  ...overrides,
});

describe("activity tables print other members' text safely", () => {
  const hostile = "pay\u001b[31mroll\u001b[0m \u202etxt.exe\nnext";
  const shown = "payroll txt.exe next";

  it("strips terminal controls and reordering marks from every cell", () => {
    const named = item({
      name: hostile,
      created_through: { kind: "org_key", id: "k", name: hostile },
    });
    for (const out of [
      formatActivityRows("you", [named]),
      formatAskedRows([
        { ...named, kind: "email_rule_request", state: "pending" },
      ]),
      formatConcerningRows([
        { ...named, kind: "email_rule", state: "started" },
      ]),
    ]) {
      expect(out).not.toContain("\u001b");
      expect(out).not.toContain("\u202e");
      expect(out.split("\n")).toHaveLength(2);
      expect(out).toContain(shown);
    }
  });
});

describe("activity created", () => {
  it("is registered beside the generated operation", () => {
    expect(COMMANDS["activity:created"]).toBeDefined();
    expect(COMMANDS["activity:list"]).toBeDefined();
  });

  it("prints one row per object, with what each came through for a person", () => {
    const out = formatActivityRows("you", [
      item(),
      item({
        kind: "api_key",
        name: "old key",
        state: "revoked",
        created_through: { kind: "member", id: null, name: null },
      }),
      item({
        kind: "recipient_route",
        name: "billing@example.com",
        owned_now: "someone_else",
        created_through: { kind: "org_key", id: "k", name: "deploy key" },
      }),
    ]);
    const lines = out.split("\n");
    expect(lines[0]).toMatch(
      /^KIND\s+STATE\s+CREATED \(UTC\)\s+NAME\s+THROUGH$/,
    );
    expect(lines[1]).toMatch(
      /^endpoint\s+enabled\s+2026-11-10 12:34\s+invoices hook\s+you$/,
    );
    expect(lines[2]).toContain("revoked");
    expect(lines[3]).toContain("enabled (transferred)");
    expect(lines[3]).toMatch(/key deploy key$/);
  });

  it("leaves out the THROUGH column for one credential, which made everything itself", () => {
    expect(
      formatActivityRows("this_credential", [item()]).split("\n")[0],
    ).not.toContain("THROUGH");
    expect(formatActivityRows("you", [])).toBe("Nothing to show.");
  });

  it("names each credential kind in words", () => {
    expect(
      throughLabel({ kind: "oauth", id: null, name: "Primitive CLI" }),
    ).toBe("app Primitive CLI");
    expect(
      throughLabel({
        kind: "connected_key",
        id: null,
        name: "agent@example.com",
      }),
    ).toBe("agent agent@example.com");
    expect(throughLabel({ kind: "org_key", id: null, name: null })).toBe("key");
  });

  it("says which kinds were left out and what would show them, without counts", () => {
    expect(formatWithheld([])).toBeNull();
    expect(
      formatWithheld([
        {
          kind: "function",
          reason: "permission_missing",
          permission: "functions:read",
        },
        { kind: "scheduled_send", reason: "mail_scope", permission: null },
        {
          kind: "api_key",
          reason: "not_for_this_credential",
          permission: null,
        },
      ]),
    ).toBe(
      "Not shown: function (needs functions:read), scheduled_send (needs access to every mailbox), api_key (not for this credential).",
    );
  });
});

describe("resumeCommand", () => {
  it("repeats the listing's filters with the next cursor", () => {
    expect(
      resumeCommand(
        "primitive",
        { kind: "endpoint,api_key", state: "ended", limit: 20 },
        "c1",
      ),
    ).toBe(
      "primitive activity created --kind endpoint,api_key --state ended --limit 20 --cursor c1",
    );
    expect(
      resumeCommand("primitive", { state: "all", limit: 50, all: true }, "c2"),
    ).toBe("primitive activity created --all --cursor c2");
  });

  it("quotes a value the shell would split", () => {
    expect(
      resumeCommand(
        "primitive",
        { kind: "a b", state: "all", limit: 50 },
        "x'y",
      ),
    ).toBe(`primitive activity created --kind 'a b' --cursor 'x'\\''y'`);
    expect(
      resumeCommand("primitive", { kind: "=ls", state: "all", limit: 50 }, "c"),
    ).toBe("primitive activity created --kind '=ls' --cursor c");
  });
});

type Reply = { status?: number; body: unknown };

const page = (
  items: ActivityItem[],
  next_cursor: string | null,
  covers = "you",
): Reply => ({
  body: {
    success: true,
    data: { covers, items, withheld: [], next_cursor },
  },
});

function useApi(replies: Reply[] | ((n: number) => Reply)) {
  const urls: URL[] = [];
  const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
    const request = new Request(input, init);
    urls.push(new URL(request.url));
    const reply =
      typeof replies === "function" ? replies(urls.length) : replies.shift();
    if (!reply) throw new Error("Unexpected extra API request");
    return new Response(JSON.stringify(reply.body), {
      status: reply.status ?? 200,
      headers: { "content-type": "application/json" },
    });
  });
  auth.create.mockResolvedValue({
    apiClient: new PrimitiveApiClient({
      apiKey: "test-key",
      apiBaseUrl: "https://api.example.test/v1",
      fetch,
    }),
    auth: {},
    baseUrlOverridden: false,
  });
  return urls;
}

function captureLog(): string[] {
  const lines: string[] = [];
  vi.spyOn(ActivityCreatedCommand.prototype, "log").mockImplementation(
    (message?: string) => {
      lines.push(message ?? "");
    },
  );
  return lines;
}

describe("activity created command", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    auth.create.mockReset();
    process.exitCode = undefined;
  });

  it("sends its filters and prints how to resume the same listing", async () => {
    const urls = useApi([page([item()], "next-1")]);
    const lines = captureLog();
    await ActivityCreatedCommand.run(
      [
        "--kind",
        "endpoint",
        "--state",
        "live",
        "--limit",
        "10",
        "--cursor",
        "c0",
      ],
      { root },
    );
    expect(urls).toHaveLength(1);
    expect(urls[0]?.pathname).toBe("/v1/activity/objects");
    expect(Object.fromEntries(urls[0]?.searchParams ?? [])).toEqual({
      kind: "endpoint",
      state: "live",
      limit: "10",
      cursor: "c0",
    });
    expect(lines.join("\n")).toContain("invoices hook");
    expect(lines.at(-1)).toMatch(
      /More: \S+ activity created --kind endpoint --state live --limit 10 --cursor next-1$/,
    );
  });

  it("follows an empty page that still has a next cursor with --all", async () => {
    const urls = useApi([
      page([], "c1"),
      page([item({ name: "second page" })], null),
    ]);
    const lines = captureLog();
    await ActivityCreatedCommand.run(["--all"], { root });
    expect(urls.map((url) => url.searchParams.get("cursor"))).toEqual([
      null,
      "c1",
    ]);
    const out = lines.join("\n");
    expect(out).toContain("second page");
    expect(out).not.toContain("More:");
  });

  it(`stops --all after ${ALL_PAGES_LIMIT} pages and says where to resume`, async () => {
    const urls = useApi((n) => {
      if (n > ALL_PAGES_LIMIT) throw new Error("past the cap");
      return page([item({ id: `id-${n}` })], `c${n}`);
    });
    const lines = captureLog();
    await ActivityCreatedCommand.run(["--all", "--json"], { root });
    expect(urls).toHaveLength(ALL_PAGES_LIMIT);
    const answer = JSON.parse(lines.join("\n"));
    expect(answer.items).toHaveLength(ALL_PAGES_LIMIT);
    expect(answer.next_cursor).toBe(`c${ALL_PAGES_LIMIT}`);
  });

  it(`prints the resume command, --all kept, after ${ALL_PAGES_LIMIT} pages`, async () => {
    useApi((n) => {
      if (n > ALL_PAGES_LIMIT) throw new Error("past the cap");
      return page([item({ id: `id-${n}` })], `c${n}`);
    });
    const lines = captureLog();
    await ActivityCreatedCommand.run(["--all", "--state", "ended"], { root });
    expect(lines.at(-1)).toMatch(
      new RegExp(
        `More: \\S+ activity created --state ended --all --cursor c${ALL_PAGES_LIMIT}$`,
      ),
    );
  });

  it("exits 1 and prints the API's error when the request fails", async () => {
    useApi([
      {
        status: 403,
        body: {
          success: false,
          error: { code: "forbidden", message: "Not for this credential" },
        },
      },
    ]);
    const lines = captureLog();
    const stderr: string[] = [];
    vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
      stderr.push(String(chunk));
      return true;
    });
    await ActivityCreatedCommand.run([], { root });
    expect(process.exitCode).toBe(1);
    expect(lines).toEqual([]);
    expect(stderr.join("")).toContain("Not for this credential");
  });
});

describe("activity asked command", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    auth.create.mockReset();
    process.exitCode = undefined;
  });

  it("is registered beside activity created", () => {
    expect(COMMANDS["activity:asked"]).toBeDefined();
  });

  it("lists what was asked of you, naming its kind and who asked, and asks the API for exactly that", async () => {
    const urls = useApi([
      page(
        [
          item({
            kind: "email_rule_request",
            name: "Vendor billing",
            state: "pending",
            owned_now: "someone_else",
            created_through: { kind: "member", id: "u-1", name: "Sam Rivera" },
          }),
          item({
            kind: "email_rule_objection",
            id: "5d1c2b3a-4e5f-4a6b-8c7d-9e0f1a2b3c4d",
            name: "Archive newsletters",
            state: "pending",
            owned_now: "someone_else",
            created_through: { kind: "member", id: "u-2", name: "Ana Lima" },
          }),
        ],
        null,
      ),
    ]);
    const lines: string[] = [];
    vi.spyOn(ActivityAskedCommand.prototype, "log").mockImplementation(
      (message?: string) => {
        lines.push(message ?? "");
      },
    );
    await ActivityAskedCommand.run(["--state", "live"], { root });
    expect(Object.fromEntries(urls[0]?.searchParams ?? [])).toEqual({
      relation: "asked",
      state: "live",
      limit: "50",
    });
    const out = lines.join("\n");
    expect(out).toMatch(/^KIND\s+STATE\s+ASKED \(UTC\)\s+NAME\s+FROM\s+ID$/m);
    expect(out).toMatch(
      /^email_rule_request\s+pending\s+.*Vendor billing\s+Sam Rivera\s/m,
    );
    expect(out).toMatch(
      /^email_rule_objection\s+pending\s+.*Archive newsletters\s+Ana Lima\s/m,
    );
  });

  it("says nobody has asked only when the listing is the whole of it", () => {
    expect(formatAskedRows([], true)).toBe(
      "Nobody has asked you for anything.",
    );
    expect(formatAskedRows([])).toBe("Nothing to show.");
  });

  it("names who asked by id when it has no name, and continues with activity asked", async () => {
    useApi([
      page(
        [
          item({
            kind: "email_rule_request",
            name: "Vendor billing",
            state: "pending",
            created_through: { kind: "member", id: "u-9", name: null },
          }),
        ],
        "next-page",
      ),
    ]);
    const lines: string[] = [];
    vi.spyOn(ActivityAskedCommand.prototype, "log").mockImplementation(
      (message?: string) => {
        lines.push(message ?? "");
      },
    );
    await ActivityAskedCommand.run([], { root });
    const out = lines.join("\n");
    expect(out).toContain("u-9");
    expect(out).toMatch(/More: \S+ activity asked --cursor next-page$/m);
  });

  it("does not say nobody asked when an empty page has more after it", async () => {
    useApi([page([], "next-page")]);
    const lines: string[] = [];
    vi.spyOn(ActivityAskedCommand.prototype, "log").mockImplementation(
      (message?: string) => {
        lines.push(message ?? "");
      },
    );
    await ActivityAskedCommand.run([], { root });
    const out = lines.join("\n");
    expect(out).toContain("Nothing to show.");
    expect(out).not.toContain("Nobody has asked");
    expect(out).toMatch(/More: \S+ activity asked --cursor next-page$/m);
  });

  it("says nothing to show, not that nobody asked, for a filtered listing", async () => {
    useApi([page([], null)]);
    const lines: string[] = [];
    vi.spyOn(ActivityAskedCommand.prototype, "log").mockImplementation(
      (message?: string) => {
        lines.push(message ?? "");
      },
    );
    await ActivityAskedCommand.run(["--state", "ended"], { root });
    expect(lines.join("\n")).toContain("Nothing to show.");
  });
});

describe("activity concerning command", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    auth.create.mockReset();
    process.exitCode = undefined;
  });

  it("is registered beside activity asked", () => {
    expect(COMMANDS["activity:concerning"]).toBeDefined();
  });

  it("says under the table what a baseline notice is, when one is listed", () => {
    const out = formatConcerningRows([
      item({
        kind: "email_rule_coverage",
        name: "Vendor invoices",
        state: "baseline",
        owned_now: "someone_else",
        created_through: { kind: "member", id: "u-3", name: "Sam Rivera" },
      }),
    ]);
    expect(out).toContain(
      "\n\nbaseline: the rule already covered you when these notices began, so its start was never told as news.",
    );
  });

  it("says in three sentences what is listed, that notices can lag, and which id is the rule's", () => {
    const help = ActivityConcerningCommand.description;
    expect(help).toContain("Notices can lag");
    expect(help).not.toMatch(/every minute|a few minutes|receivers_change/);
    expect(help).toContain("stopped (it stopped, with why)");
    expect(help).toContain(
      "RULE ID, and rule_id with --json, is the rule's id",
    );
    expect(help.split(/(?<=\.) /)).toHaveLength(3);
  });

  it("shows a stopped notice's reason in the last column, and nothing for a reason it does not know", () => {
    const stop = (stop_reason: unknown, name: string) =>
      item({
        kind: "email_rule_coverage",
        rule_id: "3b0f6a1e-6c7a-4f43-9d8e-2a1b5c4d3e2f",
        name,
        state: "stopped",
        owned_now: "someone_else",
        created_through: { kind: "member", id: "u-3", name: "Sam Rivera" },
        stop_reason,
      } as Partial<ActivityItem>);
    const out = formatConcerningRows([
      stop("deleted", "Gone"),
      stop("turned_off", "Off"),
      stop("no_longer_covers", "Moved"),
      item({ kind: "email_rule_coverage", state: "started", name: "Other" }),
    ]);
    expect(out).toMatch(
      /^NOTICE\s+WHEN \(UTC\)\s+RULE\s+AUTHOR\s+RULE ID\s+CHANGE$/m,
    );
    expect(out).toMatch(
      /^stopped {2,}.*Gone\s+Sam Rivera\s+3b0f6a1e-6c7a-4f43-9d8e-2a1b5c4d3e2f {2}rule deleted$/m,
    );
    expect(out).toMatch(/Off\s+.*set to draft$/m);
    expect(out).toMatch(/Moved\s+.*no longer reaches your mailboxes$/m);
    expect(out).toMatch(/^started {2,}.*Other/m);
    // An older server, or a reason this CLI does not know: the state alone.
    for (const reason of [
      undefined,
      "renamed",
      3,
      "constructor",
      "toString",
      "__proto__",
    ]) {
      const bare = formatConcerningRows([stop(reason, "Bare")]);
      expect(bare).not.toContain("CHANGE");
      expect(bare).toMatch(/^stopped {2,}2026-/m);
    }
  });

  it("lists coverage notices with the rule's author, and asks the API for exactly that", async () => {
    const urls = useApi([
      page(
        [
          item({
            kind: "email_rule_coverage",
            id: "6e2d3c4b-5a69-4b1a-9c8d-7e6f5a4b3c2d",
            rule_id: "3b0f6a1e-6c7a-4f43-9d8e-2a1b5c4d3e2f",
            name: "Vendor invoices",
            state: "new_version",
            owned_now: "someone_else",
            created_through: { kind: "member", id: "u-3", name: "Sam Rivera" },
          }),
          item({
            kind: "email_rule_coverage",
            name: "Vendor invoices",
            state: "started",
            owned_now: "someone_else",
            created_through: { kind: "member", id: "u-3", name: null },
          }),
        ],
        "next-page",
      ),
    ]);
    const lines: string[] = [];
    vi.spyOn(ActivityConcerningCommand.prototype, "log").mockImplementation(
      (message?: string) => {
        lines.push(message ?? "");
      },
    );
    await ActivityConcerningCommand.run([], { root });
    expect(Object.fromEntries(urls[0]?.searchParams ?? [])).toEqual({
      relation: "concerning",
      state: "all",
      limit: "50",
    });
    const out = lines.join("\n");
    expect(out).toMatch(/^NOTICE\s+WHEN \(UTC\)\s+RULE\s+AUTHOR\s+RULE ID$/m);
    expect(out).toMatch(
      /^new_version\s+.*Vendor invoices\s+Sam Rivera\s+3b0f6a1e-6c7a-4f43-9d8e-2a1b5c4d3e2f$/m,
    );
    // An older server sends no rule_id: the column is left empty.
    expect(out).toMatch(/^started\s+.*Vendor invoices\s+u-3$/m);
    // A notice's id is not a rule's, so the table leaves it out.
    expect(out).not.toContain("6e2d3c4b-5a69-4b1a-9c8d-7e6f5a4b3c2d");
    expect(out).toMatch(/More: \S+ activity concerning --cursor next-page$/m);
  });

  it("never reads an empty listing as no rule covering you: it says where to look now", async () => {
    const empty =
      "No coverage notices to show. `primitive email-rule-oversight list-covering-me` shows what covers you now.";
    expect(formatConcerningRows([])).toBe(empty);
    const urls = useApi([
      {
        body: {
          success: true,
          data: {
            covers: "you",
            items: [],
            withheld: [],
            next_cursor: null,
          },
        },
      },
    ]);
    const lines: string[] = [];
    vi.spyOn(ActivityConcerningCommand.prototype, "log").mockImplementation(
      (message?: string) => {
        lines.push(message ?? "");
      },
    );
    await ActivityConcerningCommand.run([], { root });
    // The notices only: no other read.
    expect(urls.map((url) => url.pathname)).toEqual(["/v1/activity/objects"]);
    expect(lines.join("\n")).toContain(empty);
  });
});

describe("activity reads that fail on the way", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    auth.create.mockReset();
    process.exitCode = undefined;
  });

  /** Answers attempt n with what reply(n) gives, or throws what it throws. */
  function useFetch(reply: (n: number) => Response) {
    let attempts = 0;
    auth.create.mockResolvedValue({
      apiClient: new PrimitiveApiClient({
        apiKey: "test-key",
        apiBaseUrl: "https://api.example.test/v1",
        fetch: vi.fn<typeof globalThis.fetch>(async () => {
          attempts += 1;
          return reply(attempts);
        }),
      }),
      auth: {},
      baseUrlOverridden: false,
    });
    return () => attempts;
  }

  // As undici throws it: the cause is not an enumerable property.
  const fetchFailed = (code: string) =>
    new TypeError("fetch failed", {
      cause: Object.assign(new Error(`connect ${code}`), { code }),
    });
  const connectTimeout = () => fetchFailed("UND_ERR_CONNECT_TIMEOUT");
  const ok = () =>
    new Response(JSON.stringify(page([item()], null).body), {
      headers: { "content-type": "application/json" },
    });

  function captureStderr(): string[] {
    const chunks: string[] = [];
    vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
      chunks.push(String(chunk));
      return true;
    });
    return chunks;
  }

  it("retries a network error, saying so, and then prints the feed", async () => {
    const attempts = useFetch((n) => {
      if (n === 1) throw connectTimeout();
      return ok();
    });
    const lines = captureLog();
    const stderr = captureStderr();
    await ActivityCreatedCommand.run([], { root });
    expect(attempts()).toBe(2);
    expect(process.exitCode).toBeUndefined();
    expect(stderr.join("")).toContain("primitive: network error; retrying in");
    expect(lines.join("\n")).toContain("invoices hook");
  });

  it("retries an unavailable API, and not a refusal", async () => {
    let attempts = useFetch((n) =>
      n === 1
        ? new Response(JSON.stringify({ success: false }), { status: 503 })
        : ok(),
    );
    captureLog();
    captureStderr();
    await ActivityCreatedCommand.run([], { root });
    expect(attempts()).toBe(2);
    expect(process.exitCode).toBeUndefined();

    attempts = useFetch(
      () =>
        new Response(
          JSON.stringify({
            success: false,
            error: { code: "forbidden", message: "No." },
          }),
          { status: 403, headers: { "content-type": "application/json" } },
        ),
    );
    await ActivityCreatedCommand.run([], { root });
    expect(attempts()).toBe(1);
    expect(process.exitCode).toBe(1);
  });

  it("waits out a Retry-After within its budget and tries again, and not one longer than it", async () => {
    const limited = (seconds: string) =>
      new Response(
        JSON.stringify({
          success: false,
          error: { code: "rate_limit_exceeded", message: "Slow down." },
        }),
        {
          status: 429,
          headers: {
            "content-type": "application/json",
            "retry-after": seconds,
          },
        },
      );
    sleeps.sleep.mockClear();
    let attempts = useFetch((n) => (n === 1 ? limited("2") : ok()));
    captureLog();
    captureStderr();
    await ActivityCreatedCommand.run([], { root });
    expect(attempts()).toBe(2);
    expect(sleeps.sleep).toHaveBeenCalledWith(2000);
    expect(process.exitCode).toBeUndefined();

    sleeps.sleep.mockClear();
    attempts = useFetch(() => limited("60"));
    const stderr = captureStderr();
    await ActivityCreatedCommand.run([], { root });
    expect(attempts()).toBe(1);
    expect(sleeps.sleep).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
    // The answer's own Retry-After is what the hint names.
    expect(stderr.join("")).toContain("Retry in 60 s.");
  });

  it("stops retrying once a sleep runs past its budget", async () => {
    let now = Date.now();
    vi.spyOn(Date, "now").mockImplementation(() => now);
    sleeps.sleep.mockImplementationOnce(async () => {
      now += 20_000;
    });
    const attempts = useFetch(() => new Response("", { status: 503 }));
    captureLog();
    captureStderr();
    await ActivityCreatedCommand.run([], { root });
    expect(attempts()).toBe(1);
    expect(process.exitCode).toBe(1);
  });

  it("keeps a network error's own code beside the words, with its hint", async () => {
    const attempts = useFetch(() => {
      throw fetchFailed("ENOTFOUND");
    });
    captureLog();
    const stderr = captureStderr();
    await ActivityCreatedCommand.run([], { root });
    expect(attempts()).toBe(ACTIVITY_ATTEMPTS);
    expect(process.exitCode).toBe(1);
    const said = stderr.join("");
    expect(said).toContain(NETWORK_ERROR_MESSAGE);
    expect(said).toContain('"cause": "ENOTFOUND"');
    expect(said).toContain("the API host name did not resolve");
  });

  it("asks for the same page again after a transient failure with --all", async () => {
    const cursors: (string | null)[] = [];
    let attempts = 0;
    auth.create.mockResolvedValue({
      apiClient: new PrimitiveApiClient({
        apiKey: "test-key",
        apiBaseUrl: "https://api.example.test/v1",
        fetch: vi.fn<typeof globalThis.fetch>(async (input, init) => {
          attempts += 1;
          cursors.push(
            new URL(new Request(input, init).url).searchParams.get("cursor"),
          );
          if (attempts === 2) throw connectTimeout();
          const body =
            attempts === 1
              ? page([item()], "c1").body
              : page([item({ name: "second page" })], null).body;
          return new Response(JSON.stringify(body), {
            headers: { "content-type": "application/json" },
          });
        }),
      }),
      auth: {},
      baseUrlOverridden: false,
    });
    const lines = captureLog();
    captureStderr();
    await ActivityCreatedCommand.run(["--all"], { root });
    expect(cursors).toEqual([null, "c1", "c1"]);
    expect(lines.join("\n")).toContain("second page");
  });

  it("with --json, prints one document whose error is the network error", async () => {
    useFetch(() => {
      throw connectTimeout();
    });
    const lines = captureLog();
    const stderr = captureStderr();
    // The JSON guard prints the one document with console.log.
    const stdout: string[] = [];
    vi.spyOn(console, "log").mockImplementation((line = "") => {
      stdout.push(String(line));
    });
    await ActivityCreatedCommand.run(["--json"], { root });
    expect(process.exitCode).toBe(1);
    expect(stderr.join("")).toBe("");
    const document = JSON.parse(stdout.join("\n"));
    expect(document.error).toEqual({
      code: "network_error",
      message: NETWORK_ERROR_MESSAGE,
      cause: "UND_ERR_CONNECT_TIMEOUT",
    });
    expect(lines).toEqual([]);
  });

  it("never prints an empty error: an empty body is named by its status, and an unreadable one says so", async () => {
    const jsonError = async (reply: () => Response) => {
      useFetch(reply);
      captureLog();
      captureStderr();
      const stdout: string[] = [];
      vi.spyOn(console, "log").mockImplementation((line = "") => {
        stdout.push(String(line));
      });
      process.exitCode = undefined;
      await ActivityCreatedCommand.run(["--json"], { root });
      expect(process.exitCode).toBe(1);
      vi.restoreAllMocks();
      return JSON.parse(stdout.join("\n")).error;
    };
    expect(await jsonError(() => new Response("", { status: 503 }))).toEqual({
      code: "http_error",
      message: "HTTP 503",
    });
    expect(
      await jsonError(
        () =>
          new Response("not json", {
            headers: { "content-type": "application/json" },
          }),
      ),
    ).toMatchObject({ code: "response_error" });
  });

  it("words a network error that does not clear, keeping the transport's code only as its cause", async () => {
    const attempts = useFetch(() => {
      throw connectTimeout();
    });
    captureLog();
    const stderr = captureStderr();
    await ActivityConcerningCommand.run([], { root });
    expect(attempts()).toBe(ACTIVITY_ATTEMPTS);
    expect(process.exitCode).toBe(1);
    const said = stderr.join("");
    expect(said).toContain(NETWORK_ERROR_MESSAGE);
    expect(said).toContain('"cause": "UND_ERR_CONNECT_TIMEOUT"');
    expect(said).not.toContain("fetch failed");
  });
});
