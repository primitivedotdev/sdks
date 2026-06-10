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
  credentialsPath,
  loadCliCredentials,
  type StoredCliCredentials,
  saveSignupCredentials,
} from "../auth.js";
import { checkExistingLogin } from "./login.js";

const INVALID_VERIFICATION_CODE = "invalid_verification_code";
const EXPIRED_TOKEN = "expired_token";
const INVALID_SIGNUP_TOKEN = "invalid_signup_token";
const SLOW_DOWN = "slow_down";
const PENDING_SIGNUP_FILE = "signup.json";

export type SignupFlags = {
  "accept-terms"?: boolean;
  "api-base-url"?: string;
  "device-name"?: string;
  "signup-code"?: string;
  force?: boolean;
};

type SignupConfirmFlags = {
  "api-base-url"?: string;
  "org-id"?: string;
  force?: boolean;
};

type SignupResendFlags = {
  "api-base-url"?: string;
};

type SignupStatusFlags = {
  "api-base-url"?: string;
  json?: boolean;
};

export type SignupCommandCopy = {
  actionNoun: string;
  actionGerund: string;
  confirmCommand: (email: string) => string;
  resendCommand: (email: string) => string;
  startCommand: (email: string) => string;
  /**
   * Whether the start endpoint this flow targets requires a signup
   * code. Signup is open, so signup flows default this to false. The
   * email-code auth flows (signin / login / otp) reuse the same start
   * helper but their endpoint still requires a code, so their copies
   * set this true and the helper prompts for one when the flag is
   * unset.
   */
  codeRequired: boolean;
};

export const DEFAULT_SIGNUP_COMMAND_COPY: SignupCommandCopy = {
  actionNoun: "signup",
  actionGerund: "creating a new account",
  confirmCommand: (email) => `signup confirm ${email} <code>`,
  resendCommand: (email) => `signup resend ${email}`,
  startCommand: (email) => `signup ${email}`,
  codeRequired: false,
};

export type PendingAgentSignup = AgentSignupStartResult & {
  api_base_url: string;
  created_at: string;
  expires_at: string;
};

type SignupStatus = {
  code_length: number | null;
  confirm_command: string | null;
  email: string | null;
  expired: boolean;
  expires_at: string | null;
  expires_in: number | null;
  pending: boolean;
  resend_after: number | null;
  resend_command: string | null;
  signup_command?: string;
};

type SignupFlowDeps = {
  checkExistingLogin?: typeof checkExistingLogin;
  confirmTerms?: typeof confirmTerms;
  promptRequired?: typeof promptRequired;
  resendAgentSignupVerification?: typeof resendAgentSignupVerification;
  startAgentSignup?: typeof startAgentSignup;
  verifyAgentSignup?: typeof verifyAgentSignup;
};

type StartSignupResult = {
  pending: PendingAgentSignup;
  started: boolean;
};

type ResendVerificationCodeResult = {
  pending: PendingAgentSignup;
  resent: boolean;
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
    typeof value.created_at !== "string" ||
    typeof value.expires_at !== "string"
  ) {
    return null;
  }
  const apiBaseUrl = value.api_base_url ?? value.api_base_url_1;
  if (typeof apiBaseUrl !== "string") return null;

  return {
    api_base_url: apiBaseUrl,
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
  apiBaseUrl: string,
): PendingAgentSignup {
  return {
    ...start,
    api_base_url: apiBaseUrl,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + start.expires_in * 1000).toISOString(),
  };
}

export function savePendingAgentSignup(
  configDir: string,
  start: AgentSignupStartResult,
  apiBaseUrl: string,
): PendingAgentSignup {
  mkdirSync(configDir, { mode: 0o700, recursive: true });
  const pending = pendingSignupFromStart(start, apiBaseUrl);
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
  apiBaseUrl: string,
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
  if (pending.api_base_url !== apiBaseUrl) return null;
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

export function readPendingAgentSignupState(
  configDir: string,
  apiBaseUrl: string,
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
  if (pending.api_base_url !== apiBaseUrl) return null;

  return pending;
}

function pendingSignupStartCommand(email?: string): string {
  // signup_code is optional; suggest the simplest invocation. Users
  // who have a code can pass `--signup-code <code>` per the flag's
  // help text.
  return `primitive signup ${email ?? "<email>"} --accept-terms`;
}

function buildSignupStatus(params: {
  apiBaseUrl: string;
  copy?: SignupCommandCopy;
  configDir: string;
  email?: string;
}): SignupStatus {
  const copy = params.copy ?? DEFAULT_SIGNUP_COMMAND_COPY;
  const pending = readPendingAgentSignupState(
    params.configDir,
    params.apiBaseUrl,
  );

  if (!pending) {
    return {
      code_length: null,
      confirm_command: null,
      email: null,
      expired: false,
      expires_at: null,
      expires_in: null,
      pending: false,
      resend_after: null,
      resend_command: null,
      signup_command: pendingSignupStartCommand(params.email),
    };
  }

  if (
    params.email &&
    normalizeEmail(pending.email) !== normalizeEmail(params.email)
  ) {
    throw cliError(
      `Pending ${copy.actionNoun} is for ${pending.email}, not ${params.email}. Run \`primitive signup status\` without an email argument to inspect it.`,
    );
  }

  const expiresAtMs = new Date(pending.expires_at).getTime();
  const expiresIn = Number.isFinite(expiresAtMs)
    ? Math.ceil((expiresAtMs - Date.now()) / 1000)
    : null;

  return {
    code_length: pending.verification_code_length,
    confirm_command: `primitive ${copy.confirmCommand(pending.email)}`,
    email: pending.email,
    expired: expiresIn !== null && expiresIn <= 0,
    expires_at: pending.expires_at,
    expires_in: expiresIn === null ? null : Math.max(0, expiresIn),
    pending: true,
    resend_after: pending.resend_after,
    resend_command: `primitive ${copy.resendCommand(pending.email)}`,
  };
}

function writeSignupStatus(status: SignupStatus): void {
  if (!status.pending) {
    process.stdout.write("No pending Primitive signup found.\n");
    process.stdout.write(
      `Start one with \`${status.signup_command ?? pendingSignupStartCommand()}\`.\n`,
    );
    return;
  }

  process.stdout.write(`Pending Primitive signup for ${status.email}.\n`);
  if (status.code_length !== null) {
    process.stdout.write(`Verification code length: ${status.code_length}\n`);
  }
  if (status.expires_at) {
    if (status.expired) {
      process.stdout.write(`Expired at: ${status.expires_at}\n`);
    } else {
      process.stdout.write(`Expires at: ${status.expires_at}\n`);
      process.stdout.write(
        `Expires in: ${formatSignupSeconds(status.expires_in)}\n`,
      );
    }
  }
  if (status.resend_after !== null) {
    process.stdout.write(
      `Resend after: ${formatSignupSeconds(status.resend_after)}\n`,
    );
  }
  if (status.confirm_command) {
    process.stdout.write(`Confirm: ${status.confirm_command}\n`);
  }
  if (status.resend_command) {
    process.stdout.write(`Resend: ${status.resend_command}\n`);
  }
}

export function runSignupStatus(params: {
  configDir: string;
  copy?: SignupCommandCopy;
  email?: string;
  flags: SignupStatusFlags;
}): void {
  const { requestConfig } = createCliApiClient({
    apiBaseUrl: params.flags["api-base-url"],
    configDir: params.configDir,
  });
  const status = buildSignupStatus({
    apiBaseUrl: requestConfig.resolvedApiBaseUrl,
    configDir: params.configDir,
    copy: params.copy,
    email: params.email,
  });

  if (params.flags.json) {
    process.stdout.write(`${JSON.stringify(status, null, 2)}\n`);
    return;
  }
  writeSignupStatus(status);
}

function requirePendingSignupForEmail(params: {
  apiBaseUrl: string;
  copy?: SignupCommandCopy;
  configDir: string;
  email: string;
}): PendingAgentSignup {
  const copy = params.copy ?? DEFAULT_SIGNUP_COMMAND_COPY;
  const pending = loadPendingAgentSignup(params.configDir, params.apiBaseUrl);
  if (!pending) {
    throw cliError(
      `No pending ${copy.actionNoun} for ${params.email}. Run \`primitive signup status ${params.email}\` to inspect pending state, or \`primitive ${copy.startCommand(params.email)}\` first.`,
    );
  }
  if (normalizeEmail(pending.email) !== normalizeEmail(params.email)) {
    throw cliError(
      `Pending ${copy.actionNoun} is for ${pending.email}, not ${params.email}. Run \`primitive signup status\` to inspect it, or \`primitive ${copy.startCommand(params.email)} --force\` to replace it.`,
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
    "By continuing, you agree to Primitive's Terms of Service and Privacy Policy:\n",
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
  apiBaseUrl?: string;
  copy?: SignupCommandCopy;
  configDir: string;
  flags: { force?: boolean };
  deps: SignupFlowDeps;
}): Promise<void> {
  const copy = params.copy ?? DEFAULT_SIGNUP_COMMAND_COPY;
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
      `Replacing saved Primitive CLI credentials after ${copy.actionNoun} because --force was set.\n`,
    );
    return;
  }
  if (!existing) return;

  const existingStatus = await checkExistingLoginFn({
    apiBaseUrl: params.apiBaseUrl,
    configDir: params.configDir,
    credentials: existing,
    credentialsLockHeld: true,
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
    `Already logged in${org}. Run \`primitive logout\` before ${copy.actionGerund}.`,
  );
}

function writeStartInstructions(
  start: PendingAgentSignup,
  copy = DEFAULT_SIGNUP_COMMAND_COPY,
): void {
  process.stderr.write(
    `Sent a ${start.verification_code_length}-digit verification code to ${start.email}.\n`,
  );
  process.stderr.write(
    `The code expires in ${formatSignupSeconds(start.expires_in)}.\n`,
  );
  process.stderr.write(
    `Run \`primitive ${copy.confirmCommand(start.email)}\` to finish.\n`,
  );
}

async function startSignup(params: {
  apiBaseUrl: string;
  apiClient: PrimitiveApiClient;
  copy?: SignupCommandCopy;
  configDir: string;
  deps: SignupFlowDeps;
  email: string;
  flags: SignupFlags;
}): Promise<StartSignupResult> {
  const copy = params.copy ?? DEFAULT_SIGNUP_COMMAND_COPY;
  const existingPending = loadPendingAgentSignup(
    params.configDir,
    params.apiBaseUrl,
  );
  if (existingPending && !params.flags.force) {
    if (
      normalizeEmail(existingPending.email) === normalizeEmail(params.email)
    ) {
      process.stderr.write(
        `Continuing pending Primitive ${copy.actionNoun} for ${existingPending.email}.\n`,
      );
      process.stderr.write(
        `Run \`primitive ${copy.confirmCommand(existingPending.email)}\` to finish, \`primitive ${copy.resendCommand(existingPending.email)}\` to send a new code, or \`primitive signup status\` to inspect it.\n`,
      );
      return { pending: existingPending, started: false };
    }
    throw cliError(
      `Pending ${copy.actionNoun} is for ${existingPending.email}. Run \`primitive signup status\` to inspect it, or \`primitive ${copy.startCommand(params.email)} --force\` to replace it.`,
    );
  }
  if (params.flags.force) deletePendingAgentSignup(params.configDir);

  const confirmTermsFn = params.deps.confirmTerms ?? confirmTerms;
  const promptRequiredFn = params.deps.promptRequired ?? promptRequired;
  const startFn = params.deps.startAgentSignup ?? startAgentSignup;
  // signup-code: optional for the signup flow (start endpoint accepts
  // the omitted shape), still required for the email-code auth flows
  // (signin / login / otp) that reuse this helper via copy.codeRequired.
  const rawSignupCode = params.flags["signup-code"];
  const trimmedSignupCode =
    rawSignupCode && rawSignupCode.trim().length > 0
      ? rawSignupCode
      : undefined;
  const signupCode =
    trimmedSignupCode ??
    (copy.codeRequired ? await promptRequiredFn("Signup code: ") : undefined);
  if (!params.flags["accept-terms"]) await confirmTermsFn();

  const started = await startFn({
    body: {
      device_name: params.flags["device-name"] ?? hostname(),
      email: params.email,
      // Only include signup_code in the request body when a non-empty
      // value was supplied. The API treats the omitted-key case and the
      // empty-string case the same, but omitting is more conventional.
      ...(signupCode ? { signup_code: signupCode } : {}),
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
  return {
    pending: savePendingAgentSignup(
      params.configDir,
      startResult,
      params.apiBaseUrl,
    ),
    started: true,
  };
}

async function resendVerificationCode(params: {
  apiBaseUrl: string;
  apiClient: PrimitiveApiClient;
  configDir: string;
  deps: SignupFlowDeps;
  start: PendingAgentSignup;
}): Promise<ResendVerificationCodeResult> {
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
    return {
      pending: savePendingAgentSignup(
        params.configDir,
        next,
        params.apiBaseUrl,
      ),
      resent: true,
    };
  }

  const payload = extractErrorPayload(resent.error);
  const code = extractErrorCode(payload);
  if (code === SLOW_DOWN) {
    const retryAfter = retryAfterSeconds(resent) ?? params.start.resend_after;
    process.stderr.write(
      `Verification email was sent recently. Wait ${formatSignupSeconds(retryAfter)} before trying again.\n`,
    );
    return { pending: params.start, resent: false };
  }
  if (code === EXPIRED_TOKEN || code === INVALID_SIGNUP_TOKEN) {
    deletePendingAgentSignup(params.configDir);
  }

  writeErrorWithHints(payload);
  throw cliError("Could not resend Primitive agent signup verification email.");
}

export async function runSignupStartWithCredentialLock(params: {
  configDir: string;
  copy?: SignupCommandCopy;
  deps?: SignupFlowDeps;
  email?: string;
  flags: SignupFlags;
}): Promise<void> {
  const { configDir, flags } = params;
  const deps = params.deps ?? {};
  const promptRequiredFn = deps.promptRequired ?? promptRequired;
  const email = params.email ?? (await promptRequiredFn("Email: "));
  await checkExistingCredentials({
    apiBaseUrl: flags["api-base-url"],
    configDir,
    copy: params.copy,
    deps,
    flags,
  });

  const { apiClient, requestConfig } = createCliApiClient({
    apiBaseUrl: flags["api-base-url"],
    configDir,
  });
  const start = await startSignup({
    apiBaseUrl: requestConfig.resolvedApiBaseUrl,
    apiClient,
    configDir,
    copy: params.copy,
    deps,
    email,
    flags,
  });
  if (start.started) writeStartInstructions(start.pending, params.copy);
}

export async function runSignupConfirmWithCredentialLock(params: {
  code: string;
  configDir: string;
  copy?: SignupCommandCopy;
  deps?: SignupFlowDeps;
  email: string;
  flags: SignupConfirmFlags;
  skipExistingCredentialCheck?: boolean;
}): Promise<void> {
  const { configDir, flags } = params;
  const deps = params.deps ?? {};
  if (!params.skipExistingCredentialCheck) {
    await checkExistingCredentials({
      apiBaseUrl: flags["api-base-url"],
      configDir,
      copy: params.copy,
      deps,
      flags,
    });
  }

  const { apiClient, requestConfig } = createCliApiClient({
    apiBaseUrl: flags["api-base-url"],
    configDir,
  });
  const apiBaseUrl = requestConfig.resolvedApiBaseUrl;
  const pending = requirePendingSignupForEmail({
    apiBaseUrl,
    copy: params.copy,
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

    saveSignupCredentials({ apiBaseUrl, configDir, signup });
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
    const copy = params.copy ?? DEFAULT_SIGNUP_COMMAND_COPY;
    throw cliError(
      `Invalid verification code. Try again, run ${copy.resendCommand(params.email)}, or run primitive signup status.`,
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
  copy?: SignupCommandCopy;
  deps?: SignupFlowDeps;
  email?: string;
  flags: SignupResendFlags;
}): Promise<void> {
  const deps = params.deps ?? {};
  const copy = params.copy ?? DEFAULT_SIGNUP_COMMAND_COPY;
  const { apiClient, requestConfig } = createCliApiClient({
    apiBaseUrl: params.flags["api-base-url"],
    configDir: params.configDir,
  });
  const pending = params.email
    ? requirePendingSignupForEmail({
        apiBaseUrl: requestConfig.resolvedApiBaseUrl,
        copy,
        configDir: params.configDir,
        email: params.email,
      })
    : loadPendingAgentSignup(
        params.configDir,
        requestConfig.resolvedApiBaseUrl,
      );
  if (!pending) {
    throw cliError(
      `No pending ${copy.actionNoun} found. Run \`primitive signup status\` to inspect pending state, or start one with \`${pendingSignupStartCommand()}\`.`,
    );
  }
  const resend = await resendVerificationCode({
    apiBaseUrl: requestConfig.resolvedApiBaseUrl,
    apiClient,
    configDir: params.configDir,
    deps,
    start: pending,
  });
  if (resend.resent) {
    process.stderr.write(
      `Sent a new ${resend.pending.verification_code_length}-digit verification code to ${resend.pending.email}. It expires in ${formatSignupSeconds(resend.pending.expires_in)}.\n`,
    );
  }
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
    apiBaseUrl: flags["api-base-url"],
    configDir,
    deps,
    flags,
  });

  const { apiClient, requestConfig } = createCliApiClient({
    apiBaseUrl: flags["api-base-url"],
    configDir,
  });
  const apiBaseUrl = requestConfig.resolvedApiBaseUrl;
  let start = flags.force
    ? null
    : loadPendingAgentSignup(configDir, apiBaseUrl);

  if (start) {
    process.stderr.write(
      `Continuing pending Primitive signup for ${start.email}.\n`,
    );
  } else {
    const email = await promptRequiredFn("Email: ");
    const started = await startSignup({
      apiBaseUrl,
      apiClient,
      configDir,
      deps,
      email,
      flags,
    });
    start = started.pending;
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
      const resend = await resendVerificationCode({
        apiBaseUrl,
        apiClient,
        configDir,
        deps,
        start,
      });
      start = resend.pending;
      if (resend.resent) {
        process.stderr.write(
          `Sent a new ${start.verification_code_length}-digit verification code. It expires in ${formatSignupSeconds(start.expires_in)}.\n`,
        );
      }
      continue;
    }

    try {
      await runSignupConfirmWithCredentialLock({
        code: verificationCode,
        configDir,
        deps,
        email: start.email,
        flags: {
          "api-base-url": flags["api-base-url"],
          force: true,
        },
        skipExistingCredentialCheck: true,
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
    "api-base-url": Flags.string({
      description:
        "Override the primary API base URL. Internal testing only; not documented to customers.",
      env: "PRIMITIVE_API_BASE_URL",
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
      description: "Optional signup code. Omit if you do not have one.",
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
    "<%= config.bin %> signup user@example.com --accept-terms",
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

// Resolve the verification code from exactly one of: positional arg,
// --code-from-stdin, --code-from-file <path>, or --code-from-env <VAR>.
// The non-positional sources exist so an agent constructing this command
// for the user can keep the code value out of its own prompt context:
// the agent writes the command template referencing $CODE / a file path,
// the user fills the value at the shell, and the OS hands it to the CLI.
// Inputs come in via flag sources rather than a single value field so the
// "exactly one source" rule is enforceable client-side before any further
// work happens.
export type ResolveVerificationCodeResult =
  | { kind: "ok"; code: string }
  | { kind: "error"; message: string };

export type ResolveVerificationCodeInput = {
  positional?: string;
  fromStdin?: boolean;
  fromFile?: string;
  fromEnv?: string;
  env?: Record<string, string | undefined>;
  readFile?: (path: string) => string;
  readStdin?: () => string;
};

export function resolveVerificationCode(
  input: ResolveVerificationCodeInput,
): ResolveVerificationCodeResult {
  const sources = [
    input.positional !== undefined ? "positional" : null,
    input.fromStdin === true ? "--code-from-stdin" : null,
    input.fromFile !== undefined ? "--code-from-file" : null,
    input.fromEnv !== undefined ? "--code-from-env" : null,
  ].filter((v): v is string => v !== null);

  if (sources.length === 0) {
    return {
      kind: "error",
      message:
        "Pass the verification code as a positional argument or via one of --code-from-stdin, --code-from-file, or --code-from-env.",
    };
  }
  if (sources.length > 1) {
    return {
      kind: "error",
      message: `Pass exactly one source for the verification code; got ${sources.join(", ")}.`,
    };
  }

  if (input.positional !== undefined) {
    return { kind: "ok", code: input.positional };
  }
  if (input.fromEnv !== undefined) {
    const env = input.env ?? process.env;
    const value = env[input.fromEnv];
    if (value === undefined) {
      return {
        kind: "error",
        message: `--code-from-env ${input.fromEnv}: environment variable is not set.`,
      };
    }
    return { kind: "ok", code: stripTrailingNewline(value) };
  }
  if (input.fromFile !== undefined) {
    const readFile = input.readFile ?? defaultReadCodeFile;
    try {
      const raw = readFile(input.fromFile);
      return { kind: "ok", code: stripTrailingNewline(raw) };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      return {
        kind: "error",
        message: `--code-from-file ${input.fromFile}: could not read file: ${detail}`,
      };
    }
  }
  // sources.length === 1 narrows to one of the four; positional / env / file
  // are handled above, so the remaining case is --code-from-stdin.
  const readStdin = input.readStdin ?? defaultReadCodeStdin;
  try {
    const raw = readStdin();
    return { kind: "ok", code: stripTrailingNewline(raw) };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      kind: "error",
      message: `--code-from-stdin: ${detail}`,
    };
  }
}

function stripTrailingNewline(value: string): string {
  // `read` and most file editors append a trailing newline. Strip a single
  // trailing CR/LF so the resolved code matches what the user actually typed.
  // Aggressive trimming would silently swallow a code that legitimately
  // contains internal whitespace, so this is intentionally minimal.
  return value.replace(/\r?\n$/, "");
}

function defaultReadCodeFile(path: string): string {
  return readFileSync(path, "utf8");
}

function defaultReadCodeStdin(): string {
  if (process.stdin.isTTY) {
    throw new Error(
      "stdin is a TTY; pipe the code into this command or use --code-from-file / --code-from-env instead.",
    );
  }
  return readFileSync(0, "utf8");
}

export class SignupConfirmCommand extends Command {
  static args = {
    email: Args.string({
      description: "Email address used to start signup",
      required: true,
    }),
    code: Args.string({
      description:
        "Verification code from the signup email. Optional when one of --code-from-stdin / --code-from-file / --code-from-env is passed; exactly one source must be set.",
      required: false,
    }),
  };

  static description =
    "Confirm a pending Primitive signup, create an OAuth session, and save CLI credentials locally.";

  static summary = "Confirm account signup";

  static examples = [
    "<%= config.bin %> signup confirm user@example.com 123456",
    "<%= config.bin %> signup confirm user@example.com 123456 --org-id 00000000-0000-4000-8000-000000000000",
    'read -rs CODE && CODE="$CODE" <%= config.bin %> signup confirm user@example.com --code-from-env CODE && unset CODE',
    "read -rs CODE && printf '%s' \"$CODE\" | <%= config.bin %> signup confirm user@example.com --code-from-stdin && unset CODE",
    "<%= config.bin %> signup confirm user@example.com --code-from-file /run/user/$(id -u)/verification-code",
  ];

  static flags = {
    "api-base-url": Flags.string({
      description:
        "Override the primary API base URL. Internal testing only; not documented to customers.",
      env: "PRIMITIVE_API_BASE_URL",
      hidden: true,
    }),
    "code-from-stdin": Flags.boolean({
      description:
        "Read the verification code from stdin instead of the positional argument. Use when an agent is constructing the command for the user to run, so the code never enters the agent's prompt context.",
    }),
    "code-from-file": Flags.string({
      description:
        "Read the verification code from a UTF-8 file at this path. Trailing newlines are stripped.",
    }),
    "code-from-env": Flags.string({
      description:
        'Read the verification code from this environment variable. Pair with `read -rs CODE && CODE="$CODE" primitive signup confirm <email> --code-from-env CODE && unset CODE` so the value never appears on the command line or in shell history. Plain `read` creates a shell-local variable that child processes cannot see; the inline `CODE="$CODE"` exports it for just the one command.',
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
    const resolvedCode = resolveVerificationCode({
      positional: args.code,
      fromStdin: flags["code-from-stdin"] === true,
      fromFile: flags["code-from-file"],
      fromEnv: flags["code-from-env"],
    });
    if (resolvedCode.kind === "error") {
      throw cliError(resolvedCode.message);
    }
    let releaseCredentialsLock: () => void;
    try {
      releaseCredentialsLock = acquireCliCredentialsLock(this.config.configDir);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw cliError(detail);
    }

    try {
      await runSignupConfirmWithCredentialLock({
        code: resolvedCode.code,
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
      description:
        "Email address used to start signup. Defaults to the saved pending signup.",
      required: false,
    }),
  };

  static description = "Resend the verification code for a pending signup.";

  static summary = "Resend signup verification code";

  static examples = [
    "<%= config.bin %> signup resend",
    "<%= config.bin %> signup resend user@example.com",
  ];

  static flags = {
    "api-base-url": Flags.string({
      description:
        "Override the primary API base URL. Internal testing only; not documented to customers.",
      env: "PRIMITIVE_API_BASE_URL",
      hidden: true,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(SignupResendCommand);
    let releaseCredentialsLock: () => void;
    try {
      releaseCredentialsLock = acquireCliCredentialsLock(this.config.configDir);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw cliError(detail);
    }

    try {
      await runSignupResendWithCredentialLock({
        configDir: this.config.configDir,
        email: args.email,
        flags,
      });
    } finally {
      releaseCredentialsLock();
    }
  }
}

export class SignupStatusCommand extends Command {
  static args = {
    email: Args.string({
      description: "Email address expected in the pending signup",
      required: false,
    }),
  };

  static description =
    "Inspect the locally saved pending Primitive signup state.";

  static summary = "Show pending signup status";

  static examples = [
    "<%= config.bin %> signup status",
    "<%= config.bin %> signup status user@example.com",
    "<%= config.bin %> signup status --json",
  ];

  static flags = {
    "api-base-url": Flags.string({
      description:
        "Override the primary API base URL. Internal testing only; not documented to customers.",
      env: "PRIMITIVE_API_BASE_URL",
      hidden: true,
    }),
    json: Flags.boolean({
      description: "Print pending signup status as JSON",
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(SignupStatusCommand);
    runSignupStatus({
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
