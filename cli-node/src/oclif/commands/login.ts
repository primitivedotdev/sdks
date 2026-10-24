import { hostname } from "node:os";
import { Command, Errors, Flags } from "@oclif/core";
import type {
  CliLoginPollResult,
  CliLoginStartResult,
  CliUserLoginPollResult,
  StartCliLoginInput,
} from "@primitivedotdev/api-core";
import {
  getAccount,
  PrimitiveApiClient,
  pollCliLogin,
  startCliLogin,
} from "@primitivedotdev/api-core";
import {
  createCliApiClient,
  refreshStoredCliCredentials,
  resolveCliApiRequestConfig,
} from "../api-client.js";
import {
  API_ERROR_CODES,
  extractErrorCode,
  extractErrorPayload,
  writeErrorWithHints,
} from "../api-command.js";
import {
  acquireCliCredentialsLock,
  cliAccessTokenExpiresAt,
  credentialsPath,
  deleteCliCredentials,
  loadCliCredentials,
  type StoredCliCredentials,
  saveCliCredentials,
} from "../auth.js";
import {
  canOfferCopyHotkey,
  formatBrowserLoginInstructions,
  listenForCopyHotkey,
  openBrowser,
} from "../browser-login-prompt.js";
import { deleteChatState } from "../chat-state.js";
import { ORG_SELECTION_ENV } from "../global-org-flag.js";
import {
  CliOrgRefusedError,
  credentialsFromUserLogin,
  fetchCliOrgs,
  switchCurrentOrg,
} from "../user-grant.js";

const MAX_CLI_LOGIN_POLL_INTERVAL_SECONDS = 60;

function cliError(message: string): Errors.CLIError {
  return new Errors.CLIError(message, { exit: 1 });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function unwrapData<T>(value: unknown): T | null {
  const envelope = value as { data?: T } | null | undefined;
  return envelope?.data ?? null;
}

function retryAfterSeconds(result: unknown): number | null {
  const response = (result as { response?: Response }).response;
  const raw = response?.headers.get("retry-after");
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

// Returned by the device-login poll when the signed-in account's email
// must be changed before a CLI session can be issued. Terminal: polling
// again cannot succeed until the account is updated in the browser.
export const SIGN_IN_EMAIL_CHANGE_REQUIRED = "sign_in_email_change_required";

const SIGN_IN_EMAIL_CHANGE_REQUIRED_FALLBACK =
  "Your Primitive sign-in email is on a domain Primitive receives mail for. Change it to an external address in the browser, then log in again.";

function errorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const inner = (payload as { error?: unknown }).error;
  const source =
    inner && typeof inner === "object" ? (inner as object) : payload;
  const message = (source as { message?: unknown }).message;
  return typeof message === "string" && message.trim() !== ""
    ? message.trim()
    : null;
}

type CliLoginPollResponse = {
  data?: unknown;
  error?: unknown;
  response?: Response;
};

export async function pollCliLoginUntilApproved(params: {
  poll: (deviceCode: string) => Promise<CliLoginPollResponse>;
  retryCommand: string;
  sleep?: (ms: number) => Promise<void>;
  start: Pick<CliLoginStartResult, "device_code" | "expires_in" | "interval">;
}): Promise<CliLoginPollResult> {
  const wait = params.sleep ?? sleep;
  const { retryCommand, start } = params;
  const deadline = Date.now() + start.expires_in * 1000;
  let interval = Math.min(
    Math.max(1, start.interval),
    MAX_CLI_LOGIN_POLL_INTERVAL_SECONDS,
  );
  let nextPollDelay = 1;

  while (Date.now() < deadline) {
    await wait(nextPollDelay * 1000);
    nextPollDelay = interval;

    const polled = await params.poll(start.device_code);

    if (polled.data) {
      const login = unwrapData<CliLoginPollResult>(polled.data);
      if (!login) {
        throw cliError("Primitive API returned an empty CLI poll response.");
      }
      return login;
    }

    const payload = extractErrorPayload(polled.error);
    const code = extractErrorCode(payload);
    if (code === API_ERROR_CODES.authorizationPending) {
      nextPollDelay = interval;
      continue;
    }
    if (code === API_ERROR_CODES.slowDown) {
      interval = Math.min(
        retryAfterSeconds(polled) ?? interval + 5,
        MAX_CLI_LOGIN_POLL_INTERVAL_SECONDS,
      );
      nextPollDelay = interval;
      continue;
    }
    if (code === SIGN_IN_EMAIL_CHANGE_REQUIRED) {
      throw new Errors.CLIError(
        errorMessage(payload) ?? SIGN_IN_EMAIL_CHANGE_REQUIRED_FALLBACK,
        { code: SIGN_IN_EMAIL_CHANGE_REQUIRED, exit: 1 },
      );
    }
    if (code === API_ERROR_CODES.accessDenied) {
      throw cliError("Primitive CLI login was denied in the browser.");
    }
    if (code === API_ERROR_CODES.expiredToken) {
      throw cliError(
        `Primitive CLI login expired. Run \`primitive ${retryCommand}\` again.`,
      );
    }
    if (code === API_ERROR_CODES.invalidDeviceCode) {
      throw cliError(
        `Primitive CLI login device code is invalid. Run \`primitive ${retryCommand}\` again.`,
      );
    }

    writeErrorWithHints(payload);
    throw cliError("Primitive CLI login failed while polling for approval.");
  }

  throw cliError(
    `Primitive CLI login expired. Run \`primitive ${retryCommand}\` again.`,
  );
}

type ExistingLoginStatus =
  | { status: "valid" }
  | { status: "removed_stale" }
  | { status: "blocked"; message: string; payload: unknown };

export async function checkExistingLogin(params: {
  apiBaseUrl?: string;
  configDir: string;
  credentials: StoredCliCredentials;
  credentialsLockHeld?: boolean;
  checkAccount?: (
    apiClient: PrimitiveApiClient,
  ) => Promise<{ error?: unknown }>;
}): Promise<ExistingLoginStatus> {
  const requestConfig = resolveCliApiRequestConfig({
    apiBaseUrl: params.apiBaseUrl,
    configDir: params.configDir,
  });
  const probeApiBaseUrl =
    requestConfig.apiBaseUrl ?? params.credentials.api_base_url;
  let credentials = params.credentials;
  if (credentials.auth_method === "user_grant" && !credentials.org_id) {
    // A login as yourself with no organization selected yet: it is live if
    // its identity token can still list organizations.
    try {
      await fetchCliOrgs({
        apiBaseUrl: probeApiBaseUrl,
        configDir: params.configDir,
        credentials,
        credentialsLockHeld: params.credentialsLockHeld,
        headers: requestConfig.headers,
      });
      return { status: "valid" };
    } catch (error) {
      if (loadCliCredentials(params.configDir) === null) {
        return { status: "removed_stale" };
      }
      return {
        status: "blocked",
        payload: error,
        message:
          "A saved Primitive CLI login exists, but the CLI could not verify it. Run `primitive logout` before logging in again.",
      };
    }
  }
  try {
    credentials = await refreshStoredCliCredentials({
      apiBaseUrl: probeApiBaseUrl,
      configDir: params.configDir,
      credentials,
      credentialsLockHeld: params.credentialsLockHeld,
      headers: requestConfig.headers,
      // The existing login is checked as it stands; --org applies after.
      orgSelection: null,
    });
  } catch (error) {
    if (loadCliCredentials(params.configDir) === null) {
      return { status: "removed_stale" };
    }
    return {
      status: "blocked",
      payload: error,
      message:
        "A saved Primitive CLI OAuth session exists, but the CLI could not refresh it. Run `primitive logout` before logging in again.",
    };
  }

  const apiClient = new PrimitiveApiClient({
    apiKey: credentials.access_token,
    apiBaseUrl: probeApiBaseUrl,
    headers: requestConfig.headers,
  });
  const result = await (
    params.checkAccount ??
    ((client) =>
      getAccount({
        client: client.client,
        responseStyle: "fields",
      }))
  )(apiClient);

  if (!result.error) return { status: "valid" };

  const payload = extractErrorPayload(result.error);
  const code = extractErrorCode(payload);

  // checkExistingLogin is the one place auto-deleting saved
  // credentials on 401 is the right move: the user explicitly ran
  // `primitive login`, we probed the existing credential, and it was
  // rejected. Mint a new OAuth session on top. Other 401 paths surface a hint
  // and leave the saved credential alone (see surfaceUnauthorizedHint
  // in api-command.ts for the reasoning).
  //
  // Skip the auto-delete when an API URL override is in play and the
  // override URL differs from the URL the credentials were saved
  // with. The most likely cause there is "saved against env A,
  // probing against env B"; the credential may still be valid
  // against its original host.
  const baseUrlDiffersFromSaved =
    requestConfig.baseUrlOverridden &&
    requestConfig.apiBaseUrl !== params.credentials.api_base_url;
  if (code === API_ERROR_CODES.unauthorized && !baseUrlDiffersFromSaved) {
    deleteCliCredentials(params.configDir);
    process.stderr.write(
      "Removed saved Primitive CLI OAuth credentials because the existing session was rejected during login. Continuing with a fresh login.\n",
    );
    return { status: "removed_stale" };
  }

  return {
    status: "blocked",
    payload,
    message:
      code === API_ERROR_CODES.unauthorized
        ? "Saved Primitive CLI OAuth credentials were rejected by an API URL different from the one they were saved with. Run `primitive logout` to remove them, or switch back to the original environment before logging in again."
        : "A saved Primitive CLI OAuth session exists, but the CLI could not verify whether it is still valid. Run `primitive logout` before logging in again.",
  };
}

export type LoginFlags = {
  "api-base-url"?: string;
  "device-name"?: string;
  "no-browser"?: boolean;
  force?: boolean;
  permission?: string[];
};

const PERMISSION_PATTERN = /^[a-z][a-z0-9_.]*:[a-z][a-z0-9_]*$/;

/**
 * `--permission` values as the login's `requested_grant`: space-separated
 * permissions, as OAuth scopes are written. Null when none were given.
 */
export function requestedGrantFromPermissions(
  permissions: readonly string[] | undefined,
): string | null {
  if (!permissions || permissions.length === 0) return null;
  const values = permissions
    .flatMap((value) => value.split(/[\s,]+/))
    .map((value) => value.trim())
    .filter(Boolean);
  for (const value of values) {
    if (!PERMISSION_PATTERN.test(value)) {
      throw cliError(
        `--permission ${JSON.stringify(value)} is not a permission. Permissions look like \`mail:send\`.`,
      );
    }
  }
  return [...new Set(values)].join(" ");
}

type StartResponse = { data?: unknown; error?: unknown; response?: Response };

/**
 * Start a CLI login as the person (`login_kind: "user"`), and fall back to
 * the org-bound login when the server refuses the field, as servers without
 * user logins do with `400 validation_error`.
 */
export async function startLoginWithFallback(params: {
  deviceName: string;
  requestedGrant: string | null;
  start: (body: StartCliLoginInput) => Promise<StartResponse>;
}): Promise<{
  loginKind: "user" | "org";
  start: CliLoginStartResult;
}> {
  const base: StartCliLoginInput = {
    device_name: params.deviceName,
    ...(params.requestedGrant
      ? { requested_grant: params.requestedGrant }
      : {}),
  };
  const attempts: Array<{ kind: "user" | "org"; body: StartCliLoginInput }> = [
    { kind: "user", body: { ...base, login_kind: "user" } },
    { kind: "org", body: base },
  ];
  let lastPayload: unknown = null;
  for (const attempt of attempts) {
    const started = await params.start(attempt.body);
    if (!started.error) {
      const start = unwrapData<CliLoginStartResult>(started.data);
      if (!start) {
        throw cliError("Primitive API returned an empty CLI login response.");
      }
      return { loginKind: attempt.kind, start };
    }
    const payload = extractErrorPayload(started.error);
    const code = extractErrorCode(payload);
    lastPayload = payload;
    if (code === "grant_not_available") {
      writeErrorWithHints(payload);
      throw cliError(
        "This server does not offer CLI logins narrowed with --permission. Log in without --permission.",
      );
    }
    if (code !== "validation_error" || attempt.kind === "org") break;
  }
  writeErrorWithHints(lastPayload);
  if (
    params.requestedGrant &&
    extractErrorCode(lastPayload) === "validation_error"
  ) {
    throw cliError(
      "This server does not accept --permission for CLI logins. Log in without --permission.",
    );
  }
  throw cliError("Could not start Primitive CLI login.");
}

export function isUserLoginResult(
  login: unknown,
): login is CliUserLoginPollResult {
  return (
    login !== null &&
    typeof login === "object" &&
    (login as { auth_method?: unknown }).auth_method === "user_grant"
  );
}

class LoginCommand extends Command {
  static description =
    "Log in by opening Primitive in your browser and saving the session locally. Where the server supports it, you log in as yourself and can switch between your organizations with `primitive org use <org>` or `--org <org>` on any command; otherwise the login is bound to the organization you choose in the browser.";

  static summary = "Log in with browser approval";

  static examples = [
    "<%= config.bin %> login",
    "<%= config.bin %> login --device-name work-laptop",
    "<%= config.bin %> login --force",
    "<%= config.bin %> login --org acme",
  ];

  static flags = {
    "api-base-url": Flags.string({
      description:
        "Override the primary API base URL. Internal testing only; not documented to customers.",
      env: "PRIMITIVE_API_BASE_URL",
      hidden: true,
    }),
    "device-name": Flags.string({
      description: "Device name shown in the browser approval screen",
    }),
    "no-browser": Flags.boolean({
      description: "Do not attempt to open the browser automatically",
    }),
    force: Flags.boolean({
      char: "f",
      description:
        "Replace saved credentials without first verifying the existing session",
    }),
    permission: Flags.string({
      description:
        "Ask for a login narrowed to this permission, such as `mail:read`. Repeat for more. Refused by servers that do not offer narrowed CLI logins; the login is never widened instead.",
      multiple: true,
    }),
  };

  async run(): Promise<void> {
    const commandClass = this.constructor as typeof LoginCommand;
    const { flags } = await this.parse(commandClass);

    await this.runBrowserLogin(flags, this.retryCommand());
  }

  protected async runBrowserLogin(
    flags: LoginFlags,
    retryCommand = this.retryCommand(),
  ): Promise<void> {
    let releaseCredentialsLock: () => void;
    try {
      releaseCredentialsLock = acquireCliCredentialsLock(this.config.configDir);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw cliError(detail);
    }

    try {
      await this.runWithCredentialLock(flags, retryCommand);
    } finally {
      releaseCredentialsLock();
    }
  }

  protected retryCommand(): string {
    return "login";
  }

  private async runWithCredentialLock(
    flags: LoginFlags,
    retryCommand: string,
  ): Promise<void> {
    const { apiClient, requestConfig } = createCliApiClient({
      apiBaseUrl: flags["api-base-url"],
      configDir: this.config.configDir,
    });
    const apiBaseUrl = requestConfig.resolvedApiBaseUrl;
    let existing: StoredCliCredentials | null;
    try {
      existing = loadCliCredentials(this.config.configDir);
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
        "Replacing saved Primitive CLI credentials after browser approval because --force was set.\n",
      );
    } else if (existing) {
      const existingStatus = await checkExistingLogin({
        apiBaseUrl: flags["api-base-url"],
        configDir: this.config.configDir,
        credentials: existing,
        credentialsLockHeld: true,
      });
      if (existingStatus.status === "removed_stale") {
        process.stderr.write("Continuing with a new Primitive CLI login...\n");
      } else if (existingStatus.status === "blocked") {
        writeErrorWithHints(existingStatus.payload);
        throw cliError(existingStatus.message);
      } else {
        const org = existing.org_name ? ` for ${existing.org_name}` : "";
        throw cliError(
          `Already logged in${org}. Run \`primitive logout\` before logging in again.`,
        );
      }
    }

    const deviceName = flags["device-name"] ?? hostname();
    const requestedGrant = requestedGrantFromPermissions(flags.permission);
    const { start } = await startLoginWithFallback({
      deviceName,
      requestedGrant,
      start: (body) =>
        startCliLogin({
          body,
          client: apiClient.client,
          responseStyle: "fields",
        }),
    });

    const openedBrowser = !flags["no-browser"];
    if (openedBrowser) openBrowser(start.verification_uri_complete);
    const copyHotkey = canOfferCopyHotkey(process.stdin, process.stderr);
    const stopCopyHotkey = copyHotkey
      ? listenForCopyHotkey({
          input: process.stdin,
          output: process.stderr,
          url: start.verification_uri_complete,
        })
      : () => undefined;
    process.stderr.write(
      formatBrowserLoginInstructions({ copyHotkey, openedBrowser, start }),
    );
    process.stderr.write("Waiting for browser approval...\n");

    let login: CliLoginPollResult;
    try {
      login = await pollCliLoginUntilApproved({
        poll: (deviceCode) =>
          pollCliLogin({
            body: { device_code: deviceCode },
            client: apiClient.client,
            responseStyle: "fields",
          }),
        retryCommand,
        start,
      });
    } finally {
      stopCopyHotkey();
    }

    deleteChatState(this.config.configDir);
    if (isUserLoginResult(login)) {
      await this.saveUserLogin({
        apiBaseUrl,
        headers: requestConfig.headers,
        login,
        requestedGrant,
      });
      return;
    }
    const wantedOrg = process.env[ORG_SELECTION_ENV]?.trim();
    if (
      wantedOrg &&
      wantedOrg.toLowerCase() !== login.org_id.toLowerCase() &&
      wantedOrg.toLowerCase() !== (login.org_name ?? "").toLowerCase()
    ) {
      process.stderr.write(
        `This server binds a CLI login to the organization chosen in the browser, so --org ${wantedOrg} was not applied.\n`,
      );
    }
    saveCliCredentials(this.config.configDir, {
      access_token: login.access_token,
      api_base_url: apiBaseUrl,
      auth_method: "oauth",
      created_at: new Date().toISOString(),
      expires_at: cliAccessTokenExpiresAt(login.expires_in),
      oauth_client_id: login.oauth_client_id,
      oauth_grant_id: login.oauth_grant_id,
      org_id: login.org_id,
      org_name: login.org_name,
      refresh_token: login.refresh_token,
      token_type: login.token_type,
    });

    const org = login.org_name ? ` (${login.org_name})` : "";
    process.stderr.write(`Logged in to org ${login.org_id}${org}.\n`);
    process.stderr.write(
      `Saved credentials to ${credentialsPath(this.config.configDir)}.\n`,
    );
  }

  private async saveUserLogin(params: {
    apiBaseUrl: string;
    headers?: Record<string, string>;
    login: CliUserLoginPollResult;
    requestedGrant: string | null;
  }): Promise<void> {
    const { login } = params;
    saveCliCredentials(
      this.config.configDir,
      credentialsFromUserLogin({
        apiBaseUrl: params.apiBaseUrl,
        login,
        requestedGrant: params.requestedGrant,
      }),
    );
    process.stderr.write(
      "Logged in as yourself. Switch organizations with `primitive org use <org>`, or pass --org <org> to one command.\n",
    );
    if (login.org) {
      const name = login.org.org_name ? ` (${login.org.org_name})` : "";
      process.stderr.write(
        `Current organization: ${login.org.org_id}${name}, role ${login.org.role}.\n`,
      );
    } else if (login.org_refusal) {
      process.stderr.write(
        `The organization chosen in the browser (${login.org_refusal.org_id}) cannot be used from the CLI: ${login.org_refusal.message} [${login.org_refusal.reason}]\nRun \`primitive orgs\` to see where you can, then \`primitive org use <org>\`.\n`,
      );
    }

    const wantedOrg = process.env[ORG_SELECTION_ENV]?.trim();
    const alreadyThere =
      wantedOrg &&
      login.org &&
      (wantedOrg.toLowerCase() === login.org.org_id.toLowerCase() ||
        wantedOrg.toLowerCase() === (login.org.org_name ?? "").toLowerCase());
    if (wantedOrg && !alreadyThere) {
      try {
        const { org } = await switchCurrentOrg({
          apiBaseUrl: params.apiBaseUrl,
          configDir: this.config.configDir,
          // runBrowserLogin holds the credentials lock for the whole login.
          credentialsLockHeld: true,
          headers: params.headers,
          selection: wantedOrg,
        });
        const name = org.org_name ? ` (${org.org_name})` : "";
        process.stderr.write(
          `Switched to organization ${org.org_id}${name}, role ${org.role ?? "unknown"}.\n`,
        );
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        const reason =
          error instanceof CliOrgRefusedError ? ` [${error.reason}]` : "";
        process.stderr.write(
          `Logged in, but could not switch to ${wantedOrg}: ${detail}${reason}\n`,
        );
        process.exitCode = 1;
      }
    }
    process.stderr.write(
      `Saved credentials to ${credentialsPath(this.config.configDir)}.\n`,
    );
  }
}

export default LoginCommand;
