import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadCliCredentials,
  type StoredCliCredentials,
  saveCliCredentials,
} from "../../src/oclif/auth.js";
import { checkExistingLogin } from "../../src/oclif/commands/login.js";

const CREDENTIALS: StoredCliCredentials = {
  api_key: "prim_existing",
  base_url: "https://www.primitive.dev/api/v1",
  created_at: "2026-05-05T00:00:00.000Z",
  key_id: "11111111-1111-4111-8111-111111111111",
  key_prefix: "prim_exi...",
  org_id: "22222222-2222-4222-8222-222222222222",
  org_name: "Acme",
};

describe("checkExistingLogin", () => {
  let tempDir: string;
  let writeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "primitive-cli-login-test-"));
    writeSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    writeSpy.mockRestore();
    rmSync(tempDir, { force: true, recursive: true });
  });

  it("reports a valid saved login without removing credentials", async () => {
    saveCliCredentials(tempDir, CREDENTIALS);

    const result = await checkExistingLogin({
      configDir: tempDir,
      credentials: CREDENTIALS,
      checkAccount: async () => ({}),
    });

    expect(result).toEqual({ status: "valid" });
    expect(loadCliCredentials(tempDir)).toEqual(CREDENTIALS);
  });

  it("removes stale saved credentials and allows login to continue", async () => {
    saveCliCredentials(tempDir, CREDENTIALS);

    const result = await checkExistingLogin({
      configDir: tempDir,
      credentials: CREDENTIALS,
      checkAccount: async () => ({
        error: { code: "unauthorized", message: "Invalid API key" },
      }),
    });

    expect(result).toEqual({ status: "removed_stale" });
    expect(loadCliCredentials(tempDir)).toBeNull();
  });

  it("keeps saved credentials when a different base URL rejects them", async () => {
    saveCliCredentials(tempDir, CREDENTIALS);

    const result = await checkExistingLogin({
      baseUrl: "http://localhost:3000/api/v1",
      configDir: tempDir,
      credentials: CREDENTIALS,
      checkAccount: async () => ({
        error: { code: "unauthorized", message: "Invalid API key" },
      }),
    });

    expect(result.status).toBe("blocked");
    expect(loadCliCredentials(tempDir)).toEqual(CREDENTIALS);
  });

  it("keeps saved credentials when verification fails for a non-auth reason", async () => {
    saveCliCredentials(tempDir, CREDENTIALS);

    const result = await checkExistingLogin({
      configDir: tempDir,
      credentials: CREDENTIALS,
      checkAccount: async () => ({
        error: { code: "server_error", message: "Primitive is unavailable" },
      }),
    });

    expect(result.status).toBe("blocked");
    expect(loadCliCredentials(tempDir)).toEqual(CREDENTIALS);
  });

  it("removes stale credentials when the explicit base URL matches the saved one", async () => {
    saveCliCredentials(tempDir, CREDENTIALS);

    const result = await checkExistingLogin({
      baseUrl: `${CREDENTIALS.base_url}/`,
      configDir: tempDir,
      credentials: CREDENTIALS,
      checkAccount: async () => ({
        error: { code: "unauthorized", message: "Invalid API key" },
      }),
    });

    expect(result).toEqual({ status: "removed_stale" });
    expect(loadCliCredentials(tempDir)).toBeNull();
  });
});
