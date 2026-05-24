import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_API_BASE_URL_1 } from "@primitivedotdev/api-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadCliCredentials } from "../../src/oclif/auth.js";
import {
  formatSignupSeconds,
  loadPendingCliSignup,
  promptHidden,
  retryAfterSeconds,
  runSignupWithCredentialLock,
  savePendingCliSignup,
  shouldRetrySignupPassword,
} from "../../src/oclif/commands/signup.js";

const START_RESULT = {
  email: "test@example.com",
  expires_in: 1800,
  resend_after: 60,
  signup_token: "prim_cli_signup_test",
  verification_code_length: 6,
};

const VERIFY_RESULT = {
  access_token: "prim_oat_test_access",
  api_key: "prim_oat_test_access",
  auth_method: "oauth",
  expires_in: 3600,
  key_id: "11111111-1111-4111-8111-111111111111",
  key_prefix: "prim_oat_test...",
  oauth_client_id: "primitive-cli",
  oauth_grant_id: "11111111-1111-4111-8111-111111111111",
  org_id: "22222222-2222-4222-8222-222222222222",
  org_name: "Test Org",
  refresh_token: "prim_ort_test_refresh",
  token_type: "Bearer",
};

function promptRequiredFrom(answers: string[]) {
  return vi.fn(async () => {
    const answer = answers.shift();
    if (!answer) throw new Error("missing prompt answer");
    return answer;
  });
}

function flowDeps(params: {
  confirmTerms?: unknown;
  promptAnswers: string[];
  promptNewPassword?: unknown;
  promptSetPassword?: unknown;
  startCliSignup?: unknown;
  verifyCliSignup?: unknown;
}) {
  return {
    confirmTerms: params.confirmTerms ?? vi.fn(async () => undefined),
    promptNewPassword:
      params.promptNewPassword ?? vi.fn(async () => "valid-password"),
    promptSetPassword: params.promptSetPassword ?? vi.fn(async () => false),
    promptRequired: promptRequiredFrom(params.promptAnswers),
    startCliSignup:
      params.startCliSignup ??
      vi.fn(async () => ({ data: { data: START_RESULT } })),
    verifyCliSignup:
      params.verifyCliSignup ??
      vi.fn(async () => ({ data: { data: VERIFY_RESULT } })),
  } as unknown as NonNullable<
    Parameters<typeof runSignupWithCredentialLock>[0]["deps"]
  >;
}

describe("signup command helpers", () => {
  it("formats API-provided signup timing values for prompts", () => {
    expect(formatSignupSeconds(30)).toBe("30 seconds");
    expect(formatSignupSeconds(60)).toBe("1 minute");
    expect(formatSignupSeconds(61)).toBe("2 minutes");
    expect(formatSignupSeconds(null)).toBe("soon");
  });

  it("parses Retry-After headers from resend slow-down responses", () => {
    const response = new Response(null, { headers: { "Retry-After": "45" } });
    expect(retryAfterSeconds({ response })).toBe(45);
    expect(retryAfterSeconds({ response: new Response(null) })).toBeNull();
  });

  it("only re-prompts the password for explicit Clerk password rejection errors", () => {
    expect(shouldRetrySignupPassword("clerk_password_rejected")).toBe(true);
    expect(shouldRetrySignupPassword("clerk_signup_failed")).toBe(false);
    expect(shouldRetrySignupPassword(undefined)).toBe(false);
  });

  it("fails closed instead of echoing passwords when hidden input is unavailable", async () => {
    const original = Object.getOwnPropertyDescriptor(process.stdin, "isTTY");
    Object.defineProperty(process.stdin, "isTTY", {
      configurable: true,
      value: false,
    });

    try {
      await expect(promptHidden("Password: ")).rejects.toThrow(
        /hidden input support/,
      );
    } finally {
      if (original) {
        Object.defineProperty(process.stdin, "isTTY", original);
      }
    }
  });
});

describe("runSignupWithCredentialLock", () => {
  let tempDir: string;
  let writeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "primitive-cli-signup-test-"));
    writeSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    writeSpy.mockRestore();
    rmSync(tempDir, { force: true, recursive: true });
  });

  it("completes passwordless signup and saves returned credentials", async () => {
    const deps = flowDeps({
      promptAnswers: ["signup-code", "test@example.com", "123456"],
    });

    await runSignupWithCredentialLock({ configDir: tempDir, deps, flags: {} });

    const promptRequired = deps.promptRequired as ReturnType<typeof vi.fn>;
    const confirmTerms = deps.confirmTerms as ReturnType<typeof vi.fn>;
    const promptNewPassword = deps.promptNewPassword as ReturnType<
      typeof vi.fn
    >;
    const promptSetPassword = deps.promptSetPassword as ReturnType<
      typeof vi.fn
    >;

    expect(promptRequired).toHaveBeenNthCalledWith(1, "Signup code: ");
    expect(promptRequired).toHaveBeenNthCalledWith(2, "Email: ");
    expect(promptRequired).toHaveBeenNthCalledWith(
      3,
      "Verification code (6 digits): ",
    );
    expect(confirmTerms.mock.invocationCallOrder[0]).toBeGreaterThan(
      promptRequired.mock.invocationCallOrder[0],
    );
    expect(confirmTerms.mock.invocationCallOrder[0]).toBeLessThan(
      promptRequired.mock.invocationCallOrder[1],
    );
    expect(promptSetPassword.mock.invocationCallOrder[0]).toBeGreaterThan(
      promptRequired.mock.invocationCallOrder[2],
    );
    expect(promptNewPassword).not.toHaveBeenCalled();

    expect(deps.startCliSignup).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          email: "test@example.com",
          signup_code: "signup-code",
          terms_accepted: true,
        }),
      }),
    );
    expect(deps.verifyCliSignup).toHaveBeenCalledWith(
      expect.objectContaining({
        body: {
          signup_token: START_RESULT.signup_token,
          verification_code: "123456",
        },
      }),
    );
    expect(loadCliCredentials(tempDir)).toMatchObject({
      access_token: VERIFY_RESULT.access_token,
      auth_method: "oauth",
      oauth_grant_id: VERIFY_RESULT.oauth_grant_id,
      org_id: VERIFY_RESULT.org_id,
      org_name: VERIFY_RESULT.org_name,
      refresh_token: VERIFY_RESULT.refresh_token,
    });
    const credentials = loadCliCredentials(tempDir);
    expect(credentials).not.toBeNull();
    expect(
      loadPendingCliSignup(tempDir, credentials?.api_base_url_1 ?? ""),
    ).toBeNull();
  });

  it("resumes a persisted signup token instead of starting a duplicate session", async () => {
    const apiBaseUrl1 = "https://api.example.test/api/v1";
    savePendingCliSignup(tempDir, START_RESULT, apiBaseUrl1);
    const startCliSignup = vi.fn(async () => ({
      data: { data: START_RESULT },
    }));
    const deps = flowDeps({
      promptAnswers: ["123456"],
      startCliSignup,
    });

    await runSignupWithCredentialLock({
      configDir: tempDir,
      deps,
      flags: { "api-base-url-1": apiBaseUrl1 },
    });

    expect(startCliSignup).not.toHaveBeenCalled();
    expect(deps.verifyCliSignup).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          signup_token: START_RESULT.signup_token,
        }),
      }),
    );
    expect(loadCliCredentials(tempDir)?.access_token).toBe(
      VERIFY_RESULT.access_token,
    );
  });

  it("re-prompts for a different password when Clerk rejects the password", async () => {
    const passwordMessage =
      "Password has been found in an online data breach. For account safety, please use a different password.";
    const promptNewPassword = vi
      .fn()
      .mockResolvedValueOnce("breached-password")
      .mockResolvedValueOnce("stronger-password");
    const verifyCliSignup = vi
      .fn()
      .mockResolvedValueOnce({
        error: {
          error: {
            code: "clerk_password_rejected",
            message: passwordMessage,
          },
        },
      })
      .mockResolvedValueOnce({ data: { data: VERIFY_RESULT } });
    const deps = flowDeps({
      promptAnswers: ["signup-code", "test@example.com", "123456"],
      promptNewPassword,
      promptSetPassword: vi.fn(async () => true),
      verifyCliSignup,
    });

    await runSignupWithCredentialLock({ configDir: tempDir, deps, flags: {} });

    expect(promptNewPassword).toHaveBeenCalledTimes(2);
    expect(verifyCliSignup).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        body: {
          password: "breached-password",
          signup_token: START_RESULT.signup_token,
          verification_code: "123456",
        },
      }),
    );
    expect(verifyCliSignup).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        body: {
          password: "stronger-password",
          signup_token: START_RESULT.signup_token,
          verification_code: "123456",
        },
      }),
    );
    const stderr = writeSpy.mock.calls
      .map((call: unknown[]) => String(call[0]))
      .join("");
    expect(stderr).toContain(`Password rejected: ${passwordMessage}\n`);
    expect(stderr).toContain("Choose a different password and try again.\n");
    expect(loadCliCredentials(tempDir)?.access_token).toBe(
      VERIFY_RESULT.access_token,
    );
  });

  it("keeps the pending signup token when provisioning fails after start", async () => {
    const deps = flowDeps({
      promptAnswers: ["signup-code", "test@example.com", "123456"],
      verifyCliSignup: vi.fn(async () => ({
        error: {
          error: {
            code: "clerk_signup_failed",
            message: "temporary provisioning failure",
          },
        },
      })),
    });

    await expect(
      runSignupWithCredentialLock({ configDir: tempDir, deps, flags: {} }),
    ).rejects.toThrow(/signup failed/);

    const pending = loadPendingCliSignup(tempDir, DEFAULT_API_BASE_URL_1);
    expect(pending?.signup_token).toBe(START_RESULT.signup_token);
  });
});
