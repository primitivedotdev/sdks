import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Errors } from "@oclif/core";
import { DEFAULT_API_BASE_URL } from "@primitivedotdev/api-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadCliCredentials,
  type StoredCliCredentials,
  saveCliCredentials,
} from "../../src/oclif/auth.js";
import { chatStatePath } from "../../src/oclif/chat-state.js";
import {
  DEFAULT_SIGNUP_COMMAND_COPY,
  formatSignupSeconds,
  loadPendingAgentSignup,
  managedDomainLoginError,
  resolveVerificationCode,
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
  interactive?: boolean;
  promptAnswers?: string[];
  resendAgentSignupVerification?: unknown;
  startAgentSignup?: unknown;
  verifyAgentSignup?: unknown;
}) {
  return {
    confirmTerms: params.confirmTerms ?? vi.fn(async () => undefined),
    interactive: params.interactive ?? true,
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

describe("resolveVerificationCode", () => {
  it("returns the positional value when only the positional source is set", () => {
    const result = resolveVerificationCode({ positional: "123456" });
    expect(result).toEqual({ kind: "ok", code: "123456" });
  });

  it("reads the value from the named environment variable", () => {
    const result = resolveVerificationCode({
      fromEnv: "TEST_CODE",
      env: { TEST_CODE: "482917" },
    });
    expect(result).toEqual({ kind: "ok", code: "482917" });
  });

  it("strips a single trailing newline from --code-from-env values", () => {
    // Reading via shell `read CODE; export CODE` leaves a trailing LF when
    // some shells dump env vars; trimming exactly one CR/LF protects against
    // that without swallowing intentional whitespace inside the code.
    const result = resolveVerificationCode({
      fromEnv: "TEST_CODE",
      env: { TEST_CODE: "482917\n" },
    });
    expect(result).toEqual({ kind: "ok", code: "482917" });
  });

  it("reads the value from --code-from-file and strips the trailing newline", () => {
    const result = resolveVerificationCode({
      fromFile: "/run/user/1000/code",
      readFile: () => "482917\n",
    });
    expect(result).toEqual({ kind: "ok", code: "482917" });
  });

  it("reads the value from --code-from-stdin and strips the trailing newline", () => {
    const result = resolveVerificationCode({
      fromStdin: true,
      readStdin: () => "482917\n",
    });
    expect(result).toEqual({ kind: "ok", code: "482917" });
  });

  it("rejects when no source is set", () => {
    const result = resolveVerificationCode({});
    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.message).toContain(
        "Pass the verification code as a positional argument",
      );
    }
  });

  it("rejects when two sources are set", () => {
    // The exactly-one rule keeps callers from constructing a command that
    // looks like it consumes from stdin but silently picks the positional
    // arg, or vice versa. Both names appear in the error so the user can
    // see which sources collided.
    const result = resolveVerificationCode({
      positional: "123456",
      fromEnv: "TEST_CODE",
      env: { TEST_CODE: "482917" },
    });
    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.message).toContain("positional");
      expect(result.message).toContain("--code-from-env");
    }
  });

  it("rejects --code-from-env pointing at an unset variable", () => {
    const result = resolveVerificationCode({
      fromEnv: "MISSING_VAR",
      env: {},
    });
    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.message).toContain("MISSING_VAR");
      expect(result.message).toContain("not set");
    }
  });

  it("surfaces a file read failure as a structured error", () => {
    const result = resolveVerificationCode({
      fromFile: "/no/such/file",
      readFile: () => {
        throw new Error("ENOENT: no such file or directory");
      },
    });
    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.message).toContain("/no/such/file");
      expect(result.message).toContain("ENOENT");
    }
  });

  it("surfaces a stdin read failure as a structured error", () => {
    const result = resolveVerificationCode({
      fromStdin: true,
      readStdin: () => {
        throw new Error("stdin is a TTY");
      },
    });
    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.message).toContain("--code-from-stdin");
      expect(result.message).toContain("TTY");
    }
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
      },
    });

    expect(deps.confirmTerms).not.toHaveBeenCalled();
    expect(deps.startAgentSignup).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          email: "test@example.com",
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

  it("never prompts for or sends a signup code", async () => {
    // A user with no email is still prompted for that (it's required
    // for the verification round trip), and terms are still confirmed.
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
    const body = startCall?.body;
    if (!body) throw new Error("startAgentSignup was not called with a body");
    expect(body).toEqual(
      expect.objectContaining({
        email: "test@example.com",
        terms_accepted: true,
      }),
    );
    expect(Object.hasOwn(body, "signup_code")).toBe(false);
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

const MANAGED_DOMAIN_REFUSAL = {
  error: {
    error: {
      code: "managed_domain",
      message:
        "You can't sign up with an email address on a domain that's managed by Primitive. Use a different email address.",
    },
  },
};

const LOGIN_COPY = {
  ...DEFAULT_SIGNUP_COMMAND_COPY,
  actionNoun: "login",
  actionGerund: "logging in",
  browserLoginCommand: "login browser",
  startCommand: (email: string) => `login otp ${email}`,
};

async function cliErrorFrom(
  promise: Promise<unknown>,
): Promise<Errors.CLIError> {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught,
  );
  if (!(error instanceof Errors.CLIError)) {
    throw new Error(`expected a CLIError, got ${String(error)}`);
  }
  return error;
}

// Set whether stdin and stderr are terminals; returns the undo.
function setTerminals(
  stdin: boolean | undefined,
  stderr: boolean | undefined,
): () => void {
  const saved = [
    [process.stdin, Object.getOwnPropertyDescriptor(process.stdin, "isTTY")],
    [process.stderr, Object.getOwnPropertyDescriptor(process.stderr, "isTTY")],
  ] as const;
  Object.defineProperty(process.stdin, "isTTY", {
    configurable: true,
    value: stdin,
  });
  Object.defineProperty(process.stderr, "isTTY", {
    configurable: true,
    value: stderr,
  });
  return () => {
    for (const [stream, descriptor] of saved) {
      if (descriptor) Object.defineProperty(stream, "isTTY", descriptor);
      else delete (stream as { isTTY?: boolean }).isTTY;
    }
  };
}

// The flows below resolve the API client; keep this shell's own agent
// profile or API key out of them.
function isolateFromShell(): void {
  vi.stubEnv("PRIMITIVE_AGENT_PROFILE", undefined);
  vi.stubEnv("PRIMITIVE_AGENT_ADDRESS", undefined);
  vi.stubEnv("PRIMITIVE_API_KEY", undefined);
}

describe("email-code prompts without a terminal", () => {
  let tempDir: string;
  let writeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    isolateFromShell();
    tempDir = mkdtempSync(join(tmpdir(), "primitive-cli-signup-tty-test-"));
    writeSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    writeSpy.mockRestore();
    vi.unstubAllEnvs();
    rmSync(tempDir, { force: true, recursive: true });
  });

  it("refuses unaccepted terms before checking a saved login or calling the API", async () => {
    saveCliCredentials(tempDir, EXISTING_CREDENTIALS);
    const checkExistingLogin = vi.fn(async () => ({
      status: "valid" as const,
    }));
    const deps = {
      ...flowDeps({ interactive: false }),
      checkExistingLogin,
    };

    const error = await cliErrorFrom(
      runSignupStartWithCredentialLock({
        configDir: tempDir,
        copy: LOGIN_COPY,
        deps,
        email: "member@example.com",
        flags: {},
      }),
    );

    expect(error.oclif.exit).toBe(2);
    expect(error.message).toBe(
      "Not starting login: no terminal to accept the terms in. To accept Primitive's Terms of Service (https://primitive.dev/terms) and Privacy Policy (https://primitive.dev/privacy), add --accept-terms to the same command, for example `primitive login otp member@example.com --accept-terms`.",
    );
    expect(deps.confirmTerms).not.toHaveBeenCalled();
    expect(checkExistingLogin).not.toHaveBeenCalled();
    expect(deps.startAgentSignup).not.toHaveBeenCalled();
  });

  it.each([
    ["no email", undefined],
    ["a blank email", "  "],
  ])("refuses %s instead of prompting for one", async (_case, email) => {
    const deps = flowDeps({ interactive: false });

    const error = await cliErrorFrom(
      runSignupStartWithCredentialLock({
        configDir: tempDir,
        deps,
        email,
        flags: { "accept-terms": true },
      }),
    );

    expect(error.oclif.exit).toBe(2);
    expect(error.message).toContain(
      "for example `primitive signup <email> --accept-terms`",
    );
    expect(deps.promptRequired).not.toHaveBeenCalled();
    expect(deps.startAgentSignup).not.toHaveBeenCalled();
  });

  it.each([
    ["stdin and stderr are terminals", true, true, true],
    ["only stdin is a terminal", true, undefined, false],
    ["only stderr is a terminal", undefined, true, false],
  ])(
    "prompts for the terms only when %s",
    async (_case, stdinTTY, stderrTTY, prompts) => {
      const restore = setTerminals(stdinTTY, stderrTTY);
      try {
        const { interactive: _unset, ...deps } = flowDeps({});
        const started = runSignupStartWithCredentialLock({
          configDir: tempDir,
          deps,
          email: "test@example.com",
          flags: {},
        });
        if (prompts) {
          await started;
          expect(deps.confirmTerms).toHaveBeenCalledOnce();
        } else {
          expect((await cliErrorFrom(started)).oclif.exit).toBe(2);
          expect(deps.confirmTerms).not.toHaveBeenCalled();
        }
      } finally {
        restore();
      }
    },
  );

  it("starts without a terminal when the email and --accept-terms are given", async () => {
    const deps = flowDeps({ interactive: false });

    await runSignupStartWithCredentialLock({
      configDir: tempDir,
      deps,
      email: "test@example.com",
      flags: { "accept-terms": true },
    });

    expect(deps.confirmTerms).not.toHaveBeenCalled();
    expect(deps.startAgentSignup).toHaveBeenCalledOnce();
  });

  it("refuses interactive signup before asking anything", async () => {
    const deps = flowDeps({ interactive: false });

    const error = await cliErrorFrom(
      runSignupInteractiveWithCredentialLock({
        configDir: tempDir,
        deps,
        flags: { "accept-terms": true },
      }),
    );

    expect(error.oclif.exit).toBe(2);
    expect(error.message).toContain(
      "Run `primitive signup <email> --accept-terms`, then `primitive signup confirm <email> <code>`.",
    );
    expect(deps.promptRequired).not.toHaveBeenCalled();
    expect(deps.startAgentSignup).not.toHaveBeenCalled();
  });
});

describe("email-code login on a domain Primitive receives mail for", () => {
  let tempDir: string;
  let writeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    isolateFromShell();
    tempDir = mkdtempSync(join(tmpdir(), "primitive-cli-signup-managed-test-"));
    writeSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    writeSpy.mockRestore();
    vi.unstubAllEnvs();
    rmSync(tempDir, { force: true, recursive: true });
  });

  function stderr(): string {
    return writeSpy.mock.calls
      .map((call: unknown[]) => String(call[0]))
      .join("");
  }

  it("points a login at browser approval instead of the signup refusal", async () => {
    const deps = flowDeps({
      startAgentSignup: vi.fn(async () => MANAGED_DOMAIN_REFUSAL),
    });

    const error = await cliErrorFrom(
      runSignupStartWithCredentialLock({
        configDir: tempDir,
        copy: LOGIN_COPY,
        deps,
        email: "member@Managed.example",
        flags: { "accept-terms": true },
      }),
    );

    expect(error.oclif.exit).toBe(1);
    expect(error.code).toBe("managed_domain");
    expect(error.message).toBe(
      "Primitive sends no emailed code to addresses on managed.example, a domain it receives mail for. Use browser login instead: run `primitive login browser`.",
    );
    expect(stderr()).not.toContain("You can't sign up");
    expect(loadPendingAgentSignup(tempDir, DEFAULT_API_BASE_URL)).toBeNull();
  });

  it("adds --no-browser when there is no terminal", () => {
    const error = managedDomainLoginError({
      browserLoginCommand: "signin browser",
      email: "member@managed.example",
      interactive: false,
    });

    expect(error.message).toBe(
      "Primitive sends no emailed code to addresses on managed.example, a domain it receives mail for. Use browser login instead: run `primitive signin browser --no-browser` and open the link it prints.",
    );
  });

  it("gives the same guidance, and keeps the pending code, when the code is refused at confirmation", async () => {
    const deps = flowDeps({
      interactive: false,
      verifyAgentSignup: vi.fn(async () => MANAGED_DOMAIN_REFUSAL),
    });
    savePendingAgentSignup(tempDir, START_RESULT, DEFAULT_API_BASE_URL);

    const error = await cliErrorFrom(
      runSignupConfirmWithCredentialLock({
        code: "123456",
        configDir: tempDir,
        copy: LOGIN_COPY,
        deps,
        email: "test@example.com",
        flags: {},
      }),
    );

    expect(error.code).toBe("managed_domain");
    expect(error.message).toContain(
      "Primitive sends no emailed code to addresses on example.com",
    );
    expect(error.message).toContain(
      "run `primitive login browser --no-browser` and open the link it prints.",
    );
    // The server gives the same answer when it could not tell, so the code
    // may still finish on a retry.
    expect(
      loadPendingAgentSignup(tempDir, DEFAULT_API_BASE_URL)?.signup_token,
    ).toBe(START_RESULT.signup_token);
  });

  it("keeps the server's refusal for signup", async () => {
    const deps = flowDeps({
      startAgentSignup: vi.fn(async () => MANAGED_DOMAIN_REFUSAL),
    });

    const error = await cliErrorFrom(
      runSignupStartWithCredentialLock({
        configDir: tempDir,
        deps,
        email: "member@managed.example",
        flags: { "accept-terms": true },
      }),
    );

    expect(error.message).toBe("Could not start Primitive signup.");
    expect(error.code).toBeUndefined();
    expect(stderr()).toContain(
      "You can't sign up with an email address on a domain that's managed by Primitive.",
    );
  });
});
