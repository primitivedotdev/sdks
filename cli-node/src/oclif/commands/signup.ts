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
import { Args, Command, Errors, Flags } from "@oclif/core";
import type {
  AgentSignupResendResult,
  AgentSignupStartResult,
  AgentSignupVerifyResult,
  PrimitiveApiClient,
} from "@primitivedotdev/api-core";
import {
  resendAgentSignupVerification,
  startAgentSignup,
  verifyAgentSignup,
} from "@primitivedotdev/api-core";
import { createCliApiClient } from "../api-client.js";
import {
  extractErrorCode,
  extractErrorPayload,
  writeErrorWithHints,
} from "../api-command.js";
import {
  acquireCliCredentialsLock,
  cliAccessTokenExpiresAt,
  credentialsPath,
  loadCliCredentials,
  type StoredCliCredentials,
  saveCliCredentials,
} from "../auth.js";
import { checkExistingLogin } from "./login.js";

const INVALID_VERIFICATION_CODE = "invalid_verification_code";
const EXPIRED_TOKEN = "expired_token";
const INVALID_SIGNUP_TOKEN = "invalid_signup_token";
const SLOW_DOWN = "slow_down";
const PENDING_SIGNUP_FILE = "signup.json";

export type SignupFlags = {
  "accept-terms"?: boolean;
  "api-base-url-1"?: string;
  "device-name"?: string;
  "signup-code"?: string;
  force?: boolean;
};

type SignupConfirmFlags = {
  "api-base-url-1"?: string;
  "org-id"?: string;
  force?: boolean;
};

type SignupResendFlags = {
  "api-base-url-1"?: string;
};

export type PendingAgentSignup = AgentSignupStartResult & {
  api_base_url_1: string;
  created_at: string;
  expires_at: string;
};

type SignupFlowDeps = {
  checkExistingLogin?: typeof checkExistingLogin;
  confirmTerms?: typeof confirmTerms;
  promptRequired?: typeof promptRequired;
  resendAgentSignupVerification?: typeof resendAgentSignupVerification;
  startAgentSignup?: typeof startAgentSignup;
  verifyAgentSignup?: typeof verifyAgentSignup;
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

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function pendingSignupFromJson(value: unknown): PendingAgentSignup | null {
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

export function deletePendingAgentSignup(configDir: string): void {
  rmSync(pendingSignupPath(configDir), { force: true });
}

export const deletePendingCliSignup = deletePendingAgentSignup;

function pendingSignupFromStart(
  start: AgentSignupStartResult,
  apiBaseUrl1: string,
): PendingAgentSignup {
  return {
    ...start,
    api_base_url_1: apiBaseUrl1,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + start.expires_in * 1000).toISOString(),
  };
}

export function savePendingAgentSignup(
  configDir: string,
  start: AgentSignupStartResult,
  apiBaseUrl1: string,
): PendingAgentSignup {
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

export const savePendingCliSignup = savePendingAgentSignup;

export function loadPendingAgentSignup(
  configDir: string,
  apiBaseUrl1: string,
): PendingAgentSignup | null {
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

  let pending: PendingAgentSignup | null;
  try {
    pending = pendingSignupFromJson(JSON.parse(contents));
  } catch {
    pending = null;
  }

  if (!pending) {
    deletePendingAgentSignup(configDir);
    return null;
  }
  if (pending.api_base_url_1 !== apiBaseUrl1) return null;
  if (new Date(pending.expires_at).getTime() <= Date.now()) {
    deletePendingAgentSignup(configDir);
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

export const loadPendingCliSignup = loadPendingAgentSignup;

function requirePendingSignupForEmail(params: {
  apiBaseUrl1: string;
  configDir: string;
  email: string;
}): PendingAgentSignup {
  const pending = loadPendingAgentSignup(params.configDir, params.apiBaseUrl1);
  if (!pending) {
    throw cliError(
      `No pending signup for ${params.email}. Run \`primitive signup ${params.email}\` first.`,
    );
  }
  if (normalizeEmail(pending.email) !== normalizeEmail(params.email)) {
    throw cliError(
      `Pending signup is for ${pending.email}, not ${params.email}. Run \`primitive signup ${params.email} --force\` to replace it.`,
    );
  }
  return pending;
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

async function promptRequired(question: string): Promise<string> {
  while (true) {
    const value = await promptLine(question);
    if (value) return value;
    process.stderr.write("Please enter a value.\n");
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

async function checkExistingCredentials(params: {
  apiBaseUrl1?: string;
  configDir: string;
  flags: { force?: boolean };
  deps: SignupFlowDeps;
}): Promise<void> {
  const checkExistingLoginFn =
    params.deps.checkExistingLogin ?? checkExistingLogin;
  let existing: StoredCliCredentials | null;
  try {
    existing = loadCliCredentials(params.configDir);
  } catch (error) {
    if (!params.flags.force) throw error;
    const detail = error instanceof Error ? error.message : String(error);
    process.stderr.write(
      `Replacing unreadable Primitive CLI credentials because --force was set: ${detail}\n`,
    );
    existing = null;
  }

  if (existing && params.flags.force) {
    process.stderr.write(
      "Replacing saved Primitive CLI credentials after signup because --force was set.\n",
    );
    return;
  }
  if (!existing) return;

  const existingStatus = await checkExistingLoginFn({
    apiBaseUrl1: params.apiBaseUrl1,
    configDir: params.configDir,
    credentials: existing,
  });
  if (existingStatus.status === "removed_stale") {
    process.stderr.write("Continuing with Primitive signup...\n");
    return;
  }
  if (existingStatus.status === "blocked") {
    writeErrorWithHints(existingStatus.payload);
    throw cliError(existingStatus.message);
  }

  const org = existing.org_name ? ` for ${existing.org_name}` : "";
  throw cliError(
    `Already logged in${org}. Run \`primitive logout\` before creating a new account.`,
  );
}

function saveSignupCredentials(params: {
  apiBaseUrl1: string;
  configDir: string;
  signup: AgentSignupVerifyResult;
}): void {
  saveCliCredentials(params.configDir, {
    access_token: params.signup.access_token,
    api_base_url_1: params.apiBaseUrl1,
    auth_method: "oauth",
    created_at: new Date().toISOString(),
    expires_at: cliAccessTokenExpiresAt(params.signup.expires_in),
    oauth_client_id: params.signup.oauth_client_id,
    oauth_grant_id: params.signup.oauth_grant_id,
    org_id: params.signup.org_id,
    org_name: params.signup.org_name,
    refresh_token: params.signup.refresh_token,
    token_type: params.signup.token_type,
  });
}

function writeStartInstructions(start: PendingAgentSignup): void {
  process.stderr.write(
    `Sent a ${start.verification_code_length}-digit verification code to ${start.email}.\n`,
  );
  process.stderr.write(
    `The code expires in ${formatSignupSeconds(start.expires_in)}.\n`,
  );
  process.stderr.write(
    `Run \`primitive signup confirm ${start.email} <code>\` to finish.\n`,
  );
}

async function startSignup(params: {
  apiBaseUrl1: string;
  apiClient: PrimitiveApiClient;
  configDir: string;
  deps: SignupFlowDeps;
  email: string;
  flags: SignupFlags;
}): Promise<PendingAgentSignup> {
  const existingPending = loadPendingAgentSignup(
    params.configDir,
    params.apiBaseUrl1,
  );
  if (existingPending && !params.flags.force) {
    if (
      normalizeEmail(existingPending.email) === normalizeEmail(params.email)
    ) {
      process.stderr.write(
        `Continuing pending Primitive signup for ${existingPending.email}.\n`,
      );
      process.stderr.write(
        `Run \`primitive signup confirm ${existingPending.email} <code>\` to finish, or \`primitive signup resend ${existingPending.email}\` to send a new code.\n`,
      );
      return existingPending;
    }
    throw cliError(
      `Pending signup is for ${existingPending.email}. Run \`primitive signup ${params.email} --force\` to replace it.`,
    );
  }
  if (params.flags.force) deletePendingAgentSignup(params.configDir);

  const promptRequiredFn = params.deps.promptRequired ?? promptRequired;
  const confirmTermsFn = params.deps.confirmTerms ?? confirmTerms;
  const startFn = params.deps.startAgentSignup ?? startAgentSignup;
  const signupCode =
    params.flags["signup-code"] ?? (await promptRequiredFn("Signup code: "));
  if (!params.flags["accept-terms"]) await confirmTermsFn();

  const started = await startFn({
    body: {
      device_name: params.flags["device-name"] ?? hostname(),
      email: params.email,
      signup_code: signupCode,
      terms_accepted: true,
    },
    client: params.apiClient.client,
    responseStyle: "fields",
  });

  if (started.error) {
    writeErrorWithHints(extractErrorPayload(started.error));
    throw cliError("Could not start Primitive agent signup.");
  }

  const startResult = unwrapData<AgentSignupStartResult>(started.data);
  if (!startResult) {
    throw cliError("Primitive API returned an empty agent signup response.");
  }
  return savePendingAgentSignup(
    params.configDir,
    startResult,
    params.apiBaseUrl1,
  );
}

async function resendVerificationCode(params: {
  apiBaseUrl1: string;
  apiClient: PrimitiveApiClient;
  configDir: string;
  deps: SignupFlowDeps;
  start: PendingAgentSignup;
}): Promise<PendingAgentSignup> {
  const resendFn =
    params.deps.resendAgentSignupVerification ?? resendAgentSignupVerification;
  const resent = await resendFn({
    body: { signup_token: params.start.signup_token },
    client: params.apiClient.client,
    responseStyle: "fields",
  });

  if (resent.data) {
    const resend = unwrapData<AgentSignupResendResult>(resent.data);
    const next = resend
      ? {
          email: resend.email,
          expires_in: resend.expires_in,
          resend_after: resend.resend_after,
          signup_token: params.start.signup_token,
          verification_code_length: resend.verification_code_length,
        }
      : params.start;
    return savePendingAgentSignup(params.configDir, next, params.apiBaseUrl1);
  }

  const payload = extractErrorPayload(resent.error);
  const code = extractErrorCode(payload);
  if (code === SLOW_DOWN) {
    const retryAfter = retryAfterSeconds(resent) ?? params.start.resend_after;
    process.stderr.write(
      `Verification email was sent recently. Wait ${formatSignupSeconds(retryAfter)} before trying again.\n`,
    );
    return params.start;
  }

  writeErrorWithHints(payload);
  throw cliError("Could not resend Primitive agent signup verification email.");
}

export async function runSignupStartWithCredentialLock(params: {
  configDir: string;
  deps?: SignupFlowDeps;
  email?: string;
  flags: SignupFlags;
}): Promise<void> {
  const { configDir, flags } = params;
  const deps = params.deps ?? {};
  const promptRequiredFn = deps.promptRequired ?? promptRequired;
  const email = params.email ?? (await promptRequiredFn("Email: "));
  await checkExistingCredentials({
    apiBaseUrl1: flags["api-base-url-1"],
    configDir,
    deps,
    flags,
  });

  const { apiClient, requestConfig } = createCliApiClient({
    apiBaseUrl1: flags["api-base-url-1"],
    configDir,
  });
  const pending = await startSignup({
    apiBaseUrl1: requestConfig.resolvedApiBaseUrl1,
    apiClient,
    configDir,
    deps,
    email,
    flags,
  });
  writeStartInstructions(pending);
}

export async function runSignupConfirmWithCredentialLock(params: {
  code: string;
  configDir: string;
  deps?: SignupFlowDeps;
  email: string;
  flags: SignupConfirmFlags;
}): Promise<void> {
  const { configDir, flags } = params;
  const deps = params.deps ?? {};
  await checkExistingCredentials({
    apiBaseUrl1: flags["api-base-url-1"],
    configDir,
    deps,
    flags,
  });

  const { apiClient, requestConfig } = createCliApiClient({
    apiBaseUrl1: flags["api-base-url-1"],
    configDir,
  });
  const apiBaseUrl1 = requestConfig.resolvedApiBaseUrl1;
  const pending = requirePendingSignupForEmail({
    apiBaseUrl1,
    configDir,
    email: params.email,
  });
  const verifyFn = deps.verifyAgentSignup ?? verifyAgentSignup;
  const verified = await verifyFn({
    body: {
      ...(flags["org-id"] ? { org_id: flags["org-id"] } : {}),
      signup_token: pending.signup_token,
      verification_code: params.code,
    },
    client: apiClient.client,
    responseStyle: "fields",
  });

  if (verified.data) {
    const signup = unwrapData<AgentSignupVerifyResult>(verified.data);
    if (!signup) {
      throw cliError(
        "Primitive API returned an empty agent signup verification response.",
      );
    }

    saveSignupCredentials({ apiBaseUrl1, configDir, signup });
    deletePendingAgentSignup(configDir);

    const org = signup.org_name ? ` (${signup.org_name})` : "";
    process.stderr.write(`Logged in to org ${signup.org_id}${org}.\n`);
    process.stderr.write(
      `Saved credentials to ${credentialsPath(configDir)}.\n`,
    );
    return;
  }

  const payload = extractErrorPayload(verified.error);
  const code = extractErrorCode(payload);
  if (code === INVALID_VERIFICATION_CODE) {
    throw cliError(
      "Invalid verification code. Try again or run signup resend.",
    );
  }
  if (code === EXPIRED_TOKEN || code === INVALID_SIGNUP_TOKEN) {
    deletePendingAgentSignup(configDir);
  }
  writeErrorWithHints(payload);
  throw cliError("Primitive agent signup failed while verifying the account.");
}

export async function runSignupResendWithCredentialLock(params: {
  configDir: string;
  deps?: SignupFlowDeps;
  email: string;
  flags: SignupResendFlags;
}): Promise<void> {
  const deps = params.deps ?? {};
  const { apiClient, requestConfig } = createCliApiClient({
    apiBaseUrl1: params.flags["api-base-url-1"],
    configDir: params.configDir,
  });
  const pending = requirePendingSignupForEmail({
    apiBaseUrl1: requestConfig.resolvedApiBaseUrl1,
    configDir: params.configDir,
    email: params.email,
  });
  const next = await resendVerificationCode({
    apiBaseUrl1: requestConfig.resolvedApiBaseUrl1,
    apiClient,
    configDir: params.configDir,
    deps,
    start: pending,
  });
  process.stderr.write(
    `Sent a new ${next.verification_code_length}-digit verification code to ${next.email}. It expires in ${formatSignupSeconds(next.expires_in)}.\n`,
  );
}

export async function runSignupInteractiveWithCredentialLock(params: {
  configDir: string;
  deps?: SignupFlowDeps;
  flags: SignupFlags;
}): Promise<void> {
  const { configDir, flags } = params;
  const deps = params.deps ?? {};
  const promptRequiredFn = deps.promptRequired ?? promptRequired;
  await checkExistingCredentials({
    apiBaseUrl1: flags["api-base-url-1"],
    configDir,
    deps,
    flags,
  });

  const { apiClient, requestConfig } = createCliApiClient({
    apiBaseUrl1: flags["api-base-url-1"],
    configDir,
  });
  const apiBaseUrl1 = requestConfig.resolvedApiBaseUrl1;
  let start = flags.force
    ? null
    : loadPendingAgentSignup(configDir, apiBaseUrl1);

  if (start) {
    process.stderr.write(
      `Continuing pending Primitive signup for ${start.email}.\n`,
    );
  } else {
    const email = await promptRequiredFn("Email: ");
    start = await startSignup({
      apiBaseUrl1,
      apiClient,
      configDir,
      deps,
      email,
      flags,
    });
  }

  process.stderr.write(
    `Check your email for the ${start.verification_code_length}-digit verification code sent to ${start.email}.\n`,
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
      process.stderr.write(
        `Sent a new ${start.verification_code_length}-digit verification code. It expires in ${formatSignupSeconds(start.expires_in)}.\n`,
      );
      continue;
    }

    try {
      await runSignupConfirmWithCredentialLock({
        code: verificationCode,
        configDir,
        deps,
        email: start.email,
        flags: {
          "api-base-url-1": flags["api-base-url-1"],
          force: true,
        },
      });
      return;
    } catch (error) {
      if (
        error instanceof Errors.CLIError &&
        error.message.startsWith("Invalid verification code.")
      ) {
        process.stderr.write(
          "Invalid verification code. Try again or type `resend`.\n",
        );
        continue;
      }
      throw error;
    }
  }
}

export const runSignupWithCredentialLock =
  runSignupInteractiveWithCredentialLock;

function commonStartFlags() {
  return {
    "accept-terms": Flags.boolean({
      description:
        "Confirm acceptance of Primitive's Terms of Service and Privacy Policy",
    }),
    "api-base-url-1": Flags.string({
      description:
        "Override the primary API base URL. Internal testing only; not documented to customers.",
      env: "PRIMITIVE_API_BASE_URL_1",
      hidden: true,
    }),
    "device-name": Flags.string({
      description: "Device name used for the created CLI OAuth session",
    }),
    force: Flags.boolean({
      char: "f",
      description:
        "Replace saved credentials or pending signup state when needed",
    }),
    "signup-code": Flags.string({
      description: "Signup code required to create an account",
      env: "PRIMITIVE_SIGNUP_CODE",
    }),
  };
}

class SignupCommand extends Command {
  static args = {
    email: Args.string({
      description: "Email address to sign up",
      required: false,
    }),
  };

  static description =
    "Start a Primitive account signup, send an email verification code, and save a pending signup token locally.";

  static summary = "Start account signup";

  static examples = [
    "<%= config.bin %> signup user@example.com",
    "<%= config.bin %> signup user@example.com --signup-code invite-code --accept-terms",
    "<%= config.bin %> signup confirm user@example.com 123456",
  ];

  static flags = commonStartFlags();

  async run(): Promise<void> {
    const { args, flags } = await this.parse(SignupCommand);
    let releaseCredentialsLock: () => void;
    try {
      releaseCredentialsLock = acquireCliCredentialsLock(this.config.configDir);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw cliError(detail);
    }

    try {
      await runSignupStartWithCredentialLock({
        configDir: this.config.configDir,
        email: args.email,
        flags,
      });
    } finally {
      releaseCredentialsLock();
    }
  }
}

export class SignupConfirmCommand extends Command {
  static args = {
    email: Args.string({
      description: "Email address used to start signup",
      required: true,
    }),
    code: Args.string({
      description: "Verification code from the signup email",
      required: true,
    }),
  };

  static description =
    "Confirm a pending Primitive signup, create an OAuth session, and save CLI credentials locally.";

  static summary = "Confirm account signup";

  static examples = [
    "<%= config.bin %> signup confirm user@example.com 123456",
    "<%= config.bin %> signup confirm user@example.com 123456 --org-id 00000000-0000-4000-8000-000000000000",
  ];

  static flags = {
    "api-base-url-1": Flags.string({
      description:
        "Override the primary API base URL. Internal testing only; not documented to customers.",
      env: "PRIMITIVE_API_BASE_URL_1",
      hidden: true,
    }),
    force: Flags.boolean({
      char: "f",
      description: "Replace saved credentials after verification",
    }),
    "org-id": Flags.string({
      description:
        "Workspace id to target when the email belongs to multiple workspaces",
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(SignupConfirmCommand);
    let releaseCredentialsLock: () => void;
    try {
      releaseCredentialsLock = acquireCliCredentialsLock(this.config.configDir);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw cliError(detail);
    }

    try {
      await runSignupConfirmWithCredentialLock({
        code: args.code,
        configDir: this.config.configDir,
        email: args.email,
        flags,
      });
    } finally {
      releaseCredentialsLock();
    }
  }
}

export class SignupResendCommand extends Command {
  static args = {
    email: Args.string({
      description: "Email address used to start signup",
      required: true,
    }),
  };

  static description = "Resend the verification code for a pending signup.";

  static summary = "Resend signup verification code";

  static examples = ["<%= config.bin %> signup resend user@example.com"];

  static flags = {
    "api-base-url-1": Flags.string({
      description:
        "Override the primary API base URL. Internal testing only; not documented to customers.",
      env: "PRIMITIVE_API_BASE_URL_1",
      hidden: true,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(SignupResendCommand);
    await runSignupResendWithCredentialLock({
      configDir: this.config.configDir,
      email: args.email,
      flags,
    });
  }
}

export class SignupInteractiveCommand extends Command {
  static description =
    "Run the full signup flow in one interactive terminal session.";

  static summary = "Run interactive account signup";

  static examples = ["<%= config.bin %> signup interactive"];

  static flags = commonStartFlags();

  async run(): Promise<void> {
    const { flags } = await this.parse(SignupInteractiveCommand);
    let releaseCredentialsLock: () => void;
    try {
      releaseCredentialsLock = acquireCliCredentialsLock(this.config.configDir);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw cliError(detail);
    }

    try {
      await runSignupInteractiveWithCredentialLock({
        configDir: this.config.configDir,
        flags,
      });
    } finally {
      releaseCredentialsLock();
    }
  }
}

export default SignupCommand;
