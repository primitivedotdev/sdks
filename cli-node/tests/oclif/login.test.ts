import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Errors } from "@oclif/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadCliCredentials,
  type StoredCliCredentials,
  saveCliCredentials,
} from "../../src/oclif/auth.js";
import {
  checkExistingLogin,
  pollCliLoginUntilApproved,
  SIGN_IN_EMAIL_CHANGE_REQUIRED,
} from "../../src/oclif/commands/login.js";

const CREDENTIALS: StoredCliCredentials = {
  access_token: "prim_oat_existing",
  api_base_url: "https://api.primitive.dev/v1",
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
      apiBaseUrl: "http://localhost:8787/v1",
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
      apiBaseUrl: `${CREDENTIALS.api_base_url}/`,
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

describe("pollCliLoginUntilApproved", () => {
  const START = { device_code: "dev_code", expires_in: 600, interval: 1 };
  const noSleep = async () => undefined;
  let writeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    writeSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    writeSpy.mockRestore();
  });

  function errorResponse(code: string, message?: string) {
    return {
      error: {
        success: false,
        error: { code, ...(message === undefined ? {} : { message }) },
      },
    };
  }

  it("stops polling and surfaces the server message when the sign-in email must change", async () => {
    const message =
      "Your Primitive sign-in email is on a domain Primitive receives mail for. Change it to an external address in the browser, then log in again.";
    const poll = vi
      .fn()
      .mockResolvedValueOnce(errorResponse("authorization_pending"))
      .mockResolvedValueOnce(
        errorResponse(SIGN_IN_EMAIL_CHANGE_REQUIRED, message),
      )
      .mockResolvedValue(errorResponse("authorization_pending"));

    const error = await pollCliLoginUntilApproved({
      poll,
      retryCommand: "login",
      sleep: noSleep,
      start: START,
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(Errors.CLIError);
    expect((error as Errors.CLIError).message).toBe(message);
    expect((error as Errors.CLIError).code).toBe(
      "sign_in_email_change_required",
    );
    expect((error as Errors.CLIError).oclif.exit).toBe(1);
    expect(poll).toHaveBeenCalledTimes(2);
  });

  it("falls back to local text when the server omits the message", async () => {
    const poll = vi
      .fn()
      .mockResolvedValue(errorResponse(SIGN_IN_EMAIL_CHANGE_REQUIRED));

    await expect(
      pollCliLoginUntilApproved({
        poll,
        retryCommand: "login",
        sleep: noSleep,
        start: START,
      }),
    ).rejects.toThrow(/Change it to an external address in the browser/);
    expect(poll).toHaveBeenCalledTimes(1);
  });

  it("keeps the access_denied outcome unchanged", async () => {
    const poll = vi
      .fn()
      .mockResolvedValue(errorResponse("access_denied", "Denied"));

    const error = await pollCliLoginUntilApproved({
      poll,
      retryCommand: "login",
      sleep: noSleep,
      start: START,
    }).catch((caught: unknown) => caught);

    expect((error as Errors.CLIError).message).toBe(
      "Primitive CLI login was denied in the browser.",
    );
    expect((error as Errors.CLIError).code).toBeUndefined();
    expect(poll).toHaveBeenCalledTimes(1);
  });

  it("returns the session once the browser approves", async () => {
    const login = { access_token: "prim_oat_new", org_id: "org" };
    const poll = vi
      .fn()
      .mockResolvedValueOnce(errorResponse("authorization_pending"))
      .mockResolvedValueOnce({ data: { data: login } });

    await expect(
      pollCliLoginUntilApproved({
        poll,
        retryCommand: "login",
        sleep: noSleep,
        start: START,
      }),
    ).resolves.toEqual(login);
    expect(poll).toHaveBeenCalledTimes(2);
  });
});
