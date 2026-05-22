import { Command, Errors, Flags } from "@oclif/core";
import type { CliLogoutResult } from "@primitivedotdev/api-core";
import { cliLogout, PrimitiveApiClient } from "@primitivedotdev/api-core";
import { resolveCliApiRequestConfig } from "../api-client.js";
import {
  API_ERROR_CODES,
  extractErrorCode,
  extractErrorPayload,
  writeErrorWithHints,
} from "../api-command.js";
import {
  acquireCliCredentialsLock,
  deleteCliCredentials,
  loadCliCredentials,
  normalizeApiBaseUrl1,
} from "../auth.js";

function cliError(message: string): Errors.CLIError {
  return new Errors.CLIError(message, { exit: 1 });
}

function unwrapData<T>(value: unknown): T | null {
  const envelope = value as { data?: T } | null | undefined;
  return envelope?.data ?? null;
}

type LogoutFlags = {
  "api-base-url-1"?: string;
};

class LogoutCommand extends Command {
  static description =
    "Log out by revoking the saved Primitive CLI API key and deleting local credentials.";

  static summary = "Log out and revoke the saved CLI key";

  static examples = ["<%= config.bin %> logout"];

  static flags = {
    "api-base-url-1": Flags.string({
      description:
        "Override the primary API base URL. Internal testing only; not documented to customers.",
      env: "PRIMITIVE_API_BASE_URL_1",
      hidden: true,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(LogoutCommand);
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

  private async runWithCredentialLock(flags: LogoutFlags): Promise<void> {
    let credentials: ReturnType<typeof loadCliCredentials>;
    try {
      credentials = loadCliCredentials(this.config.configDir);
    } catch (error) {
      deleteCliCredentials(this.config.configDir);
      const detail = error instanceof Error ? error.message : String(error);
      process.stderr.write(
        `Removed unreadable Primitive CLI credentials. Backing API key was not revoked: ${detail}\n`,
      );
      process.exitCode = 1;
      return;
    }
    if (!credentials) {
      throw cliError(
        "Not logged in. Run `primitive login` to create saved CLI credentials.",
      );
    }

    const requestConfig = resolveCliApiRequestConfig({
      apiBaseUrl1: flags["api-base-url-1"],
      configDir: this.config.configDir,
    });
    const apiBaseUrl1 = requestConfig.apiBaseUrl1
      ? normalizeApiBaseUrl1(requestConfig.apiBaseUrl1)
      : credentials.api_base_url_1;
    const apiClient = new PrimitiveApiClient({
      apiKey: credentials.api_key,
      apiBaseUrl1,
      headers: requestConfig.headers,
    });

    const result = await cliLogout({
      body: { key_id: credentials.key_id },
      client: apiClient.client,
      responseStyle: "fields",
    });

    if (result.error) {
      const payload = extractErrorPayload(result.error);
      const code = extractErrorCode(payload);
      if (
        code === API_ERROR_CODES.unauthorized ||
        code === API_ERROR_CODES.notFound
      ) {
        deleteCliCredentials(this.config.configDir);
        writeErrorWithHints(payload);
        process.stderr.write(
          "Removed saved Primitive CLI credentials because the backing API key is already unavailable.\n",
        );
        process.exitCode = 1;
        return;
      }

      writeErrorWithHints(payload);
      throw cliError("Could not revoke the saved Primitive CLI API key.");
    }

    const logout = unwrapData<CliLogoutResult>(result.data);
    deleteCliCredentials(this.config.configDir);

    const keyId = logout?.key_id ?? credentials.key_id;
    process.stderr.write(`Logged out and revoked API key ${keyId}.\n`);
  }
}

export default LogoutCommand;
