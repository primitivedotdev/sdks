import { spawn } from "node:child_process";
import { hostname } from "node:os";
import { Command, Errors, Flags } from "@oclif/core";
import type {
  CliLoginPollResult,
  CliLoginStartResult,
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

const MAX_CLI_LOGIN_POLL_INTERVAL_SECONDS = 60;

function cliError(message: string): Errors.CLIError {
  return new Errors.CLIError(message, { exit: 1 });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function openBrowser(url: string): void {
  const command =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "cmd"
        : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  const child = spawn(command, args, { detached: true, stdio: "ignore" });
  child.on("error", () => undefined);
  child.unref();
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

type ExistingLoginStatus =
  | { status: "valid" }
  | { status: "removed_stale" }
  | { status: "blocked"; message: string; payload: unknown };

export async function checkExistingLogin(params: {
  apiBaseUrl1?: string;
  configDir: string;
  credentials: StoredCliCredentials;
  credentialsLockHeld?: boolean;
  checkAccount?: (
    apiClient: PrimitiveApiClient,
  ) => Promise<{ error?: unknown }>;
}): Promise<ExistingLoginStatus> {
  const requestConfig = resolveCliApiRequestConfig({
    apiBaseUrl1: params.apiBaseUrl1,
    configDir: params.configDir,
  });
  const probeApiBaseUrl1 =
    requestConfig.apiBaseUrl1 ?? params.credentials.api_base_url_1;
  let credentials = params.credentials;
  try {
    credentials = await refreshStoredCliCredentials({
      apiBaseUrl1: probeApiBaseUrl1,
      configDir: params.configDir,
      credentials,
      credentialsLockHeld: params.credentialsLockHeld,
      headers: requestConfig.headers,
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
    apiBaseUrl1: probeApiBaseUrl1,
    apiBaseUrl2: requestConfig.resolvedApiBaseUrl2,
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
  // probing against env B" — the credential may still be valid
  // against its original host.
  const baseUrlDiffersFromSaved =
    requestConfig.baseUrlOverridden &&
    requestConfig.apiBaseUrl1 !== params.credentials.api_base_url_1;
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

type LoginFlags = {
  "api-base-url-1"?: string;
  "device-name"?: string;
  "no-browser"?: boolean;
  force?: boolean;
};

class LoginCommand extends Command {
  static description =
    "Log in by opening Primitive in your browser and saving an org-scoped OAuth session locally.";

  static summary = "Log in with browser approval";

  static examples = [
    "<%= config.bin %> login",
    "<%= config.bin %> login --device-name work-laptop",
    "<%= config.bin %> login --force",
  ];

  static flags = {
    "api-base-url-1": Flags.string({
      description:
        "Override the primary API base URL. Internal testing only; not documented to customers.",
      env: "PRIMITIVE_API_BASE_URL_1",
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
        "Replace saved credentials without first verifying the existing login",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(LoginCommand);

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

  private async runWithCredentialLock(flags: LoginFlags): Promise<void> {
    const { apiClient, requestConfig } = createCliApiClient({
      apiBaseUrl1: flags["api-base-url-1"],
      configDir: this.config.configDir,
    });
    const apiBaseUrl1 = requestConfig.resolvedApiBaseUrl1;
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
        apiBaseUrl1: flags["api-base-url-1"],
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
    const started = await startCliLogin({
      body: {
        device_name: deviceName,
      },
      client: apiClient.client,
      responseStyle: "fields",
    });

    if (started.error) {
      writeErrorWithHints(extractErrorPayload(started.error));
      throw cliError("Could not start Primitive CLI login.");
    }

    const start = unwrapData<CliLoginStartResult>(started.data);
    if (!start) {
      throw cliError("Primitive API returned an empty CLI login response.");
    }

    process.stderr.write(`Your login code is: ${start.user_code}\n`);
    if (!flags["no-browser"]) {
      openBrowser(start.verification_uri_complete);
      process.stderr.write("Opening Primitive in your browser...\n");
    }
    process.stderr.write(
      `If the browser did not open, visit: ${start.verification_uri_complete}\n`,
    );
    process.stderr.write("Waiting for browser approval...\n");

    const deadline = Date.now() + start.expires_in * 1000;
    let interval = Math.min(
      Math.max(1, start.interval),
      MAX_CLI_LOGIN_POLL_INTERVAL_SECONDS,
    );
    let nextPollDelay = 1;

    while (Date.now() < deadline) {
      await sleep(nextPollDelay * 1000);
      nextPollDelay = interval;

      const polled = await pollCliLogin({
        body: { device_code: start.device_code },
        client: apiClient.client,
        responseStyle: "fields",
      });

      if (polled.data) {
        const login = unwrapData<CliLoginPollResult>(polled.data);
        if (!login) {
          throw cliError("Primitive API returned an empty CLI poll response.");
        }

        saveCliCredentials(this.config.configDir, {
          access_token: login.access_token,
          api_base_url_1: apiBaseUrl1,
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
        return;
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
      if (code === API_ERROR_CODES.accessDenied) {
        throw cliError("Primitive CLI login was denied in the browser.");
      }
      if (code === API_ERROR_CODES.expiredToken) {
        throw cliError(
          "Primitive CLI login expired. Run `primitive login` again.",
        );
      }
      if (code === API_ERROR_CODES.invalidDeviceCode) {
        throw cliError(
          "Primitive CLI login device code is invalid. Run `primitive login` again.",
        );
      }

      writeErrorWithHints(payload);
      throw cliError("Primitive CLI login failed while polling for approval.");
    }

    throw cliError("Primitive CLI login expired. Run `primitive login` again.");
  }
}

export default LoginCommand;
