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

describe("activity created", () => {
  it("is registered beside the generated operation", () => {
    expect(COMMANDS["activity:created"]).toBeDefined();
    expect(COMMANDS["activity:list-activity-objects"]).toBeDefined();
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

  it("marks a notice whose rule has since been deleted", () => {
    const out = formatConcerningRows([
      item({
        kind: "email_rule_coverage",
        name: "Vendor invoices",
        state: "started",
        rule_id: "3b0f6a1e-6c7a-4f43-9d8e-2a1b5c4d3e2f",
        rule_now: "deleted",
        owned_now: "someone_else",
        created_through: { kind: "member", id: "u-3", name: "Sam Rivera" },
      }),
      item({
        kind: "email_rule_coverage",
        name: "Other rule",
        state: "started",
        owned_now: "someone_else",
        created_through: { kind: "member", id: "u-3", name: "Sam Rivera" },
      }),
    ]);
    expect(out).toMatch(
      /^started\s+.*Vendor invoices \(deleted\)\s+Sam Rivera/m,
    );
    expect(out).toMatch(/^started\s+.*Other rule\s+Sam Rivera/m);
    expect(out).not.toMatch(/Other rule \(deleted\)/);
  });

  it("says in its help that notices can lag, promising no cadence, and which id is the rule's", () => {
    const help = ActivityConcerningCommand.description;
    expect(help).toContain("Notices can lag.");
    // receivers_changed is listed, with its totals, and no longer said to be left out.
    expect(help).toContain(
      "receivers_changed, with the totals before and after in the table",
    );
    expect(help).not.toContain(
      "changes to its keys, webhooks or share are not listed",
    );
    expect(help).not.toMatch(/every minute|a few minutes/);
    expect(help).toContain(
      "RULE ID, and rule_id with --json, is the rule's id",
    );
  });

  it("shows a receivers_changed notice's totals before and after in a last column, and where to see who", () => {
    const changed = (
      before: unknown,
      after: unknown,
      name = "Vendor invoices",
    ) =>
      item({
        kind: "email_rule_coverage",
        rule_id: "3b0f6a1e-6c7a-4f43-9d8e-2a1b5c4d3e2f",
        name,
        state: "receivers_changed",
        owned_now: "someone_else",
        created_through: { kind: "member", id: "u-3", name: "Sam Rivera" },
        receivers_change: { before, after },
      } as Partial<ActivityItem>);
    const totals = { keys: 3, reads_in_full: 1, webhooks: 2, shares: 0 };
    const out = formatConcerningRows([
      changed(totals, { ...totals, keys: 2, reads_in_full: 0, webhooks: 1 }),
      changed(totals, totals, "Same"),
      changed(totals, { ...totals, reads_in_full: 2 }, "Full"),
      changed(totals, { ...totals, keys: 4, shares: 1 }, "Shared"),
      item({ kind: "email_rule_coverage", state: "started", name: "Other" }),
    ]);
    expect(out).toMatch(
      /^NOTICE\s+WHEN \(UTC\)\s+RULE\s+AUTHOR\s+RULE ID\s+CHANGE$/m,
    );
    expect(out).toMatch(
      /^receivers_changed {2,}.*Vendor invoices\s+Sam Rivera\s+3b0f6a1e-6c7a-4f43-9d8e-2a1b5c4d3e2f {2}keys 3 to 2 \(1 to 0 also reading your mail beyond the rule\), webhooks 2 to 1$/m,
    );
    expect(out).toMatch(
      /Same\s+.*same totals, an owner or webhook site changed$/m,
    );
    expect(out).toMatch(
      /Full\s+.*keys 3 \(1 to 2 also reading your mail beyond the rule\)$/m,
    );
    expect(out).toMatch(/Shared\s+.*keys 3 to 4, shares 0 to 1$/m);
    // Other notices keep their state alone, and nothing is added to the NOTICE column.
    expect(out).toMatch(/^started {2,}.*Other/m);
    expect(out).not.toContain("receivers_changed (");
    expect(out).toContain(
      "get-email-rule-covering-me <rule-id>` shows who receives them now, by owner, while the rule covers you.",
    );
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
    expect(out).toMatch(/Off\s+.*turned off$/m);
    expect(out).toMatch(/Moved\s+.*no longer reaches your mailboxes$/m);
    expect(out).toMatch(/^started {2,}.*Other/m);
    // An older server, or a reason this CLI does not know: the state alone.
    for (const reason of [undefined, "renamed", 3]) {
      const bare = formatConcerningRows([stop(reason, "Bare")]);
      expect(bare).not.toContain("CHANGE");
      expect(bare).toMatch(/^stopped {2,}2026-/m);
    }
  });

  it("says in its help that a rule that stops covering you is listed as stopped", () => {
    const help = ActivityConcerningCommand.description;
    expect(help).toContain(
      "A rule that stops covering you is listed as stopped, with why",
    );
    expect(help).not.toContain(
      "A rule that stops covering you and a rename are not listed",
    );
  });

  it("shows no CHANGE for totals that are missing or not counts, and lists every footnote together", () => {
    const odd = (receivers_change: unknown, state = "receivers_changed") =>
      item({
        kind: "email_rule_coverage",
        state,
        name: "Odd",
        receivers_change,
      } as Partial<ActivityItem>);
    const totals = { keys: 3, reads_in_full: 1, webhooks: 2, shares: 0 };
    for (const change of [
      undefined,
      { before: { keys: 3 }, after: totals },
      { before: {}, after: {} },
      { before: [], after: [] },
      { before: { ...totals, keys: "3" }, after: totals },
      { before: { ...totals, keys: -1 }, after: totals },
      { before: { ...totals, keys: 1.5 }, after: totals },
    ]) {
      const out = formatConcerningRows([odd(change)]);
      expect(out).not.toContain("CHANGE");
      expect(out).not.toContain("undefined");
      expect(out).toMatch(/^receivers_changed {2,}2026-/m);
    }
    // Totals on any other notice are not shown.
    expect(
      formatConcerningRows([
        odd({ before: totals, after: { ...totals, keys: 1 } }, "new_version"),
      ]),
    ).not.toContain("CHANGE");
    const all = formatConcerningRows(
      [
        item({
          kind: "email_rule_coverage",
          state: "pending",
          name: "Waiting",
        }),
        odd({ before: totals, after: { ...totals, webhooks: 3 } }),
      ],
      false,
      null,
      false,
    );
    expect(all).toContain("pending: the rule covers you now");
    expect(all).toContain(
      "receivers_changed: who receives the rule's matches changed",
    );
    expect(all).toContain("did not finish");
    expect(formatConcerningRows([item({ state: "started" })])).not.toContain(
      "receivers_changed:",
    );
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

  it("never reads an empty listing as no rule covering you: it says how far the notices go and where to look now", async () => {
    const now =
      "Notices can lag, so a rule that starts covering your mail may not appear here yet. `primitive email-rule-oversight list-email-rules-covering-me` shows what covers you now.";
    expect(formatConcerningRows([], true)).toBe(
      `Nothing recorded for you yet. ${now}`,
    );
    expect(formatConcerningRows([], true, "2026-11-12T23:50:03.315Z")).toBe(
      `Nothing recorded for you as of 2026-11-12 23:50 UTC. ${now}`,
    );
    expect(formatConcerningRows([])).toBe("Nothing to show.");
    expect(formatConcerningRows([], true)).not.toMatch(/has covered/);
    const urls = useApi([
      {
        body: {
          success: true,
          data: {
            covers: "you",
            items: [],
            withheld: [],
            next_cursor: null,
            as_of: "2026-11-12T23:50:03.315Z",
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
    expect(urls).toHaveLength(1);
    expect(lines.join("\n")).toContain(
      `Nothing recorded for you as of 2026-11-12 23:50 UTC. ${now}`,
    );
  });

  it("lists a rule that covers you before its notice is written as pending, and keeps as_of in --json", async () => {
    const pending = item({
      kind: "email_rule_coverage",
      id: "6e4dc223-0000-4000-8000-000000000001",
      name: "edge-test-noshare-secrets",
      state: "pending",
      created_at: "2026-11-12T23:49:21.000Z",
      owned_now: "someone_else",
      created_through: { kind: "member", id: "u-1", name: "Ethan Byrd" },
    });
    const out = formatConcerningRows([pending], true, null);
    expect(out).toMatch(
      /^pending\s+2026-11-12 23:49\s+edge-test-noshare-secrets\s+Ethan Byrd\s+6e4dc223-0000-4000-8000-000000000001$/m,
    );
    expect(out).toContain(
      "pending: the rule covers you now and its notice is not written yet.",
    );
    expect(formatConcerningRows([item({ state: "started" })])).not.toContain(
      "pending:",
    );
    useApi([
      {
        body: {
          success: true,
          data: {
            covers: "you",
            items: [pending],
            withheld: [],
            next_cursor: null,
            as_of: null,
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
    await ActivityConcerningCommand.run(["--json"], { root });
    expect(JSON.parse(lines.join("\n"))).toMatchObject({
      items: [{ id: pending.id, state: "pending" }],
      as_of: null,
    });
  });

  it("keeps pending_complete in --json, and says when the check for pending rows did not finish", async () => {
    const unfinished =
      "The check for rules that cover you with no notice written yet did not finish, so some may be missing: run this again in a moment.";
    const covering =
      "`primitive email-rule-oversight list-email-rules-covering-me` shows what covers you now.";
    // Nothing listed, but the check ran out of time: not "nothing recorded".
    expect(formatConcerningRows([], false, null, false)).toBe(
      `${unfinished} ${covering}`,
    );
    const started = item({ kind: "email_rule_coverage", state: "started" });
    expect(formatConcerningRows([started], false, null, false)).toContain(
      `\n\n${unfinished} ${covering}`,
    );
    // Under a pending row's own note, the pointer is not said twice.
    const pending = item({ kind: "email_rule_coverage", state: "pending" });
    const both = formatConcerningRows([pending], false, null, false);
    expect(both.split(covering)).toHaveLength(2);
    expect(both.endsWith(unfinished)).toBe(true);
    expect(formatConcerningRows([started], true, null, true)).not.toContain(
      unfinished,
    );
    const answer = (pending_complete?: boolean) => ({
      body: {
        success: true,
        data: {
          covers: "you",
          items: [],
          withheld: [],
          next_cursor: null,
          as_of: "2026-11-12T23:50:03.315Z",
          ...(pending_complete === undefined ? {} : { pending_complete }),
        },
      },
    });
    const lines: string[] = [];
    vi.spyOn(ActivityConcerningCommand.prototype, "log").mockImplementation(
      (message?: string) => {
        lines.push(message ?? "");
      },
    );
    useApi([answer(false)]);
    await ActivityConcerningCommand.run(["--json"], { root });
    expect(JSON.parse(lines.join("\n"))).toMatchObject({
      pending_complete: false,
    });
    // Unfinished is never read as a complete, empty listing.
    lines.length = 0;
    useApi([answer(false)]);
    await ActivityConcerningCommand.run([], { root });
    expect(lines.join("\n")).toBe(`${unfinished} ${covering}`);
    // An answer without it keeps the document as it was.
    lines.length = 0;
    useApi([answer()]);
    await ActivityConcerningCommand.run(["--json"], { root });
    expect(JSON.parse(lines.join("\n"))).not.toHaveProperty("pending_complete");
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
