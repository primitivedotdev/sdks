import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  acquireCliCredentialsLock,
  credentialsPath,
  deleteCliCredentials,
  loadCliCredentials,
  normalizeApiBaseUrl1,
  resolveCliAuth,
  type StoredCliCredentials,
  saveCliCredentials,
} from "../../src/oclif/auth.js";

const CREDENTIALS: StoredCliCredentials = {
  access_token: "prim_oat_test",
  api_base_url_1: "https://api.example.test/api/v1",
  auth_method: "oauth",
  created_at: "2026-05-05T00:00:00.000Z",
  expires_at: "2099-05-05T00:00:00.000Z",
  oauth_client_id: "primitive-cli",
  oauth_grant_id: "11111111-1111-4111-8111-111111111111",
  org_id: "22222222-2222-4222-8222-222222222222",
  org_name: "Acme",
  refresh_token: "prim_ort_test",
  token_type: "Bearer",
};

describe("CLI auth credentials", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "primitive-cli-auth-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { force: true, recursive: true });
  });

  it("returns null when no saved credentials exist", () => {
    expect(loadCliCredentials(tempDir)).toBeNull();
  });

  it("saves and loads credentials with private file permissions", () => {
    saveCliCredentials(tempDir, CREDENTIALS);

    expect(loadCliCredentials(tempDir)).toEqual(CREDENTIALS);
    if (process.platform !== "win32") {
      expect(statSync(credentialsPath(tempDir)).mode & 0o777).toBe(0o600);
    }
    expect(
      readdirSync(tempDir).filter((name) => name.endsWith(".tmp")),
    ).toEqual([]);
  });

  it("deletes saved credentials", () => {
    saveCliCredentials(tempDir, CREDENTIALS);
    deleteCliCredentials(tempDir);

    expect(loadCliCredentials(tempDir)).toBeNull();
  });

  it("normalizes explicit base URLs", () => {
    expect(normalizeApiBaseUrl1("https://api.example.test/api/v1///")).toBe(
      "https://api.example.test/api/v1",
    );
  });

  it("prefers explicit API keys over saved credentials", () => {
    saveCliCredentials(tempDir, CREDENTIALS);

    expect(
      resolveCliAuth({
        apiKey: "prim_explicit",
        apiBaseUrl1: "https://override.example/api/v1",
        configDir: tempDir,
      }),
    ).toMatchObject({
      apiKey: "prim_explicit",
      apiBaseUrl1: "https://override.example/api/v1",
      source: "flag-or-env",
    });
  });

  it("falls back to saved credentials and saved base URL", () => {
    saveCliCredentials(tempDir, CREDENTIALS);

    expect(resolveCliAuth({ configDir: tempDir })).toMatchObject({
      apiKey: CREDENTIALS.access_token,
      apiBaseUrl1: CREDENTIALS.api_base_url_1,
      source: "stored",
    });
  });

  it("throws a helpful error for invalid credential JSON", () => {
    writeFileSync(credentialsPath(tempDir), "not json");

    expect(() => loadCliCredentials(tempDir)).toThrow(
      /credentials are not valid JSON/,
    );
  });

  it("throws a field-specific error for malformed credential fields", () => {
    writeFileSync(
      credentialsPath(tempDir),
      `${JSON.stringify({ ...CREDENTIALS, access_token: "" })}\n`,
    );

    expect(() => loadCliCredentials(tempDir)).toThrow(/access_token/);
  });

  it("ignores legacy saved API-key credentials and prints a re-login notice", () => {
    const stderrWrites: string[] = [];
    const writeSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation((chunk: unknown) => {
        stderrWrites.push(typeof chunk === "string" ? chunk : String(chunk));
        return true;
      });
    try {
      const stale = {
        api_key: "prim_old",
        base_url: "https://api.example.test/api/v1",
        created_at: "2026-05-05T00:00:00.000Z",
        key_id: "11111111-1111-4111-8111-111111111111",
        key_prefix: "prim_old",
        org_id: "22222222-2222-4222-8222-222222222222",
        org_name: "Acme",
      };
      writeFileSync(credentialsPath(tempDir), `${JSON.stringify(stale)}\n`);

      expect(loadCliCredentials(tempDir)).toBeNull();
      expect(stderrWrites.join("")).toContain("No API key was revoked");
      // Stale file should have been cleared so the next call is idempotent.
      expect(loadCliCredentials(tempDir)).toBeNull();
    } finally {
      writeSpy.mockRestore();
    }
  });

  it("serializes credential updates with a lock directory", () => {
    const release = acquireCliCredentialsLock(tempDir);

    expect(() => acquireCliCredentialsLock(tempDir)).toThrow(
      /already in progress/,
    );

    release();
    const releaseAgain = acquireCliCredentialsLock(tempDir);
    releaseAgain();
  });

  it("recovers stale credential lock directories", () => {
    const lockPath = join(tempDir, "credentials.lock");
    mkdirSync(lockPath, { mode: 0o700 });
    const now = new Date("2026-05-05T00:00:00.000Z").getTime();
    const staleTime = new Date(now - 2_000);
    utimesSync(lockPath, staleTime, staleTime);

    const release = acquireCliCredentialsLock(tempDir, {
      now: () => now,
      staleMs: 1_000,
    });

    expect(() =>
      acquireCliCredentialsLock(tempDir, { now: () => now, staleMs: 1_000 }),
    ).toThrow(/already in progress/);
    release();
  });
});
