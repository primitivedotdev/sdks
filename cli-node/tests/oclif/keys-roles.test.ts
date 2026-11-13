import { resolve } from "node:path";
import { PrimitiveApiClient } from "@primitivedotdev/api-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAuthenticatedCliApiClient: vi.fn(),
}));

vi.mock("../../src/oclif/api-client.js", () => ({
  createAuthenticatedCliApiClient: mocks.createAuthenticatedCliApiClient,
}));

import {
  forbiddenHint,
  grantForbiddenHint,
} from "../../src/oclif/api-command.js";
import {
  cliOperationManifest,
  KEY_WRITE_OPERATION_IDS,
} from "../../src/oclif/cli-operations.js";
import {
  buildCreateGrant,
  buildUpdatedGrant,
  describeMailScope,
  expiryFromFlags,
  formatKeyDetail,
  formatKeyRows,
  HELD_REQUEST_NOTICE,
  KeysCreateCommand,
  KeysGetCommand,
  KeysListCommand,
  KeysRevokeCommand,
  KeysRotateCommand,
  KeysUpdateCommand,
  nextRules,
  revokeCascadeLines,
  STORE_SECRET_NOTICE,
  standingSummary,
  stepUpUrlOf,
  withApproval,
} from "../../src/oclif/commands/keys.js";
import {
  formatAccessMode,
  formatGroups,
  formatMembers,
  formatRoles,
  RolesListCommand,
  RolesMembersCommand,
} from "../../src/oclif/commands/roles.js";
import {
  extractGlobalOrgFlag,
  withoutOrgSelection,
} from "../../src/oclif/global-org-flag.js";
import { COMMANDS, lookupOperation } from "../../src/oclif/index.js";
import { keyPermissionsHelp } from "../../src/oclif/key-permissions.js";

const CLI_ROOT = resolve(import.meta.dirname, "../..");
const KEY_ID = "0f0e0d0c-0b0a-4908-8706-050403020100";

type Handler = (request: Request) => Response | Promise<Response>;

function useServer(handler: Handler) {
  const requests: Request[] = [];
  const client = new PrimitiveApiClient({
    apiKey: "prim_oat_test",
    apiBaseUrl: "https://api.example.test/v1",
    fetch: (async (input: Request) => {
      requests.push(input.clone());
      return handler(input);
    }) as typeof fetch,
  });
  mocks.createAuthenticatedCliApiClient.mockResolvedValue({
    apiClient: client,
    auth: { apiKey: "prim_oat_test", source: "flag-or-env", credentials: null },
    baseUrlOverridden: false,
  });
  return requests;
}

async function run(
  command: { run(argv: string[], o: { root: string }): Promise<unknown> },
  argv: string[],
) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const previous = process.exitCode;
  process.exitCode = undefined;
  const log = vi.spyOn(console, "log").mockImplementation((line = "") => {
    stdout.push(`${String(line)}\n`);
  });
  const err = vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
    stderr.push(String(chunk));
    return true;
  });
  let error: unknown = null;
  try {
    await command.run(argv, { root: CLI_ROOT });
  } catch (caught) {
    error = caught;
  } finally {
    log.mockRestore();
    err.mockRestore();
  }
  const exitCode = process.exitCode;
  process.exitCode = previous;
  return { error, exitCode, stderr: stderr.join(""), stdout: stdout.join("") };
}

describe("the global --org flag", () => {
  it("takes --org out of argv in both spellings", () => {
    expect(
      extractGlobalOrgFlag(["emails", "list", "--org", "acme", "--json"]),
    ).toEqual({
      ok: true,
      argv: ["emails", "list", "--json"],
      org: "acme",
    });
    expect(extractGlobalOrgFlag(["whoami", "--org=Beta Inc"])).toEqual({
      ok: true,
      argv: ["whoami"],
      org: "Beta Inc",
    });
    expect(extractGlobalOrgFlag(["send", "--", "--org", "x"])).toEqual({
      ok: true,
      argv: ["send", "--", "--org", "x"],
      org: null,
    });
  });

  it("leaves the memories boolean --org alone and refuses a missing value", () => {
    expect(
      extractGlobalOrgFlag(["memories", "set", "--org", "--key", "k"]),
    ).toEqual({
      ok: true,
      argv: ["memories", "set", "--org", "--key", "k"],
      org: null,
    });
    expect(
      extractGlobalOrgFlag(["memories:search", "--org", "--prefix", "a"]),
    ).toEqual({
      ok: true,
      argv: ["memories:search", "--org", "--prefix", "a"],
      org: null,
    });
    expect(extractGlobalOrgFlag(["whoami", "--org"]).ok).toBe(false);
    expect(withoutOrgSelection({ A: "1", PRIMITIVE_CLI_ORG: "beta" })).toEqual({
      A: "1",
    });
    expect(extractGlobalOrgFlag(["whoami", "--org", "--json"]).ok).toBe(false);
    expect(extractGlobalOrgFlag(["whoami", "--org="]).ok).toBe(false);
  });
});

const RULE_ID = "3b0f6a1e-6c7a-4f43-9d8e-2a1b5c4d3e2f";

function keyRow(
  grant: {
    template: string | null;
    permissions: string[] | null;
    mail_scope: unknown;
  } & Record<string, unknown>,
  extra: Record<string, unknown> = {},
) {
  return {
    agent_address: null,
    created_at: "2026-11-01T00:00:00.000Z",
    created_by_user_id: null,
    expires_at: null,
    // As GET /v1/keys/{id} answers: the grant's ref, and its resource limits (none).
    grant: { ref: grant.template ?? "grant-1", resources: null, ...grant },
    id: KEY_ID,
    key_prefix: "prim_ab12cd34...",
    kind: "org_key" as const,
    last_used_at: null,
    name: "ci",
    suspended: false,
    ...extra,
  };
}

const READER = keyRow({
  template: null,
  permissions: ["mail:read"],
  mail_scope: "org",
});

describe("keys helpers", () => {
  it("formats key rows and one key, with permissions and mail scope", () => {
    expect(formatKeyRows([])).toBe(
      "No API keys. Revoked keys are left out; pass --include-revoked to list them too.",
    );
    expect(formatKeyRows([], { includeRevoked: true })).toBe(
      "No API keys, revoked or not.",
    );
    // A revoked key with no recorded time, once suspended: only [revoked].
    expect(
      formatKeyRows([
        keyRow(
          { template: "super_admin", permissions: null, mail_scope: null },
          { status: "revoked", revoked_at: null, suspended: true },
        ),
      ]),
    ).toMatch(/last used never \[revoked\]$/);
    expect(
      formatKeyRows([
        keyRow({
          template: "super_admin",
          permissions: null,
          mail_scope: null,
        }),
        keyRow(
          {
            template: null,
            permissions: ["mail:read"],
            mail_scope: { addresses: [], domains: [], rules: [RULE_ID] },
          },
          { suspended: true },
        ),
      ]),
    ).toBe(
      [
        `${KEY_ID}  prim_ab12cd34...  ci  super admin (every permission)  mail: every mailbox  expires never  last used never`,
        `${KEY_ID}  prim_ab12cd34...  ci  mail:read  mail: rules ${RULE_ID}  expires never  last used never [suspended]`,
      ].join("\n"),
    );
    const detail = formatKeyDetail(
      keyRow({
        template: null,
        permissions: ["mail:read", "mail:send"],
        mail_scope: { addresses: ["a@example.com"], domains: ["example.org"] },
      }),
    );
    expect(detail).toContain(
      "Mail:         addresses a@example.com; domains example.org",
    );
    expect(detail).toContain("Permissions:\n  mail:read\n  mail:send");
    expect(detail).not.toContain("Revoked:");
  });

  it("shows the notes the server gives on a key's grant, in the detail and as a count in the list", () => {
    const note =
      "This key also lists email rules, but it reads every email at desk@example.com, not only what the rules granted.";
    const noted = keyRow(
      {
        template: null,
        permissions: ["mail:read"],
        mail_scope: {
          addresses: ["desk@example.com"],
          domains: [],
          rules: [RULE_ID],
        },
      },
      {
        address_warnings: [
          {
            address: "desk@example.com",
            reason: "whole_mailbox",
            description: note,
          },
        ],
      },
    );
    expect(formatKeyDetail(noted).endsWith(`\nNotes:\n  ${note}`)).toBe(true);
    expect(
      formatKeyRows([noted]).endsWith(`[1 note: primitive keys get ${KEY_ID}]`),
    ).toBe(true);
    // A note on more than one line stays inside the block.
    const twoLines = {
      ...noted,
      address_warnings: [
        { address: "", reason: "x", description: "first\nsecond" },
      ],
    };
    expect(
      formatKeyDetail(twoLines).endsWith("\nNotes:\n  first\n  second"),
    ).toBe(true);
    // A key with none, a server that sends none, or anything that is not a list of notes, shows nothing.
    const plain = keyRow({
      template: null,
      permissions: ["mail:read"],
      mail_scope: "org",
    });
    const malformed: unknown[] = [[], null, "x", [null, 5, { reason: "x" }]];
    for (const key of [
      plain,
      ...malformed.map((value) => ({ ...plain, address_warnings: value })),
    ]) {
      expect(formatKeyDetail(key)).not.toContain("Notes:");
      expect(formatKeyRows([key])).not.toContain("note");
    }
  });

  it("says when the key read is a revoked key", () => {
    const grant = {
      template: null,
      permissions: ["mail:read"],
      mail_scope: "org",
    };
    expect(
      formatKeyDetail(
        keyRow(grant, {
          status: "revoked",
          revoked_at: "2026-11-02T00:00:00.000Z",
          revoked_by: "user-1",
        }),
      ),
    ).toContain("Revoked:      2026-11-02T00:00:00.000Z by user user-1");
    expect(
      formatKeyDetail(keyRow(grant, { status: "revoked", revoked_at: null })),
    ).toContain("Revoked:      yes");
    expect(
      formatKeyDetail(keyRow(grant, { status: "active", revoked_at: null })),
    ).not.toContain("Revoked:");
  });

  it("builds a new key's grant only from an explicit choice", () => {
    const none = {
      permissions: [],
      addresses: [],
      domains: [],
      rules: [],
      allMailboxes: false,
    };
    expect(buildCreateGrant(none)).toMatchObject({
      ok: false,
      message: expect.stringContaining("no default"),
    });
    expect(buildCreateGrant({ ...none, preset: "super_admin" })).toEqual({
      ok: true,
      grant: "super_admin",
    });
    expect(
      buildCreateGrant({ ...none, preset: "read_only", rules: [RULE_ID] }).ok,
    ).toBe(false);
    expect(
      buildCreateGrant({
        ...none,
        preset: "own_addresses_read_only",
        rules: [RULE_ID],
      }),
    ).toEqual({
      ok: true,
      grant: { preset: "own_addresses_read_only", rules: [RULE_ID] },
    });
    expect(
      buildCreateGrant({
        ...none,
        permissions: ["mail:read"],
        rules: [RULE_ID],
      }),
    ).toEqual({
      ok: true,
      grant: { preset: "custom", permissions: ["mail:read"], rules: [RULE_ID] },
    });
    expect(
      buildCreateGrant({
        ...none,
        permissions: ["mail:read"],
        allMailboxes: true,
      }),
    ).toEqual({
      ok: true,
      grant: {
        preset: "custom",
        permissions: ["mail:read"],
        mail_scope: "org",
      },
    });
    // Chosen permissions must say which mail they reach, one way only.
    expect(buildCreateGrant({ ...none, permissions: ["mail:read"] }).ok).toBe(
      false,
    );
    expect(
      buildCreateGrant({
        ...none,
        permissions: ["mail:read"],
        allMailboxes: true,
        rules: [RULE_ID],
      }).ok,
    ).toBe(false);
    expect(
      buildCreateGrant({
        ...none,
        preset: "read_only",
        permissions: ["mail:read"],
      }).ok,
    ).toBe(false);
  });

  it("restates a key's grant with permissions added or removed, and refuses what it cannot restate", () => {
    expect(
      buildUpdatedGrant(READER.grant, {
        add: ["mail:send", "mail:reply"],
        remove: [],
      }),
    ).toEqual({
      ok: true,
      grant: {
        preset: "custom",
        permissions: ["mail:read", "mail:reply", "mail:send"],
        mail_scope: "org",
      },
      permissions: ["mail:read", "mail:reply", "mail:send"],
    });
    const ruled = {
      template: null,
      resources: null,
      permissions: ["mail:read", "mail:send"],
      mail_scope: {
        addresses: ["a@example.com"],
        domains: [],
        rules: [RULE_ID],
        depth: "content",
      },
    };
    expect(
      buildUpdatedGrant(ruled, {
        add: [],
        remove: ["mail:send"],
        rules: ["9c1d2e3f-4a5b-4c6d-8e7f-0a1b2c3d4e5f"],
      }),
    ).toEqual({
      ok: true,
      grant: {
        preset: "custom",
        permissions: ["mail:read"],
        addresses: ["a@example.com"],
        rules: ["9c1d2e3f-4a5b-4c6d-8e7f-0a1b2c3d4e5f"],
      },
      permissions: ["mail:read"],
    });
    expect(
      buildUpdatedGrant(
        { template: "super_admin", permissions: null, mail_scope: null },
        { add: [], remove: ["mail:send"] },
      ),
    ).toMatchObject({
      ok: false,
      message: expect.stringContaining("super admin"),
    });
    expect(
      buildUpdatedGrant(READER.grant, { add: [], remove: ["mail:read"] }).ok,
    ).toBe(false);
    expect(
      buildUpdatedGrant(READER.grant, { add: [], remove: [], rules: [RULE_ID] })
        .ok,
    ).toBe(false);
    expect(
      buildUpdatedGrant(
        { ...READER.grant, resources: { domain: ["example.com"] } },
        { add: ["mail:send"], remove: [] },
      ).ok,
    ).toBe(false);
    // A setting the CLI does not know is named, so the refusal says what it would drop.
    expect(
      buildUpdatedGrant(
        {
          ...ruled,
          mail_scope: {
            addresses: ["a@example.com"],
            domains: [],
            exclude: ["b@example.com"],
          },
        },
        { add: ["mail:send"], remove: [] },
      ),
    ).toEqual({
      ok: false,
      message:
        "This key's mail scope has a setting the CLI cannot restate (exclude), and a change here could drop it. Change the key in the dashboard, or create a key with what you need and revoke this one.",
    });
    expect(
      buildUpdatedGrant(
        {
          ...ruled,
          mail_scope: { addresses: "a@example.com", domains: [], rules: [] },
        },
        { add: ["mail:send"], remove: [] },
      ),
    ).toMatchObject({
      ok: false,
      message: expect.stringContaining("could not be read (addresses)"),
    });
    expect(
      buildUpdatedGrant(
        {
          ...ruled,
          mail_scope: { addresses: [], domains: [], rules: [RULE_ID] },
        },
        { add: [], remove: [], rules: [] },
      ).ok,
    ).toBe(false);
  });

  it("restates a grant only when the read shows its resource limits, and none", () => {
    const base = {
      template: null,
      permissions: ["mail:read"],
      mail_scope: "org",
    };
    const change = { add: ["mail:send"], remove: [] };
    // No resources field: the server does not say, so nothing is restated, ref or not.
    expect(buildUpdatedGrant({ ...base, ref: "g1" }, change)).toMatchObject({
      ok: false,
      message: expect.stringContaining(
        "The server does not say whether this key is limited",
      ),
    });
    // None, as null or an empty map: restated.
    expect(buildUpdatedGrant({ ...base, resources: null }, change).ok).toBe(
      true,
    );
    expect(buildUpdatedGrant({ ...base, resources: {} }, change).ok).toBe(true);
    // A type listed with no ids allows none of that type: a limit, which the change could not keep.
    expect(
      buildUpdatedGrant({ ...base, resources: { function: [] } }, change),
    ).toMatchObject({
      ok: false,
      message: expect.stringContaining(
        "create a key with what you need and revoke this one",
      ),
    });
  });

  it("adds rules to a key or takes them off, keeping the others, where --rule replaces them all", () => {
    const A = RULE_ID;
    const B = "9c1d2e3f-4a5b-4c6d-8e7f-0a1b2c3d4e5f";
    const C = "5e5e5e5e-0000-4000-8000-000000000003";
    expect(nextRules([A, B], { add: [], remove: [], addRules: [C] })).toEqual([
      A,
      B,
      C,
    ]);
    expect(
      nextRules([A, B], { add: [], remove: [], removeRules: [A] }),
    ).toEqual([B]);
    expect(
      nextRules([A, B], {
        add: [],
        remove: [],
        addRules: [C],
        removeRules: [B],
      }),
    ).toEqual([A, C]);
    // As the server stores them, lowercase: a rule the key has is neither added twice nor missed on removal.
    expect(
      nextRules([A], { add: [], remove: [], addRules: [A.toUpperCase()] }),
    ).toEqual([A]);
    expect(
      nextRules([A, B], {
        add: [],
        remove: [],
        removeRules: [B.toUpperCase()],
      }),
    ).toEqual([A]);
    expect(nextRules([A, B], { add: [], remove: [], rules: [C] })).toEqual([C]);
    const ruled = {
      template: null,
      resources: null,
      permissions: ["mail:read"],
      mail_scope: {
        addresses: ["a@example.com"],
        domains: [],
        rules: [A, B],
        depth: "content",
      },
    };
    expect(
      buildUpdatedGrant(ruled, { add: [], remove: [], addRules: [C] }),
    ).toEqual({
      ok: true,
      grant: {
        preset: "custom",
        permissions: ["mail:read"],
        addresses: ["a@example.com"],
        rules: [A, B, C],
      },
      permissions: ["mail:read"],
    });
    // Taking off the last rule of a key that reads nothing else is refused, as clearing it with --rule would be.
    const onlyRules = {
      ...ruled,
      mail_scope: { addresses: [], domains: [], rules: [A] },
    };
    expect(
      buildUpdatedGrant(onlyRules, { add: [], remove: [], removeRules: [A] }),
    ).toMatchObject({
      ok: false,
      message:
        "The key would reach no mail. Keep at least one address, domain or rule.",
    });
    // A key that reaches every mailbox takes no rules, added or removed.
    expect(
      buildUpdatedGrant(READER.grant, { add: [], remove: [], addRules: [A] })
        .ok,
    ).toBe(false);
    expect(
      buildUpdatedGrant(READER.grant, { add: [], remove: [], removeRules: [A] })
        .ok,
    ).toBe(false);
  });

  it("asks for approval, waits for the token, and sends the request again with it", async () => {
    const tokens: Array<string | undefined> = [];
    const opened: string[] = [];
    const written: string[] = [];
    const url =
      "https://app.example.test/app/settings/step-up?purpose=keys.create&client=primitive-cli";
    const refusal = {
      code: "step_up_required",
      message: "Confirm",
      details: { purpose: "keys.create", step_up_url: url },
    };
    const io = {
      interactive: true,
      openBrowser: true,
      open: (u: string) => opened.push(u),
      prompt: async () => "  pstep_abc  ",
      write: (t: string) => written.push(t),
    };
    const outcome = await withApproval(async (token) => {
      tokens.push(token);
      return token
        ? { ok: true as const, data: "made" }
        : { ok: false as const, payload: refusal };
    }, io);
    expect(outcome).toEqual({ ok: true, data: "made" });
    expect(tokens).toEqual([undefined, "pstep_abc"]);
    expect(opened).toEqual([url]);
    expect(written.join("")).toContain(url);
    // Without a terminal the refusal comes back with its link, and nothing waits.
    const quiet = await withApproval(
      async () => ({ ok: false as const, payload: refusal }),
      { ...io, interactive: false },
    );
    expect(quiet).toMatchObject({ ok: false, stepUpUrl: url });
    // Any other refusal is returned as it is.
    expect(
      await withApproval(
        async () => ({
          ok: false as const,
          payload: { code: "grant_forbidden" },
        }),
        io,
      ),
    ).toEqual({ ok: false, payload: { code: "grant_forbidden" } });
    expect(
      stepUpUrlOf({ code: "grant_forbidden", details: { step_up_url: url } }),
    ).toBeUndefined();
  });

  it("names the missing permission in the grant_forbidden hint", () => {
    expect(
      grantForbiddenHint({
        code: "grant_forbidden",
        details: { permission: "mail:send", reason: "permission_missing" },
      }),
    ).toBe(
      "Hint: This credential's grant does not include mail:send (permission_missing). Use a credential whose grant includes it, or ask an owner or admin to widen it. Check a credential with `primitive whoami --check mail:send`.",
    );
    expect(grantForbiddenHint({ code: "grant_forbidden" })).toContain(
      "does not allow this operation",
    );
  });

  it("names the missing permission in a forbidden refusal that has one", () => {
    expect(
      forbiddenHint({
        code: "forbidden",
        details: { permission: "org:read", reason: "permission_missing" },
      }),
    ).toBe(
      "Hint: This operation needs org:read, which this credential does not have. Some operations stay closed to keys and the CLI even with it. Check a credential with `primitive whoami --check org:read`.",
    );
    expect(
      forbiddenHint({
        error: {
          code: "forbidden",
          details: { permission: "org:read", reason: "permission_missing" },
        },
      }),
    ).toContain("needs org:read");
  });

  it("adds no forbidden hint when the refusal names no missing permission", () => {
    expect(forbiddenHint({ code: "forbidden" })).toBeNull();
    expect(
      forbiddenHint({
        code: "forbidden",
        details: { reason: "dashboard_only" },
      }),
    ).toBeNull();
    expect(
      forbiddenHint({
        code: "forbidden",
        details: { permission: "", reason: "route_undeclared" },
      }),
    ).toBeNull();
  });
});

describe("keys commands", () => {
  beforeEach(() => {
    mocks.createAuthenticatedCliApiClient.mockReset();
  });

  it("are registered", () => {
    for (const id of [
      "keys:list",
      "keys:get",
      "keys:create",
      "keys:rotate",
      "keys:update",
      "keys:revoke",
      "orgs",
      "org:use",
      "cli:list-cli-orgs",
      "roles:list",
      "roles:groups",
      "roles:mailbox-access",
      "roles:access-mode",
    ]) {
      expect(COMMANDS[id], id).toBeDefined();
    }
  });

  it("write keys only through the keys commands, never a generated one", () => {
    for (const id of KEY_WRITE_OPERATION_IDS) {
      expect(COMMANDS[id], id).toBeUndefined();
    }
    for (const operationId of [
      "createKey",
      "rotateKey",
      "updateKey",
      "revokeCredential",
    ]) {
      expect(
        cliOperationManifest.some(
          (operation) => operation.operationId === operationId,
        ),
        operationId,
      ).toBe(false);
      expect(lookupOperation(operationId).match, operationId).toBeNull();
    }
    expect(
      Object.keys(COMMANDS)
        .filter((id) => id.startsWith("keys:"))
        .sort(),
    ).toEqual([
      "keys:create",
      "keys:get",
      "keys:list",
      "keys:revoke",
      "keys:rotate",
      "keys:update",
    ]);
  });

  it("list pages through every key and shows permissions and mail scope", async () => {
    const requests = useServer((request) => {
      const cursor = new URL(request.url).searchParams.get("cursor");
      return Response.json({
        success: true,
        data: cursor
          ? { items: [{ ...READER, id: "second" }], next_cursor: null }
          : { items: [READER], next_cursor: "page-2" },
      });
    });
    const result = await run(KeysListCommand, []);
    expect(result.exitCode).toBeUndefined();
    expect(requests.map((r) => new URL(r.url).pathname)).toEqual([
      "/v1/keys",
      "/v1/keys",
    ]);
    expect(new URL((requests[1] as Request).url).search).toBe("?cursor=page-2");
    expect(result.stdout).toContain("mail:read  mail: every mailbox");
    expect(result.stdout).toContain("second  prim_ab12cd34...");
  });

  it("list --include-revoked asks for revoked keys on every page and marks them", async () => {
    const revoked = {
      ...READER,
      id: "gone",
      status: "revoked",
      revoked_at: "2026-11-11T13:05:00.000Z",
      revoked_by: "user-1",
    };
    const requests = useServer((request) => {
      const cursor = new URL(request.url).searchParams.get("cursor");
      return Response.json({
        success: true,
        data: cursor
          ? { items: [revoked], next_cursor: null }
          : { items: [READER], next_cursor: "page-2" },
      });
    });
    const result = await run(KeysListCommand, ["--include-revoked"]);
    expect(result.exitCode).toBeUndefined();
    expect(
      requests.map((r) => Object.fromEntries(new URL(r.url).searchParams)),
    ).toEqual([
      { include_revoked: "true" },
      { cursor: "page-2", include_revoked: "true" },
    ]);
    for (const request of requests) {
      expect(
        new URL(request.url).searchParams.getAll("include_revoked"),
      ).toEqual(["true"]);
    }
    const lines = result.stdout.trim().split("\n");
    expect(lines[0]).not.toContain("[revoked");
    expect(lines[1]).toMatch(
      /^gone {2}.* \[revoked 2026-11-11T13:05:00\.000Z\]$/,
    );

    const json = await run(KeysListCommand, ["--include-revoked", "--json"]);
    expect(JSON.parse(json.stdout)[1]).toMatchObject({
      id: "gone",
      status: "revoked",
      revoked_at: "2026-11-11T13:05:00.000Z",
      revoked_by: "user-1",
    });
  });

  it("list without --include-revoked asks for no revoked keys and says they are left out", async () => {
    const requests = useServer(() =>
      Response.json({ success: true, data: { items: [], next_cursor: null } }),
    );
    const result = await run(KeysListCommand, []);
    expect(new URL((requests[0] as Request).url).search).toBe("");
    expect(result.stdout).toBe(
      "No API keys. Revoked keys are left out; pass --include-revoked to list them too.\n",
    );
  });

  it("get prints one key's permissions and scope, and the JSON as returned", async () => {
    const requests = useServer(() =>
      Response.json({ success: true, data: READER }),
    );
    const human = await run(KeysGetCommand, [KEY_ID]);
    expect(new URL((requests[0] as Request).url).pathname).toBe(
      `/v1/keys/${KEY_ID}`,
    );
    expect(human.stdout).toContain("Permissions:\n  mail:read");
    expect(human.stdout).toContain("Mail:         every mailbox");
    const json = await run(KeysGetCommand, [KEY_ID, "--json"]);
    expect(JSON.parse(json.stdout)).toEqual(READER);
  });

  it("create refuses without an explicit grant and sends nothing", async () => {
    const requests = useServer(() => Response.json({}, { status: 500 }));
    const result = await run(KeysCreateCommand, ["--name", "x"]);
    expect(String(result.error)).toContain("no default");
    expect(requests).toHaveLength(0);
  });

  it("create without a terminal prints the approval link and makes nothing", async () => {
    const url =
      "https://app.example.test/app/settings/step-up?purpose=keys.create&client=primitive-cli";
    useServer(() =>
      Response.json(
        {
          success: false,
          error: {
            code: "step_up_required",
            message: "Confirm in the dashboard.",
            details: { purpose: "keys.create", step_up_url: url },
          },
        },
        { status: 403 },
      ),
    );
    const result = await run(KeysCreateCommand, [
      "--preset",
      "read_only",
      "--no-browser",
    ]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(url);
    expect(result.stderr).toContain("--step-up-token");
    expect(result.stdout).toBe("");
  });

  it("create with an approved token prints the secret alone on stdout and says to store it", async () => {
    const secret = `prim_${"a".repeat(64)}`;
    const created = {
      id: KEY_ID,
      name: "orders",
      key: secret,
      key_prefix: "prim_aaaaaaaa...",
      grant: {
        template: null,
        credential_grant_id: "g",
        permissions: ["mail:read"],
        mail_scope: { addresses: [], domains: [], rules: [RULE_ID] },
        resources: null,
      },
      expires_at: null,
      conditions: null,
      warnings: [],
    };
    const requests = useServer(() =>
      Response.json({ success: true, data: created }, { status: 201 }),
    );
    const result = await run(KeysCreateCommand, [
      "--name",
      "orders",
      "--permission",
      "mail:read",
      "--rule",
      RULE_ID,
      "--step-up-token",
      "pstep_x",
    ]);
    expect(result.exitCode).toBeUndefined();
    const request = requests[0] as Request;
    expect(request.headers.get("Primitive-Step-Up")).toBe("pstep_x");
    expect(request.headers.get("Idempotency-Key")).toMatch(/^cli-/);
    expect(await request.json()).toEqual({
      name: "orders",
      grant: { preset: "custom", permissions: ["mail:read"], rules: [RULE_ID] },
    });
    expect(result.stdout).toBe(`${secret}\n`);
    expect(result.stderr).toContain(STORE_SECRET_NOTICE);
    expect(result.stderr).toContain(`Mail: rules ${RULE_ID}`);
    const json = await run(KeysCreateCommand, [
      "--preset",
      "read_only",
      "--step-up-token",
      "pstep_y",
      "--json",
    ]);
    expect(JSON.parse(json.stdout)).toMatchObject({
      key: secret,
      notice: STORE_SECRET_NOTICE,
    });
  });

  it("create prints the address warnings, such as an address beside a rule read in full, and --json keeps them", async () => {
    const secret = `prim_${"b".repeat(64)}`;
    const whole = {
      address: "ops@acme.example",
      reason: "whole_mailbox",
      description:
        "ops@acme.example is listed beside email rules, so this key reads all of its mail, not only what the rules match.",
    };
    const created = {
      id: KEY_ID,
      name: "orders",
      key: secret,
      key_prefix: "prim_bbbbbbbb...",
      grant: {
        template: null,
        credential_grant_id: "g",
        permissions: ["mail:read"],
        mail_scope: {
          addresses: ["ops@acme.example"],
          domains: [],
          rules: [RULE_ID],
        },
        resources: null,
      },
      expires_at: null,
      conditions: null,
      warnings: [],
      address_warnings: [whole],
    };
    useServer(() =>
      Response.json({ success: true, data: created }, { status: 201 }),
    );
    const result = await run(KeysCreateCommand, [
      "--name",
      "orders",
      "--permission",
      "mail:read",
      "--rule",
      RULE_ID,
      "--address",
      "ops@acme.example",
      "--step-up-token",
      "pstep_x",
    ]);
    expect(result.exitCode).toBeUndefined();
    expect(result.stderr).toContain(`Note: ${whole.description}`);
    const json = await run(KeysCreateCommand, [
      "--name",
      "orders",
      "--permission",
      "mail:read",
      "--rule",
      RULE_ID,
      "--address",
      "ops@acme.example",
      "--step-up-token",
      "pstep_x",
      "--json",
    ]);
    expect(json.stderr).not.toContain("Note:");
    expect(JSON.parse(json.stdout)).toMatchObject({
      address_warnings: [whole],
    });
  });

  it("update prints the address warnings the change answers with", async () => {
    const description =
      "acme.example is listed beside email rules, so this key reads all of its mail, not only what the rules match.";
    let reads = 0;
    useServer((request) => {
      if (request.method === "GET") {
        reads += 1;
        return Response.json({ success: true, data: READER });
      }
      return Response.json({
        success: true,
        data: {
          id: KEY_ID,
          changed: ["grant"],
          warnings: [],
          address_warnings: [
            { address: "acme.example", reason: "whole_mailbox", description },
          ],
        },
      });
    });
    const result = await run(KeysUpdateCommand, [
      KEY_ID,
      "--add",
      "mail:send",
      "--step-up-token",
      "pstep_z",
    ]);
    expect(result.exitCode).toBeUndefined();
    expect(reads).toBeGreaterThan(0);
    expect(result.stderr).toContain(`Note: ${description}`);
  });

  it("update adds permissions to a read-only key, guarded by the grant it read, and says what happens to held requests", async () => {
    const reader = READER;
    const upgraded = {
      ...READER,
      grant: {
        ...READER.grant,
        permissions: ["mail:read", "mail:reply", "mail:send"],
      },
    };
    let reads = 0;
    const requests = useServer((request) => {
      if (request.method === "GET") {
        reads += 1;
        return Response.json({
          success: true,
          data: reads === 1 ? reader : upgraded,
        });
      }
      return Response.json({
        success: true,
        data: { id: KEY_ID, changed: ["grant"], warnings: [] },
      });
    });
    const result = await run(KeysUpdateCommand, [
      KEY_ID,
      "--add",
      "mail:send,mail:reply",
      "--step-up-token",
      "pstep_z",
    ]);
    expect(result.exitCode).toBeUndefined();
    const patch = requests.find((r) => r.method === "PATCH") as Request;
    expect(patch.headers.get("Primitive-Step-Up")).toBe("pstep_z");
    expect(await patch.json()).toEqual({
      grant: {
        preset: "custom",
        permissions: ["mail:read", "mail:reply", "mail:send"],
        mail_scope: "org",
      },
      expected_grant_ref: "grant-1",
    });
    expect(result.stdout).toContain(
      "Permissions: mail:read, mail:reply, mail:send",
    );
    expect(result.stderr).toContain(HELD_REQUEST_NOTICE);
  });

  describe("a permission the API says cannot be granted to a key", () => {
    // The permission check goes out over plain fetch (no token exchange),
    // so it reaches the same test server through the global fetch.
    let handler: Handler = () => {
      throw new Error("no server");
    };
    const checks: URL[] = [];
    beforeEach(() => {
      checks.length = 0;
      vi.stubGlobal(
        "fetch",
        async (input: Request | string | URL, init?: RequestInit) => {
          const request =
            input instanceof Request ? input : new Request(input, init);
          checks.push(new URL(request.url));
          return handler(request);
        },
      );
    });
    afterEach(() => {
      vi.unstubAllGlobals();
    });
    const serveAll = (next: Handler) => {
      handler = next;
      return useServer(next);
    };
    const refusedAs = (name: string) =>
      Response.json(
        {
          success: false,
          error: {
            code: "validation_error",
            message: `${name} cannot be granted to a key`,
            details: {},
          },
        },
        { status: 400 },
      );
    /** The API's answer to GET /whoami?check=<name>. */
    const checkAnswer = (known: boolean | "fails") => (url: URL) =>
      known === "fails"
        ? Response.json(
            {
              success: false,
              error: { code: "internal_error", message: "x" },
            },
            { status: 500 },
          )
        : known
          ? Response.json({
              success: true,
              data: {
                org_id: "org-1",
                check: {
                  permission: url.searchParams.get("check"),
                  allow: true,
                },
              },
            })
          : Response.json(
              {
                success: false,
                error: {
                  code: "validation_error",
                  message: `unknown permission: ${url.searchParams.get("check")}`,
                },
              },
              { status: 400 },
            );
    const serve = (name: string, known: boolean | "fails") =>
      serveAll((request) => {
        const url = new URL(request.url);
        return url.pathname.endsWith("/whoami")
          ? checkAnswer(known)(url)
          : refusedAs(name);
      });
    const holdable =
      "As this CLI version lists them, a key can hold mail:read, changes:read, mail.search:semantic, mail:send,";

    it.each([
      ["mail:everything", false, "Hint: mail:everything is not a permission."],
      [
        "members:manage",
        true,
        "Hint: members:manage is a permission, but an API key cannot hold it.",
      ],
      [
        "mail:everything",
        "fails",
        "Hint: mail:everything is not a permission an API key can hold.",
      ],
    ] as const)(
      "create says whether %s is a permission at all, then what a key can hold",
      async (name, known, lead) => {
        const requests = serve(name, known);
        const result = await run(KeysCreateCommand, [
          "--permission",
          name,
          "--all-mailboxes",
          "--step-up-token",
          "pstep_x",
        ]);
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain(`${name} cannot be granted to a key`);
        const hint = result.stderr
          .split("\n")
          .find((line) => line.startsWith("Hint: "));
        expect(hint).toMatch(new RegExp(`^${lead.replaceAll(".", "\\.")} `));
        expect(hint).toContain(holdable);
        expect(hint).toContain(
          "and, only when it reaches every mailbox, members:read. `primitive keys create --help-full` lists them by area.",
        );
        expect(requests).toHaveLength(1);
        expect(checks.map((url) => url.pathname)).toEqual(["/v1/whoami"]);
        expect(checks[0]?.searchParams.get("check")).toBe(name);
      },
    );

    it("puts the hint in warnings with --json and keeps the API's error", async () => {
      serve("mail:everything", false);
      const result = await run(COMMANDS["keys:create"] as never, [
        "--permission",
        "mail:everything",
        "--all-mailboxes",
        "--step-up-token",
        "pstep_x",
        "--json",
      ]);
      const document = JSON.parse(result.stdout);
      expect(document.error).toEqual({
        code: "validation_error",
        message: "mail:everything cannot be granted to a key",
        details: {},
      });
      expect(document.warnings).toEqual([
        expect.stringMatching(/^Hint: mail:everything is not a permission\. /),
      ]);
    });

    it("update --add gets the same hint", async () => {
      serveAll((request) => {
        const url = new URL(request.url);
        if (url.pathname.endsWith("/whoami")) return checkAnswer(false)(url);
        return request.method === "GET"
          ? Response.json({ success: true, data: READER })
          : refusedAs("mail:everything");
      });
      const result = await run(KeysUpdateCommand, [
        KEY_ID,
        "--add",
        "mail:everything",
        "--step-up-token",
        "pstep_x",
      ]);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain(
        "Hint: mail:everything is not a permission. As this CLI version lists them, a key can hold",
      );
    });

    it("update says when the refused permission is one the key already holds", async () => {
      serveAll((request) => {
        const url = new URL(request.url);
        if (url.pathname.endsWith("/whoami")) return checkAnswer(true)(url);
        return request.method === "GET"
          ? Response.json({ success: true, data: READER })
          : refusedAs("mail:read");
      });
      const result = await run(KeysUpdateCommand, [
        KEY_ID,
        "--add",
        "mail:send",
        "--step-up-token",
        "pstep_x",
      ]);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain(
        "Hint: mail:read is a permission, but an API key cannot hold it. The key already holds it, so this change cannot keep it: take it off with --remove mail:read.",
      );
    });

    it("says the CLI's list is out of date when it still names the refused permission", async () => {
      serve("mail:send", true);
      const result = await run(KeysCreateCommand, [
        "--permission",
        "mail:send",
        "--all-mailboxes",
        "--step-up-token",
        "pstep_x",
      ]);
      expect(result.stderr).toContain(
        "Hint: mail:send is a permission, but an API key cannot hold it. This CLI's list of the permissions a key can hold still names it, so the list is older than the API's: update the CLI.",
      );
      expect(result.stderr).not.toContain("As this CLI version lists them");
    });

    it("says only what it knows when the check gives no answer", async () => {
      for (const whoami of [
        // A server that ignores ?check.
        () => Response.json({ success: true, data: { org_id: "org-1" } }),
        () => {
          throw new TypeError("network down");
        },
      ]) {
        serveAll((request) =>
          new URL(request.url).pathname.endsWith("/whoami")
            ? whoami()
            : refusedAs("mail:everything"),
        );
        const result = await run(KeysCreateCommand, [
          "--permission",
          "mail:everything",
          "--all-mailboxes",
          "--step-up-token",
          "pstep_x",
        ]);
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain(
          "Hint: mail:everything is not a permission an API key can hold. As this CLI version lists them,",
        );
      }
    });

    it("gives up on a check that does not answer within five seconds", async () => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      try {
        serveAll((request) =>
          new URL(request.url).pathname.endsWith("/whoami")
            ? new Promise<Response>(() => {})
            : refusedAs("mail:everything"),
        );
        const pending = run(KeysCreateCommand, [
          "--permission",
          "mail:everything",
          "--all-mailboxes",
          "--step-up-token",
          "pstep_x",
        ]);
        let settled = false;
        void pending.finally(() => {
          settled = true;
        });
        // Step the clock, letting real I/O (loading the command) run between
        // steps, until the command reaches the check and its five seconds
        // run out. Date is not faked, so this stops after real time too.
        const started = Date.now();
        while (!settled && Date.now() - started < 4_000) {
          await vi.advanceTimersByTimeAsync(250);
          await new Promise((resolve) => setImmediate(resolve));
        }
        const result = await pending;
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain(
          "Hint: mail:everything is not a permission an API key can hold.",
        );
      } finally {
        vi.useRealTimers();
      }
    });

    it("lists the permissions in keys create --help-full", () => {
      expect(KeysCreateCommand.description).toContain(keyPermissionsHelp());
    });

    it("asks nothing more for any other refusal", async () => {
      const requests = serveAll(() =>
        Response.json(
          {
            success: false,
            error: {
              code: "validation_error",
              message: "Say which mail the key reaches.",
            },
          },
          { status: 400 },
        ),
      );
      const result = await run(KeysCreateCommand, [
        "--permission",
        "mail:read",
        "--all-mailboxes",
        "--step-up-token",
        "pstep_x",
      ]);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).not.toContain("A key can hold");
      expect(requests).toHaveLength(1);
      expect(checks).toEqual([]);
    });
  });

  it("update --add-rule keeps the key's rules and adds one, and --remove-rule names what it took off", async () => {
    const B = "9c1d2e3f-4a5b-4c6d-8e7f-0a1b2c3d4e5f";
    const C = "5e5e5e5e-0000-4000-8000-000000000003";
    const ruledKey = (rules: string[], ref: string) =>
      keyRow({
        template: null,
        permissions: ["mail:read"],
        mail_scope: { addresses: [], domains: [], rules, depth: "content" },
        ref,
      });
    const serve = (before: string[], after: string[]) => {
      let reads = 0;
      return useServer((request) => {
        if (request.method === "GET") {
          reads += 1;
          return Response.json({
            success: true,
            data:
              reads === 1
                ? ruledKey(before, "grant-7")
                : ruledKey(after, "grant-8"),
          });
        }
        return Response.json({
          success: true,
          data: { id: KEY_ID, changed: ["grant"], warnings: [] },
        });
      });
    };
    let requests = serve([RULE_ID, B], [RULE_ID, B, C]);
    const added = await run(KeysUpdateCommand, [
      KEY_ID,
      "--add-rule",
      C,
      "--step-up-token",
      "pstep_a",
    ]);
    expect(added.exitCode).toBeUndefined();
    expect(
      await (requests.find((r) => r.method === "PATCH") as Request).json(),
    ).toEqual({
      grant: {
        preset: "custom",
        permissions: ["mail:read"],
        rules: [RULE_ID, B, C],
      },
      expected_grant_ref: "grant-7",
    });
    expect(added.stdout).not.toContain("Rules taken off");

    requests = serve([RULE_ID, B], [B]);
    const removed = await run(KeysUpdateCommand, [
      KEY_ID,
      "--remove-rule",
      RULE_ID,
      "--step-up-token",
      "pstep_b",
    ]);
    expect(
      await (requests.find((r) => r.method === "PATCH") as Request).json(),
    ).toEqual({
      grant: { preset: "custom", permissions: ["mail:read"], rules: [B] },
      expected_grant_ref: "grant-7",
    });
    expect(removed.stdout).toContain(`Rules taken off: ${RULE_ID}`);

    // --rule replaces them all, and says which it took off.
    requests = serve([RULE_ID, B], [C]);
    const replaced = await run(KeysUpdateCommand, [
      KEY_ID,
      "--rule",
      C,
      "--step-up-token",
      "pstep_c",
    ]);
    expect(replaced.stdout).toContain(`Rules taken off: ${RULE_ID}, ${B}`);

    // Taking off a rule the key does not have changes nothing: it says so and sends no change.
    const withAddress = keyRow({
      template: null,
      permissions: ["mail:read"],
      mail_scope: {
        addresses: ["a@example.com"],
        domains: [],
        rules: [B],
        depth: "content",
      },
    });
    requests = useServer(() =>
      Response.json({ success: true, data: withAddress }),
    );
    const absent = await run(KeysUpdateCommand, [KEY_ID, "--remove-rule", C]);
    expect(absent.exitCode).toBeUndefined();
    expect(absent.stderr).toContain(
      `Not on this key, so nothing to take off: ${C}.`,
    );
    expect(absent.stdout).toContain(
      `Key ${KEY_ID} already matched; nothing changed.`,
    );
    expect(requests.filter((r) => r.method === "PATCH")).toHaveLength(0);
    // Adding one it already has, in another case, is the same.
    const again = await run(KeysUpdateCommand, [
      KEY_ID,
      "--add-rule",
      B.toUpperCase(),
      "--json",
    ]);
    expect(JSON.parse(again.stdout)).toMatchObject({
      id: KEY_ID,
      changed: [],
      warnings: [],
    });
    expect(requests.filter((r) => r.method === "PATCH")).toHaveLength(0);
    // With a new expiry, the expiry is still sent, alone: the rule change adds nothing to it.
    requests = useServer((request) =>
      request.method === "GET"
        ? Response.json({ success: true, data: withAddress })
        : Response.json({
            success: true,
            data: { id: KEY_ID, changed: ["expires_at"], warnings: [] },
          }),
    );
    const expiring = await run(KeysUpdateCommand, [
      KEY_ID,
      "--add-rule",
      B,
      "--expires-at",
      "2027-02-08T00:00:00Z",
    ]);
    expect(expiring.exitCode).toBeUndefined();
    const patches = requests.filter((r) => r.method === "PATCH");
    expect(patches).toHaveLength(1);
    expect(await (patches[0] as Request).json()).toEqual({
      expires_at: "2027-02-08T00:00:00Z",
    });
    expect(expiring.stdout).toContain("Expires: 2027-02-08T00:00:00Z");
    // So is --no-expiry, which removes it.
    const unexpiring = await run(KeysUpdateCommand, [
      KEY_ID,
      "--add-rule",
      B,
      "--no-expiry",
    ]);
    expect(unexpiring.exitCode).toBeUndefined();
    const second = requests.filter((r) => r.method === "PATCH");
    expect(await (second[1] as Request).json()).toEqual({ expires_at: null });
    // A rule change that does change the grant goes in the same request as the expiry, guarded by the grant it read.
    requests = useServer((request) =>
      request.method === "GET"
        ? Response.json({ success: true, data: withAddress })
        : Response.json({
            success: true,
            data: {
              id: KEY_ID,
              changed: ["grant", "expires_at"],
              warnings: [],
            },
          }),
    );
    const both = await run(KeysUpdateCommand, [
      KEY_ID,
      "--remove-rule",
      B,
      "--expires-at",
      "2027-02-08T00:00:00Z",
      "--step-up-token",
      "pstep_both",
    ]);
    expect(both.exitCode).toBeUndefined();
    const combined = requests.filter((r) => r.method === "PATCH");
    expect(combined).toHaveLength(1);
    const sent = (await (combined[0] as Request).json()) as {
      grant: { rules?: string[]; addresses?: string[] };
    };
    expect(sent).toMatchObject({
      expires_at: "2027-02-08T00:00:00Z",
      expected_grant_ref: withAddress.grant.ref,
      grant: { addresses: ["a@example.com"] },
    });
    expect(sent.grant.rules ?? []).not.toContain(B);
    expect(both.stdout).toContain(`Rules taken off: ${B}`);
    expect(both.stdout).toContain("Expires: 2027-02-08T00:00:00Z");
  });

  it("update --json says which rules a change took off and which were not on the key", async () => {
    const B = "9c1d2e3f-4a5b-4c6d-8e7f-0a1b2c3d4e5f";
    const C = "5e5e5e5e-0000-4000-8000-000000000003";
    const before = keyRow({
      template: null,
      permissions: ["mail:read"],
      mail_scope: {
        addresses: ["a@example.com"],
        domains: [],
        rules: [RULE_ID, B],
        depth: "content",
      },
    });
    const after = keyRow({
      template: null,
      permissions: ["mail:read"],
      mail_scope: {
        addresses: ["a@example.com"],
        domains: [],
        rules: [B],
        depth: "content",
      },
    });
    let reads = 0;
    useServer((request) => {
      if (request.method !== "GET")
        return Response.json({
          success: true,
          data: { id: KEY_ID, changed: ["grant"], warnings: [] },
        });
      reads += 1;
      return Response.json({
        success: true,
        data: reads === 1 ? before : after,
      });
    });
    const result = await run(KeysUpdateCommand, [
      KEY_ID,
      "--remove-rule",
      `${RULE_ID},${C}`,
      "--step-up-token",
      "pstep_e",
      "--json",
    ]);
    expect(JSON.parse(result.stdout)).toMatchObject({
      rules_removed: [RULE_ID],
      rules_not_on_key: [C],
      changed: ["grant"],
    });
    expect(result.stderr).not.toContain("Not on this key");
  });

  it("update --remove-rule takes off a rule that reads nothing any more, shown under ended_rules", async () => {
    const B = "9c1d2e3f-4a5b-4c6d-8e7f-0a1b2c3d4e5f";
    const DELETED = "5e5e5e5e-0000-4000-8000-000000000004";
    const withEnded = keyRow({
      template: null,
      permissions: ["mail:read"],
      mail_scope: {
        addresses: [],
        domains: [],
        rules: [B],
        ended_rules: [{ id: DELETED, reason: "rule_deleted" }],
        depth: "content",
      },
      ref: "grant-9",
    });
    let reads = 0;
    const requests = useServer((request) => {
      if (request.method === "GET") {
        reads += 1;
        return Response.json({
          success: true,
          data:
            reads === 1
              ? withEnded
              : keyRow({
                  template: null,
                  permissions: ["mail:read"],
                  mail_scope: {
                    addresses: [],
                    domains: [],
                    rules: [B],
                    depth: "content",
                  },
                  ref: "grant-10",
                }),
        });
      }
      return Response.json({
        success: true,
        data: { id: KEY_ID, changed: ["grant"], warnings: [] },
      });
    });
    const removed = await run(KeysUpdateCommand, [
      KEY_ID,
      "--remove-rule",
      DELETED,
      "--step-up-token",
      "pstep_d",
    ]);
    expect(removed.exitCode).toBeUndefined();
    // The key is restated without it: ended_rules is never sent back.
    expect(
      await (requests.find((r) => r.method === "PATCH") as Request).json(),
    ).toEqual({
      grant: { preset: "custom", permissions: ["mail:read"], rules: [B] },
      expected_grant_ref: "grant-9",
    });
    expect(removed.stderr).not.toContain("Not on this key");
    expect(removed.stdout).toContain(`Rules taken off: ${DELETED}`);
  });

  it("update restates a key whose read shows rule_versions, for a rule or permission change, never sending them back", async () => {
    const B = "9c1d2e3f-4a5b-4c6d-8e7f-0a1b2c3d4e5f";
    // As GET /v1/keys/{id} shows a key that lists a live rule.
    const withVersions = keyRow({
      template: null,
      permissions: ["mail:read"],
      mail_scope: {
        addresses: [],
        domains: [],
        rules: [RULE_ID],
        depth: "content",
        rule_versions: [
          {
            id: RULE_ID,
            current_version: 2,
            state: "active",
            version_saved_at: "2026-11-13T10:00:00.000Z",
          },
        ],
      },
      ref: "grant-11",
    });
    for (const [argv, grant] of [
      [
        ["--add-rule", B],
        { preset: "custom", permissions: ["mail:read"], rules: [RULE_ID, B] },
      ],
      [
        ["--rule", B],
        { preset: "custom", permissions: ["mail:read"], rules: [B] },
      ],
      [
        ["--add", "mail:send"],
        {
          preset: "custom",
          permissions: ["mail:read", "mail:send"],
          rules: [RULE_ID],
        },
      ],
    ] as const) {
      const requests = useServer((request) =>
        request.method === "GET"
          ? Response.json({ success: true, data: withVersions })
          : Response.json({
              success: true,
              data: { id: KEY_ID, changed: ["grant"], warnings: [] },
            }),
      );
      const result = await run(KeysUpdateCommand, [
        KEY_ID,
        ...argv,
        "--step-up-token",
        "pstep_v",
      ]);
      expect(result.exitCode).toBeUndefined();
      expect(result.stderr).not.toContain("cannot restate");
      expect(
        await (requests.find((r) => r.method === "PATCH") as Request).json(),
      ).toEqual({ grant, expected_grant_ref: "grant-11" });
    }
  });

  it("update refuses to put back a rule that reads nothing any more, and says when a key reads no mail at all", () => {
    const DELETED = "5e5e5e5e-0000-4000-8000-000000000004";
    const onlyEnded = keyRow({
      template: null,
      permissions: ["mail:read"],
      mail_scope: {
        addresses: [],
        domains: [],
        rules: [],
        ended_rules: [{ id: DELETED, reason: "rule_deleted" }],
        depth: "content",
      },
    });
    expect(
      buildUpdatedGrant(onlyEnded.grant, {
        add: [],
        remove: [],
        removeRules: [DELETED],
      }),
    ).toEqual({
      ok: false,
      message:
        "This key reads no mail any more: its only rules were deleted or their shares ended. Revoke it with `primitive keys revoke <key-id>`.",
    });
    for (const change of [
      { addRules: [DELETED.toUpperCase()] },
      { rules: [DELETED] },
    ]) {
      expect(
        buildUpdatedGrant(onlyEnded.grant, { add: [], remove: [], ...change }),
      ).toEqual({
        ok: false,
        message: `${DELETED} reads nothing any more (rule_deleted), so it cannot be added back to the key.`,
      });
    }
    expect(describeMailScope(onlyEnded.grant)).toBe(
      `no mailbox; ended rules ${DELETED} (rule_deleted)`,
    );
  });

  it("update restates a key with ended rules for any grant change, leaving them off", async () => {
    const DELETED = "5e5e5e5e-0000-4000-8000-000000000004";
    const withEnded = keyRow({
      template: null,
      permissions: ["mail:read"],
      mail_scope: {
        addresses: ["a@example.com"],
        domains: [],
        rules: [],
        ended_rules: [{ id: DELETED, reason: "share_ended" }],
        depth: "content",
      },
    });
    const next = buildUpdatedGrant(withEnded.grant, {
      add: ["mail:send"],
      remove: [],
    });
    expect(next).toEqual({
      ok: true,
      grant: {
        preset: "custom",
        permissions: ["mail:read", "mail:send"],
        addresses: ["a@example.com"],
      },
      permissions: ["mail:read", "mail:send"],
    });
  });

  it("update refuses --rule with --add-rule or --remove-rule, and a rule both added and removed, sending nothing", async () => {
    const requests = useServer(() =>
      Response.json({ success: true, data: READER }),
    );
    const mixed = await run(KeysUpdateCommand, [
      KEY_ID,
      "--rule",
      RULE_ID,
      "--add-rule",
      RULE_ID,
    ]);
    // oclif refuses the pair as a usage error, either way round.
    expect((mixed.error as { oclif?: { exit?: number } }).oclif?.exit).toBe(2);
    expect(String((mixed.error as Error).message)).toContain(
      "cannot also be provided when using --rule",
    );
    const removing = await run(KeysUpdateCommand, [
      KEY_ID,
      "--remove-rule",
      RULE_ID,
      "--rule",
      RULE_ID,
    ]);
    expect((removing.error as { oclif?: { exit?: number } }).oclif?.exit).toBe(
      2,
    );
    const twice = await run(KeysUpdateCommand, [
      KEY_ID,
      "--add-rule",
      RULE_ID,
      "--remove-rule",
      RULE_ID.toUpperCase(),
    ]);
    expect(String((twice.error as Error).message)).toContain(
      "Both added and removed",
    );
    expect((twice.error as { oclif?: { exit?: number } }).oclif?.exit).toBe(2);
    expect(requests).toHaveLength(0);
  });

  it("says in help that --rule replaces every rule, and offers --add-rule and --remove-rule", () => {
    // Compact help keeps only a flag's first sentence, so it starts there.
    expect(KeysUpdateCommand.flags.rule.description).toMatch(
      /^Replaces the key's rules with these email rule ids\. /,
    );
    expect(KeysUpdateCommand.flags["add-rule"].description).toContain(
      "Its other rules stay.",
    );
    expect(KeysUpdateCommand.flags["remove-rule"].description).toContain(
      "Its other rules stay.",
    );
    expect(KeysUpdateCommand.description).toContain(
      "--add-rule and --remove-rule",
    );
  });

  it("update --json prints the key at the top level, as keys get does, with what changed alongside", async () => {
    const after = keyRow({
      template: null,
      permissions: ["mail:read"],
      mail_scope: "org",
    });
    useServer((request) =>
      request.method === "GET"
        ? Response.json({ success: true, data: after })
        : Response.json({
            success: true,
            data: { id: KEY_ID, changed: ["name"], warnings: [] },
          }),
    );
    const result = await run(KeysUpdateCommand, [
      KEY_ID,
      "--name",
      after.name,
      "--json",
    ]);
    expect(result.exitCode).toBeUndefined();
    const printed = JSON.parse(result.stdout);
    expect(printed).toEqual({ ...after, changed: ["name"], warnings: [] });
    expect(printed.grant.mail_scope).toEqual(after.grant.mail_scope);
    expect(printed).not.toHaveProperty("key");
  });

  it("update --json keeps the key's own notes when no grant was written, and the update's when one was", async () => {
    const after = keyRow({
      template: null,
      permissions: ["mail:read"],
      mail_scope: "org",
    });
    const standing = [
      {
        address: "",
        reason: "no_send_address",
        description: "It cannot send.",
      },
    ];
    const written = [
      {
        address: "a@example.com",
        reason: "member_address",
        description: "A member's mailbox.",
      },
    ];
    const answer = (
      changed: string[],
      notes: unknown,
      read: Record<string, unknown>,
    ) =>
      useServer((request) =>
        request.method === "GET"
          ? Response.json({ success: true, data: read })
          : Response.json({
              success: true,
              data: {
                id: KEY_ID,
                changed,
                warnings: [],
                address_warnings: notes,
              },
            }),
      );
    answer(["name"], [], { ...after, address_warnings: standing });
    const renamed = await run(KeysUpdateCommand, [
      KEY_ID,
      "--name",
      after.name,
      "--json",
    ]);
    expect(JSON.parse(renamed.stdout).address_warnings).toEqual(standing);
    // A server that gives no notes on a read leaves the update's.
    answer(["name"], [], after);
    const older = await run(KeysUpdateCommand, [
      KEY_ID,
      "--name",
      after.name,
      "--json",
    ]);
    expect(JSON.parse(older.stdout).address_warnings).toEqual([]);
    // Anything but a list on the read is not taken.
    answer(["name"], [], { ...after, address_warnings: null });
    const malformed = await run(KeysUpdateCommand, [
      KEY_ID,
      "--name",
      after.name,
      "--json",
    ]);
    expect(JSON.parse(malformed.stdout).address_warnings).toEqual([]);
    // A grant change answers every note on the grant it wrote.
    answer(["grant"], written, { ...after, address_warnings: standing });
    const regranted = await run(KeysUpdateCommand, [
      KEY_ID,
      "--add",
      "mail:send",
      "--json",
    ]);
    expect(JSON.parse(regranted.stdout).address_warnings).toEqual(written);
  });

  it("update --json adds the held-request notice when the grant changed, and key_error when the read-back fails", async () => {
    const before = keyRow({
      template: null,
      permissions: ["mail:read", "mail:send"],
      mail_scope: "org",
    });
    const after = keyRow({
      template: null,
      permissions: ["mail:read"],
      mail_scope: "org",
    });
    let reads = 0;
    useServer((request) => {
      if (request.method !== "GET")
        return Response.json({
          success: true,
          data: { id: KEY_ID, changed: ["grant"], warnings: [] },
        });
      reads += 1;
      return Response.json({
        success: true,
        data: reads === 1 ? before : after,
      });
    });
    const narrowed = await run(KeysUpdateCommand, [
      KEY_ID,
      "--remove",
      "mail:send",
      "--json",
    ]);
    expect(JSON.parse(narrowed.stdout)).toEqual({
      ...after,
      changed: ["grant"],
      warnings: [],
      notice: HELD_REQUEST_NOTICE,
    });
    // A rename that succeeds but whose read-back is refused.
    useServer((request) =>
      request.method === "GET"
        ? Response.json(
            {
              success: false,
              error: {
                code: "forbidden",
                message: "Reading a key needs the whole organization's mail.",
              },
            },
            { status: 403 },
          )
        : Response.json({
            success: true,
            data: { id: KEY_ID, changed: ["name"], warnings: [] },
          }),
    );
    const renamed = await run(KeysUpdateCommand, [
      KEY_ID,
      "--name",
      "x",
      "--json",
    ]);
    expect(renamed.exitCode).toBeUndefined();
    expect(JSON.parse(renamed.stdout)).toMatchObject({
      id: KEY_ID,
      changed: ["name"],
      key_error: { code: "forbidden" },
    });
  });

  it("update narrows a key in one request when the server asks for no approval", async () => {
    const sender = keyRow({
      template: null,
      permissions: ["mail:read", "mail:send"],
      mail_scope: "org",
    });
    const requests = useServer((request) =>
      request.method === "GET"
        ? Response.json({ success: true, data: sender })
        : Response.json({
            success: true,
            data: { id: KEY_ID, changed: ["grant"], warnings: [] },
          }),
    );
    const result = await run(KeysUpdateCommand, [
      KEY_ID,
      "--remove",
      "mail:send",
      "--no-browser",
    ]);
    expect(result.exitCode).toBeUndefined();
    const patches = requests.filter((r) => r.method === "PATCH");
    expect(patches).toHaveLength(1);
    expect((patches[0] as Request).headers.get("Primitive-Step-Up")).toBeNull();
    expect(await (patches[0] as Request).json()).toEqual({
      grant: {
        preset: "custom",
        permissions: ["mail:read"],
        mail_scope: "org",
      },
      // Guarded by the grant it read.
      expected_grant_ref: "grant-1",
    });
  });

  it("update does not restate a grant whose resource limits the server does not show, and sends nothing", async () => {
    // A server that predates showing them: the read has neither ref nor resources.
    const { ref: _ref, resources: _resources, ...older } = READER.grant;
    const requests = useServer(() =>
      Response.json({ success: true, data: { ...READER, grant: older } }),
    );
    const result = await run(KeysUpdateCommand, [KEY_ID, "--add", "mail:send"]);
    expect(String((result.error as Error | null)?.message)).toContain(
      "The server does not say whether this key is limited to selected Functions, domains, endpoints or routes",
    );
    expect(requests.filter((r) => r.method === "PATCH")).toHaveLength(0);
  });

  it("update refuses a grant change on a revoked key before sending anything", async () => {
    const requests = useServer(() =>
      Response.json({
        success: true,
        data: {
          ...READER,
          status: "revoked",
          revoked_at: "2026-11-02T00:00:00.000Z",
          revoked_by: null,
        },
      }),
    );
    const result = await run(KeysUpdateCommand, [KEY_ID, "--add", "mail:send"]);
    expect(String((result.error as Error | null)?.message)).toContain(
      `Key ${KEY_ID} is revoked, so it cannot be changed.`,
    );
    expect(requests.filter((r) => r.method === "PATCH")).toHaveLength(0);
  });

  it("update says when the read carries no grant ref, and then sends no guard", async () => {
    const { ref: _ref, ...unreffed } = READER.grant;
    const requests = useServer((request) =>
      request.method === "GET"
        ? Response.json({ success: true, data: { ...READER, grant: unreffed } })
        : Response.json({
            success: true,
            data: { id: KEY_ID, changed: ["grant"], warnings: [] },
          }),
    );
    const result = await run(KeysUpdateCommand, [
      KEY_ID,
      "--add",
      "mail:send",
      "--no-browser",
    ]);
    expect(result.stderr).toContain(
      "Note: the server did not say which grant this key holds, so this change is not checked against changes made since it was read.",
    );
    const patch = requests.find((r) => r.method === "PATCH") as Request;
    expect(await patch.json()).not.toHaveProperty("expected_grant_ref");
    // Under --json the note stays out of stderr.
    const json = await run(KeysUpdateCommand, [
      KEY_ID,
      "--add",
      "mail:send",
      "--no-browser",
      "--json",
    ]);
    expect(json.stderr).not.toContain("which grant this key holds");
  });

  it("update --expires-at sets the expiry alone, without reading the key, and --no-expiry removes it", async () => {
    const requests = useServer(() =>
      Response.json({
        success: true,
        data: { id: KEY_ID, changed: ["expires_at"], warnings: [] },
      }),
    );
    const extended = await run(KeysUpdateCommand, [
      KEY_ID,
      "--expires-at",
      "2027-02-08T00:00:00Z",
    ]);
    expect(extended.exitCode).toBeUndefined();
    expect(requests.map((r) => r.method)).toEqual(["PATCH"]);
    expect(await (requests[0] as Request).json()).toEqual({
      expires_at: "2027-02-08T00:00:00Z",
    });
    expect(extended.stdout).toContain(`Updated key ${KEY_ID}: expires_at.`);
    expect(extended.stdout).toContain("Expires: 2027-02-08T00:00:00Z");
    const removed = await run(KeysUpdateCommand, [KEY_ID, "--no-expiry"]);
    expect(removed.exitCode).toBeUndefined();
    expect(await (requests[1] as Request).json()).toEqual({ expires_at: null });
    expect(removed.stdout).toContain("Expires: never");
  });

  it("update and rotate refuse an --expires-at without a time and zone, and send nothing", async () => {
    const requests = useServer(() =>
      Response.json({ success: true, data: {} }),
    );
    for (const command of [KeysUpdateCommand, KeysRotateCommand]) {
      const refused = await run(command, [
        KEY_ID,
        "--expires-at",
        "2027-02-08",
      ]);
      expect(String(refused.error)).toContain(
        "ISO 8601 time with its time zone",
      );
    }
    expect(requests).toHaveLength(0);
    expect(
      expiryFromFlags({ "expires-at": "2027-02-08T00:00:00+02:00" }),
    ).toEqual({ ok: true, expiresAt: "2027-02-08T00:00:00+02:00" });
    expect(expiryFromFlags({ "no-expiry": true })).toEqual({
      ok: true,
      expiresAt: null,
    });
    expect(expiryFromFlags({})).toEqual({ ok: true, expiresAt: undefined });
    expect(expiryFromFlags({ "expires-at": "next week" }).ok).toBe(false);
    expect(expiryFromFlags({ "expires-at": "2027-02-08t00:00:00z" }).ok).toBe(
      false,
    );
    expect(expiryFromFlags({ "expires-at": "2027-02-08T24:00:00Z" }).ok).toBe(
      false,
    );
  });

  it("rotate keeps the expiry unless told, sends --expires-at for the new key, and says when the new key expires", async () => {
    const requests = useServer(() =>
      Response.json({
        success: true,
        data: {
          id: "1f0e0d0c-0b0a-4908-8706-050403020100",
          key: "prim_new_secret",
          key_prefix: "prim_new",
          expires_at: "2027-02-08T00:00:00.000Z",
          previous_key_id: KEY_ID,
          previous_key_expires_at: "2026-11-12T00:00:00.000Z",
        },
      }),
    );
    const kept = await run(KeysRotateCommand, [KEY_ID]);
    expect(kept.exitCode).toBeUndefined();
    expect(await (requests[0] as Request).json()).toEqual({});
    const extended = await run(KeysRotateCommand, [
      KEY_ID,
      "--expires-at",
      "2027-02-08T00:00:00Z",
      "--overlap-seconds",
      "3600",
    ]);
    expect(extended.exitCode).toBeUndefined();
    expect(await (requests[1] as Request).json()).toEqual({
      overlap_seconds: 3600,
      expires_at: "2027-02-08T00:00:00Z",
    });
    expect(extended.stderr).toContain("and expires 2027-02-08T00:00:00.000Z.");
  });

  it("refuses --expires-at with --no-expiry on both commands, and rotate --no-expiry asks for a key that never expires", async () => {
    const requests = useServer(() =>
      Response.json({
        success: true,
        data: {
          id: "1f0e0d0c-0b0a-4908-8706-050403020100",
          key: "prim_new_secret",
          key_prefix: "prim_new",
          expires_at: null,
          previous_key_id: KEY_ID,
          previous_key_expires_at: "2026-11-12T00:00:00.000Z",
        },
      }),
    );
    for (const command of [KeysUpdateCommand, KeysRotateCommand]) {
      const both = await run(command, [
        KEY_ID,
        "--expires-at",
        "2027-02-08T00:00:00Z",
        "--no-expiry",
      ]);
      expect(both.error).toBeTruthy();
    }
    expect(requests).toHaveLength(0);
    const never = await run(KeysRotateCommand, [KEY_ID, "--no-expiry"]);
    expect(never.exitCode).toBeUndefined();
    expect(await (requests[0] as Request).json()).toEqual({ expires_at: null });
    expect(never.stderr).toContain("and expires never.");
  });

  it("rotate says nothing about the new key's expiry when the answer does not give it", async () => {
    useServer(() =>
      Response.json({
        success: true,
        data: {
          id: "1f0e0d0c-0b0a-4908-8706-050403020100",
          key: "prim_new_secret",
          key_prefix: "prim_new",
          previous_key_id: KEY_ID,
          previous_key_expires_at: "2026-11-12T00:00:00.000Z",
        },
      }),
    );
    const rotated = await run(KeysRotateCommand, [KEY_ID]);
    expect(rotated.stderr).toContain(
      "prefix prim_new. The old key works until",
    );
    expect(rotated.stderr).not.toContain("expires never");
  });

  it("revoke prints what the organization owns and what the key owned", async () => {
    useServer(() =>
      Response.json({
        success: true,
        data: {
          revoked: 1,
          kind: "org_key",
          id: KEY_ID,
          standing_objects: [
            { kind: "endpoint", id: "a", label: "x", org_owned: true },
            { kind: "endpoint", id: "b", label: "y", org_owned: false },
          ],
        },
      }),
    );
    const revoked = await run(KeysRevokeCommand, [KEY_ID, "--yes"]);
    expect(revoked.stdout).toContain(
      "1 item(s) the organization owns keep working. 1 item(s) the key owned itself or carried on for the keys it was rotated from, such as its own webhooks, which keep working only while someone can still act for them, such as a key of the same rotation that still works.",
    );
  });

  it("revoke says what keeps working for the organization, and that what the key owned works only while someone can act for it", () => {
    expect(standingSummary([])).toBeNull();
    expect(standingSummary(undefined)).toBeNull();
    expect(
      standingSummary([
        { kind: "endpoint", id: "a", label: "x", org_owned: true },
        { kind: "endpoint", id: "b", label: "y", org_owned: false },
        { kind: "recipient_route", id: "c", label: "z", org_owned: false },
      ]),
    ).toBe(
      "1 item(s) the organization owns keep working. 2 item(s) the key owned itself or carried on for the keys it was rotated from, such as its own webhooks, which keep working only while someone can still act for them, such as a key of the same rotation that still works. Review them with --json.",
    );
    expect(
      standingSummary([
        { kind: "endpoint", id: "b", label: "y", org_owned: false },
      ]),
    ).toBe(
      "1 item(s) the key owned itself or carried on for the keys it was rotated from, such as its own webhooks, which keep working only while someone can still act for them, such as a key of the same rotation that still works. Review them with --json.",
    );
    expect(KeysRevokeCommand.description).not.toContain(
      "what it set up keeps working",
    );
    expect(KeysRevokeCommand.description).not.toContain("stop with it");
    expect(KeysRotateCommand.description).toContain(
      "rotating alone does not extend a key",
    );
  });

  it("revoke without --yes and without a terminal sends nothing; with --yes it revokes an API key", async () => {
    const requests = useServer(() =>
      Response.json({
        success: true,
        data: { revoked: 1, kind: "org_key", id: KEY_ID, standing_objects: [] },
      }),
    );
    const refused = await run(KeysRevokeCommand, [KEY_ID]);
    expect(String(refused.error)).toContain("--yes");
    expect(requests).toHaveLength(0);
    const revoked = await run(KeysRevokeCommand, [KEY_ID, "--yes"]);
    expect(revoked.exitCode).toBeUndefined();
    expect(await (requests[0] as Request).json()).toEqual({
      kind: "org_key",
      id: KEY_ID,
    });
    expect(revoked.stdout).toContain(`Revoked key ${KEY_ID}.`);
  });

  it("revoke says what still acts and delivers for each item, and the keys it replaced", async () => {
    useServer(() =>
      Response.json({
        success: true,
        data: {
          revoked: 2,
          kind: "org_key",
          id: KEY_ID,
          predecessors_revoked_count: 1,
          predecessors_left: 1,
          predecessors_revoked: ["prev-1"],
          predecessors_not_revoked: ["prev-2"],
          standing_objects: [
            {
              kind: "endpoint",
              id: "a",
              label: "https://org.example/hook",
              org_owned: true,
              still_acting: true,
              acting_key_id: null,
              delivering: false,
            },
            {
              kind: "endpoint",
              id: "b",
              label: "https://own.example/hook?token=secret",
              org_owned: false,
              still_acting: true,
              acting_key_id: "next-1",
              delivering: true,
            },
            {
              kind: "recipient_route",
              id: "c",
              label: "support@acme.example",
              org_owned: false,
              still_acting: false,
              acting_key_id: null,
            },
            {
              kind: "endpoint",
              id: "d",
              label: "https://unknown.example/hook",
              org_owned: false,
              still_acting: null,
              delivering: null,
            },
            {
              kind: "function_trigger",
              id: "fn-1",
              label: "function",
              org_owned: false,
              still_acting: true,
              acting_key_id: "prev-2",
            },
            {
              kind: "filter_rule",
              id: "f",
              label: "*@spam.example",
              org_owned: false,
              still_acting: true,
              acting_key_id: null,
            },
            {
              kind: "wake_schedule",
              id: "w",
              label: "check to a@b.example",
              org_owned: false,
            },
          ],
        },
      }),
    );
    const revoked = await run(KeysRevokeCommand, [KEY_ID, "--yes"]);
    expect(revoked.stdout.trim().split("\n")).toEqual([
      `Revoked key ${KEY_ID}.`,
      "Also revoked 1 key it replaced, still in its rotation overlap: prev-1.",
      "1 key it replaced is left working until its overlap ends, because you may not revoke it: prev-2; what it acts for keeps working until then.",
      "What it set up, owns or carried on for the keys it replaced (revoking deletes none of it):",
      "  webhook https://org.example/hook: the organization owns it, so revoking does not stop it; not delivering received mail.",
      "  webhook https://own.example/hook?...: owned by the revoked key; key next-1 still acts for it, so it keeps working while that key does; still delivering received mail.",
      "  route support@acme.example: owned by the revoked key; nothing acts for it, so it does not work.",
      "  webhook https://unknown.example/hook: owned by the revoked key; whether anything still acts for it could not be read, and it works only while something does; whether it still delivers could not be read.",
      "  Function trigger fn-1: owned by the revoked key; key prev-2 still acts for it until that key's overlap ends.",
      "  filter *@spam.example: owned by the revoked key; someone still acts for it, so it keeps working while they do.",
      "  wake schedule check to a@b.example: owned by the revoked key; it keeps working only while someone can still act for it.",
    ]);
    expect(revoked.stdout).not.toContain("secret");
  });

  it("revoke of a key already revoked says so without 'nothing changed' when it revoked keys it replaced", async () => {
    useServer(() =>
      Response.json({
        success: true,
        data: {
          revoked: 1,
          kind: "org_key",
          id: KEY_ID,
          already_revoked: true,
          predecessors_revoked_count: 1,
          standing_objects: [],
        },
      }),
    );
    const again = await run(KeysRevokeCommand, [KEY_ID, "--yes"]);
    expect(again.stdout.trim().split("\n")).toEqual([
      `Key ${KEY_ID} was already revoked.`,
      "Also revoked 1 key it replaced, still in its rotation overlap.",
    ]);
  });

  it("revoke lists at most ten items, and counts keys in the plural", () => {
    const standing = (n: number) =>
      Array.from({ length: n }, (_, i) => ({
        kind: "endpoint",
        id: `e${i}`,
        label: `https://h${i}.example`,
        org_owned: false,
        still_acting: false,
        delivering: false,
      }));
    const lines = revokeCascadeLines({
      predecessors_revoked_count: 2,
      predecessors_left: 3,
      standing_objects: standing(11),
    });
    expect(lines[0]).toBe(
      "Also revoked 2 keys it replaced, still in their rotation overlap.",
    );
    expect(lines[1]).toBe(
      "3 keys it replaced are left working until their overlap ends, because you may not revoke them; what they act for keeps working until then.",
    );
    expect(lines).toHaveLength(2 + 1 + 10 + 1);
    expect(lines.at(-1)).toBe("  1 more; --json lists them all.");
    expect(lines[3]).toBe(
      "  webhook https://h0.example: owned by the revoked key; nothing acts for it, so it does not work; not delivering received mail.",
    );
    // Exactly ten: no "more" line.
    const ten = revokeCascadeLines({ standing_objects: standing(10) });
    expect(ten).toHaveLength(1 + 10);
    expect(ten.at(-1)).not.toContain("more");
    // No predecessors and an older server's items: the earlier summary.
    expect(
      revokeCascadeLines({
        predecessors_revoked_count: 0,
        predecessors_left: 0,
        standing_objects: [
          { kind: "endpoint", id: "b", label: "y", org_owned: false },
        ],
      }),
    ).toEqual([
      "1 item(s) the key owned itself or carried on for the keys it was rotated from, such as its own webhooks, which keep working only while someone can still act for them, such as a key of the same rotation that still works. Review them with --json.",
    ]);
    expect(revokeCascadeLines({ standing_objects: [] })).toEqual([]);
    expect(revokeCascadeLines(null)).toEqual([]);
  });

  it("revoke says when the key was already revoked", async () => {
    useServer(() =>
      Response.json({
        success: true,
        data: {
          revoked: 0,
          kind: "org_key",
          id: KEY_ID,
          standing_objects: [],
          already_revoked: true,
        },
      }),
    );
    const again = await run(KeysRevokeCommand, [KEY_ID, "--yes"]);
    expect(again.exitCode).toBeUndefined();
    expect(again.stdout).toContain(
      `Key ${KEY_ID} was already revoked; nothing changed.`,
    );
    expect(again.stdout).not.toContain(`Revoked key ${KEY_ID}.`);
  });

  it("revoke takes an approval token, and without one prints the approval link and how to rerun", async () => {
    const stepUpUrl = "https://app.example.test/approve/abc";
    let calls = 0;
    const requests = useServer((request) => {
      calls += 1;
      return request.headers.get("primitive-step-up")
        ? Response.json({
            success: true,
            data: {
              revoked: 1,
              kind: "org_key",
              id: KEY_ID,
              standing_objects: [],
            },
          })
        : Response.json(
            {
              success: false,
              error: {
                code: "step_up_required",
                message: "Approve this in the dashboard.",
                details: { step_up_url: stepUpUrl },
              },
            },
            { status: 403 },
          );
    });
    const refused = await run(KeysRevokeCommand, [KEY_ID, "--yes"]);
    expect(refused.exitCode).toBe(1);
    expect(refused.stderr).toContain(stepUpUrl);
    expect(refused.stderr).toContain("--step-up-token");
    const approved = await run(KeysRevokeCommand, [
      KEY_ID,
      "--yes",
      "--step-up-token",
      "token-123",
    ]);
    expect(approved.exitCode).toBeUndefined();
    expect(requests.at(-1)?.headers.get("primitive-step-up")).toBe("token-123");
    expect(approved.stdout).toContain(`Revoked key ${KEY_ID}.`);
    expect(calls).toBe(2);
  });
});

describe("roles commands", () => {
  it("formats roles, groups and the access mode", () => {
    expect(
      formatRoles({
        assignment: { available: false, reason: "flag_off" },
        roles: [
          {
            id: "r1",
            catalog_version: null,
            description: null,
            key: "owner",
            kind: "builtin",
            mail_scope: "org",
            name: "Owner",
            permissions: ["a:b"],
            predates_catalog: false,
            version: 1,
          },
          {
            id: "r3",
            catalog_version: null,
            description: null,
            key: "operator",
            kind: "template",
            mail_scope: "org",
            name: "Operator",
            permissions: ["a:b", "c:d"],
            predates_catalog: false,
            version: 1,
          },
          {
            id: "r2",
            catalog_version: null,
            description: null,
            key: "custom_1",
            kind: "custom",
            mail_scope: "org",
            name: "Support",
            permissions: [],
            predates_catalog: false,
            version: 2,
          },
        ],
        templates: [
          {
            description: "",
            key: "read_only",
            name: "Read only",
            permissions: ["a:b", "c:d"],
          },
        ],
      }),
    ).toBe(
      [
        "owner  builtin  Owner  1 permissions",
        "operator  template  Operator  2 permissions",
        "custom_1  custom  Support  0 permissions  (r2)",
        "",
        "Templates:",
        "read_only  Read only  2 permissions",
        "",
        "Role assignment is not available (flag_off).",
      ].join("\n"),
    );
    expect(formatGroups({ groups: [] })).toBe("No groups.");
    // The id of the group's role, labelled as an id, not as the role.
    expect(
      formatGroups({
        groups: [{ id: "g1", name: "Support", members: [], role_id: "r1" }],
      } as never),
    ).toBe("g1  Support  0 members  role id r1");
    expect(
      formatGroups({
        groups: [{ id: "g2", name: "Nobody", members: [], role_id: null }],
      } as never),
    ).toBe("g2  Nobody  0 members  role id none");
    expect(
      formatAccessMode({ changed_at: null, mode: "whole_org", version: 0 }),
    ).toBe("Access mode: whole_org (version 0).");
  });

  it("lists members with their roles, and pages with the cursor on stderr", async () => {
    const person = {
      user_id: "11111111-1111-4111-8111-111111111111",
      name: "Alice",
      work_email: "alice@example.com",
      role: "restricted",
      role_name: "Finance reviewer (custom)",
      role_id: "22222222-2222-4222-8222-222222222222",
      agents: [{ id: KEY_ID, address: "a@example.com", name: "helper" }],
    };
    const page = {
      items: [
        person,
        {
          ...person,
          user_id: "33333333-3333-4333-8333-333333333333",
          work_email: null,
          name: "Bob\u001b[2J\nfake line",
          role: "admin",
          role_name: "Admin",
          role_id: null,
          agents: [],
        },
      ],
      cursor: "44444444-4444-4444-8444-444444444444",
      can_invite: true,
    };
    expect(formatMembers(page as never)).toBe(
      [
        "Alice  alice@example.com  Finance reviewer (custom)  11111111-1111-4111-8111-111111111111  1 agent",
        "Bob [2J fake line  no work email  Admin  33333333-3333-4333-8333-333333333333",
      ].join("\n"),
    );
    const requests = useServer(() =>
      Response.json({ success: true, data: page }),
    );
    const plain = await run(RolesMembersCommand, [
      "--query",
      "ali",
      "--limit",
      "10",
    ]);
    expect(plain.exitCode).toBeUndefined();
    expect(plain.stdout).toContain("Finance reviewer (custom)");
    expect(plain.stderr).toBe(
      "next cursor: 44444444-4444-4444-8444-444444444444\n",
    );
    const url = new URL(requests[0]?.url ?? "");
    expect(url.pathname).toBe("/v1/organization/members");
    expect(url.searchParams.get("query")).toBe("ali");
    expect(url.searchParams.get("limit")).toBe("10");
    const json = await run(RolesMembersCommand, [
      "--json",
      "--cursor",
      "44444444-4444-4444-8444-444444444444",
    ]);
    expect(json.stderr).toBe("");
    expect(JSON.parse(json.stdout)).toEqual(page);
    expect(new URL(requests[1]?.url ?? "").searchParams.get("cursor")).toBe(
      "44444444-4444-4444-8444-444444444444",
    );
    expect(formatMembers({ items: [], cursor: null, can_invite: false })).toBe(
      "No members.",
    );
    // What each member's access lets them do with mail, where the caller sees it.
    const withMail = (read: boolean, send: boolean) => ({
      ...person,
      agents: [],
      mail_access: { read, send },
    });
    expect(
      formatMembers({
        items: [
          withMail(true, true),
          withMail(true, false),
          withMail(false, true),
          withMail(false, false),
          // Malformed or absent: nothing is said about mail.
          { ...person, agents: [], mail_access: { read: "yes", send: true } },
          { ...person, agents: [], mail_access: null },
        ],
        cursor: null,
        can_invite: false,
      } as never).split("\n"),
    ).toEqual([
      "Alice  alice@example.com  Finance reviewer (custom)  11111111-1111-4111-8111-111111111111  mail: read and send",
      "Alice  alice@example.com  Finance reviewer (custom)  11111111-1111-4111-8111-111111111111  mail: read only",
      "Alice  alice@example.com  Finance reviewer (custom)  11111111-1111-4111-8111-111111111111  mail: send only",
      "Alice  alice@example.com  Finance reviewer (custom)  11111111-1111-4111-8111-111111111111  mail: none",
      "Alice  alice@example.com  Finance reviewer (custom)  11111111-1111-4111-8111-111111111111",
      "Alice  alice@example.com  Finance reviewer (custom)  11111111-1111-4111-8111-111111111111",
    ]);
    expect(COMMANDS["members:list"]).toBe(RolesMembersCommand);
    expect(COMMANDS["roles:members"]).toBe(RolesMembersCommand);
  });

  it("roles members prints the server's refusal and exits 1", async () => {
    useServer(() =>
      Response.json(
        {
          success: false,
          error: { code: "forbidden", message: "Not a signed-in member" },
        },
        { status: 403 },
      ),
    );
    const result = await run(RolesMembersCommand, []);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("Not a signed-in member");
  });

  it("names the built-in roles in roles list help, and Operator as a template", () => {
    expect(RolesListCommand.description).toContain(
      "The built-in roles are owner, admin and member. Operator is a template",
    );
  });

  it("prints the server's refusal where roles are not enabled", async () => {
    useServer(() =>
      Response.json(
        {
          success: false,
          error: {
            code: "feature_disabled",
            message: "Roles are not available",
          },
        },
        { status: 404 },
      ),
    );
    const result = await run(RolesListCommand, []);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("feature_disabled");
  });
});
