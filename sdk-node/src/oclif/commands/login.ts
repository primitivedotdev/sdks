import { spawn } from "node:child_process";
import { hostname } from "node:os";
import { Command, Errors, Flags } from "@oclif/core";
import {
  getAccount,
  pollCliLogin,
  startCliLogin,
} from "../../api/generated/sdk.gen.js";
import type {
  CliLoginPollResult,
  CliLoginStartResult,
} from "../../api/generated/types.gen.js";
import { PrimitiveApiClient } from "../../api/index.js";
import {
  extractErrorCode,
  extractErrorPayload,
  removeStaleSavedCredentialOnUnauthorized,
  writeErrorWithHints,
} from "../api-command.js";
import {
  loadCliCredentials,
  normalizeBaseUrl,
  type StoredCliCredentials,
  saveCliCredentials,
} from "../auth.js";

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
  baseUrl?: string;
  configDir: string;
  credentials: StoredCliCredentials;
  checkAccount?: (
    apiClient: PrimitiveApiClient,
  ) => Promise<{ error?: unknown }>;
}): Promise<ExistingLoginStatus> {
  const baseUrlOverridden = params.baseUrl !== undefined;
  const probeBaseUrl = baseUrlOverridden
    ? normalizeBaseUrl(params.baseUrl)
    : params.credentials.base_url;
  const apiClient = new PrimitiveApiClient({
    apiKey: params.credentials.api_key,
    baseUrl: probeBaseUrl,
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
  const auth = {
    apiKey: params.credentials.api_key,
    baseUrl: probeBaseUrl,
    credentials: params.credentials,
    source: "stored" as const,
  };
  const removed = removeStaleSavedCredentialOnUnauthorized({
    auth,
    baseUrlOverridden,
    configDir: params.configDir,
    payload,
  });
  if (removed) return { status: "removed_stale" };

  const code = extractErrorCode(payload);
  return {
    status: "blocked",
    payload,
    message:
      code === "unauthorized"
        ? "Saved Primitive CLI credentials were rejected. Run `primitive logout` to remove them before logging in again."
        : "A saved Primitive CLI login exists, but the CLI could not verify whether it is still valid. Run `primitive logout` before logging in again.",
  };
}

class LoginCommand extends Command {
  static description =
    "Log in by opening Primitive in your browser and saving an org-scoped CLI API key locally.";

  static summary = "Log in with browser approval";

  static examples = [
    "<%= config.bin %> login",
    "<%= config.bin %> login --device-name work-laptop",
  ];

  static flags = {
    "base-url": Flags.string({
      description: "API base URL (defaults to PRIMITIVE_API_URL or production)",
      env: "PRIMITIVE_API_URL",
    }),
    "device-name": Flags.string({
      description: "Device name shown in the browser approval screen",
    }),
    "no-browser": Flags.boolean({
      description: "Do not attempt to open the browser automatically",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(LoginCommand);
    const baseUrl = normalizeBaseUrl(flags["base-url"]);
    const existing = loadCliCredentials(this.config.configDir);
    if (existing) {
      const existingStatus = await checkExistingLogin({
        baseUrl: flags["base-url"],
        configDir: this.config.configDir,
        credentials: existing,
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

    const apiClient = new PrimitiveApiClient({ baseUrl });
    const deviceName = flags["device-name"] ?? hostname();
    const started = await startCliLogin({
      body: {
        device_name: deviceName,
        metadata: {
          arch: process.arch,
          platform: process.platform,
          version: this.config.version,
        },
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
    let interval = start.interval;

    while (Date.now() < deadline) {
      await sleep(interval * 1000);

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
          api_key: login.api_key,
          base_url: baseUrl,
          created_at: new Date().toISOString(),
          key_id: login.key_id,
          key_prefix: login.key_prefix,
          org_id: login.org_id,
          org_name: login.org_name,
        });

        const org = login.org_name ? ` (${login.org_name})` : "";
        process.stderr.write(`Logged in to org ${login.org_id}${org}.\n`);
        return;
      }

      const payload = extractErrorPayload(polled.error);
      const code = extractErrorCode(payload);
      if (code === "authorization_pending") continue;
      if (code === "slow_down") {
        interval = retryAfterSeconds(polled) ?? interval + 5;
        continue;
      }
      if (code === "access_denied") {
        throw cliError("Primitive CLI login was denied in the browser.");
      }
      if (code === "expired_token") {
        throw cliError(
          "Primitive CLI login expired. Run `primitive login` again.",
        );
      }
      if (code === "invalid_device_code") {
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
