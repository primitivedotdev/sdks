import { describe, expect, expectTypeOf, it, vi } from "vitest";
import {
  BUILTIN_ROLE_KEYS,
  type BuiltinRoleKey,
  createPrimitiveApiError,
  GrantForbiddenError,
  GrantSpec,
  isGrantForbiddenError,
  OPERATION_PERMISSIONS,
  PERMISSIONS,
  type Permission,
  PrimitiveApiError,
  PrimitiveClient,
} from "../../src/api/index.js";

const credential = ["fixture", "credential"].join("-");

const grantForbiddenBody = {
  success: false,
  error: {
    code: "grant_forbidden",
    message:
      "This credential's grant does not allow this operation (mail:send: permission_missing).",
    details: {
      permission: "mail:send",
      credential_kind: "org_key",
      credential_grant_id: "6a2b8f8e-4b6f-4c1e-9d55-0f2b8e7f6a11",
      catalog_version: "c1",
      reason: "permission_missing",
      resource: { type: "domain", id: "d1" },
    },
  },
};

function clientReturning(status: number, body: unknown) {
  const requests: Request[] = [];
  const fetcher = vi.fn<typeof fetch>(async (input) => {
    requests.push(input as Request);
    return Response.json(body, { status });
  });
  return {
    client: new PrimitiveClient({ apiKey: credential, fetch: fetcher }),
    requests,
  };
}

describe("GrantForbiddenError", () => {
  it("is thrown, with typed details, for a 403 grant_forbidden", async () => {
    const { client } = clientReturning(403, grantForbiddenBody);
    const error = await client.account.get().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(GrantForbiddenError);
    expect(error).toBeInstanceOf(PrimitiveApiError);
    expect(isGrantForbiddenError(error)).toBe(true);
    const refused = error as GrantForbiddenError;
    expect(refused.status).toBe(403);
    expect(refused.code).toBe("grant_forbidden");
    expect(refused.permission).toBe("mail:send");
    expect(refused.reason).toBe("permission_missing");
    expect(refused.grant).toEqual({
      permission: "mail:send",
      credential_kind: "org_key",
      credential_grant_id: "6a2b8f8e-4b6f-4c1e-9d55-0f2b8e7f6a11",
      catalog_version: "c1",
      reason: "permission_missing",
      resource: { type: "domain", id: "d1" },
    });
    expect(refused.name).toBe("GrantForbiddenError");
  });

  it("keeps every other refusal a plain PrimitiveApiError", async () => {
    const { client } = clientReturning(403, {
      success: false,
      error: { code: "forbidden", message: "Insufficient permissions" },
    });
    const error = await client.account.get().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(PrimitiveApiError);
    expect(error).not.toBeInstanceOf(GrantForbiddenError);
    expect(isGrantForbiddenError(error)).toBe(false);
  });

  it("tolerates missing or malformed details", () => {
    const error = createPrimitiveApiError("refused", {
      payload: {},
      code: "grant_forbidden",
      status: 403,
      details: undefined,
    });
    expect(error).toBeInstanceOf(GrantForbiddenError);
    expect((error as GrantForbiddenError).grant).toEqual({
      permission: "",
      credential_kind: "",
      catalog_version: "",
      reason: "",
    });
  });
});

describe("Permission and OPERATION_PERMISSIONS", () => {
  it("come from the spec's x-primitive-permission", () => {
    expect(PERMISSIONS).toContain("mail:send");
    expect(PERMISSIONS).toContain("keys:manage");
    expect([...PERMISSIONS].sort()).toEqual([...PERMISSIONS]);
    expect(OPERATION_PERMISSIONS.sendEmail).toEqual(["mail:send"]);
    expect(OPERATION_PERMISSIONS.createKey).toEqual(["keys:manage"]);
    for (const required of Object.values(OPERATION_PERMISSIONS)) {
      for (const permission of required) {
        expect(PERMISSIONS).toContain(permission);
      }
    }
    expectTypeOf<"mail:send">().toMatchTypeOf<Permission>();
  });
});

describe("BUILTIN_ROLE_KEYS", () => {
  it("come from the spec's BuiltinRoleKey and include operator", () => {
    expect(BUILTIN_ROLE_KEYS).toEqual(["owner", "admin", "operator", "member"]);
    expectTypeOf<"operator">().toMatchTypeOf<BuiltinRoleKey>();
    expectTypeOf<
      (typeof BUILTIN_ROLE_KEYS)[number]
    >().toEqualTypeOf<BuiltinRoleKey>();
  });
});

describe("GrantSpec", () => {
  it("sends a bare preset as its name", () => {
    expect(GrantSpec.preset("send_only").build()).toBe("send_only");
  });

  it("builds a custom grant", () => {
    expect(
      GrantSpec.custom()
        .allow("mail:read", "mail:send", "mail:read")
        .addresses("support@example.com")
        .domains("example.com")
        .resources("function", "f1", "f2")
        .matrix("functions", "read")
        .build(),
    ).toEqual({
      preset: "custom",
      permissions: ["mail:read", "mail:send"],
      addresses: ["support@example.com"],
      domains: ["example.com"],
      resources: { function: ["f1", "f2"] },
      matrix: { functions: "read" },
    });
  });

  it("narrows a preset to addresses", () => {
    expect(
      JSON.parse(
        JSON.stringify({
          grant: GrantSpec.preset("own_addresses").addresses("a@example.com"),
        }),
      ),
    ).toEqual({
      grant: { preset: "own_addresses", addresses: ["a@example.com"] },
    });
  });

  it("refuses an empty custom grant and malformed permissions", () => {
    expect(() => GrantSpec.custom().build()).toThrow(TypeError);
    expect(() => GrantSpec.custom().allowUnchecked("not a permission")).toThrow(
      TypeError,
    );
    expect(
      GrantSpec.custom().allowUnchecked("future_area:read").build(),
    ).toEqual({ preset: "custom", permissions: ["future_area:read"] });
    expect(GrantSpec.isPermission("mail:send")).toBe(true);
    expect(GrantSpec.isPermission("nope:never")).toBe(false);
  });
});

describe("keys, credentials, roles and whoami", () => {
  it("creates a key with a step-up token and a typed grant", async () => {
    const { client, requests } = clientReturning(201, {
      success: true,
      data: {
        id: "k1",
        name: "ci",
        key: "prim_secret",
        key_prefix: "prim_sec",
        grant: {
          template: null,
          credential_grant_id: "g1",
          permissions: ["mail:send"],
          mail_scope: "org",
          resources: null,
        },
        expires_at: "2026-12-01T00:00:00.000Z",
        conditions: null,
        warnings: [],
      },
    });
    const created = await client.keys.create(
      {
        name: "ci",
        grant: GrantSpec.custom().allow("mail:send").build(),
        expires_in_days: 30,
        conditions: { ip_allowlist: ["10.0.0.0/8"] },
      },
      { stepUp: "pstep_abc" },
    );
    expect(created.key).toBe("prim_secret");
    const request = requests[0];
    expect(request.method).toBe("POST");
    expect(new URL(request.url).pathname).toBe("/v1/keys");
    expect(request.headers.get("primitive-step-up")).toBe("pstep_abc");
    expect(await request.json()).toEqual({
      name: "ci",
      grant: { preset: "custom", permissions: ["mail:send"] },
      expires_in_days: 30,
      conditions: { ip_allowlist: ["10.0.0.0/8"] },
    });
  });

  it("rotates a key with an overlap", async () => {
    const { client, requests } = clientReturning(200, {
      success: true,
      data: {
        id: "k2",
        key: "prim_new",
        key_prefix: "prim_new",
        previous_key_id: "k1",
        previous_key_expires_at: "2026-11-01T00:00:00.000Z",
      },
    });
    const rotated = await client.keys.rotate("k1", { overlapSeconds: 0 });
    expect(rotated.previous_key_id).toBe("k1");
    expect(new URL(requests[0].url).pathname).toBe("/v1/keys/k1/rotate");
    expect(requests[0].headers.get("primitive-step-up")).toBeNull();
    expect(await requests[0].json()).toEqual({ overlap_seconds: 0 });
  });

  it("lists and revokes credentials, and reads events", async () => {
    const list = clientReturning(200, {
      success: true,
      data: { items: [], counts: { org_key: 0 } },
    });
    await list.client.credentials.list({ kind: "org_key" });
    expect(new URL(list.requests[0].url).search).toBe("?kind=org_key");

    const revoke = clientReturning(200, {
      success: true,
      data: { revoked: 1, kind: "org_key", id: "k1" },
    });
    expect(
      await revoke.client.credentials.revoke({ kind: "org_key", id: "k1" }),
    ).toEqual({ revoked: 1, kind: "org_key", id: "k1" });
    expect(await revoke.requests[0].json()).toEqual({
      kind: "org_key",
      id: "k1",
    });

    const events = clientReturning(200, {
      success: true,
      data: { items: [], next_cursor: null },
    });
    await events.client.credentials.events({ limit: 5, cursor: "c" });
    const url = new URL(events.requests[0].url);
    expect(url.pathname).toBe("/v1/credential-events");
    expect(url.searchParams.get("limit")).toBe("5");
    expect(url.searchParams.get("cursor")).toBe("c");
  });

  it("reads roles", async () => {
    const roles = clientReturning(200, {
      success: true,
      data: {
        roles: [
          {
            id: "r-operator",
            key: "operator",
            kind: "builtin",
            name: "Operator",
            permissions: ["mail:send"],
            version: 1,
          },
          {
            id: "r-other",
            key: "restricted",
            kind: "builtin",
            name: "Restricted",
            permissions: [],
            version: 1,
          },
        ],
        templates: [],
        assignment: { available: false, reason: "flag_off" },
      },
    });
    const result = await roles.client.roles.list();
    expect(result.assignment.available).toBe(false);
    expect(result.roles.map((role) => role.key)).toEqual([
      "operator",
      "restricted",
    ]);
    expect(BUILTIN_ROLE_KEYS).toContain(result.roles[0]?.key);
    expect(BUILTIN_ROLE_KEYS).not.toContain(result.roles[1]?.key);
    expect(new URL(roles.requests[0].url).pathname).toBe("/v1/roles");
  });

  it("asks whoami for the grant and for a permission check", async () => {
    const identity = {
      org_id: "o",
      user_id: "u",
      role: "owner",
      request_id: "r",
      auth_method: "oauth",
      key_id: null,
      member_address: null,
      member_address_suggestion: null,
    };
    const withGrant = clientReturning(200, {
      success: true,
      data: {
        ...identity,
        grant: {
          credential_kind: "oauth",
          permissions: ["mail:read"],
          catalog_version: "c1",
        },
      },
    });
    const who = await withGrant.client.account.whoami({ grant: true });
    expect(who.grant?.permissions).toEqual(["mail:read"]);
    expect(new URL(withGrant.requests[0].url).search).toBe("?include=grant");

    const check = clientReturning(200, {
      success: true,
      data: {
        ...identity,
        check: {
          permission: "mail:send",
          allow: false,
          reason: "permission_missing",
        },
      },
    });
    expect(
      await check.client.account.checkPermission("mail:send", {
        resource: "domain:d1",
      }),
    ).toEqual({
      permission: "mail:send",
      allow: false,
      reason: "permission_missing",
    });
    const url = new URL(check.requests[0].url);
    expect(url.searchParams.get("check")).toBe("mail:send");
    expect(url.searchParams.get("resource")).toBe("domain:d1");

    // A server without permission checks answers the plain identity.
    const old = clientReturning(200, { success: true, data: identity });
    expect(await old.client.account.checkPermission("mail:send")).toBeNull();
  });
});
