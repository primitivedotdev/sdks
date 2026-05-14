import { randomUUID } from "node:crypto";
import {
  chmodSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { hostname } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { createInterface } from "node:readline/promises";
import { Command, Errors, Flags } from "@oclif/core";
import type {
  CliSignupResendResult,
  CliSignupStartResult,
  CliSignupVerifyResult,
} from "@primitivedotdev/api-core";
import {
  PrimitiveApiClient,
  resendCliSignupVerification,
  startCliSignup,
  verifyCliSignup,
} from "@primitivedotdev/api-core";
import {
  extractErrorCode,
  extractErrorPayload,
  writeErrorWithHints,
} from "../api-command.js";
import {
  acquireCliCredentialsLock,
  credentialsPath,
  loadCliCredentials,
  normalizeApiBaseUrl1,
  type StoredCliCredentials,
  saveCliCredentials,
} from "../auth.js";
import { checkExistingLogin } from "./login.js";

const INVALID_VERIFICATION_CODE = "invalid_verification_code";
const CLERK_PASSWORD_REJECTED = "clerk_password_rejected";
const EXPIRED_TOKEN = "expired_token";
const INVALID_SIGNUP_TOKEN = "invalid_signup_token";
const SLOW_DOWN = "slow_down";
const PENDING_SIGNUP_FILE = "signup.json";

export type SignupFlags = {
  "api-base-url-1"?: string;
  "device-name"?: string;
  force?: boolean;
};

export type PendingCliSignup = CliSignupStartResult & {
  api_base_url_1: string;
  created_at: string;
  expires_at: string;
};

type SignupFlowDeps = {
  checkExistingLogin?: typeof checkExistingLogin;
  confirmTerms?: typeof confirmTerms;
  promptNewPassword?: typeof promptNewPassword;
  promptRequired?: typeof promptRequired;
  resendCliSignupVerification?: typeof resendCliSignupVerification;
  startCliSignup?: typeof startCliSignup;
  verifyCliSignup?: typeof verifyCliSignup;
};

function cliError(message: string): Errors.CLIError {
  return new Errors.CLIError(message, { exit: 1 });
}

function unwrapData<T>(value: unknown): T | null {
  const envelope = value as { data?: T } | null | undefined;
  return envelope?.data ?? null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function pendingSignupFromJson(value: unknown): PendingCliSignup | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.signup_token !== "string" ||
    typeof value.email !== "string" ||
    typeof value.expires_in !== "number" ||
    typeof value.resend_after !== "number" ||
    typeof value.verification_code_length !== "number" ||
    typeof value.api_base_url_1 !== "string" ||
    typeof value.created_at !== "string" ||
    typeof value.expires_at !== "string"
  ) {
    return null;
  }

  return {
    api_base_url_1: value.api_base_url_1,
    created_at: value.created_at,
    email: value.email,
    expires_at: value.expires_at,
    expires_in: value.expires_in,
    resend_after: value.resend_after,
    signup_token: value.signup_token,
    verification_code_length: value.verification_code_length,
  };
}

export function pendingSignupPath(configDir: string): string {
  return join(configDir, PENDING_SIGNUP_FILE);
}

export function deletePendingCliSignup(configDir: string): void {
  rmSync(pendingSignupPath(configDir), { force: true });
}

function pendingSignupFromStart(
  start: CliSignupStartResult,
  apiBaseUrl1: string,
): PendingCliSignup {
  return {
    ...start,
    api_base_url_1: apiBaseUrl1,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + start.expires_in * 1000).toISOString(),
  };
}

export function savePendingCliSignup(
  configDir: string,
  start: CliSignupStartResult,
  apiBaseUrl1: string,
): PendingCliSignup {
  mkdirSync(configDir, { mode: 0o700, recursive: true });
  const pending = pendingSignupFromStart(start, apiBaseUrl1);
  const path = pendingSignupPath(configDir);
  const tempPath = join(
    configDir,
    `${PENDING_SIGNUP_FILE}.${process.pid}.${randomUUID()}.tmp`,
  );
  try {
    writeFileSync(tempPath, `${JSON.stringify(pending, null, 2)}\n`, {
      mode: 0o600,
    });
    chmodSync(tempPath, 0o600);
    renameSync(tempPath, path);
    chmodSync(path, 0o600);
    return pending;
  } catch (error) {
    rmSync(tempPath, { force: true });
    throw error;
  }
}

export function loadPendingCliSignup(
  configDir: string,
  apiBaseUrl1: string,
): PendingCliSignup | null {
  const path = pendingSignupPath(configDir);
  let contents: string;
  try {
    contents = readFileSync(path, "utf8");
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      (error as { code?: unknown }).code === "ENOENT"
    ) {
      return null;
    }
    throw error;
  }

  let pending: PendingCliSignup | null;
  try {
    pending = pendingSignupFromJson(JSON.parse(contents));
  } catch {
    pending = null;
  }

  if (!pending) {
    deletePendingCliSignup(configDir);
    return null;
  }
  if (pending.api_base_url_1 !== apiBaseUrl1) return null;
  if (new Date(pending.expires_at).getTime() <= Date.now()) {
    deletePendingCliSignup(configDir);
    return null;
  }

  return {
    ...pending,
    expires_in: Math.max(
      0,
      Math.ceil((new Date(pending.expires_at).getTime() - Date.now()) / 1000),
    ),
  };
}

export function retryAfterSeconds(result: unknown): number | null {
  const response = (result as { response?: Response }).response;
  const raw = response?.headers.get("retry-after");
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalizeAnswer(value: string): string {
  return value.trim();
}

async function promptLine(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  try {
    return normalizeAnswer(await rl.question(question));
  } finally {
    rl.close();
  }
}

export async function promptHidden(question: string): Promise<string> {
  if (
    !process.stdin.isTTY ||
    !process.stderr.isTTY ||
    !process.stdin.setRawMode
  ) {
    throw cliError(
      "Password input requires an interactive terminal with hidden input support.",
    );
  }

  return new Promise((resolve, reject) => {
    const input = process.stdin;
    let value = "";
    const cleanup = (): void => {
      input.setRawMode(false);
      input.pause();
      input.off("data", onData);
    };
    const finish = (): void => {
      cleanup();
      process.stderr.write("\n");
      resolve(value);
    };
    const onData = (chunk: Buffer): void => {
      const text = chunk.toString("utf8");
      for (const char of text) {
        if (char === "\u0003") {
          cleanup();
          process.stderr.write("\n");
          reject(cliError("Signup cancelled."));
          return;
        }
        if (char === "\r" || char === "\n") {
          finish();
          return;
        }
        if (char === "\b" || char === "\u007f") {
          value = value.slice(0, -1);
          continue;
        }
        value += char;
      }
    };

    process.stderr.write(question);
    input.setRawMode(true);
    input.resume();
    input.on("data", onData);
  });
}

export function formatSignupSeconds(
  seconds: number | null | undefined,
): string {
  if (
    typeof seconds !== "number" ||
    !Number.isFinite(seconds) ||
    seconds <= 0
  ) {
    return "soon";
  }
  if (seconds < 60) return `${Math.ceil(seconds)} seconds`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

export function shouldRetrySignupPassword(
  errorCode: string | undefined,
): boolean {
  return errorCode === CLERK_PASSWORD_REJECTED;
}

async function promptRequired(question: string): Promise<string> {
  while (true) {
    const value = await promptLine(question);
    if (value) return value;
    process.stderr.write("Please enter a value.\n");
  }
}

async function promptRequiredPassword(question: string): Promise<string> {
  while (true) {
    const value = await promptHidden(question);
    if (value) return value;
    process.stderr.write("Please enter a password.\n");
  }
}

async function promptNewPassword(): Promise<string> {
  while (true) {
    const password = await promptRequiredPassword("Password: ");
    const confirmation = await promptRequiredPassword("Confirm password: ");
    if (password === confirmation) return password;
    process.stderr.write("Passwords did not match. Try again.\n");
  }
}

async function confirmTerms(): Promise<void> {
  process.stderr.write(
    "By creating an account, you agree to Primitive's Terms of Service and Privacy Policy:\n",
  );
  process.stderr.write("  https://primitive.dev/terms\n");
  process.stderr.write("  https://primitive.dev/privacy\n");
  const answer = (
    await promptRequired("Type 'yes' to continue: ")
  ).toLowerCase();
  if (answer !== "yes" && answer !== "y") {
    throw cliError("You must accept the terms to create an account.");
  }
}

async function resendVerificationCode(params: {
  apiBaseUrl1: string;
  apiClient: PrimitiveApiClient;
  configDir: string;
  deps: SignupFlowDeps;
  start: CliSignupStartResult;
}): Promise<CliSignupStartResult> {
  const resendFn =
    params.deps.resendCliSignupVerification ?? resendCliSignupVerification;
  const resent = await resendFn({
    body: { signup_token: params.start.signup_token },
    client: params.apiClient.client,
    responseStyle: "fields",
  });

  if (resent.data) {
    const resend = unwrapData<CliSignupResendResult>(resent.data);
    const next = resend
      ? {
          email: resend.email,
          expires_in: resend.expires_in,
          resend_after: resend.resend_after,
          signup_token: params.start.signup_token,
          verification_code_length: resend.verification_code_length,
        }
      : params.start;
    savePendingCliSignup(params.configDir, next, params.apiBaseUrl1);
    process.stderr.write(
      `Sent a new ${next.verification_code_length}-digit verification code. It expires in ${formatSignupSeconds(next.expires_in)}.\n`,
    );
    return next;
  }

  const payload = extractErrorPayload(resent.error);
  const code = extractErrorCode(payload);
  if (code === SLOW_DOWN) {
    const retryAfter = retryAfterSeconds(resent) ?? params.start.resend_after;
    const suffix = ` Wait ${formatSignupSeconds(retryAfter)} before trying again.`;
    process.stderr.write(`Verification email was sent recently.${suffix}\n`);
    return params.start;
  }

  writeErrorWithHints(payload);
  throw cliError("Could not resend Primitive CLI signup verification email.");
}

export async function runSignupWithCredentialLock(params: {
  configDir: string;
  deps?: SignupFlowDeps;
  flags: SignupFlags;
}): Promise<void> {
  const { configDir, flags } = params;
  const deps = params.deps ?? {};
  const promptRequiredFn = deps.promptRequired ?? promptRequired;
  const promptNewPasswordFn = deps.promptNewPassword ?? promptNewPassword;
  const confirmTermsFn = deps.confirmTerms ?? confirmTerms;
  const startFn = deps.startCliSignup ?? startCliSignup;
  const verifyFn = deps.verifyCliSignup ?? verifyCliSignup;
  const checkExistingLoginFn = deps.checkExistingLogin ?? checkExistingLogin;
  const apiBaseUrl1 = normalizeApiBaseUrl1(flags["api-base-url-1"]);
  let existing: StoredCliCredentials | null;
  try {
    existing = loadCliCredentials(configDir);
  } catch (error) {
    if (!flags.force) throw error;
    const detail = error instanceof Error ? error.message : String(error);
    process.stderr.write(
      `Replacing unreadable Primitive CLI credentials because --force was set: ${detail}\n`,
    );
    existing = null;
  }

  if (existing && flags.force) {
    process.stderr.write(
      "Replacing saved Primitive CLI credentials after signup because --force was set.\n",
    );
  } else if (existing) {
    const existingStatus = await checkExistingLoginFn({
      apiBaseUrl1: flags["api-base-url-1"],
      configDir,
      credentials: existing,
    });
    if (existingStatus.status === "removed_stale") {
      process.stderr.write("Continuing with Primitive CLI signup...\n");
    } else if (existingStatus.status === "blocked") {
      writeErrorWithHints(existingStatus.payload);
      throw cliError(existingStatus.message);
    } else {
      const org = existing.org_name ? ` for ${existing.org_name}` : "";
      throw cliError(
        `Already logged in${org}. Run \`primitive logout\` before creating a new account.`,
      );
    }
  }

  if (flags.force) {
    deletePendingCliSignup(configDir);
  }

  const apiClient = new PrimitiveApiClient({ apiBaseUrl1 });
  let start: CliSignupStartResult | null = flags.force
    ? null
    : loadPendingCliSignup(configDir, apiBaseUrl1);

  if (start) {
    process.stderr.write(
      `Continuing pending Primitive CLI signup for ${start.email}.\n`,
    );
  } else {
    const signupCode = await promptRequiredFn("Signup code: ");
    const email = await promptRequiredFn("Email: ");
    await confirmTermsFn();

    const deviceName = flags["device-name"] ?? hostname();
    const started = await startFn({
      body: {
        device_name: deviceName,
        email,
        signup_code: signupCode,
        terms_accepted: true,
      },
      client: apiClient.client,
      responseStyle: "fields",
    });

    if (started.error) {
      writeErrorWithHints(extractErrorPayload(started.error));
      throw cliError("Could not start Primitive CLI signup.");
    }

    const startResult = unwrapData<CliSignupStartResult>(started.data);
    if (!startResult) {
      throw cliError("Primitive API returned an empty CLI signup response.");
    }
    start = savePendingCliSignup(configDir, startResult, apiBaseUrl1);
  }

  let password = await promptNewPasswordFn();

  process.stderr.write(
    `Sent a ${start.verification_code_length}-digit verification code to ${start.email}.\n`,
  );
  process.stderr.write(
    `The code expires in ${formatSignupSeconds(start.expires_in)}.\n`,
  );
  process.stderr.write(
    `Enter the code from the email, or type \`resend\` to send a new code after ${formatSignupSeconds(start.resend_after)}.\n`,
  );

  while (true) {
    const verificationCode = await promptRequiredFn(
      `Verification code (${start.verification_code_length} digits): `,
    );
    if (verificationCode.toLowerCase() === "resend") {
      start = await resendVerificationCode({
        apiBaseUrl1,
        apiClient,
        configDir,
        deps,
        start,
      });
      continue;
    }

    const verified = await verifyFn({
      body: {
        password,
        signup_token: start.signup_token,
        verification_code: verificationCode,
      },
      client: apiClient.client,
      responseStyle: "fields",
    });

    if (verified.data) {
      const signup = unwrapData<CliSignupVerifyResult>(verified.data);
      if (!signup) {
        throw cliError(
          "Primitive API returned an empty CLI signup verification response.",
        );
      }

      saveCliCredentials(configDir, {
        api_key: signup.api_key,
        api_base_url_1: apiBaseUrl1,
        created_at: new Date().toISOString(),
        key_id: signup.key_id,
        key_prefix: signup.key_prefix,
        org_id: signup.org_id,
        org_name: signup.org_name,
      });
      deletePendingCliSignup(configDir);

      const org = signup.org_name ? ` (${signup.org_name})` : "";
      process.stderr.write(
        `Created account and logged in to org ${signup.org_id}${org}.\n`,
      );
      process.stderr.write(
        `Saved credentials to ${credentialsPath(configDir)}.\n`,
      );
      return;
    }

    const payload = extractErrorPayload(verified.error);
    const code = extractErrorCode(payload);
    if (code === INVALID_VERIFICATION_CODE) {
      process.stderr.write(
        "Invalid verification code. Try again or type `resend`.\n",
      );
      continue;
    }
    if (shouldRetrySignupPassword(code)) {
      writeErrorWithHints(payload);
      process.stderr.write("Choose a different password and try again.\n");
      password = await promptNewPasswordFn();
      continue;
    }
    if (code === EXPIRED_TOKEN || code === INVALID_SIGNUP_TOKEN) {
      deletePendingCliSignup(configDir);
    }

    writeErrorWithHints(payload);
    throw cliError("Primitive CLI signup failed while verifying the account.");
  }
}

class SignupCommand extends Command {
  static description =
    "Create a Primitive account from the terminal, verify your email, and save an org-scoped CLI API key locally.";

  static summary = "Create an account and log in";

  static examples = [
    "<%= config.bin %> signup",
    "<%= config.bin %> signup --device-name work-laptop",
    "<%= config.bin %> signup --force",
  ];

  static flags = {
    "api-base-url-1": Flags.string({
      description:
        "Override the primary API base URL. Internal testing only; not documented to customers.",
      env: "PRIMITIVE_API_BASE_URL_1",
      hidden: true,
    }),
    "device-name": Flags.string({
      description: "Device name used for the created CLI API key",
    }),
    force: Flags.boolean({
      char: "f",
      description:
        "Replace saved credentials without first verifying the existing login",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(SignupCommand);

    let releaseCredentialsLock: () => void;
    try {
      releaseCredentialsLock = acquireCliCredentialsLock(this.config.configDir);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw cliError(detail);
    }

    try {
      await this.runWithCredentialLock(flags);
    } finally {
      releaseCredentialsLock();
    }
  }

  private async runWithCredentialLock(flags: SignupFlags): Promise<void> {
    await runSignupWithCredentialLock({
      configDir: this.config.configDir,
      flags,
    });
  }
}

export default SignupCommand;
