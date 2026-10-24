import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { getAccount } from "@primitivedotdev/api-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createAuthenticatedCliApiClient,
  refuseOrgSelectionForProfile,
} from "../../src/oclif/api-client.js";
import {
  acquireCliCredentialsLock,
  credentialsPath,
  loadCliCredentials,
  type StoredCliCredentials,
  saveCliCredentials,
} from "../../src/oclif/auth.js";
import LoginCommand, {
  isUserLoginResult,
  requestedGrantFromPermissions,
  startLoginWithFallback,
} from "../../src/oclif/commands/login.js";
import { runLogoutWithCredentialLock } from "../../src/oclif/commands/logout.js";
import {
  formatOrgRows,
  OrgsCommand,
  OrgUseCommand,
} from "../../src/oclif/commands/orgs.js";
import WhoamiCommand from "../../src/oclif/commands/whoami.js";
import {
  CliOrgRefusedError,
  credentialsFromUserLogin,
  ensureUserGrantSession,
  matchOrg,
  switchCurrentOrg,
} from "../../src/oclif/user-grant.js";

const CLI_ROOT = resolve(import.meta.dirname, "../..");

const OWNER_ORG = "11111111-1111-4111-8111-111111111111";
const MEMBER_ORG = "22222222-2222-4222-8222-222222222222";
const OFF_ORG = "33333333-3333-4333-8333-333333333333";
const DEFAULT_POLICY_ORG = "44444444-4444-4444-8444-444444444444";
const REVOKED_ORG = "55555555-5555-4555-8555-555555555555";
const STRANGER_ORG = "66666666-6666-4666-8666-666666666666";
const USER_ID = "77777777-7777-4777-8777-777777777777";
const GRANT_ID = "88888888-8888-4888-8888-888888888888";

type OrgSpec = {
  name: string;
  role: string;
  refusal: string | null;
};

const ORGS: Record<string, OrgSpec> = {
  [OWNER_ORG]: { name: "Acme", role: "owner", refusal: null },
  [MEMBER_ORG]: { name: "Beta", role: "member", refusal: null },
  [OFF_ORG]: {
    name: "Closed",
    role: "admin",
    refusal: "cli_access_disabled_by_org",
  },
  [DEFAULT_POLICY_ORG]: {
    name: "Default",
    role: "member",
    refusal: "role_insufficient",
  },
  [REVOKED_ORG]: { name: "Gone", role: "admin", refusal: "cli_access_revoked" },
};

const REFUSAL_MESSAGES: Record<string, string> = {
  not_a_member: "You are not a member of this organization.",
  cli_access_disabled_by_org: "This organization does not allow CLI access.",
  role_insufficient:
    "Your role in this organization does not allow CLI access.",
  cli_access_revoked: "Your CLI access to this organization was revoked.",
};

/**
 * A mock Primitive API: the login, the user grant refresh, the org list, the
 * token exchange and two org routes. `userGrants: false` behaves like a
 * released server without CLI user logins.
 */
class MockPrimitive {
  server!: Server;
  base = "";
  userGrants = true;
  requestedGrantAccepted = false;
  revokeEmpty = false;
  /** Live per-org access tokens: token to org id. */
  orgTokens = new Map<string, string>();
  identityToken = "prim_uat_1";
  refreshToken = "prim_urt_1";
  refreshCount = 0;
  exchangeCount = 0;
  revoked: string[] = [];
  loginStarts: Array<Record<string, unknown>> = [];
  lastStepUp: string | null = null;
  requests: string[] = [];
  private tokenSeq = 0;

  async start(): Promise<void> {
    this.server = createServer((req, res) => {
      void this.handle(req, res);
    });
    await new Promise<void>((done) =>
      this.server.listen(0, "127.0.0.1", () => done()),
    );
    const { port } = this.server.address() as AddressInfo;
    this.base = `http://127.0.0.1:${port}/v1`;
  }

  async stop(): Promise<void> {
    await new Promise<void>((done) => this.server.close(() => done()));
  }

  issueOrgToken(orgId: string): string {
    this.tokenSeq += 1;
    const token = `prim_oat_${orgId.slice(0, 4)}_${this.tokenSeq}`;
    this.orgTokens.set(token, orgId);
    return token;
  }

  /** Kill every live token for `orgId`, as a demotion or a revoke would. */
  killOrgTokens(orgId: string): void {
    for (const [token, org] of this.orgTokens) {
      if (org === orgId) this.orgTokens.delete(token);
    }
  }

  private async body(req: IncomingMessage): Promise<string> {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    return Buffer.concat(chunks).toString("utf8");
  }

  private json(res: ServerResponse, status: number, body: unknown): void {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  }

  private bearer(req: IncomingMessage): string {
    return /^Bearer\s+(\S+)$/i.exec(req.headers.authorization ?? "")?.[1] ?? "";
  }

  private async handle(req: IncomingMessage, res: ServerResponse) {
    const url = new URL(req.url ?? "/", "http://mock");
    this.requests.push(`${req.method} ${url.pathname}`);
    const text = await this.body(req);
    if (req.method === "POST" && url.pathname === "/v1/cli/login/start") {
      const body = JSON.parse(text || "{}") as Record<string, unknown>;
      this.loginStarts.push(body);
      const allowed = new Set(["device_name", "metadata"]);
      if (this.userGrants) allowed.add("login_kind");
      if (this.requestedGrantAccepted) allowed.add("requested_grant");
      const unknown = Object.keys(body).find((key) => !allowed.has(key));
      if (unknown) {
        return this.json(res, 400, {
          success: false,
          error: {
            code: "validation_error",
            message: `Unrecognized key: "${unknown}"`,
          },
        });
      }
      if (
        body.requested_grant !== undefined &&
        body.requested_grant !== "primitive:api"
      ) {
        return this.json(res, 400, {
          success: false,
          error: {
            code: "grant_not_available",
            message:
              "requested_grant must be omitted or primitive:api; narrower CLI grants are not available yet",
          },
        });
      }
      return this.json(res, 201, {
        success: true,
        data: {
          device_code: body.login_kind === "user" ? "dev-user" : "dev-org",
          user_code: "BCDF-GHJK",
          verification_uri: "https://example.test/cli",
          verification_uri_complete: "https://example.test/cli?code=BCDF-GHJK",
          expires_in: 60,
          interval: 1,
        },
      });
    }
    if (req.method === "POST" && url.pathname === "/v1/cli/login/poll") {
      const body = JSON.parse(text) as { device_code: string };
      if (body.device_code === "dev-user") {
        return this.json(res, 200, {
          success: true,
          data: {
            auth_method: "user_grant",
            user_grant_id: GRANT_ID,
            user_id: USER_ID,
            access_token: this.identityToken,
            refresh_token: this.refreshToken,
            token_type: "Bearer",
            expires_in: 3600,
            oauth_client_id: "primitive-cli",
            org: {
              access_token: this.issueOrgToken(OWNER_ORG),
              token_type: "Bearer",
              expires_in: 900,
              scope: "primitive:api",
              org_id: OWNER_ORG,
              org_name: "Acme",
              role: "owner",
              oauth_grant_id: "99999999-9999-4999-8999-999999999991",
            },
            org_refusal: null,
          },
        });
      }
      return this.json(res, 200, {
        success: true,
        data: {
          api_key: "prim_oat_orgbound",
          key_id: "99999999-9999-4999-8999-999999999999",
          key_prefix: "prim_oat_org",
          access_token: "prim_oat_orgbound",
          refresh_token: "prim_ort_orgbound",
          token_type: "Bearer",
          expires_in: 3600,
          auth_method: "oauth",
          oauth_grant_id: "99999999-9999-4999-8999-999999999999",
          oauth_client_id: "primitive-cli",
          org_id: OWNER_ORG,
          org_name: "Acme",
        },
      });
    }
    if (req.method === "POST" && url.pathname === "/oauth/token") {
      const form = new URLSearchParams(text);
      const grantType = form.get("grant_type");
      if (grantType === "refresh_token") {
        if (form.get("refresh_token") !== this.refreshToken) {
          return this.json(res, 400, { error: "invalid_grant" });
        }
        this.refreshCount += 1;
        this.identityToken = `prim_uat_${this.refreshCount + 1}`;
        this.refreshToken = `prim_urt_${this.refreshCount + 1}`;
        return this.json(res, 200, {
          access_token: this.identityToken,
          refresh_token: this.refreshToken,
          token_type: "Bearer",
          expires_in: 3600,
          scope: "primitive:api",
        });
      }
      if (grantType === "urn:ietf:params:oauth:grant-type:token-exchange") {
        if (!this.userGrants) {
          return this.json(res, 400, {
            error: "unsupported_grant_type",
            error_description:
              "Only authorization_code and refresh_token grants are supported",
          });
        }
        this.exchangeCount += 1;
        if (form.get("subject_token") !== this.identityToken) {
          return this.json(res, 400, {
            error: "invalid_grant",
            error_description:
              "subject_token is not a live CLI user grant token",
          });
        }
        const orgId = form.get("org") ?? "";
        const spec = ORGS[orgId];
        const reason = spec ? spec.refusal : "not_a_member";
        if (reason) {
          return this.json(res, 403, {
            error: "access_denied",
            error_description: REFUSAL_MESSAGES[reason],
            reason,
          });
        }
        return this.json(res, 200, {
          access_token: this.issueOrgToken(orgId),
          issued_token_type: "urn:ietf:params:oauth:token-type:access_token",
          token_type: "Bearer",
          expires_in: 900,
          scope: "primitive:api",
          org_id: orgId,
          org_name: spec?.name ?? null,
          role: spec?.role ?? "member",
          oauth_grant_id: `99999999-9999-4999-8999-99999999999${orgId[0]}`,
        });
      }
      return this.json(res, 400, { error: "unsupported_grant_type" });
    }
    if (req.method === "POST" && url.pathname === "/oauth/revoke") {
      this.revoked.push(new URLSearchParams(text).get("token") ?? "");
      this.orgTokens.clear();
      if (this.revokeEmpty) {
        res.writeHead(200);
        res.end();
        return;
      }
      return this.json(res, 200, {});
    }
    if (req.method === "GET" && url.pathname === "/v1/cli/orgs") {
      if (!this.userGrants) {
        return this.json(res, 404, {
          success: false,
          error: {
            code: "feature_disabled",
            message: "CLI user grants are not available",
          },
        });
      }
      if (this.bearer(req) !== this.identityToken) {
        return this.json(res, 401, {
          success: false,
          error: { code: "unauthorized", message: "Unauthorized" },
        });
      }
      return this.json(res, 200, {
        success: true,
        data: {
          user: { id: USER_ID, email: "person@example.test" },
          user_grant_id: GRANT_ID,
          orgs: Object.entries(ORGS).map(([id, spec]) => ({
            id,
            name: spec.name,
            role: spec.role,
            available: spec.refusal === null,
            reason: spec.refusal,
            message: spec.refusal ? REFUSAL_MESSAGES[spec.refusal] : null,
          })),
        },
      });
    }
    const orgId = this.orgTokens.get(this.bearer(req));
    if (!orgId) {
      return this.json(res, 401, {
        success: false,
        error: { code: "unauthorized", message: "Unauthorized" },
      });
    }
    if (req.method === "GET" && url.pathname === "/v1/account") {
      return this.json(res, 200, {
        success: true,
        data: {
          id: orgId,
          email: "person@example.test",
          plan: "developer",
        },
      });
    }
    if (req.method === "GET" && url.pathname === "/v1/whoami") {
      const check = url.searchParams.get("check");
      return this.json(res, 200, {
        success: true,
        data: {
          org_id: orgId,
          user_id: USER_ID,
          role: ORGS[orgId]?.role ?? "member",
          request_id: "req",
          auth_method: "oauth",
          key_id: null,
          member_address: null,
          member_address_suggestion: null,
          ...(url.searchParams.get("include") === "grant"
            ? {
                grant: {
                  credential_kind: "oauth",
                  grant_type: "computed",
                  template: null,
                  permissions: ["mail:read", "mail:send"],
                  mail_scope: "org",
                  catalog_version: "c1",
                  expires_at: null,
                },
              }
            : {}),
          ...(check
            ? {
                check:
                  check === "mail:send"
                    ? { permission: check, allow: true }
                    : {
                        permission: check,
                        allow: false,
                        reason: "permission_missing",
                      },
              }
            : {}),
        },
      });
    }
    if (req.method === "POST" && url.pathname === "/v1/keys") {
      this.lastStepUp = (req.headers["primitive-step-up"] as string) ?? null;
      if (!this.lastStepUp) {
        return this.json(res, 403, {
          success: false,
          error: {
            code: "step_up_required",
            message:
              "Creating a key needs the person to confirm in the dashboard.",
            details: {
              purpose: "keys.create",
              step_up_url: "https://example.test/app/settings/step-up",
            },
          },
        });
      }
      return this.json(res, 201, {
        success: true,
        data: {
          id: "k1",
          name: "ci",
          key: "prim_secret_once",
          key_prefix: "prim_sec",
          grant: {
            template: "send_only",
            credential_grant_id: null,
            permissions: null,
            mail_scope: "org",
            resources: null,
          },
          expires_at: "2026-12-01T00:00:00.000Z",
          conditions: null,
          warnings: [],
        },
      });
    }
    return this.json(res, 404, {
      success: false,
      error: { code: "not_found", message: `${req.method} ${url.pathname}` },
    });
  }
}

function userLogin(mock: MockPrimitive, orgToken: string | null) {
  return credentialsFromUserLogin({
    apiBaseUrl: mock.base,
    login: {
      access_token: mock.identityToken,
      expires_in: 3600,
      oauth_client_id: "primitive-cli",
      org: orgToken
        ? {
            access_token: orgToken,
            token_type: "Bearer",
            expires_in: 900,
            org_id: OWNER_ORG,
            org_name: "Acme",
            role: "owner",
            oauth_grant_id: "99999999-9999-4999-8999-999999999991",
          }
        : null,
      refresh_token: mock.refreshToken,
      user_grant_id: GRANT_ID,
      user_id: USER_ID,
    },
  });
}

async function capture(fn: () => Promise<unknown>) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const previousExitCode = process.exitCode;
  process.exitCode = undefined;
  const logSpy = vi.spyOn(console, "log").mockImplementation((line = "") => {
    stdout.push(`${String(line)}\n`);
  });
  const errSpy = vi
    .spyOn(process.stderr, "write")
    .mockImplementation((chunk) => {
      stderr.push(String(chunk));
      return true;
    });
  let error: unknown = null;
  try {
    await fn();
  } catch (caught) {
    error = caught;
  } finally {
    logSpy.mockRestore();
    errSpy.mockRestore();
  }
  const exitCode = process.exitCode;
  process.exitCode = previousExitCode;
  return {
    error,
    exitCode,
    stderr: stderr.join(""),
    stdout: stdout.join(""),
  };
}

describe("CLI login as the person, against a mock server", () => {
  let mock: MockPrimitive;
  let configDir: string;

  beforeEach(async () => {
    mock = new MockPrimitive();
    await mock.start();
    configDir = mkdtempSync(join(tmpdir(), "primitive-user-grant-"));
    vi.stubEnv("PRIMITIVE_CONFIG_DIR", configDir);
    vi.stubEnv("PRIMITIVE_AGENT_PROFILE", "");
    vi.stubEnv("PRIMITIVE_CLI_ORG", "");
    vi.stubEnv("PRIMITIVE_API_KEY", "");
    vi.stubEnv("PRIMITIVE_API_BASE_URL", "");
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await mock.stop();
    rmSync(configDir, { force: true, recursive: true });
  });

  describe("login start", () => {
    it("asks for a user login and keeps it when the server supports it", async () => {
      const started = await startLoginWithFallback({
        deviceName: "laptop",
        requestedGrant: null,
        start: async (body) => {
          const response = await fetch(`${mock.base}/cli/login/start`, {
            body: JSON.stringify(body),
            headers: { "content-type": "application/json" },
            method: "POST",
          });
          const json = await response.json();
          return response.ok ? { data: json } : { error: json };
        },
      });
      expect(started.loginKind).toBe("user");
      expect(mock.loginStarts).toEqual([
        { device_name: "laptop", login_kind: "user" },
      ]);
    });

    it("falls back to the org-bound login when the server refuses login_kind", async () => {
      mock.userGrants = false;
      const started = await startLoginWithFallback({
        deviceName: "laptop",
        requestedGrant: null,
        start: async (body) => {
          const response = await fetch(`${mock.base}/cli/login/start`, {
            body: JSON.stringify(body),
            headers: { "content-type": "application/json" },
            method: "POST",
          });
          const json = await response.json();
          return response.ok ? { data: json } : { error: json };
        },
      });
      expect(started.loginKind).toBe("org");
      expect(mock.loginStarts).toEqual([
        { device_name: "laptop", login_kind: "user" },
        { device_name: "laptop" },
      ]);
    });

    it("never widens a --permission login: refusals stop the login", async () => {
      const start = async (body: unknown) => {
        const response = await fetch(`${mock.base}/cli/login/start`, {
          body: JSON.stringify(body),
          headers: { "content-type": "application/json" },
          method: "POST",
        });
        const json = await response.json();
        return response.ok ? { data: json } : { error: json };
      };
      const errSpy = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);
      try {
        // A server that knows requested_grant but not narrower grants.
        mock.requestedGrantAccepted = true;
        await expect(
          startLoginWithFallback({
            deviceName: "laptop",
            requestedGrant: "mail:read",
            start,
          }),
        ).rejects.toThrow(/does not offer CLI logins narrowed/);
        // A server that knows neither field.
        mock.requestedGrantAccepted = false;
        mock.userGrants = false;
        await expect(
          startLoginWithFallback({
            deviceName: "laptop",
            requestedGrant: "mail:read",
            start,
          }),
        ).rejects.toThrow(/does not accept --permission/);
      } finally {
        errSpy.mockRestore();
      }
      expect(
        mock.loginStarts.every((body) => body.requested_grant === "mail:read"),
      ).toBe(true);
    });

    it("validates --permission values", () => {
      expect(requestedGrantFromPermissions(undefined)).toBeNull();
      expect(
        requestedGrantFromPermissions(["mail:read", "mail:send,mail:read"]),
      ).toBe("mail:read mail:send");
      expect(() => requestedGrantFromPermissions(["everything"])).toThrow(
        /not a permission/,
      );
    });
  });

  it("logs in as the person end to end and switches with --org after the login", async () => {
    vi.stubEnv("PRIMITIVE_CLI_ORG", "Beta");
    const result = await capture(() =>
      LoginCommand.run(
        [
          "--no-browser",
          "--device-name",
          "laptop",
          "--api-base-url",
          mock.base,
        ],
        { root: CLI_ROOT },
      ),
    );
    expect(result.error).toBeNull();
    expect(result.exitCode).toBeUndefined();
    expect(result.stderr).toContain("Logged in as yourself");
    expect(result.stderr).toContain(
      `Switched to organization ${MEMBER_ORG} (Beta)`,
    );
    const saved = loadCliCredentials(configDir) as StoredCliCredentials;
    expect(saved.auth_method).toBe("user_grant");
    expect(saved.org_id).toBe(MEMBER_ORG);
    expect(saved.user_grant?.user_grant_id).toBe(GRANT_ID);
    // The browser organization's token stays cached for --org.
    expect(Object.keys(saved.user_grant?.org_tokens ?? {})).toEqual([
      OWNER_ORG,
    ]);
    const onDisk = JSON.parse(readFileSync(credentialsPath(configDir), "utf8"));
    expect(onDisk.auth_method).toBe("user_grant");
  }, 15_000);

  it("saves today's org-bound login from a server without user logins", async () => {
    mock.userGrants = false;
    const result = await capture(() =>
      LoginCommand.run(
        [
          "--no-browser",
          "--device-name",
          "laptop",
          "--api-base-url",
          mock.base,
        ],
        { root: CLI_ROOT },
      ),
    );
    expect(result.error).toBeNull();
    const saved = loadCliCredentials(configDir) as StoredCliCredentials;
    expect(saved.auth_method).toBe("oauth");
    expect(saved.user_grant).toBeUndefined();
    expect(
      Object.keys(
        JSON.parse(readFileSync(credentialsPath(configDir), "utf8")),
      ).sort(),
    ).toEqual([
      "access_token",
      "api_base_url",
      "auth_method",
      "created_at",
      "expires_at",
      "oauth_client_id",
      "oauth_grant_id",
      "org_id",
      "org_name",
      "refresh_token",
      "token_type",
    ]);
  }, 15_000);

  it("round-trips a saved user login and refuses a malformed one", () => {
    const credentials = userLogin(mock, null);
    saveCliCredentials(configDir, credentials);
    expect(loadCliCredentials(configDir)).toEqual(credentials);
    const broken = {
      ...credentials,
      user_grant: { access_token: "prim_uat_x" },
    };
    writeFileSync(credentialsPath(configDir), JSON.stringify(broken));
    expect(() => loadCliCredentials(configDir)).toThrow(
      /malformed: expires_at must be a non-empty string/,
    );
    writeFileSync(
      credentialsPath(configDir),
      JSON.stringify({ ...credentials, user_grant: null }),
    );
    expect(() => loadCliCredentials(configDir)).toThrow(
      /user_grant must be an object/,
    );
  });

  it("recognizes the user login poll shape", () => {
    expect(isUserLoginResult({ auth_method: "user_grant" })).toBe(true);
    expect(isUserLoginResult({ auth_method: "oauth" })).toBe(false);
    expect(isUserLoginResult(null)).toBe(false);
  });

  it("exchanges for the current organization when its token has expired", async () => {
    const credentials = userLogin(mock, null);
    credentials.org_id = OWNER_ORG;
    credentials.org_name = "Acme";
    saveCliCredentials(configDir, credentials);
    const { apiClient, auth } = await createAuthenticatedCliApiClient({
      configDir,
    });
    expect(mock.exchangeCount).toBe(1);
    expect(auth.credentials?.org_id).toBe(OWNER_ORG);
    const account = await getAccount({
      client: apiClient.client,
      responseStyle: "fields",
    });
    expect(account.error).toBeUndefined();
  });

  it("re-exchanges once on a 401 and retries the request", async () => {
    const token = mock.issueOrgToken(OWNER_ORG);
    saveCliCredentials(configDir, userLogin(mock, token));
    const { apiClient } = await createAuthenticatedCliApiClient({ configDir });
    expect(mock.exchangeCount).toBe(0);
    // A demotion, a policy change or a revoke: the live token stops working.
    mock.killOrgTokens(OWNER_ORG);
    const [first, second] = await Promise.all([
      getAccount({ client: apiClient.client, responseStyle: "fields" }),
      getAccount({ client: apiClient.client, responseStyle: "fields" }),
    ]);
    expect(first.error).toBeUndefined();
    expect(second.error).toBeUndefined();
    expect(mock.exchangeCount).toBe(1);
    const saved = loadCliCredentials(configDir) as StoredCliCredentials;
    expect(saved.access_token).not.toBe(token);
    expect(mock.orgTokens.get(saved.access_token)).toBe(OWNER_ORG);
  });

  it("answers a refused re-exchange with the refusal's reason", async () => {
    const token = mock.issueOrgToken(OWNER_ORG);
    saveCliCredentials(configDir, userLogin(mock, token));
    const { apiClient } = await createAuthenticatedCliApiClient({ configDir });
    mock.killOrgTokens(OWNER_ORG);
    const previous = ORGS[OWNER_ORG].refusal;
    ORGS[OWNER_ORG].refusal = "cli_access_disabled_by_org";
    try {
      const result = await getAccount({
        client: apiClient.client,
        responseStyle: "fields",
      });
      expect(result.response?.status).toBe(403);
      expect(result.error).toMatchObject({
        error: { code: "cli_access_disabled_by_org" },
      });
    } finally {
      ORGS[OWNER_ORG].refusal = previous;
    }
  });

  it("names every refusal reason when switching", async () => {
    saveCliCredentials(
      configDir,
      userLogin(mock, mock.issueOrgToken(OWNER_ORG)),
    );
    for (const [orgId, reason] of [
      [OFF_ORG, "cli_access_disabled_by_org"],
      [DEFAULT_POLICY_ORG, "role_insufficient"],
      [REVOKED_ORG, "cli_access_revoked"],
      [STRANGER_ORG, "not_a_member"],
    ] as const) {
      const error = await switchCurrentOrg({
        apiBaseUrl: mock.base,
        configDir,
        selection: orgId,
      }).catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(CliOrgRefusedError);
      expect((error as CliOrgRefusedError).reason).toBe(reason);
    }
    // A refused switch leaves the current organization alone.
    expect(loadCliCredentials(configDir)?.org_id).toBe(OWNER_ORG);
  });

  it("waits for another command holding the credentials lock, then uses its exchange", async () => {
    const stale = mock.issueOrgToken(OWNER_ORG);
    saveCliCredentials(configDir, userLogin(mock, stale));
    const release = acquireCliCredentialsLock(configDir, {
      installSignalHandlers: false,
    });
    // Another process exchanges while holding the lock, then releases it.
    const fresh = mock.issueOrgToken(OWNER_ORG);
    setTimeout(() => {
      const current = loadCliCredentials(configDir) as StoredCliCredentials;
      saveCliCredentials(configDir, { ...current, access_token: fresh });
      release();
    }, 300);
    const next = await ensureUserGrantSession({
      apiBaseUrl: mock.base,
      configDir,
      credentials: loadCliCredentials(configDir) as StoredCliCredentials,
      forceExchange: true,
      staleToken: stale,
    });
    expect(next.access_token).toBe(fresh);
    expect(mock.exchangeCount).toBe(0);
  });

  it("acts in another organization for one command with --org, by name, and caches its token", async () => {
    saveCliCredentials(
      configDir,
      userLogin(mock, mock.issueOrgToken(OWNER_ORG)),
    );
    vi.stubEnv("PRIMITIVE_CLI_ORG", "beta");
    const first = await createAuthenticatedCliApiClient({ configDir });
    expect(first.auth.credentials?.org_id).toBe(MEMBER_ORG);
    expect(mock.requests).toContain("GET /v1/cli/orgs");
    const second = await createAuthenticatedCliApiClient({ configDir });
    expect(second.auth.credentials?.org_id).toBe(MEMBER_ORG);
    expect(mock.exchangeCount).toBe(1);
    const saved = loadCliCredentials(configDir) as StoredCliCredentials;
    expect(saved.org_id).toBe(OWNER_ORG);
    expect(saved.user_grant?.org_tokens[MEMBER_ORG]?.org_name).toBe("Beta");
  });

  it("refreshes the identity token before exchanging, and saves the rotated refresh token", async () => {
    const credentials = userLogin(mock, null);
    credentials.org_id = OWNER_ORG;
    credentials.user_grant = {
      ...(credentials.user_grant as NonNullable<
        StoredCliCredentials["user_grant"]
      >),
      expires_at: new Date(0).toISOString(),
    };
    saveCliCredentials(configDir, credentials);
    await ensureUserGrantSession({
      apiBaseUrl: mock.base,
      configDir,
      credentials,
    });
    expect(mock.refreshCount).toBe(1);
    const saved = loadCliCredentials(configDir) as StoredCliCredentials;
    expect(saved.refresh_token).toBe(mock.refreshToken);
    expect(saved.user_grant?.access_token).toBe(mock.identityToken);
  });

  it("removes the saved login when the user grant is gone", async () => {
    const credentials = userLogin(mock, null);
    credentials.org_id = OWNER_ORG;
    credentials.refresh_token = "prim_urt_revoked";
    credentials.user_grant = {
      ...(credentials.user_grant as NonNullable<
        StoredCliCredentials["user_grant"]
      >),
      expires_at: new Date(0).toISOString(),
    };
    saveCliCredentials(configDir, credentials);
    await expect(
      ensureUserGrantSession({ apiBaseUrl: mock.base, configDir, credentials }),
    ).rejects.toThrow(/expired or was revoked/);
    expect(loadCliCredentials(configDir)).toBeNull();
  });

  it("explains an older server without organization switching", async () => {
    saveCliCredentials(configDir, userLogin(mock, null));
    mock.userGrants = false;
    await expect(
      switchCurrentOrg({
        apiBaseUrl: mock.base,
        configDir,
        selection: OWNER_ORG,
      }),
    ).rejects.toThrow(/does not support switching organizations/);
    await expect(
      switchCurrentOrg({ apiBaseUrl: mock.base, configDir, selection: "Acme" }),
    ).rejects.toThrow(/does not support switching organizations/);
  });

  it("keeps org-bound logins working and refuses --org for another organization", async () => {
    const orgBound: StoredCliCredentials = {
      access_token: mock.issueOrgToken(OWNER_ORG),
      api_base_url: mock.base,
      auth_method: "oauth",
      created_at: "2026-05-05T00:00:00.000Z",
      expires_at: "2099-05-05T00:00:00.000Z",
      oauth_client_id: "primitive-cli",
      oauth_grant_id: "99999999-9999-4999-8999-999999999999",
      org_id: OWNER_ORG,
      org_name: "Acme",
      refresh_token: "prim_ort_existing",
      token_type: "Bearer",
    };
    saveCliCredentials(configDir, orgBound);
    const plain = await createAuthenticatedCliApiClient({ configDir });
    expect(plain.auth.credentials).toEqual(orgBound);
    vi.stubEnv("PRIMITIVE_CLI_ORG", "acme");
    await expect(
      createAuthenticatedCliApiClient({ configDir }),
    ).resolves.toBeTruthy();
    vi.stubEnv("PRIMITIVE_CLI_ORG", MEMBER_ORG);
    await expect(
      createAuthenticatedCliApiClient({ configDir }),
    ).rejects.toThrow(/bound to organization Acme/);
    expect(mock.exchangeCount).toBe(0);
  });

  it("refuses --org with an API key", async () => {
    vi.stubEnv("PRIMITIVE_CLI_ORG", MEMBER_ORG);
    await expect(
      createAuthenticatedCliApiClient({ apiKey: "prim_key", configDir }),
    ).rejects.toThrow(/An API key belongs to one organization/);
  });

  it("lists organizations and switches with org use", async () => {
    saveCliCredentials(
      configDir,
      userLogin(mock, mock.issueOrgToken(OWNER_ORG)),
    );
    const listed = await capture(() => OrgsCommand.run([], { root: CLI_ROOT }));
    expect(listed.error).toBeNull();
    expect(listed.stdout).toContain(`* Acme (${OWNER_ORG}) owner, available`);
    expect(listed.stdout).toContain(
      `  Closed (${OFF_ORG}) admin, unavailable: This organization does not allow CLI access. [cli_access_disabled_by_org]`,
    );
    const json = await capture(() =>
      OrgsCommand.run(["--json"], { root: CLI_ROOT }),
    );
    expect(JSON.parse(json.stdout).orgs).toHaveLength(Object.keys(ORGS).length);

    const used = await capture(() =>
      OrgUseCommand.run(["Beta"], { root: CLI_ROOT }),
    );
    expect(used.error).toBeNull();
    expect(used.stdout).toContain(
      `Now using Beta (${MEMBER_ORG}), role member.`,
    );
    expect(loadCliCredentials(configDir)?.org_id).toBe(MEMBER_ORG);

    const refused = await capture(() =>
      OrgUseCommand.run(["Default"], { root: CLI_ROOT }),
    );
    expect(String((refused.error as Error).message)).toContain(
      "[role_insufficient]",
    );
  });

  it("matches organizations by id or exact name", () => {
    const orgs = [
      { id: OWNER_ORG, name: "Acme", available: true, reason: null },
      { id: MEMBER_ORG, name: "Twin", available: true, reason: null },
      { id: OFF_ORG, name: "Twin", available: true, reason: null },
    ];
    expect(matchOrg("acme", orgs).id).toBe(OWNER_ORG);
    expect(matchOrg(MEMBER_ORG.toUpperCase(), orgs).id).toBe(MEMBER_ORG);
    expect(() => matchOrg("Twin", orgs)).toThrow(/More than one/);
    expect(() => matchOrg("Nope", orgs)).toThrow(/No organization matches/);
    expect(formatOrgRows([])).toBe("You do not belong to any organization.");
  });

  it("shows the grant in whoami and answers --check", async () => {
    saveCliCredentials(
      configDir,
      userLogin(mock, mock.issueOrgToken(OWNER_ORG)),
    );
    const summary = await capture(() =>
      WhoamiCommand.run([], { root: CLI_ROOT }),
    );
    expect(summary.error).toBeNull();
    expect(summary.stdout).toContain(`Organization: Acme (${OWNER_ORG})`);
    expect(summary.stdout).toContain("Role: owner");
    expect(summary.stdout).toContain(
      "Grant: computed with 2 permissions, all mail in the organization (oauth)",
    );
    expect(summary.stdout).toContain("Signed in as yourself");

    const allowed = await capture(() =>
      WhoamiCommand.run(["--check", "mail:send"], { root: CLI_ROOT }),
    );
    expect(allowed.stdout.trim()).toBe("mail:send: allowed");
    expect(allowed.exitCode).toBeUndefined();
    const denied = await capture(() =>
      WhoamiCommand.run(["--check", "keys:manage"], { root: CLI_ROOT }),
    );
    expect(denied.stdout.trim()).toBe(
      "keys:manage: not allowed (permission_missing)",
    );
    expect(denied.exitCode).toBe(1);
  });

  it("switches by name without losing the login when the identity token is due a refresh", async () => {
    const credentials = userLogin(mock, mock.issueOrgToken(OWNER_ORG));
    credentials.user_grant = {
      ...(credentials.user_grant as NonNullable<
        StoredCliCredentials["user_grant"]
      >),
      expires_at: new Date(0).toISOString(),
    };
    saveCliCredentials(configDir, credentials);
    const { org } = await switchCurrentOrg({
      apiBaseUrl: mock.base,
      configDir,
      selection: "Beta",
    });
    expect(org.org_id).toBe(MEMBER_ORG);
    expect(mock.refreshCount).toBe(1);
    const saved = loadCliCredentials(configDir) as StoredCliCredentials;
    expect(saved.org_id).toBe(MEMBER_ORG);
    expect(saved.refresh_token).toBe(mock.refreshToken);
  });

  it("refuses --org before a connected profile acts", () => {
    expect(() =>
      refuseOrgSelectionForProfile("work", { PRIMITIVE_CLI_ORG: "beta" }),
    ).toThrow(/Connected agent profile work belongs to one organization/);
    expect(() => refuseOrgSelectionForProfile("work", {})).not.toThrow();
  });

  it("treats an empty successful revoke response as signed out", async () => {
    mock.revokeEmpty = true;
    saveCliCredentials(
      configDir,
      userLogin(mock, mock.issueOrgToken(OWNER_ORG)),
    );
    const out = await capture(() =>
      runLogoutWithCredentialLock({ configDir, flags: {} }),
    );
    expect(out.error).toBeNull();
    expect(loadCliCredentials(configDir)).toBeNull();
  });

  it("logs out of every organization by revoking the refresh token", async () => {
    saveCliCredentials(
      configDir,
      userLogin(mock, mock.issueOrgToken(OWNER_ORG)),
    );
    const out = await capture(() =>
      runLogoutWithCredentialLock({ configDir, flags: {} }),
    );
    expect(out.error).toBeNull();
    expect(mock.revoked).toEqual(["prim_urt_1"]);
    expect(loadCliCredentials(configDir)).toBeNull();
    expect(out.stderr).toContain("Logged out of every organization");
  });
});
