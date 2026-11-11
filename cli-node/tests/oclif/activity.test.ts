import { resolve } from "node:path";
import { PrimitiveApiClient } from "@primitivedotdev/api-core";
import { afterEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("../../src/oclif/api-client.js", async (original) => ({
  ...(await original<typeof import("../../src/oclif/api-client.js")>()),
  createAuthenticatedCliApiClient: auth.create,
}));

import {
  ActivityCreatedCommand,
  type ActivityItem,
  ALL_PAGES_LIMIT,
  formatActivityRows,
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
    const urls = useApi((n) => page([item({ id: `id-${n}` })], `c${n}`));
    const lines = captureLog();
    await ActivityCreatedCommand.run(["--all", "--json"], { root });
    expect(urls).toHaveLength(ALL_PAGES_LIMIT);
    const answer = JSON.parse(lines.join("\n"));
    expect(answer.items).toHaveLength(ALL_PAGES_LIMIT);
    expect(answer.next_cursor).toBe(`c${ALL_PAGES_LIMIT}`);
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
