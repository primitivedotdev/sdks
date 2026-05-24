import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Errors } from "@oclif/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  cliApiHeadersFromEnv,
  createAuthenticatedCliApiClient,
  refreshStoredCliCredentials,
  resolveCliApiRequestConfig,
} from "../../src/oclif/api-client.js";
import {
  acquireCliCredentialsLock,
  loadCliCredentials,
  type StoredCliCredentials,
  saveCliCredentials,
} from "../../src/oclif/auth.js";
import {
  emptyCliConfig,
  parseHeaderAssignment,
  resolveConfigEnvironment,
  saveCliConfig,
  upsertCliEnvironment,
} from "../../src/oclif/cli-config.js";

const CREDENTIALS: StoredCliCredentials = {
  access_token: "prim_oat_existing",
  api_base_url_1: "https://saved.example/api/v1",
  auth_method: "oauth",
  created_at: "2026-05-05T00:00:00.000Z",
  expires_at: "2099-05-05T00:00:00.000Z",
  oauth_client_id: "primitive-cli",
  oauth_grant_id: "11111111-1111-4111-8111-111111111111",
  org_id: "22222222-2222-4222-8222-222222222222",
  org_name: "Acme",
  refresh_token: "prim_ort_existing",
  token_type: "Bearer",
};

describe("CLI API request config", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "primitive-cli-api-client-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { force: true, recursive: true });
  });

  it("parses arbitrary request headers from the generic env var", () => {
    expect(
      cliApiHeadersFromEnv({
        PRIMITIVE_API_HEADERS: '{"x-test":"one"}',
      }),
    ).toEqual({
      "x-test": "one",
    });
  });

  it("rejects invalid header JSON with a CLI error", () => {
    expect(() =>
      cliApiHeadersFromEnv({ PRIMITIVE_API_HEADERS: "{not json" }),
    ).toThrow(Errors.CLIError);
  });

  it("rejects Authorization header injection", () => {
    expect(() =>
      cliApiHeadersFromEnv({
        PRIMITIVE_API_HEADERS: '{"authorization":"Bearer nope"}',
      }),
    ).toThrow(/Authorization header is managed/);
  });

  it("rejects control characters in request header values", () => {
    for (const value of ["bad\rvalue", "bad\nvalue", "bad\0value"]) {
      expect(() =>
        cliApiHeadersFromEnv({
          PRIMITIVE_API_HEADERS: JSON.stringify({ "x-test": value }),
        }),
      ).toThrow(/must not contain CR, LF, or NUL/);
    }
  });

  it("parses header assignment values with embedded equals signs", () => {
    expect(parseHeaderAssignment("x-another======value")).toEqual([
      "x-another",
      "=====value",
    ]);
  });

  it("rejects header assignments without a name=value delimiter", () => {
    for (const value of ["value", "=value"]) {
      expect(() => parseHeaderAssignment(value)).toThrow(/name=value syntax/);
    }
  });

  it("writes unnamed config changes to default even when another config is active", () => {
    let config = upsertCliEnvironment({
      apiBaseUrl1: "https://staging.example/api/v1",
      config: emptyCliConfig(),
      environmentName: "staging",
    });
    expect(config.current_environment).toBe("staging");

    config = upsertCliEnvironment({
      config,
      headers: ["x-default=yes"],
    });

    expect(config.current_environment).toBe("default");
    expect(config.environments.default).toMatchObject({
      headers: { "x-default": "yes" },
    });
    expect(config.environments.staging).toMatchObject({
      api_base_url_1: "https://staging.example/api/v1",
    });
  });

  it("resolves default as active when no named config is selected", () => {
    const config = upsertCliEnvironment({
      config: emptyCliConfig(),
      headers: ["x-default=yes"],
    });

    expect(config.current_environment).toBe("default");
    expect(
      resolveConfigEnvironment({ ...config, current_environment: null }),
    ).toMatchObject({
      name: "default",
      config: { headers: { "x-default": "yes" } },
    });
  });

  it("lets later repeated header assignments win", () => {
    const config = upsertCliEnvironment({
      config: emptyCliConfig(),
      headers: ["x-test=one", "x-test=two"],
    });

    expect(config.environments.default).toMatchObject({
      headers: { "x-test": "two" },
    });
  });

  it("loads the active environment and lets env headers override stored headers", () => {
    const config = upsertCliEnvironment({
      apiBaseUrl1: "https://staging.example/api/v1/",
      apiBaseUrl2: "https://staging-worker.example/v1/",
      config: emptyCliConfig(),
      environmentName: "staging",
      headers: ["x-test=stored", "x-keep=yes"],
    });
    saveCliConfig(tempDir, config);

    const resolved = resolveCliApiRequestConfig({
      configDir: tempDir,
      env: { PRIMITIVE_API_HEADERS: '{"x-test":"env"}' },
    });

    expect(resolved).toMatchObject({
      apiBaseUrl1: "https://staging.example/api/v1",
      apiBaseUrl2: "https://staging-worker.example/v1",
      baseUrlOverridden: true,
      environmentName: "staging",
      headers: { "x-keep": "yes", "x-test": "env" },
    });
  });

  it("uses configured API URLs when resolving saved credentials", async () => {
    saveCliCredentials(tempDir, CREDENTIALS);
    const config = upsertCliEnvironment({
      apiBaseUrl1: "https://staging.example/api/v1",
      config: emptyCliConfig(),
      environmentName: "staging",
      headers: ["x-staging-secret=secret"],
    });
    saveCliConfig(tempDir, config);

    const { apiClient, auth, baseUrlOverridden, requestConfig } =
      await createAuthenticatedCliApiClient({
        configDir: tempDir,
      });

    expect(auth.apiKey).toBe(CREDENTIALS.access_token);
    expect(auth.apiBaseUrl1).toBe("https://staging.example/api/v1");
    expect(baseUrlOverridden).toBe(true);
    expect(requestConfig.headers).toEqual({ "x-staging-secret": "secret" });
    const clientHeaders = apiClient.getConfig().headers as Headers;
    expect(clientHeaders.get("x-staging-secret")).toBe("secret");
  });

  it("refreshes expired saved OAuth credentials and persists the new token set", async () => {
    const expired = {
      ...CREDENTIALS,
      expires_at: "2026-05-05T00:00:00.000Z",
    };
    saveCliCredentials(tempDir, expired);
    const fetchMock = async (
      url: string | URL | Request,
      init?: RequestInit,
    ) => {
      expect(String(url)).toBe("https://saved.example/oauth/token");
      expect(init?.method).toBe("POST");
      expect(init?.body?.toString()).toContain("grant_type=refresh_token");
      return new Response(
        JSON.stringify({
          access_token: "prim_oat_refreshed",
          expires_in: 120,
          refresh_token: "prim_ort_refreshed",
          token_type: "Bearer",
        }),
      );
    };

    const refreshed = await refreshStoredCliCredentials({
      apiBaseUrl1: expired.api_base_url_1,
      configDir: tempDir,
      credentials: expired,
      fetch: fetchMock as typeof fetch,
      now: () => new Date("2026-05-05T00:00:00.000Z").getTime(),
    });

    expect(refreshed).toMatchObject({
      access_token: "prim_oat_refreshed",
      refresh_token: "prim_ort_refreshed",
    });
    expect(loadCliCredentials(tempDir)).toEqual(refreshed);
  });

  it("removes saved OAuth credentials when refresh returns invalid_grant", async () => {
    const expired = {
      ...CREDENTIALS,
      expires_at: "2026-05-05T00:00:00.000Z",
    };
    saveCliCredentials(tempDir, expired);
    const fetchMock = async () =>
      new Response(
        JSON.stringify({
          error: "invalid_grant",
          error_description: "Refresh token is no longer active",
        }),
        { status: 400 },
      );

    await expect(
      refreshStoredCliCredentials({
        apiBaseUrl1: expired.api_base_url_1,
        configDir: tempDir,
        credentials: expired,
        fetch: fetchMock as typeof fetch,
        now: () => new Date("2026-05-05T00:00:00.000Z").getTime(),
      }),
    ).rejects.toThrow(/expired or was revoked/);
    expect(loadCliCredentials(tempDir)).toBeNull();
  });

  it("does not refresh while another credential operation holds the lock", async () => {
    const expired = {
      ...CREDENTIALS,
      expires_at: "2026-05-05T00:00:00.000Z",
    };
    saveCliCredentials(tempDir, expired);
    const release = acquireCliCredentialsLock(tempDir);
    let fetchCalled = false;

    try {
      await expect(
        createAuthenticatedCliApiClient({
          configDir: tempDir,
          fetch: (async () => {
            fetchCalled = true;
            return new Response("{}") as Response;
          }) as typeof fetch,
          now: () => new Date("2026-05-05T00:00:00.000Z").getTime(),
        }),
      ).rejects.toThrow(/credential operation is already in progress/);
    } finally {
      release();
    }

    expect(fetchCalled).toBe(false);
    expect(loadCliCredentials(tempDir)).toEqual(expired);
  });
});
