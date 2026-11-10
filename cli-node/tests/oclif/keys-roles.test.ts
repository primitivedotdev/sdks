import { resolve } from "node:path";
import { PrimitiveApiClient } from "@primitivedotdev/api-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
  formatKeyDetail,
  formatKeyRows,
  HELD_REQUEST_NOTICE,
  KeysCreateCommand,
  KeysGetCommand,
  KeysListCommand,
  KeysRevokeCommand,
  KeysUpdateCommand,
  STORE_SECRET_NOTICE,
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
    grant,
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
    expect(formatKeyRows([])).toBe("No API keys.");
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
      ).ok,
    ).toBe(false);
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

  it("update adds permissions to a read-only key, guarded by the grant it read, and says what happens to held requests", async () => {
    const reader = { ...READER, grant: { ...READER.grant, ref: "grant-1" } };
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
    });
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
            kind: "builtin",
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
        "operator  builtin  Operator  2 permissions",
        "custom_1  custom  Support  0 permissions  (r2)",
        "",
        "Templates:",
        "read_only  Read only  2 permissions",
        "",
        "Role assignment is not available (flag_off).",
      ].join("\n"),
    );
    expect(formatGroups({ groups: [] })).toBe("No groups.");
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

  it("names the built-in roles, operator included, in roles list help", () => {
    expect(RolesListCommand.description).toContain(
      "owner, admin, operator and member",
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
