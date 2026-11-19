import { resolve } from "node:path";
import {
  operationManifest,
  PrimitiveApiClient,
} from "@primitivedotdev/api-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createOperationCommand } from "../../src/oclif/api-command.js";
import {
  shareLines,
  shareListLines,
} from "../../src/oclif/email-rule-shares.js";

const auth = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("../../src/oclif/api-client.js", () => ({
  createAuthenticatedCliApiClient: auth.create,
}));

const SHARE = "0b9a3c1e-6c4d-4a7e-9a51-000000000001";
const RULE = "6b1f2c1e-0d3a-4b8e-9a51-2f0c7d9e4a10";
const BEN = {
  user_id: "u-ben",
  name: "Ben Lee",
  email: "ben@x.test",
  active: true,
};
const ASHLEY = {
  user_id: "u-ash",
  name: null,
  email: "ashley@x.test",
  active: true,
};

function share(extra: Record<string, unknown> = {}) {
  return {
    id: SHARE,
    live: true,
    ended_at: null,
    end_reason: null,
    is_granter: false,
    is_beneficiary: true,
    granter: BEN,
    beneficiary: ASHLEY,
    rule_name: "Intern applications",
    rule: { name: "Intern applications", state: "active", current_version: 2 },
    rule_id: RULE,
    ...extra,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  auth.create.mockReset();
  process.exitCode = undefined;
});

describe("shareListLines", () => {
  it("shows a received share's rule id beside the share id, and says which goes where", () => {
    const lines = shareListLines([share()]);
    expect(lines[0]).toMatch(/^SHARE ID +RULE +RULE ID +WITH +STATE$/);
    expect(lines[1]).toContain(SHARE);
    expect(lines[1]).toContain(RULE);
    expect(lines[1]).toContain("from Ben Lee");
    expect(lines[1]).toMatch(/live$/);
    expect(lines.at(-1)).toMatch(
      /^RULE ID names the rule in your webhook deliveries.*SHARE ID/,
    );
  });

  it("shows `-` for a rule id the share no longer shows, with why it is not live", () => {
    const lines = shareListLines([
      share({
        live: false,
        ended_at: "2026-11-19T00:00:00Z",
        end_reason: "stopped_by_granter",
        rule: null,
        rule_id: null,
      }),
      share({ live: false, rule: null, rule_id: null, rule_name: null }),
    ]);
    expect(lines[1]).toMatch(
      /Intern applications +- +from Ben Lee +ended \(stopped_by_granter\)$/,
    );
    expect(lines[2]).toMatch(/- +- +from Ben Lee +not live$/);
  });

  it("names the person a given share is with, and adds no note for shares you gave", () => {
    const lines = shareListLines([
      share({ is_granter: true, is_beneficiary: false }),
    ]);
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain("to ashley@x.test");
  });

  it("names both people for an admin on neither side, and keeps a granter's id once ended", () => {
    const lines = shareListLines([
      share({ is_granter: false, is_beneficiary: false }),
      share({
        is_granter: true,
        is_beneficiary: false,
        live: false,
        ended_at: "2026-11-19T00:00:00Z",
        end_reason: "removed_by_beneficiary",
      }),
    ]);
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain("Ben Lee to ashley@x.test");
    expect(lines[2]).toContain(RULE);
    expect(lines[2]).toMatch(
      /to ashley@x\.test +ended \(removed_by_beneficiary\)$/,
    );
  });

  it("adds no note when no received share shows a rule id", () => {
    const lines = shareListLines([
      share({ live: false, rule: null, rule_id: null }),
    ]);
    expect(lines).toHaveLength(2);
  });

  it("prints nothing for an empty list, and keeps terminal control out", () => {
    expect(shareListLines([])).toEqual([]);
    expect(shareListLines(null)).toEqual([]);
    const lines = shareListLines([
      share({ rule: { name: "evil\u001b[31mred" } }),
    ]);
    expect(lines.join("\n")).not.toContain("\u001b");
  });
});

describe("shareLines", () => {
  it("gives one share's state, the other person, and the rule with its id", () => {
    expect(shareLines(share())).toEqual([
      `Share ${SHARE}: live, from Ben Lee`,
      `Rule: Intern applications (id ${RULE})`,
      expect.stringMatching(/^RULE ID names the rule/),
    ]);
  });

  it("says when the id is not shown", () => {
    expect(
      shareLines(
        share({
          live: false,
          ended_at: "2026-11-19T00:00:00Z",
          end_reason: "removed_by_beneficiary",
          rule: null,
          rule_id: null,
        }),
      )[1],
    ).toBe("Rule: Intern applications (id not shown to you)");
  });
});

describe("list-shares", () => {
  it("prints the table with the rule id on stderr", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(
      async () =>
        new Response(
          JSON.stringify({
            success: true,
            data: [share()],
            meta: { limit: 50, cursor: null },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    );
    auth.create.mockResolvedValue({
      apiClient: new PrimitiveApiClient({
        apiKey: "test-key",
        apiBaseUrl: "https://api.example.test/v1",
        fetch,
      }),
      auth: {},
      baseUrlOverridden: false,
    });
    const operation = operationManifest.find(
      (op) => op.sdkName === "listEmailRuleShares",
    );
    if (!operation) throw new Error("missing listEmailRuleShares");
    const command = createOperationCommand(operation) as unknown as {
      run(argv: string[], opts: { root: string }): Promise<void>;
    };
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const stderr = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    await command.run([], { root: resolve(import.meta.dirname, "../..") });
    const printed = stderr.mock.calls.map(([chunk]) => String(chunk)).join("");
    expect(printed).toMatch(/SHARE ID +RULE +RULE ID +WITH +STATE/);
    expect(printed).toContain(RULE);
  });
});
