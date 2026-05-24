import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_API_BASE_URL_1 } from "@primitivedotdev/api-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadCliCredentials } from "../../src/oclif/auth.js";
import {
  formatSignupSeconds,
  loadPendingAgentSignup,
  retryAfterSeconds,
  runSignupConfirmWithCredentialLock,
  runSignupInteractiveWithCredentialLock,
  runSignupResendWithCredentialLock,
  runSignupStartWithCredentialLock,
  savePendingAgentSignup,
} from "../../src/oclif/commands/signup.js";

const START_RESULT = {
  email: "test@example.com",
  expires_in: 1800,
  resend_after: 60,
  signup_token: "prim_agent_signup_test",
  verification_code_length: 6,
};

const RESEND_RESULT = {
  email: "test@example.com",
  expires_in: 1200,
  resend_after: 60,
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
  orgs: [{ id: "22222222-2222-4222-8222-222222222222", name: "Test Org" }],
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
  promptAnswers?: string[];
  resendAgentSignupVerification?: unknown;
  startAgentSignup?: unknown;
  verifyAgentSignup?: unknown;
}) {
  return {
    confirmTerms: params.confirmTerms ?? vi.fn(async () => undefined),
    promptRequired: promptRequiredFrom(params.promptAnswers ?? []),
    resendAgentSignupVerification:
      params.resendAgentSignupVerification ??
      vi.fn(async () => ({ data: { data: RESEND_RESULT } })),
    startAgentSignup:
      params.startAgentSignup ??
      vi.fn(async () => ({ data: { data: START_RESULT } })),
    verifyAgentSignup:
      params.verifyAgentSignup ??
      vi.fn(async () => ({ data: { data: VERIFY_RESULT } })),
  } as unknown as NonNullable<
    Parameters<typeof runSignupStartWithCredentialLock>[0]["deps"]
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
});

describe("agent signup commands", () => {
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

  it("starts signup from email and saves the pending token", async () => {
    const deps = flowDeps({});

    await runSignupStartWithCredentialLock({
      configDir: tempDir,
      deps,
      email: "test@example.com",
      flags: {
        "accept-terms": true,
        "signup-code": "signup-code",
      },
    });

    expect(deps.confirmTerms).not.toHaveBeenCalled();
    expect(deps.startAgentSignup).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          email: "test@example.com",
          signup_code: "signup-code",
          terms_accepted: true,
        }),
      }),
    );
    expect(
      loadPendingAgentSignup(tempDir, DEFAULT_API_BASE_URL_1),
    ).toMatchObject({
      email: START_RESULT.email,
      signup_token: START_RESULT.signup_token,
    });
  });

  it("prompts for missing email, signup code, and terms", async () => {
    const deps = flowDeps({
      promptAnswers: ["test@example.com", "signup-code"],
    });

    await runSignupStartWithCredentialLock({
      configDir: tempDir,
      deps,
      flags: {},
    });

    expect(deps.promptRequired).toHaveBeenNthCalledWith(1, "Email: ");
    expect(deps.promptRequired).toHaveBeenNthCalledWith(2, "Signup code: ");
    expect(deps.confirmTerms).toHaveBeenCalledOnce();
    expect(deps.startAgentSignup).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          email: "test@example.com",
          signup_code: "signup-code",
        }),
      }),
    );
  });

  it("confirms signup and saves returned OAuth credentials", async () => {
    const deps = flowDeps({});
    savePendingAgentSignup(tempDir, START_RESULT, DEFAULT_API_BASE_URL_1);

    await runSignupConfirmWithCredentialLock({
      code: "123456",
      configDir: tempDir,
      deps,
      email: "test@example.com",
      flags: {},
    });

    expect(deps.verifyAgentSignup).toHaveBeenCalledWith(
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
    expect(loadPendingAgentSignup(tempDir, DEFAULT_API_BASE_URL_1)).toBeNull();
  });

  it("passes org id during confirmation when provided", async () => {
    const deps = flowDeps({});
    savePendingAgentSignup(tempDir, START_RESULT, DEFAULT_API_BASE_URL_1);

    await runSignupConfirmWithCredentialLock({
      code: "123456",
      configDir: tempDir,
      deps,
      email: "test@example.com",
      flags: { "org-id": "33333333-3333-4333-8333-333333333333" },
    });

    expect(deps.verifyAgentSignup).toHaveBeenCalledWith(
      expect.objectContaining({
        body: {
          org_id: "33333333-3333-4333-8333-333333333333",
          signup_token: START_RESULT.signup_token,
          verification_code: "123456",
        },
      }),
    );
  });

  it("resends a pending signup verification code", async () => {
    const deps = flowDeps({});
    savePendingAgentSignup(tempDir, START_RESULT, DEFAULT_API_BASE_URL_1);

    await runSignupResendWithCredentialLock({
      configDir: tempDir,
      deps,
      email: "test@example.com",
      flags: {},
    });

    expect(deps.resendAgentSignupVerification).toHaveBeenCalledWith(
      expect.objectContaining({
        body: { signup_token: START_RESULT.signup_token },
      }),
    );
    expect(
      loadPendingAgentSignup(tempDir, DEFAULT_API_BASE_URL_1),
    ).toMatchObject({
      email: RESEND_RESULT.email,
      expires_in: expect.any(Number),
      signup_token: START_RESULT.signup_token,
    });
  });

  it("runs the full interactive flow when requested", async () => {
    const deps = flowDeps({
      promptAnswers: ["test@example.com", "signup-code", "123456"],
    });

    await runSignupInteractiveWithCredentialLock({
      configDir: tempDir,
      deps,
      flags: {},
    });

    expect(deps.startAgentSignup).toHaveBeenCalledOnce();
    expect(deps.verifyAgentSignup).toHaveBeenCalledOnce();
    expect(loadCliCredentials(tempDir)?.access_token).toBe(
      VERIFY_RESULT.access_token,
    );
  });

  it("keeps interactive signup open after an invalid verification code", async () => {
    const verifyAgentSignup = vi
      .fn()
      .mockResolvedValueOnce({
        error: {
          error: {
            code: "invalid_verification_code",
            message: "Invalid verification code",
          },
        },
      })
      .mockResolvedValueOnce({ data: { data: VERIFY_RESULT } });
    const deps = flowDeps({
      promptAnswers: ["test@example.com", "signup-code", "000000", "123456"],
      verifyAgentSignup,
    });

    await runSignupInteractiveWithCredentialLock({
      configDir: tempDir,
      deps,
      flags: {},
    });

    expect(verifyAgentSignup).toHaveBeenCalledTimes(2);
    expect(loadCliCredentials(tempDir)?.access_token).toBe(
      VERIFY_RESULT.access_token,
    );
    expect(
      writeSpy.mock.calls.map((call: unknown[]) => String(call[0])).join(""),
    ).toContain("Invalid verification code. Try again or type `resend`.\n");
  });

  it("keeps the pending token after invalid verification code", async () => {
    const deps = flowDeps({
      verifyAgentSignup: vi.fn(async () => ({
        error: {
          error: {
            code: "invalid_verification_code",
            message: "Invalid verification code",
          },
        },
      })),
    });
    savePendingAgentSignup(tempDir, START_RESULT, DEFAULT_API_BASE_URL_1);

    await expect(
      runSignupConfirmWithCredentialLock({
        code: "000000",
        configDir: tempDir,
        deps,
        email: "test@example.com",
        flags: {},
      }),
    ).rejects.toThrow(/Invalid verification code/);

    expect(
      loadPendingAgentSignup(tempDir, DEFAULT_API_BASE_URL_1)?.signup_token,
    ).toBe(START_RESULT.signup_token);
  });
});
