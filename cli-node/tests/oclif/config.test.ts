import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  acquireCliCredentialsLock,
  loadCliCredentials,
  type StoredCliCredentials,
  saveCliCredentials,
} from "../../src/oclif/auth.js";
import {
  emptyCliConfig,
  loadCliConfig,
  saveCliConfig,
  upsertCliEnvironment,
} from "../../src/oclif/cli-config.js";
import {
  switchCliEnvironment,
  upsertCliEnvironmentAndClearCredentialsIfSwitched,
} from "../../src/oclif/commands/config.js";
import { COMMANDS } from "../../src/oclif/index.js";

const CREDENTIALS: StoredCliCredentials = {
  access_token: "prim_oat_existing",
  api_base_url_1: "https://api.default.example/v1",
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

function configWithDefaultAndStaging() {
  const withDefault = upsertCliEnvironment({
    apiBaseUrl1: "https://api.default.example/v1",
    config: emptyCliConfig(),
    environmentName: "default",
  });
  const withStaging = upsertCliEnvironment({
    apiBaseUrl1: "https://api.staging.example/v1",
    config: withDefault,
    environmentName: "staging",
  });

  return { ...withStaging, current_environment: "default" };
}

describe("config use", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "primitive-cli-config-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { force: true, recursive: true });
  });

  it("documents that switching environments clears saved OAuth credentials", () => {
    const command = COMMANDS["config:use"];

    expect(command.description).toContain("removes saved OAuth credentials");
  });

  it("clears saved credentials when switching to a different environment", () => {
    saveCliConfig(tempDir, configWithDefaultAndStaging());
    saveCliCredentials(tempDir, CREDENTIALS);

    const result = switchCliEnvironment(tempDir, "staging");

    expect(result).toEqual({
      environment: "staging",
      previousEnvironment: "default",
      removedCredentials: true,
    });
    expect(loadCliConfig(tempDir)?.current_environment).toBe("staging");
    expect(loadCliCredentials(tempDir)).toBeNull();
  });

  it("clears saved credentials when config set activates a different environment", () => {
    saveCliConfig(tempDir, configWithDefaultAndStaging());
    saveCliCredentials(tempDir, CREDENTIALS);

    const result = upsertCliEnvironmentAndClearCredentialsIfSwitched({
      apiBaseUrl1: "https://api.preview.example/v1",
      configDir: tempDir,
      environmentName: "preview",
    });

    expect(result).toEqual({
      environment: "preview",
      previousEnvironment: "default",
      removedCredentials: true,
    });
    expect(loadCliConfig(tempDir)?.current_environment).toBe("preview");
    expect(loadCliCredentials(tempDir)).toBeNull();
  });

  it("clears saved credentials when config set changes the active API host", () => {
    saveCliConfig(tempDir, configWithDefaultAndStaging());
    saveCliCredentials(tempDir, CREDENTIALS);

    const result = upsertCliEnvironmentAndClearCredentialsIfSwitched({
      apiBaseUrl1: "https://api.changed.example/v1",
      configDir: tempDir,
      environmentName: "default",
    });

    expect(result).toEqual({
      environment: "default",
      previousEnvironment: "default",
      removedCredentials: true,
    });
    expect(loadCliConfig(tempDir)?.current_environment).toBe("default");
    expect(loadCliCredentials(tempDir)).toBeNull();
  });

  it("does not switch environments when the credentials lock is held", () => {
    saveCliConfig(tempDir, configWithDefaultAndStaging());
    saveCliCredentials(tempDir, CREDENTIALS);
    const releaseLock = acquireCliCredentialsLock(tempDir);

    try {
      expect(() => switchCliEnvironment(tempDir, "staging")).toThrow(
        /credential operation is already in progress/,
      );
    } finally {
      releaseLock();
    }

    expect(loadCliConfig(tempDir)?.current_environment).toBe("default");
    expect(loadCliCredentials(tempDir)).toEqual(CREDENTIALS);
  });

  it("preserves saved credentials when selecting the active environment again", () => {
    saveCliConfig(tempDir, configWithDefaultAndStaging());
    saveCliCredentials(tempDir, CREDENTIALS);

    const result = switchCliEnvironment(tempDir, "default");

    expect(result).toEqual({
      environment: "default",
      previousEnvironment: "default",
      removedCredentials: false,
    });
    expect(loadCliConfig(tempDir)?.current_environment).toBe("default");
    expect(loadCliCredentials(tempDir)).toEqual(CREDENTIALS);
  });

  it("does not clear credentials when the target environment is missing", () => {
    saveCliConfig(tempDir, configWithDefaultAndStaging());
    saveCliCredentials(tempDir, CREDENTIALS);

    expect(() => switchCliEnvironment(tempDir, "prod")).toThrow(
      /environment prod is not configured/,
    );

    expect(loadCliConfig(tempDir)?.current_environment).toBe("default");
    expect(loadCliCredentials(tempDir)).toEqual(CREDENTIALS);
  });
});
