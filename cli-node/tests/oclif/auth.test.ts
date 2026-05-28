import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
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
  normalizeApiBaseUrl,
  resolveCliAuth,
  type StoredCliCredentials,
  saveCliCredentials,
} from "../../src/oclif/auth.js";
import { chatStatePath } from "../../src/oclif/chat-state.js";

const CREDENTIALS: StoredCliCredentials = {
  access_token: "prim_oat_test",
  api_base_url: "https://api.example.test/v1",
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

  it("deletes local chat state with saved credentials", () => {
    saveCliCredentials(tempDir, CREDENTIALS);
    writeFileSync(chatStatePath(tempDir), "{}\n", { mode: 0o600 });

    deleteCliCredentials(tempDir);

    expect(loadCliCredentials(tempDir)).toBeNull();
    expect(existsSync(chatStatePath(tempDir))).toBe(false);
  });

  it("normalizes explicit base URLs", () => {
    expect(normalizeApiBaseUrl("https://api.example.test/v1///")).toBe(
      "https://api.example.test/v1",
    );
  });

  it("canonicalizes known legacy web API base URLs", () => {
    expect(normalizeApiBaseUrl("https://www.primitive.dev/api/v1")).toBe(
      "https://api.primitive.dev/v1",
    );
    expect(normalizeApiBaseUrl("https://primitive-staging-1.com/api/v1")).toBe(
      "https://api.primitive-staging-1.com/v1",
    );
  });

  it("loads legacy saved OAuth credentials on the canonical API host", () => {
    writeFileSync(
      credentialsPath(tempDir),
      `${JSON.stringify({
        ...CREDENTIALS,
        api_base_url: undefined,
        api_base_url_1: "https://primitive-staging-1.com/api/v1",
      })}\n`,
    );

    expect(loadCliCredentials(tempDir)?.api_base_url).toBe(
      "https://api.primitive-staging-1.com/v1",
    );
  });

  it("prefers legacy host-2 credentials over legacy host-1 credentials", () => {
    writeFileSync(
      credentialsPath(tempDir),
      `${JSON.stringify({
        ...CREDENTIALS,
        api_base_url: undefined,
        api_base_url_1: "https://primitive-staging-1.com/api/v1",
        api_base_url_2: "https://api.primitive-staging-1.com/v1",
      })}\n`,
    );

    expect(loadCliCredentials(tempDir)?.api_base_url).toBe(
      "https://api.primitive-staging-1.com/v1",
    );
  });

  it("prefers explicit API keys over saved credentials", () => {
    saveCliCredentials(tempDir, CREDENTIALS);

    expect(
      resolveCliAuth({
        apiKey: "prim_explicit",
        apiBaseUrl: "https://api.override.example/v1",
        configDir: tempDir,
      }),
    ).toMatchObject({
      apiKey: "prim_explicit",
      apiBaseUrl: "https://api.override.example/v1",
      source: "flag-or-env",
    });
  });

  it("falls back to saved credentials and saved base URL", () => {
    saveCliCredentials(tempDir, CREDENTIALS);

    expect(resolveCliAuth({ configDir: tempDir })).toMatchObject({
      apiKey: CREDENTIALS.access_token,
      apiBaseUrl: CREDENTIALS.api_base_url,
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
        base_url: "https://api.example.test/v1",
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
    const release = acquireCliCredentialsLock(tempDir, {
      installSignalHandlers: false,
    });

    const owner = JSON.parse(
      readFileSync(join(tempDir, "credentials.lock", "owner.json"), "utf8"),
    );
    expect(owner.pid).toBe(process.pid);

    expect(() => acquireCliCredentialsLock(tempDir)).toThrow(
      /already in progress/,
    );

    release();
    const releaseAgain = acquireCliCredentialsLock(tempDir, {
      installSignalHandlers: false,
    });
    releaseAgain();
  });

  it("recovers stale credential lock directories", () => {
    const lockPath = join(tempDir, "credentials.lock");
    mkdirSync(lockPath, { mode: 0o700 });
    const now = new Date("2026-05-05T00:00:00.000Z").getTime();
    const staleTime = new Date(now - 2_000);
    utimesSync(lockPath, staleTime, staleTime);

    const release = acquireCliCredentialsLock(tempDir, {
      installSignalHandlers: false,
      now: () => now,
      staleMs: 1_000,
    });

    expect(() =>
      acquireCliCredentialsLock(tempDir, {
        installSignalHandlers: false,
        now: () => now,
        staleMs: 1_000,
      }),
    ).toThrow(/already in progress/);
    release();
  });

  it("recovers credential lock directories owned by dead processes", () => {
    const lockPath = join(tempDir, "credentials.lock");
    mkdirSync(lockPath, { mode: 0o700 });
    writeFileSync(
      join(lockPath, "owner.json"),
      `${JSON.stringify({ pid: 999_999, created_at: "2026-05-05T00:00:00.000Z" })}\n`,
    );

    const release = acquireCliCredentialsLock(tempDir, {
      installSignalHandlers: false,
      isProcessRunning: () => false,
      now: () => new Date("2026-05-05T00:00:00.000Z").getTime(),
      staleMs: 30 * 60 * 1000,
    });

    release();
  });

  it("keeps credential lock directories owned by live processes", () => {
    const lockPath = join(tempDir, "credentials.lock");
    mkdirSync(lockPath, { mode: 0o700 });
    writeFileSync(
      join(lockPath, "owner.json"),
      `${JSON.stringify({ pid: 123, created_at: "2026-05-05T00:00:00.000Z" })}\n`,
    );

    expect(() =>
      acquireCliCredentialsLock(tempDir, {
        installSignalHandlers: false,
        isProcessRunning: () => true,
        now: () => new Date("2026-05-05T00:00:00.000Z").getTime(),
        staleMs: 30 * 60 * 1000,
      }),
    ).toThrow(/primitive logout --force/);
  });

  it("does not stale-delete credential locks owned by live processes", () => {
    const lockPath = join(tempDir, "credentials.lock");
    mkdirSync(lockPath, { mode: 0o700 });
    writeFileSync(
      join(lockPath, "owner.json"),
      `${JSON.stringify({ pid: 123, created_at: "2026-05-05T00:00:00.000Z" })}\n`,
    );
    const now = new Date("2026-05-05T00:30:00.000Z").getTime();
    const staleTime = new Date(now - 60 * 60 * 1000);
    utimesSync(lockPath, staleTime, staleTime);

    expect(() =>
      acquireCliCredentialsLock(tempDir, {
        installSignalHandlers: false,
        isProcessRunning: () => true,
        now: () => now,
        staleMs: 1_000,
      }),
    ).toThrow(/primitive logout --force/);
    expect(statSync(lockPath).isDirectory()).toBe(true);
  });
});
