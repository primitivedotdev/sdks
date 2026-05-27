import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SAVED_CLI_OAUTH_SESSION_EXPIRED_MESSAGE } from "../../src/oclif/api-client.js";
import {
  deleteCliCredentials,
  loadCliCredentials,
  type StoredCliCredentials,
  saveCliCredentials,
} from "../../src/oclif/auth.js";
import { chatStatePath } from "../../src/oclif/chat-state.js";
import {
  runForceLogout,
  runLogoutWithCredentialLock,
} from "../../src/oclif/commands/logout.js";
import { pendingSignupPath } from "../../src/oclif/commands/signup.js";

const CREDENTIALS: StoredCliCredentials = {
  access_token: "prim_oat_existing",
  api_base_url_1: "https://www.primitive.dev/api/v1",
  auth_method: "oauth",
  created_at: "2026-05-05T00:00:00.000Z",
  expires_at: "2026-05-05T00:00:00.000Z",
  oauth_client_id: "primitive-cli",
  oauth_grant_id: "11111111-1111-4111-8111-111111111111",
  org_id: "22222222-2222-4222-8222-222222222222",
  org_name: "Acme",
  refresh_token: "prim_ort_existing",
  token_type: "Bearer",
};

describe("runLogoutWithCredentialLock", () => {
  let tempDir: string;
  let writeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "primitive-cli-logout-test-"));
    writeSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    writeSpy.mockRestore();
    rmSync(tempDir, { force: true, recursive: true });
  });

  it("treats an already-revoked refreshed session as logged out", async () => {
    saveCliCredentials(tempDir, CREDENTIALS);
    const cliLogout = vi.fn();

    await runLogoutWithCredentialLock({
      configDir: tempDir,
      deps: {
        cliLogout,
        createAuthenticatedCliApiClient: vi.fn(async () => {
          deleteCliCredentials(tempDir);
          throw new Error(SAVED_CLI_OAUTH_SESSION_EXPIRED_MESSAGE);
        }),
      },
      flags: {},
    });

    expect(loadCliCredentials(tempDir)).toBeNull();
    expect(cliLogout).not.toHaveBeenCalled();
    expect(
      writeSpy.mock.calls.map((call: unknown[]) => String(call[0])).join(""),
    ).toContain(
      "Logged out (OAuth session was already expired or revoked on the server).",
    );
  });

  it("force logout removes local credentials and stale credential locks", () => {
    saveCliCredentials(tempDir, CREDENTIALS);
    const lockPath = join(tempDir, "credentials.lock");
    mkdirSync(lockPath, { recursive: true });
    const localChatStatePath = chatStatePath(tempDir);
    writeFileSync(localChatStatePath, "{}\n");
    const pendingPath = pendingSignupPath(tempDir);
    writeFileSync(
      pendingPath,
      `${JSON.stringify({
        api_base_url_1: "https://www.primitive.dev/api/v1",
        created_at: "2026-05-05T00:00:00.000Z",
        email: "user@example.com",
        expires_at: "2099-05-05T00:00:00.000Z",
        expires_in: 1800,
        resend_after: 60,
        signup_token: "signup-token",
        verification_code_length: 6,
      })}\n`,
    );

    runForceLogout({ configDir: tempDir });

    expect(loadCliCredentials(tempDir)).toBeNull();
    expect(existsSync(localChatStatePath)).toBe(false);
    expect(existsSync(lockPath)).toBe(false);
    expect(existsSync(pendingPath)).toBe(false);
    expect(
      writeSpy.mock.calls.map((call: unknown[]) => String(call[0])).join(""),
    ).toContain("pending email-code auth state");
    expect(
      writeSpy.mock.calls.map((call: unknown[]) => String(call[0])).join(""),
    ).toContain("local chat reply state");
  });

  it("force logout reports when no local auth state existed", () => {
    runForceLogout({ configDir: tempDir });

    expect(loadCliCredentials(tempDir)).toBeNull();
    expect(
      writeSpy.mock.calls.map((call: unknown[]) => String(call[0])).join(""),
    ).toContain("No local Primitive CLI auth state was present");
  });
});
