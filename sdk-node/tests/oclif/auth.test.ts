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
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  acquireCliCredentialsLock,
  credentialsPath,
  deleteCliCredentials,
  loadCliCredentials,
  normalizeBaseUrl,
  resolveCliAuth,
  type StoredCliCredentials,
  saveCliCredentials,
} from "../../src/oclif/auth.js";

const CREDENTIALS: StoredCliCredentials = {
  api_key: "prim_test",
  base_url: "https://api.example.test/api/v1",
  created_at: "2026-05-05T00:00:00.000Z",
  key_id: "11111111-1111-4111-8111-111111111111",
  key_prefix: "prim_abc",
  org_id: "22222222-2222-4222-8222-222222222222",
  org_name: "Acme",
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
    expect(normalizeBaseUrl("https://api.example.test/api/v1///")).toBe(
      "https://api.example.test/api/v1",
    );
  });

  it("prefers explicit API keys over saved credentials", () => {
    saveCliCredentials(tempDir, CREDENTIALS);

    expect(
      resolveCliAuth({
        apiKey: "prim_explicit",
        baseUrl: "https://override.example/api/v1",
        configDir: tempDir,
      }),
    ).toMatchObject({
      apiKey: "prim_explicit",
      baseUrl: "https://override.example/api/v1",
      source: "flag-or-env",
    });
  });

  it("falls back to saved credentials and saved base URL", () => {
    saveCliCredentials(tempDir, CREDENTIALS);

    expect(resolveCliAuth({ configDir: tempDir })).toMatchObject({
      apiKey: CREDENTIALS.api_key,
      baseUrl: CREDENTIALS.base_url,
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
      `${JSON.stringify({ ...CREDENTIALS, api_key: "" })}\n`,
    );

    expect(() => loadCliCredentials(tempDir)).toThrow(/api_key/);
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
