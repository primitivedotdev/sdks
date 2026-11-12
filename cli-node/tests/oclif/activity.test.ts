import { resolve } from "node:path";
import { PrimitiveApiClient } from "@primitivedotdev/api-core";
import { afterEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("../../src/oclif/api-client.js", async (original) => ({
  ...(await original<typeof import("../../src/oclif/api-client.js")>()),
  createAuthenticatedCliApiClient: auth.create,
}));

import {
  ActivityAskedCommand,
  ActivityConcerningCommand,
  ActivityCreatedCommand,
  type ActivityItem,
  ALL_PAGES_LIMIT,
  formatActivityRows,
  formatAskedRows,
  formatConcerningRows,
  formatWithheld,
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

  it("lists coverage notices with the rule's author, and asks the API for exactly that", async () => {
    const urls = useApi([
      page(
        [
          item({
            kind: "email_rule_coverage",
            id: "6e2d3c4b-5a69-4b1a-9c8d-7e6f5a4b3c2d",
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
    expect(out).toMatch(/^NOTICE\s+WHEN \(UTC\)\s+RULE\s+AUTHOR\s+ID$/m);
    expect(out).toMatch(/^new_version\s+.*Vendor invoices\s+Sam Rivera\s/m);
    expect(out).toMatch(/^started\s+.*Vendor invoices\s+u-3\s/m);
    expect(out).toMatch(/More: \S+ activity concerning --cursor next-page$/m);
  });

  it("says no rule has covered your mail only when the listing is the whole of it", async () => {
    expect(formatConcerningRows([], true)).toBe(
      "No other member's rule has covered your mail.",
    );
    expect(formatConcerningRows([])).toBe("Nothing to show.");
    useApi([page([], null)]);
    const lines: string[] = [];
    vi.spyOn(ActivityConcerningCommand.prototype, "log").mockImplementation(
      (message?: string) => {
        lines.push(message ?? "");
      },
    );
    await ActivityConcerningCommand.run([], { root });
    expect(lines.join("\n")).toContain(
      "No other member's rule has covered your mail.",
    );
  });
});
