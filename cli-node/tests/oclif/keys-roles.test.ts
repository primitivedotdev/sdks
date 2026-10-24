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
  cliOperationManifest,
  DASHBOARD_ONLY_OPERATION_IDS,
} from "../../src/oclif/cli-operations.js";
import {
  formatKeyRows,
  KeysListCommand,
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

describe("keys helpers", () => {
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
      "keys:list",
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

  it("offer no way to create, rotate, update or revoke a key", () => {
    for (const id of [
      "keys:create",
      "keys:rotate",
      "keys:revoke",
      "keys:update",
      ...DASHBOARD_ONLY_OPERATION_IDS,
    ]) {
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
    ).toEqual(["keys:get-key-builder", "keys:list"]);
    const list = COMMANDS["keys:list"] as unknown as { description: string };
    expect(list.description).toContain(
      "API keys are created, rotated and revoked in the dashboard.",
    );
    expect(list.description).toContain("never a secret");
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
            id: "r3",
            key: "operator",
            kind: "builtin",
            name: "Operator",
            permissions: ["a:b", "c:d"],
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
