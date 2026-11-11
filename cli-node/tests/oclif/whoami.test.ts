import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { agentProfileDirectory } from "../../src/oclif/connected-agent-profile.js";
import { appendRegistrationLog } from "../../src/oclif/registration-log.js";
import { writeMailJson } from "../../src/oclif/shared-mail-files.js";

const session = "11111111-1111-4111-8111-111111111111";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  account: vi.fn(),
  ownGrant: vi.fn(),
}));
vi.mock("../../src/oclif/api-client.js", () => ({
  createAuthenticatedCliApiClient: mocks.auth,
}));
vi.mock("@primitivedotdev/api-core", async (original) => ({
  ...(await original<typeof import("@primitivedotdev/api-core")>()),
  getAccount: mocks.account,
  getOwnGrant: mocks.ownGrant,
}));

import WhoamiCommand, {
  formatGrantLines,
  formatWhoamiSummary,
} from "../../src/oclif/commands/whoami.js";
import { COMMANDS } from "../../src/oclif/index.js";

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

function makeAccount(overrides: Record<string, unknown> = {}) {
  return {
    id: "acct-1",
    email: "cli@example.com",
    plan: "pro",
    created_at: "2026-05-25T00:00:00.000Z",
    onboarding_completed: false,
    onboarding_step: "dns",
    subscription_status: "trialing",
    subscription_current_period_end: "2026-06-25T00:00:00.000Z",
    subscription_cancel_at_period_end: false,
    spam_threshold: null,
    discard_content_on_webhook_confirmed: false,
    webhook_secret_rotated_at: null,
    ...overrides,
  } as never;
}

describe("whoami command", () => {
  it("registers the credentials smoke-test command", () => {
    expect(COMMANDS.whoami).toBe(WhoamiCommand);
  });

  it("exposes explicit JSON output for raw account fields", () => {
    const flags = WhoamiCommand.flags as Record<string, unknown>;
    expect(flags.json).toBeDefined();
  });

  it("formats a concise summary without setup or billing internals", () => {
    const output = formatWhoamiSummary(makeAccount(), null);

    expect(output.split("\n")[0]).toBe("Authenticated");
    expect(output).toContain(
      "Account email: cli@example.com (the email the account was opened with)",
    );
    expect(output).toContain("Organization id: acct-1");
    expect(output).toContain("Plan: pro");
    expect(output).not.toContain("onboarding");
    expect(output).not.toContain("trialing");
    expect(output).not.toContain("webhook");
    expect(output).not.toContain("Managed inbox");
  });

  it("leaves out the account email when the credential may not see it", () => {
    const output = formatWhoamiSummary(makeAccount({ email: null }), null);

    expect(output).not.toContain("Account email");
    expect(output).not.toContain("null");
  });

  it("names the caller by their member address, never by the account email", () => {
    const output = formatWhoamiSummary(makeAccount(), null, null, {
      auth_method: "oauth",
      key_id: null,
      member_address: { address: "member@managed.test", name: null },
      member_address_suggestion: null,
    });

    expect(output.split("\n")).toEqual([
      "Authenticated as member@managed.test (your member address)",
      "Organization id: acct-1",
      "Account email: cli@example.com (the email the account was opened with)",
      "Plan: pro",
    ]);
  });

  it("tells a person without a member address how to set one", () => {
    const output = formatWhoamiSummary(makeAccount(), null, null, {
      auth_method: "oauth",
      key_id: null,
      member_address: null,
      member_address_suggestion: "member@managed.test",
    });

    expect(output.split("\n")[0]).toBe(
      "Authenticated (you have no member address in this organization; `primitive account provision-member-address --address member@managed.test` sets one)",
    );
    expect(output).not.toContain("Authenticated as cli@example.com");
  });

  it("says an API key has no member address and gives it no role line", () => {
    const identity = {
      auth_method: "api_key",
      key_id: "key-1",
      member_address: null,
      member_address_suggestion: null,
      org_id: "org-1",
      role: "member",
    };
    const output = formatWhoamiSummary(makeAccount(), null, null, identity);

    expect(output.split("\n")[0]).toBe(
      "Authenticated (API keys have no member address)",
    );
    const lines = formatGrantLines(identity as never);
    expect(lines.some((line) => /role/i.test(line))).toBe(false);
  });

  it("names a key's email rules and its key id on the Grant line", () => {
    const keyGrant = (mail_scope: unknown, credential_kind = "org_key") => ({
      auth_method: "api_key",
      key_id: "key-1",
      org_id: "org-1",
      role: "member",
      grant: {
        credential_kind,
        grant_type: "concrete",
        template: null,
        permissions: ["mail:read"],
        mail_scope,
        expires_at: null,
        catalog_version: "v",
      },
    });
    const rules = (ids: string[], addresses: string[] = []) => ({
      addresses,
      domains: [],
      rules: ids,
      depth: "content",
    });
    const head = "Grant: concrete with 1 permissions,";
    for (const [scope, text] of [
      [
        rules(["rule-1"]),
        "mail that email rule rule-1 granted, while it stays active",
      ],
      [
        rules(["rule-1", "rule-2"]),
        "mail that email rules rule-1 and rule-2 granted, while each stays active",
      ],
      [
        rules(["rule-1", "rule-2", "rule-3", "rule-4", "rule-5"]),
        "mail that email rules rule-1, rule-2, rule-3 and 2 more granted, while each stays active (`primitive whoami --json --grant` lists every rule)",
      ],
      [
        rules(["rule-1"], ["a@acme.test"]),
        "a narrowed mail scope, plus mail that email rule rule-1 granted, while it stays active",
      ],
      [rules([], ["a@acme.test"]), "a narrowed mail scope"],
      [
        rules([]),
        "no mail through its grant, which names no mailbox, domain or email rule",
      ],
      ["unreadable", "a mail scope the server could not read, so no mail"],
      [{ addresses: [1], domains: [], rules: [] }, "a narrowed mail scope"],
      ["org", "all mail in the organization"],
    ] as const) {
      expect(formatGrantLines(keyGrant(scope) as never)).toContain(
        `${head} ${text} (org_key, key id key-1)`,
      );
    }
    expect(
      formatGrantLines(keyGrant(rules(["rule-1"]), "function_key") as never),
    ).toContain(
      `${head} mail that email rule rule-1 granted, while it stays active (function_key, key id key-1)`,
    );
    // A person's login has no key id to show.
    expect(
      formatGrantLines({
        ...keyGrant("org", "cli_user_access"),
        auth_method: "oauth",
        key_id: null,
      } as never),
    ).toContain(`${head} all mail in the organization (cli_user_access)`);
  });

  it("says only what the server reported", () => {
    expect(
      formatWhoamiSummary(makeAccount(), null, null, {
        auth_method: "oauth",
        key_id: null,
      } as never).split("\n")[0],
    ).toBe("Authenticated");
    // A role value that names no built-in role is shown as the key it is.
    expect(
      formatGrantLines({
        auth_method: "oauth",
        key_id: null,
        org_id: "org-1",
        role: "operator",
      } as never),
    ).toContain("Role key: operator");
  });

  it("uses neutral wording for a credential that is neither a key nor a person", () => {
    const identity = {
      auth_method: "signed_token",
      key_id: null,
      member_address: null,
      member_address_suggestion: null,
      org_id: "org-1",
      role: "member",
    };
    const output = formatWhoamiSummary(makeAccount(), null, null, identity);

    expect(output.split("\n")[0]).toBe(
      "Authenticated (this credential has no member address)",
    );
    expect(
      formatGrantLines(identity as never).some((line) => /role/i.test(line)),
    ).toBe(false);
  });

  it.each([
    [
      "member",
      "Built-in role: member (also shown for a template or custom role that does not fully include member; the Grant line is what this login can do)",
    ],
    ["admin", "Built-in role: admin"],
  ])(
    "labels a person's %s role from GET /whoami as their built-in role",
    (role, line) => {
      const lines = formatGrantLines({
        auth_method: "oauth",
        key_id: null,
        org_id: "org-1",
        role,
      } as never);

      expect(lines).toContain(line);
      expect(lines.some((text) => text.startsWith("Role: "))).toBe(false);
    },
  );

  it("shows the account email apart from the member's own address", async () => {
    const identity = {
      member_address: { address: "member@managed.test", name: null },
      member_address_suggestion: null,
      org_id: "acct-1",
      user_id: "user-1",
      role: "member",
      request_id: "req-1",
      auth_method: "oauth",
      key_id: null,
      grant: {
        credential_kind: "cli_user_access",
        grant_type: "computed",
        template: null,
        permissions: ["members:read"],
        mail_scope: "org",
        resources: null,
        expires_at: null,
      },
    };
    // Answers GET /whoami only; any other read is refused.
    const get = vi.fn(async (options: { url: string }) =>
      options.url === "/whoami"
        ? { data: { success: true, data: identity } }
        : { error: { error: { code: "not_found", message: "Not found" } } },
    );
    mocks.auth.mockResolvedValue({
      apiClient: { client: { get } },
      auth: {
        credentials: {
          auth_method: "user_grant",
          org_id: "acct-1",
          org_name: "Managed",
        },
      },
      baseUrlOverridden: false,
    });
    mocks.account.mockResolvedValue({
      data: { data: makeAccount({ email: "owner@managed.test" }) },
    });
    const output: string[] = [];
    vi.spyOn(console, "log").mockImplementation((value: unknown) => {
      output.push(String(value));
    });

    await WhoamiCommand.run([], {
      root: resolve(import.meta.dirname, "../.."),
    });

    expect(get).toHaveBeenCalledWith(
      expect.objectContaining({ url: "/whoami" }),
    );
    const lines = output.join("\n").split("\n");
    expect(lines[0]).toBe(
      "Authenticated as member@managed.test (your member address)",
    );
    expect(lines).toContain(
      "Account email: owner@managed.test (the email the account was opened with)",
    );
    expect(lines.join("\n")).not.toContain(
      "Authenticated as owner@managed.test",
    );
    expect(lines.some((line) => line.startsWith("Built-in role: member"))).toBe(
      true,
    );
  });

  it("reports the credential's own grant when refused the account", async () => {
    mocks.auth.mockResolvedValue({
      apiClient: { client: {} },
      auth: { credentials: { org_id: "org-1", org_name: "Acme" } },
      baseUrlOverridden: false,
    });
    mocks.account.mockResolvedValue({
      error: {
        success: false,
        error: { code: "grant_forbidden", message: "Not allowed" },
      },
    });
    mocks.ownGrant.mockResolvedValue({
      data: {
        data: {
          org_id: "org-1",
          auth_method: "user_grant",
          key_id: null,
          grant: {
            credential_kind: "cli_user_access",
            template: null,
            permissions: ["mail:send"],
            mail_scope: { addresses: ["a@b.test"], domains: [], depth: "raw" },
            resources: null,
            expires_at: null,
          },
        },
      },
    });
    const output: string[] = [];
    vi.spyOn(console, "log").mockImplementation((value: unknown) => {
      output.push(String(value));
    });
    const root = resolve(import.meta.dirname, "../..");
    await WhoamiCommand.run([], { root });
    expect(process.exitCode ?? 0).toBe(0);
    const text = output.join("\n");
    expect(text).toContain("lacks org:read");
    expect(text).toContain("Organization: Acme (org-1)");
    expect(text).toContain("grant with 1 permissions, a narrowed mail scope");
  });

  it("names the rules and key id of a key on the summary", async () => {
    const identity = {
      member_address: null,
      member_address_suggestion: null,
      org_id: "acct-1",
      role: "member",
      auth_method: "api_key",
      key_id: "key-7",
      grant: {
        credential_kind: "org_key",
        grant_type: "concrete",
        template: null,
        permissions: ["mail:read"],
        mail_scope: {
          addresses: [],
          domains: [],
          rules: ["rule-1"],
          depth: "content",
        },
        resources: null,
        expires_at: null,
      },
    };
    const get = vi.fn(async (options: { url: string }) =>
      options.url === "/whoami"
        ? { data: { success: true, data: identity } }
        : { error: { error: { code: "not_found", message: "Not found" } } },
    );
    mocks.auth.mockResolvedValue({
      apiClient: { client: { get } },
      auth: { credentials: null },
      baseUrlOverridden: false,
    });
    mocks.account.mockResolvedValue({ data: { data: makeAccount() } });
    const output: string[] = [];
    vi.spyOn(console, "log").mockImplementation((value: unknown) => {
      output.push(String(value));
    });

    await WhoamiCommand.run([], {
      root: resolve(import.meta.dirname, "../.."),
    });

    const lines = output.join("\n").split("\n");
    expect(lines[0]).toBe("Authenticated (API keys have no member address)");
    expect(lines).toContain(
      "Grant: concrete with 1 permissions, mail that email rule rule-1 granted, while it stays active (org_key, key id key-7)",
    );
  });

  it("names the rules and key id of a key refused the account", async () => {
    mocks.auth.mockResolvedValue({
      apiClient: { client: {} },
      auth: { credentials: null },
      baseUrlOverridden: false,
    });
    mocks.account.mockResolvedValue({
      error: {
        success: false,
        error: { code: "grant_forbidden", message: "Not allowed" },
      },
    });
    mocks.ownGrant.mockResolvedValue({
      data: {
        data: {
          org_id: "org-1",
          auth_method: "api_key",
          key_id: "key-9",
          grant: {
            credential_kind: "org_key",
            grant_type: "concrete",
            template: null,
            permissions: ["mail:read"],
            mail_scope: {
              addresses: [],
              domains: [],
              rules: ["rule-1"],
              depth: "content",
            },
            resources: null,
            expires_at: null,
          },
        },
      },
    });
    const output: string[] = [];
    vi.spyOn(console, "log").mockImplementation((value: unknown) => {
      output.push(String(value));
    });
    const root = resolve(import.meta.dirname, "../..");
    await WhoamiCommand.run([], { root });
    expect(process.exitCode ?? 0).toBe(0);
    expect(output.join("\n")).toContain(
      "Grant: concrete with 1 permissions, mail that email rule rule-1 granted, while it stays active (org_key, key id key-9)",
    );
  });

  it("names the organization when the saved login recorded its name", () => {
    const output = formatWhoamiSummary(makeAccount(), null, "Acme Agents");

    expect(output).toContain("Organization: Acme Agents (acct-1)");
    expect(output).not.toContain("Organization id:");
  });

  it.each([
    [
      "the saved login's organization",
      "acct-1",
      "Organization: Acme Agents (acct-1)",
      "Acme Agents",
    ],
    [
      "another organization's saved login",
      "org-other",
      "Organization id: acct-1",
      null,
    ],
    ["no saved login (an API key)", null, "Organization id: acct-1", null],
  ])(
    "names the organization from %s in text and JSON",
    async (_case, savedOrgId, line, jsonName) => {
      mocks.auth.mockResolvedValue({
        apiClient: { client: {} },
        auth: {
          credentials: savedOrgId
            ? { org_id: savedOrgId, org_name: "Acme Agents" }
            : null,
        },
        baseUrlOverridden: false,
      });
      mocks.account.mockResolvedValue({ data: { data: makeAccount() } });
      const output: string[] = [];
      vi.spyOn(console, "log").mockImplementation((value: unknown) => {
        output.push(String(value));
      });
      const root = resolve(import.meta.dirname, "../..");
      await WhoamiCommand.run([], { root });
      expect(output.join("\n")).toContain(line);
      output.length = 0;
      await WhoamiCommand.run(["--json"], { root });
      const json = JSON.parse(output.join("\n"));
      expect(json.org_name).toBe(jsonName);
      // The account payload passes through unchanged beside the new field.
      expect(json).toMatchObject({
        id: "acct-1",
        email: "cli@example.com",
        plan: "pro",
      });
    },
  );

  it("includes the managed inbox line when a managed domain is present", () => {
    const output = formatWhoamiSummary(
      makeAccount(),
      "crisp-crane.primitive.email",
    );

    expect(output).toContain(
      "Managed inbox: any-local-part@crisp-crane.primitive.email",
    );
  });

  it.each([true, false])(
    "reports saved identity offline without calling the account API (json %s)",
    async (json) => {
      const credential = ["pconn", "test"].join("_");
      mocks.auth.mockResolvedValue({
        apiClient: { client: {} },
        auth: {
          apiKey: credential,
          connectedAgent: {
            profileName: "work",
            agentAddress: "agent@example.test",
            ownerAddress: "owner@example.test",
            ownerMemberAddress: "ada_123456789@example.test",
            apiBaseUrl: "https://api.primitive-staging-1.com/v1",
            orgId: "org-1",
          },
        },
      });
      const output: string[] = [];
      vi.spyOn(console, "log").mockImplementation((value: unknown) => {
        output.push(String(value));
      });
      await WhoamiCommand.run(json ? ["--json"] : [], {
        root: resolve(import.meta.dirname, "../.."),
      });
      const text = output.join("\n");
      expect(mocks.account).not.toHaveBeenCalled();
      expect(text).toContain("agent@example.test");
      expect(text).toContain(
        "primitive agent connect --profile work --status --json",
      );
      expect(text).toContain("not verified");
      expect(text).toContain("ada_123456789@example.test");
      if (!json)
        expect(text).toContain(
          "Owner personal address (send reports here): ada_123456789@example.test",
        );
      expect(text).not.toContain(credential);
      if (json)
        expect(JSON.parse(text)).toMatchObject({
          verification: "offline",
          auth_method: "agent_connection",
        });
    },
  );

  it.each([
    [
      "external",
      "Inspect the Claude hook receiver with `primitive agent connect --profile work --status --json`.",
    ],
    [
      "native",
      `Inspect the receiver with \`PRIMITIVE_AGENT_PROFILE=work primitive listen --status --notify-session ${session}\`.`,
    ],
  ])(
    "points a %s receiver at the status command for its mode",
    async (receiverMode, hint) => {
      const directory = mkdtempSync(join(tmpdir(), "primitive-whoami-"));
      try {
        vi.stubEnv("PRIMITIVE_CONFIG_DIR", directory);
        writeMailJson(
          join(agentProfileDirectory(directory, "work"), "setup.json"),
          { session, receiverMode },
        );
        mocks.auth.mockResolvedValue({
          apiClient: { client: {} },
          auth: {
            apiKey: ["pconn", "test"].join("_"),
            connectedAgent: {
              profileName: "work",
              agentAddress: "agent@example.test",
              ownerAddress: "owner@example.test",
              ownerMemberAddress: null,
              apiBaseUrl: "https://api.primitive.dev/v1",
              orgId: "org-1",
            },
          },
        });
        const output: string[] = [];
        vi.spyOn(console, "log").mockImplementation((value: unknown) => {
          output.push(String(value));
        });
        await WhoamiCommand.run(["--json"], {
          root: resolve(import.meta.dirname, "../.."),
        });
        const { guidance } = JSON.parse(output.join("\n"));
        expect(guidance).toContain(hint);
        if (receiverMode === "external")
          expect(guidance).not.toContain("listen --status");
      } finally {
        vi.unstubAllEnvs();
        rmSync(directory, { recursive: true, force: true });
      }
    },
  );

  it.each([
    [{}, "env"],
    [
      {
        CLAUDE_CODE_SESSION_ID: session,
        PRIMITIVE_AGENT_ADDRESS: "agent@example.test",
      },
      "session_hook",
    ],
  ] as const)(
    "prints the agent address first and names where the identity came from (%j)",
    async (env, source) => {
      for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
      try {
        mocks.auth.mockResolvedValue({
          apiClient: { client: {} },
          auth: {
            apiKey: ["pconn", "test"].join("_"),
            connectedAgent: {
              profileName: `session-${session}`,
              agentAddress: "agent@example.test",
              ownerAddress: "owner@example.test",
              ownerMemberAddress: null,
              apiBaseUrl: "https://api.primitive.dev/v1",
              orgId: "org-1",
            },
          },
        });
        const output: string[] = [];
        vi.spyOn(console, "log").mockImplementation((value: unknown) => {
          output.push(String(value));
        });
        await WhoamiCommand.run([], {
          root: resolve(import.meta.dirname, "../.."),
        });
        await WhoamiCommand.run(["--json"], {
          root: resolve(import.meta.dirname, "../.."),
        });
        expect(output[0].split("\n")[0]).toBe("agent@example.test");
        expect(JSON.parse(output[1])).toMatchObject({
          address: "agent@example.test",
          profile: `session-${session}`,
          source,
        });
        expect(mocks.account).not.toHaveBeenCalled();
      } finally {
        vi.unstubAllEnvs();
      }
    },
  );

  it.each([true, false])(
    "names this session's failed registration under the member login (json %s)",
    async (json) => {
      const directory = mkdtempSync(join(tmpdir(), "primitive-whoami-"));
      try {
        vi.stubEnv("PRIMITIVE_CONFIG_DIR", directory);
        vi.stubEnv("CLAUDE_CODE_SESSION_ID", session);
        appendRegistrationLog(directory, `session-${session}`, {
          event: "failed",
          phase: "setup_attempted",
          code: "setup_unfinished",
          orgId: "org-1",
          address: "pending@example.test",
          detail:
            "This session's agent pending@example.test is created but not connected: in the Primitive app open it and choose Copy again, then paste that setup instruction here; `agent connect` finishes the same address.",
        });
        mocks.auth.mockResolvedValue({
          apiClient: { client: {} },
          auth: { apiKey: undefined },
          baseUrlOverridden: false,
        });
        mocks.account.mockResolvedValue({ data: { data: makeAccount() } });
        const output: string[] = [];
        vi.spyOn(console, "log").mockImplementation((value: unknown) => {
          output.push(String(value));
        });
        await WhoamiCommand.run(json ? ["--json"] : [], {
          root: resolve(import.meta.dirname, "../.."),
        });
        const text = output.join("\n");
        if (json)
          expect(JSON.parse(text)).toMatchObject({
            id: "acct-1",
            session_registration: {
              address: "pending@example.test",
              lastFailure: { code: "setup_unfinished" },
            },
          });
        else
          expect(text).toContain(
            "The last registration attempt for this session (pending@example.test) failed at",
          );
        expect(text).toContain("choose Copy again");
      } finally {
        vi.unstubAllEnvs();
        rmSync(directory, { recursive: true, force: true });
      }
    },
  );

  it("does not call account or imply sign-in is needed for a raw connection credential", async () => {
    mocks.auth.mockResolvedValue({
      apiClient: { client: {} },
      auth: { apiKey: ["pconn", "test"].join("_") },
    });
    await expect(
      WhoamiCommand.run([], { root: resolve(import.meta.dirname, "../..") }),
    ).rejects.toThrow("Select its saved profile");
    expect(mocks.account).not.toHaveBeenCalled();
  });
});
