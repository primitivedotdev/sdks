import { resolve } from "node:path";
import { PrimitiveApiClient } from "@primitivedotdev/api-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAuthenticatedCliApiClient: vi.fn(),
}));

vi.mock("../../src/oclif/api-client.js", () => ({
  createAuthenticatedCliApiClient: mocks.createAuthenticatedCliApiClient,
}));

import { grantForbiddenHint } from "../../src/oclif/api-command.js";
import {
  buildKeyGrant,
  formatKeyRows,
  KeysCreateCommand,
  KeysListCommand,
  KeysRevokeCommand,
  KeysRotateCommand,
  parseDurationSeconds,
  parseExpires,
} from "../../src/oclif/commands/keys.js";
import {
  formatAccessMode,
  formatGroups,
  formatRoles,
  RolesListCommand,
} from "../../src/oclif/commands/roles.js";
import {
  extractGlobalOrgFlag,
  withoutOrgSelection,
} from "../../src/oclif/global-org-flag.js";
import { COMMANDS } from "../../src/oclif/index.js";

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

describe("keys helpers", () => {
  it("parses --expires durations and dates", () => {
    const now = () => Date.parse("2026-10-01T00:00:00.000Z");
    expect(parseExpires("30d", now)).toEqual({ expires_in_days: 30 });
    expect(parseExpires("12h", now)).toEqual({
      expires_at: "2026-10-01T12:00:00.000Z",
    });
    expect(parseExpires("2026-12-31", now)).toEqual({
      expires_at: "2026-12-31T00:00:00.000Z",
    });
    expect(() => parseExpires("0d", now)).toThrow(/1d to 3650d/);
    expect(() => parseExpires("2020-01-01", now)).toThrow(/future/);
    expect(() => parseExpires("soon", now)).toThrow(/not a duration/);
    expect(parseDurationSeconds("2w")).toBe(14 * 86400);
    expect(parseDurationSeconds("x")).toBeNull();
  });

  it("builds the grant from flags", () => {
    expect(buildKeyGrant({})).toBeUndefined();
    expect(buildKeyGrant({ preset: "send_only" })).toBe("send_only");
    expect(
      buildKeyGrant({
        permission: ["mail:read,mail:send"],
        address: ["a@example.com"],
      }),
    ).toEqual({
      preset: "custom",
      permissions: ["mail:read", "mail:send"],
      addresses: ["a@example.com"],
    });
    expect(
      buildKeyGrant({ preset: "own_addresses", address: ["a@example.com"] }),
    ).toEqual({
      preset: "own_addresses",
      addresses: ["a@example.com"],
    });
    expect(() =>
      buildKeyGrant({ preset: "send_only", permission: ["mail:read"] }),
    ).toThrow(/custom grant/);
    expect(() => buildKeyGrant({ permission: ["all"] })).toThrow(
      /not a permission/,
    );
    expect(() => buildKeyGrant({ address: ["a@example.com"] })).toThrow(
      /narrow/,
    );
    expect(() => buildKeyGrant({ preset: "custom" })).toThrow(/at least one/);
  });

  it("formats inventory rows", () => {
    expect(formatKeyRows([])).toBe("No API keys.");
    expect(
      formatKeyRows([
        {
          actions: ["revoke"],
          creator: { email: null, id: null, kind: null, status: "member" },
          expires_at: null,
          flags: ["unused_90_days"],
          grant: {
            permissions: null,
            ref: null,
            template: "super_admin",
            type: "template",
          },
          id: KEY_ID,
          kind: "org_key",
          last_used_at: null,
          name: "ci",
          prefix: "prim_ab",
        },
      ]),
    ).toBe(
      `${KEY_ID}  prim_ab  ci  super_admin  expires never  last used never [unused_90_days]`,
    );
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
});

describe("keys commands", () => {
  beforeEach(() => {
    mocks.createAuthenticatedCliApiClient.mockReset();
  });

  it("are registered", () => {
    for (const id of [
      "keys:create",
      "keys:list",
      "keys:rotate",
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

  it("creates a key with a step-up, a grant, an expiry and conditions, and prints the secret once", async () => {
    const requests = useServer(() =>
      Response.json(
        {
          success: true,
          data: {
            id: KEY_ID,
            name: "ci",
            key: "prim_secret_once",
            key_prefix: "prim_sec",
            grant: {
              template: null,
              credential_grant_id: "g1",
              permissions: ["mail:read"],
              mail_scope: {
                addresses: ["a@example.com"],
                domains: [],
                depth: "raw",
              },
              resources: null,
            },
            expires_at: "2026-11-01T00:00:00.000Z",
            conditions: null,
            warnings: [
              {
                permission: "mail:read",
                adds: ["threads:read"],
                why: "Reading mail reads its threads.",
                description: "",
              },
            ],
          },
        },
        { status: 201 },
      ),
    );
    const result = await run(KeysCreateCommand, [
      "--name",
      "ci",
      "--permission",
      "mail:read",
      "--address",
      "a@example.com",
      "--expires",
      "30d",
      "--ip",
      "10.0.0.0/8",
      "--rate-limit",
      "60",
      "--step-up",
      "pstep_abc",
    ]);
    expect(result.error).toBeNull();
    expect(result.stdout).toBe("prim_secret_once\n");
    expect(result.stderr).toContain("Also added threads:read");
    expect(result.stderr).toContain("shown once");
    const request = requests[0] as Request;
    expect(new URL(request.url).pathname).toBe("/v1/keys");
    expect(request.headers.get("primitive-step-up")).toBe("pstep_abc");
    expect(await request.json()).toEqual({
      name: "ci",
      grant: {
        preset: "custom",
        permissions: ["mail:read"],
        addresses: ["a@example.com"],
      },
      expires_in_days: 30,
      conditions: { ip_allowlist: ["10.0.0.0/8"], rate_limit_per_minute: 60 },
    });
  });

  it("points to the dashboard step-up when the server asks for one", async () => {
    useServer(() =>
      Response.json(
        {
          success: false,
          error: {
            code: "step_up_required",
            message:
              "Creating a key needs the person to confirm in the dashboard.",
            details: {
              purpose: "keys.create",
              step_up_url: "https://example.test/step-up",
            },
          },
        },
        { status: 403 },
      ),
    );
    const result = await run(KeysCreateCommand, ["--preset", "send_only"]);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain(
      "Confirm in the dashboard (https://example.test/step-up), then rerun this command with --step-up <token>.",
    );
  });

  it("lists keys from the inventory and passes the server's refusal through", async () => {
    const requests = useServer(() =>
      Response.json(
        {
          success: false,
          error: {
            code: "forbidden",
            message:
              "Only an organization owner or admin in a dashboard session can do this.",
          },
        },
        { status: 403 },
      ),
    );
    const result = await run(KeysListCommand, []);
    expect(new URL((requests[0] as Request).url).search).toBe("?kind=org_key");
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("dashboard session");
  });

  it("rotates with an overlap and revokes through the inventory", async () => {
    const requests = useServer((request) =>
      new URL(request.url).pathname.endsWith("/rotate")
        ? Response.json({
            success: true,
            data: {
              id: "k2",
              key: "prim_new_secret",
              key_prefix: "prim_new",
              previous_key_id: KEY_ID,
              previous_key_expires_at: "2026-10-02T00:00:00.000Z",
            },
          })
        : Response.json({
            success: true,
            data: { revoked: 1, kind: "org_key", id: KEY_ID },
          }),
    );
    const rotated = await run(KeysRotateCommand, [
      KEY_ID,
      "--overlap",
      "1h",
      "--step-up",
      "pstep_x",
    ]);
    expect(rotated.stdout).toBe("prim_new_secret\n");
    expect(await (requests[0] as Request).json()).toEqual({
      overlap_seconds: 3600,
    });
    const revoked = await run(KeysRevokeCommand, [
      KEY_ID,
      "--reason",
      "leaked",
    ]);
    expect(revoked.stdout).toBe(`Revoked key ${KEY_ID}.\n`);
    expect(await (requests[1] as Request).json()).toEqual({
      id: KEY_ID,
      kind: "org_key",
      reason: "leaked",
    });
    const bad = await run(KeysRotateCommand, ["not-a-uuid"]);
    expect(String((bad.error as Error).message)).toContain("must be a UUID");
    const badOverlap = await run(KeysRotateCommand, [
      KEY_ID,
      "--overlap",
      "30d",
    ]);
    expect(String((badOverlap.error as Error).message)).toContain("up to 7d");
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
            key: "owner",
            kind: "builtin",
            name: "Owner",
            permissions: ["a:b"],
            version: 1,
          },
          {
            id: "r2",
            key: "custom_1",
            kind: "custom",
            name: "Support",
            permissions: [],
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
