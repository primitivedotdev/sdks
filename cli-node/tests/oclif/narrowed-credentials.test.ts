import { PrimitiveApiClient } from "@primitivedotdev/api-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { checkAccount } from "../../src/oclif/commands/doctor.js";
import { pickDefaultFromAddress } from "../../src/oclif/outbound-defaults.js";

const ACCOUNT_ID = "11111111-1111-4111-8111-111111111111";

function clientAnswering(
  answer: (path: string) => Response,
): PrimitiveApiClient {
  return new PrimitiveApiClient({
    apiKey: ["prim", "test"].join("_"),
    apiBaseUrl: "https://api.example.test/v1",
    fetch: (async (input: Request | string | URL) =>
      answer(
        new URL(input instanceof Request ? input.url : input).pathname,
      )) as typeof fetch,
  });
}

function refusal(code = "grant_forbidden"): Response {
  return Response.json(
    { success: false, error: { code, message: "Not allowed" } },
    { status: 403 },
  );
}

function grantWithScope(scope: unknown): Response {
  return Response.json({
    success: true,
    data: {
      org_id: ACCOUNT_ID,
      auth_method: "user_grant",
      key_id: null,
      grant: {
        credential_kind: "cli_user_access",
        template: null,
        permissions: ["mail:send"],
        mail_scope: scope,
        resources: null,
        expires_at: null,
      },
    },
  });
}

const authContext = {
  auth: { apiKey: ["prim", "test"].join("_") },
  baseUrlOverridden: false,
  configDir: "/nonexistent",
} as never;

function scope(addresses: string[], direction?: string) {
  return { addresses, domains: [], depth: "raw", direction };
}

describe("pickDefaultFromAddress with a narrowed grant", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses the single address the grant names", async () => {
    const client = clientAnswering((path) =>
      path.endsWith("/whoami/grant")
        ? grantWithScope(scope(["me@example.test"]))
        : refusal(),
    );

    await expect(pickDefaultFromAddress(client, authContext)).resolves.toBe(
      "me@example.test",
    );
  });

  it.each([
    ["several addresses", scope(["a@example.test", "b@example.test"])],
    ["no addresses", scope([])],
    ["an inbound-only scope", scope(["me@example.test"], "inbound")],
    ["the whole organization", "org"],
  ])("asks for --from when the grant has %s", async (_case, grantScope) => {
    const client = clientAnswering((path) =>
      path.endsWith("/whoami/grant") ? grantWithScope(grantScope) : refusal(),
    );

    await expect(pickDefaultFromAddress(client, authContext)).rejects.toThrow(
      "Pass --from explicitly",
    );
  });

  it("keeps the generic error for a failure that is not a refusal", async () => {
    const client = clientAnswering(() =>
      Response.json(
        { success: false, error: { code: "internal_error", message: "boom" } },
        { status: 500 },
      ),
    );

    await expect(pickDefaultFromAddress(client, authContext)).rejects.toThrow(
      "Could not look up your verified domains",
    );
  });
});

describe("doctor checkAccount", () => {
  it("does not print null when the credential may not see the email", async () => {
    const { outcome } = await checkAccount(
      clientAnswering(() =>
        Response.json({
          success: true,
          data: { id: ACCOUNT_ID, email: null, plan: "pro" },
        }),
      ),
    );

    expect(outcome.status).toBe("ok");
    expect(outcome.message).not.toContain("null");
  });

  it("warns instead of reporting a rejected key on a grant refusal", async () => {
    const { outcome } = await checkAccount(clientAnswering(() => refusal()));

    expect(outcome.status).toBe("warn");
    expect(outcome.message).toContain("cannot read the account");
  });
});
