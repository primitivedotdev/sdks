import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_API_BASE_URL } from "@primitivedotdev/api-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadCliCredentials,
  type StoredCliCredentials,
  saveCliCredentials,
} from "../../src/oclif/auth.js";
import { chatStatePath } from "../../src/oclif/chat-state.js";
import {
  formatSignupSeconds,
  loadPendingAgentSignup,
  retryAfterSeconds,
  runSignupConfirmWithCredentialLock,
  runSignupInteractiveWithCredentialLock,
  runSignupResendWithCredentialLock,
  runSignupStartWithCredentialLock,
  runSignupStatus,
  SignupConfirmCommand,
  SignupInteractiveCommand,
  SignupResendCommand,
  SignupStatusCommand,
  savePendingAgentSignup,
} from "../../src/oclif/commands/signup.js";
import { COMMANDS } from "../../src/oclif/index.js";

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

const EXISTING_CREDENTIALS: StoredCliCredentials = {
  access_token: "prim_oat_existing",
  api_base_url: DEFAULT_API_BASE_URL,
  auth_method: "oauth",
  created_at: "2026-05-05T00:00:00.000Z",
  expires_at: "2099-05-05T00:00:00.000Z",
  oauth_client_id: "primitive-cli",
  oauth_grant_id: "11111111-1111-4111-8111-111111111111",
  org_id: "33333333-3333-4333-8333-333333333333",
  org_name: "Existing Org",
  refresh_token: "prim_ort_existing",
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
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let writeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "primitive-cli-signup-test-"));
    stdoutSpy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);
    writeSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    writeSpy.mockRestore();
    rmSync(tempDir, { force: true, recursive: true });
  });

  it("routes exact signup command shapes", () => {
    expect(COMMANDS["signup:confirm"]).toBe(SignupConfirmCommand);
    expect(COMMANDS["signup:interactive"]).toBe(SignupInteractiveCommand);
    expect(COMMANDS["signup:resend"]).toBe(SignupResendCommand);
    expect(COMMANDS["signup:status"]).toBe(SignupStatusCommand);
    expect(SignupResendCommand.args.email.required).toBe(false);
    expect(SignupStatusCommand.flags.json).toBeDefined();
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
    expect(loadPendingAgentSignup(tempDir, DEFAULT_API_BASE_URL)).toMatchObject(
      {
        email: START_RESULT.email,
        signup_token: START_RESULT.signup_token,
      },
    );
  });

  it("does not prompt for a signup code when DEFAULT_SIGNUP_COMMAND_COPY is in use", async () => {
    // DEFAULT_SIGNUP_COMMAND_COPY sets codeRequired: false (signup
    // accepts requests without one). A user with no email is still
    // prompted for that (it's required for the verification round
    // trip), and terms are still confirmed. The signin / login / otp
    // copies in cli-node/src/oclif/commands/signin.ts set codeRequired
    // true and still prompt; that path has its own coverage.
    const deps = flowDeps({
      promptAnswers: ["test@example.com"],
    });

    await runSignupStartWithCredentialLock({
      configDir: tempDir,
      deps,
      flags: {},
    });

    expect(deps.promptRequired).toHaveBeenCalledTimes(1);
    expect(deps.promptRequired).toHaveBeenNthCalledWith(1, "Email: ");
    expect(deps.promptRequired).not.toHaveBeenCalledWith("Signup code: ");
    expect(deps.confirmTerms).toHaveBeenCalledOnce();
    // Cast through vi.mocked to recover the mock's .mock.calls without
    // losing the assertion strength. A `not.toHaveBeenCalledWith
    // (objectContaining({signup_code: expect.anything()}))` matcher
    // would silently pass if the regression shipped `{signup_code:
    // undefined}` (expect.anything ignores undefined). Reading the
    // actual call body and using Object.hasOwn pins absence of the
    // key, not just an undefined value.
    const startMock = vi.mocked(
      deps.startAgentSignup as unknown as ReturnType<typeof vi.fn>,
    );
    const startCall = startMock.mock.calls[0]?.[0] as
      | { body?: Record<string, unknown> }
      | undefined;
    expect(startCall?.body).toEqual(
      expect.objectContaining({
        email: "test@example.com",
        terms_accepted: true,
      }),
    );
    expect(startCall?.body).toBeDefined();
    expect(Object.hasOwn(startCall!.body!, "signup_code")).toBe(false);
  });

  it("continues an existing pending signup without saying a new code was sent", async () => {
    const deps = flowDeps({});
    savePendingAgentSignup(tempDir, START_RESULT, DEFAULT_API_BASE_URL);

    await runSignupStartWithCredentialLock({
      configDir: tempDir,
      deps,
      email: "test@example.com",
      flags: {
        "accept-terms": true,
        "signup-code": "signup-code",
      },
    });

    const stderr = writeSpy.mock.calls
      .map((call: unknown[]) => String(call[0]))
      .join("");
    expect(deps.startAgentSignup).not.toHaveBeenCalled();
    expect(stderr).toContain(
      "Continuing pending Primitive signup for test@example.com.\n",
    );
    expect(stderr).toContain(
      "Run `primitive signup confirm test@example.com <code>` to finish, `primitive signup resend test@example.com` to send a new code, or `primitive signup status` to inspect it.\n",
    );
    expect(stderr).not.toContain("Sent a 6-digit verification code");
  });

  it("prints useful status for a pending signup", () => {
    savePendingAgentSignup(tempDir, START_RESULT, DEFAULT_API_BASE_URL);

    runSignupStatus({
      configDir: tempDir,
      flags: {},
    });

    const stdout = stdoutSpy.mock.calls
      .map((call: unknown[]) => String(call[0]))
      .join("");
    expect(stdout).toContain(
      "Pending Primitive signup for test@example.com.\n",
    );
    expect(stdout).toContain("Verification code length: 6\n");
    expect(stdout).toContain("Expires at: ");
    expect(stdout).toContain("Expires in: 30 minutes\n");
    expect(stdout).toContain("Resend after: 1 minute\n");
    expect(stdout).toContain(
      "Confirm: primitive signup confirm test@example.com <code>\n",
    );
    expect(stdout).toContain(
      "Resend: primitive signup resend test@example.com\n",
    );
  });

  it("prints pending signup status as JSON", () => {
    savePendingAgentSignup(tempDir, START_RESULT, DEFAULT_API_BASE_URL);

    runSignupStatus({
      configDir: tempDir,
      flags: { json: true },
    });

    const status = JSON.parse(
      stdoutSpy.mock.calls.map((call: unknown[]) => String(call[0])).join(""),
    );
    expect(status).toMatchObject({
      code_length: 6,
      confirm_command: "primitive signup confirm test@example.com <code>",
      email: "test@example.com",
      expired: false,
      pending: true,
      resend_after: 60,
      resend_command: "primitive signup resend test@example.com",
    });
    expect(status.expires_at).toEqual(expect.any(String));
    expect(status.expires_in).toEqual(expect.any(Number));
  });

  it("reports no pending signup in text and JSON", () => {
    runSignupStatus({
      configDir: tempDir,
      email: "new@example.com",
      flags: {},
    });
    let stdout = stdoutSpy.mock.calls
      .map((call: unknown[]) => String(call[0]))
      .join("");
    expect(stdout).toContain("No pending Primitive signup found.\n");
    expect(stdout).toContain(
      "Start one with `primitive signup new@example.com --accept-terms`.\n",
    );

    stdoutSpy.mockClear();
    runSignupStatus({
      configDir: tempDir,
      flags: { json: true },
    });

    stdout = stdoutSpy.mock.calls
      .map((call: unknown[]) => String(call[0]))
      .join("");
    expect(JSON.parse(stdout)).toMatchObject({
      email: null,
      expired: false,
      pending: false,
      signup_command: "primitive signup <email> --accept-terms",
    });
  });

  it("reports expired pending signup state without deleting it", () => {
    writeFileSync(
      join(tempDir, "signup.json"),
      `${JSON.stringify({
        ...START_RESULT,
        api_base_url: DEFAULT_API_BASE_URL,
        created_at: "2026-05-01T00:00:00.000Z",
        expires_at: "2026-05-01T00:01:00.000Z",
      })}\n`,
    );

    runSignupStatus({
      configDir: tempDir,
      flags: { json: true },
    });

    const status = JSON.parse(
      stdoutSpy.mock.calls.map((call: unknown[]) => String(call[0])).join(""),
    );
    expect(status).toMatchObject({
      email: "test@example.com",
      expired: true,
      expires_at: "2026-05-01T00:01:00.000Z",
      expires_in: 0,
      pending: true,
    });
    expect(existsSync(join(tempDir, "signup.json"))).toBe(true);
  });

  it("fails status clearly when the supplied email does not match", () => {
    savePendingAgentSignup(tempDir, START_RESULT, DEFAULT_API_BASE_URL);

    expect(() =>
      runSignupStatus({
        configDir: tempDir,
        email: "other@example.com",
        flags: {},
      }),
    ).toThrow(
      "Pending signup is for test@example.com, not other@example.com. Run `primitive signup status` without an email argument to inspect it.",
    );
  });

  it("checks existing credentials as an already-locked operation", async () => {
    saveCliCredentials(tempDir, EXISTING_CREDENTIALS);
    const checkExistingLogin = vi.fn(async () => ({
      status: "valid" as const,
    }));
    const deps = flowDeps({}) as ReturnType<typeof flowDeps> & {
      checkExistingLogin: typeof checkExistingLogin;
    };
    deps.checkExistingLogin = checkExistingLogin;

    await expect(
      runSignupStartWithCredentialLock({
        configDir: tempDir,
        deps,
        email: "test@example.com",
        flags: {
          "accept-terms": true,
          "signup-code": "signup-code",
        },
      }),
    ).rejects.toThrow(/Already logged in/);

    expect(checkExistingLogin).toHaveBeenCalledWith(
      expect.objectContaining({
        configDir: tempDir,
        credentials: EXISTING_CREDENTIALS,
        credentialsLockHeld: true,
      }),
    );
  });

  it("confirms signup and saves returned OAuth credentials", async () => {
    const deps = flowDeps({});
    savePendingAgentSignup(tempDir, START_RESULT, DEFAULT_API_BASE_URL);
    writeFileSync(chatStatePath(tempDir), "{}\n");

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
    expect(loadPendingAgentSignup(tempDir, DEFAULT_API_BASE_URL)).toBeNull();
    expect(existsSync(chatStatePath(tempDir))).toBe(false);
  });

  it("passes org id during confirmation when provided", async () => {
    const deps = flowDeps({});
    savePendingAgentSignup(tempDir, START_RESULT, DEFAULT_API_BASE_URL);

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
    savePendingAgentSignup(tempDir, START_RESULT, DEFAULT_API_BASE_URL);

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
    expect(loadPendingAgentSignup(tempDir, DEFAULT_API_BASE_URL)).toMatchObject(
      {
        email: RESEND_RESULT.email,
        expires_in: expect.any(Number),
        signup_token: START_RESULT.signup_token,
      },
    );
  });

  it("infers the resend email from pending signup state", async () => {
    const deps = flowDeps({});
    savePendingAgentSignup(tempDir, START_RESULT, DEFAULT_API_BASE_URL);

    await runSignupResendWithCredentialLock({
      configDir: tempDir,
      deps,
      flags: {},
    });

    expect(deps.resendAgentSignupVerification).toHaveBeenCalledWith(
      expect.objectContaining({
        body: { signup_token: START_RESULT.signup_token },
      }),
    );
  });

  it("does not claim a resend occurred when the API says to slow down", async () => {
    const deps = flowDeps({
      resendAgentSignupVerification: vi.fn(async () => ({
        error: {
          error: {
            code: "slow_down",
            message: "Verification email was sent recently",
          },
        },
        response: new Response(null, { headers: { "Retry-After": "45" } }),
      })),
    });
    savePendingAgentSignup(tempDir, START_RESULT, DEFAULT_API_BASE_URL);

    await runSignupResendWithCredentialLock({
      configDir: tempDir,
      deps,
      email: "test@example.com",
      flags: {},
    });

    const stderr = writeSpy.mock.calls
      .map((call: unknown[]) => String(call[0]))
      .join("");
    expect(stderr).toContain(
      "Verification email was sent recently. Wait 45 seconds before trying again.\n",
    );
    expect(stderr).not.toContain("Sent a new");
    expect(
      loadPendingAgentSignup(tempDir, DEFAULT_API_BASE_URL)?.signup_token,
    ).toBe(START_RESULT.signup_token);
  });

  it("clears dead pending signup state when resend sees an expired token", async () => {
    const deps = flowDeps({
      resendAgentSignupVerification: vi.fn(async () => ({
        error: {
          error: {
            code: "expired_token",
            message: "Signup token expired",
          },
        },
      })),
    });
    savePendingAgentSignup(tempDir, START_RESULT, DEFAULT_API_BASE_URL);

    await expect(
      runSignupResendWithCredentialLock({
        configDir: tempDir,
        deps,
        email: "test@example.com",
        flags: {},
      }),
    ).rejects.toThrow(/Could not resend/);

    expect(loadPendingAgentSignup(tempDir, DEFAULT_API_BASE_URL)).toBeNull();
  });

  it("runs the full interactive flow when requested", async () => {
    const deps = flowDeps({
      promptAnswers: ["test@example.com", "123456"],
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

  it("keeps interactive resend in-place when the API says to slow down", async () => {
    const deps = flowDeps({
      promptAnswers: ["resend", "123456"],
      resendAgentSignupVerification: vi.fn(async () => ({
        error: {
          error: {
            code: "slow_down",
            message: "Verification email was sent recently",
          },
        },
        response: new Response(null, { headers: { "Retry-After": "30" } }),
      })),
    });
    savePendingAgentSignup(tempDir, START_RESULT, DEFAULT_API_BASE_URL);

    await runSignupInteractiveWithCredentialLock({
      configDir: tempDir,
      deps,
      flags: {},
    });

    const stderr = writeSpy.mock.calls
      .map((call: unknown[]) => String(call[0]))
      .join("");
    expect(stderr).toContain(
      "Verification email was sent recently. Wait 30 seconds before trying again.\n",
    );
    expect(stderr).not.toContain("Sent a new 6-digit verification code.");
    expect(deps.verifyAgentSignup).toHaveBeenCalledOnce();
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
      promptAnswers: ["test@example.com", "000000", "123456"],
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

  it("does not repeat the force replacement warning on interactive code retries", async () => {
    saveCliCredentials(tempDir, EXISTING_CREDENTIALS);
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
      promptAnswers: ["test@example.com", "000000", "123456"],
      verifyAgentSignup,
    });

    await runSignupInteractiveWithCredentialLock({
      configDir: tempDir,
      deps,
      flags: {
        force: true,
      },
    });

    const stderr = writeSpy.mock.calls
      .map((call: unknown[]) => String(call[0]))
      .join("");
    expect(
      stderr.match(
        /Replacing saved Primitive CLI credentials after signup because --force was set\./g,
      ) ?? [],
    ).toHaveLength(1);
    expect(verifyAgentSignup).toHaveBeenCalledTimes(2);
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
    savePendingAgentSignup(tempDir, START_RESULT, DEFAULT_API_BASE_URL);

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
      loadPendingAgentSignup(tempDir, DEFAULT_API_BASE_URL)?.signup_token,
    ).toBe(START_RESULT.signup_token);
  });
});
