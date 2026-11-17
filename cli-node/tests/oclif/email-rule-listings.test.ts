import { resolve } from "node:path";
import {
  operationManifest,
  PrimitiveApiClient,
} from "@primitivedotdev/api-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createOperationCommand } from "../../src/oclif/api-command.js";
import {
  decisionLines,
  emptyRuleListHint,
  listEmailRulesErrorHint,
  ruleListLines,
} from "../../src/oclif/email-rule-listings.js";

const auth = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("../../src/oclif/api-client.js", () => ({
  createAuthenticatedCliApiClient: auth.create,
}));

type Reply = { body: unknown; status?: number };

function fixture(...responses: Reply[]) {
  const calls: { method: string; url: URL }[] = [];
  const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
    const request = new Request(input, init);
    calls.push({ method: request.method, url: new URL(request.url) });
    const next = responses.shift();
    if (!next) throw new Error("Unexpected extra API request");
    return new Response(JSON.stringify(next.body), {
      status: next.status ?? 200,
      headers: { "content-type": "application/json" },
    });
  });
  const apiClient = new PrimitiveApiClient({
    apiKey: "test-key",
    apiBaseUrl: "https://api.example.test/v1",
    fetch,
  });
  auth.create.mockResolvedValue({
    apiClient,
    auth: {},
    baseUrlOverridden: false,
  });
  return calls;
}

function command(sdkName: string) {
  const operation = operationManifest.find((op) => op.sdkName === sdkName);
  if (!operation) throw new Error(`missing operation ${sdkName}`);
  return createOperationCommand(operation) as unknown as {
    run(argv: string[], opts: { root: string }): Promise<void>;
    flags: Record<string, { type?: string; options?: string[] }>;
  };
}

const root = resolve(import.meta.dirname, "../..");

afterEach(() => {
  vi.restoreAllMocks();
  auth.create.mockReset();
  process.exitCode = undefined;
});

function rule(extra: Record<string, unknown>) {
  return {
    id: "6b1f2c1e-0d3a-4b8e-9a51-2f0c7d9e4a10",
    name: "Investor intros",
    state: "active",
    kind: "grant",
    evaluation_scope: "author",
    scope_selection: null,
    current_version: 3,
    revision: 4,
    author: {
      user_id: "1f0b6c2a-7e3d-4c59-8a1b-9d2e4f6a8c01",
      name: "Ethan Byrd",
      email: "ethan@example.test",
    },
    is_author: true,
    created_at: "2026-11-01T00:00:00Z",
    updated_at: "2026-11-02T00:00:00Z",
    ...extra,
  };
}

describe("ruleListLines", () => {
  it("prints one line per rule, with RECEIVERS only for --all", () => {
    const rows = [
      rule({
        receivers: {
          keys: [{ owner: { kind: "organization" }, count: 2 }],
          webhooks: [{ owner: { kind: "organization" }, count: 1 }],
          shares: [],
        },
      }),
      rule({
        name: "Payroll stays put",
        kind: "do_not_share",
        is_author: false,
        current_version: null,
        author: {
          user_id: "a1b2c3d4-0000-4000-8000-000000000000",
          name: null,
          email: null,
        },
        evaluation_scope: "selected",
        scope_selection: {
          addresses: ["a@x.test", "b@x.test", "c@x.test"],
          domains: ["y.test"],
        },
        receivers: { keys: [], webhooks: [], shares: [] },
      }),
      rule({
        name: "Recruiting",
        evaluation_scope: "own_mailboxes",
        receivers: null,
      }),
    ];
    const all = ruleListLines(rows, true);
    expect(all[0]).toMatch(
      /^NAME +AUTHOR +KIND +STATE +VERSION +COVERS +RECEIVERS$/,
    );
    expect(all[1]).toMatch(
      /^Investor intros +Ethan Byrd \(you\) +grant +active +v3 +all mail the author reads +2 keys, 1 webhook, 0 shares$/,
    );
    expect(all[2]).toMatch(
      /^Payroll stays put +a1b2c3d4 +do not share +active +- +a@x\.test, b@x\.test, c@x\.test \+1 more +-$/,
    );
    expect(all[3]).toMatch(/author's own mailboxes +unknown$/);
    const mine = ruleListLines(rows, false);
    expect(mine[0]).not.toContain("RECEIVERS");
    expect(mine[1]).toMatch(/all mail the author reads$/);
    expect(ruleListLines([], true)).toEqual([]);
  });
});

describe("decisionLines", () => {
  it("prints when, what, the email, its mailbox, sender and subject", () => {
    const lines = decisionLines([
      {
        email_id: "e1",
        matched: true,
        near_miss: false,
        decided_at: "2026-11-16T10:05:59Z",
        recipient: "ops@x.test",
        from_address: "billing@vendor.test",
        subject: "Invoice\u001b[31m 42",
      },
      {
        email_id: "e2",
        matched: false,
        near_miss: true,
        decided_at: "2026-11-16T10:06:00Z",
        recipient: null,
        from_address: null,
        subject: null,
      },
    ]);
    expect(lines[0]).toMatch(
      /^DECIDED +OUTCOME +EMAIL +RECIPIENT +FROM +SUBJECT$/,
    );
    expect(lines[1]).toMatch(
      /^2026-11-16 10:05 UTC +matched +e1 +ops@x\.test +billing@vendor\.test +Invoice 42$/,
    );
    expect(lines[2]).toMatch(/^2026-11-16 10:06 UTC +near miss +e2 +- +- +-$/);
    expect(lines.join("\n")).not.toContain("\u001b");
    expect(decisionLines([])).toEqual([]);
  });
});

describe("listEmailRulesErrorHint", () => {
  const refusal = (details: Record<string, unknown>) => ({
    success: false,
    error: { code: "grant_forbidden", message: "x", details },
  });

  it("says what to do for each refusal of a list filter", () => {
    expect(
      listEmailRulesErrorHint(
        "grant_forbidden",
        refusal({ reason: "owner_or_admin_only" }),
      ),
    ).toMatch(/^Only owners and admins can list every rule/);
    expect(
      listEmailRulesErrorHint(
        "grant_forbidden",
        refusal({ reason: "person_credential" }),
      ),
    ).toMatch(/your own CLI login/);
    expect(
      listEmailRulesErrorHint(
        "grant_forbidden",
        refusal({ reason: "permission_missing", param: "author" }),
      ),
    ).toMatch(/Use the author's user id instead/);
    expect(
      listEmailRulesErrorHint(
        "grant_forbidden",
        refusal({ reason: "permission_missing" }),
        { author: "a@x.test" },
      ),
    ).toMatch(/Use the author's user id instead/);
    expect(
      listEmailRulesErrorHint(
        "grant_forbidden",
        refusal({ reason: "mail_depth" }),
      ),
    ).toBeUndefined();
    expect(listEmailRulesErrorHint("forbidden", refusal({}))).toBeUndefined();
  });

  it("words the empty list by whether --all was given", () => {
    expect(emptyRuleListHint(true)).toMatch(/in the organization/);
    expect(emptyRuleListHint(false)).toMatch(/--all/);
  });
});

describe("email-rules list-email-rules", () => {
  it("takes --all as a switch and --kind and --state as fixed values", () => {
    const flags = command("listEmailRules").flags;
    expect(flags.all?.type).toBe("boolean");
    expect(flags.kind?.options).toEqual(["grant", "do_not_share"]);
    expect(flags.state?.options).toEqual(["draft", "observe", "active"]);
    expect(flags.author).toBeDefined();
    expect(flags.mailbox).toBeDefined();
  });

  it("sends all=true and the filters, and prints the table on stderr", async () => {
    const calls = fixture({
      body: {
        success: true,
        data: [rule({ receivers: { keys: [], webhooks: [], shares: [] } })],
        meta: { limit: 50, cursor: null },
      },
    });
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const stderr = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    await command("listEmailRules").run(
      [
        "--all",
        "--kind",
        "grant",
        "--state",
        "active",
        "--mailbox",
        "ops@x.test",
      ],
      { root },
    );
    const query = calls[0]?.url.searchParams;
    expect(query?.get("all")).toBe("true");
    expect(query?.get("kind")).toBe("grant");
    expect(query?.get("state")).toBe("active");
    expect(query?.get("mailbox")).toBe("ops@x.test");
    const printed = stderr.mock.calls.map(([chunk]) => String(chunk)).join("");
    expect(printed).toMatch(
      /NAME +AUTHOR +KIND +STATE +VERSION +COVERS +RECEIVERS/,
    );
  });

  it("sends no all without --all", async () => {
    const calls = fixture({
      body: { success: true, data: [], meta: { limit: 50, cursor: null } },
    });
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const stderr = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    await command("listEmailRules").run([], { root });
    expect(calls[0]?.url.searchParams.has("all")).toBe(false);
    const printed = stderr.mock.calls.map(([chunk]) => String(chunk)).join("");
    expect(printed).toContain(emptyRuleListHint(false));
  });

  it("says a short page filtered by mailbox is not the end", async () => {
    fixture({
      body: {
        success: true,
        data: [rule({})],
        meta: { limit: 50, cursor: "next-page" },
      },
    });
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const stderr = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    await command("listEmailRules").run(
      ["--mailbox", "ops@x.test", "--limit", "50"],
      { root },
    );
    const printed = stderr.mock.calls.map(([chunk]) => String(chunk)).join("");
    expect(printed).toContain(
      "Scanned part of the rules; run again with --cursor to continue.",
    );
  });

  it("replaces the generic grant hint when --all is refused", async () => {
    fixture({
      status: 403,
      body: {
        success: false,
        error: {
          code: "grant_forbidden",
          message: "Listing every rule is for owners and admins.",
          details: { reason: "owner_or_admin_only" },
        },
      },
    });
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const stderr = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    await command("listEmailRules").run(["--all"], { root });
    expect(process.exitCode).toBe(1);
    const printed = stderr.mock.calls.map(([chunk]) => String(chunk)).join("");
    expect(printed).toContain("Only owners and admins can list every rule.");
  });
});
