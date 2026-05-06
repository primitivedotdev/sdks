import { Command, Errors, Flags } from "@oclif/core";
import { cliLogout } from "../../api/generated/sdk.gen.js";
import type { CliLogoutResult } from "../../api/generated/types.gen.js";
import { PrimitiveApiClient } from "../../api/index.js";
import {
  API_ERROR_CODES,
  extractErrorCode,
  extractErrorPayload,
  writeErrorWithHints,
} from "../api-command.js";
import {
  deleteCliCredentials,
  loadCliCredentials,
  normalizeBaseUrl,
} from "../auth.js";

function cliError(message: string): Errors.CLIError {
  return new Errors.CLIError(message, { exit: 1 });
}

function unwrapData<T>(value: unknown): T | null {
  const envelope = value as { data?: T } | null | undefined;
  return envelope?.data ?? null;
}

class LogoutCommand extends Command {
  static description =
    "Log out by revoking the saved Primitive CLI API key and deleting local credentials.";

  static summary = "Log out and revoke the saved CLI key";

  static examples = ["<%= config.bin %> logout"];

  static flags = {
    "base-url": Flags.string({
      description: "Override the API base URL used for key revocation",
      env: "PRIMITIVE_API_URL",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(LogoutCommand);
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

    const baseUrl = flags["base-url"]
      ? normalizeBaseUrl(flags["base-url"])
      : credentials.base_url;
    const apiClient = new PrimitiveApiClient({
      apiKey: credentials.api_key,
      baseUrl,
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
