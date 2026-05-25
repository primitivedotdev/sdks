import { Command, Errors, Flags } from "@oclif/core";
import type { CliLogoutResult } from "@primitivedotdev/api-core";
import { cliLogout } from "@primitivedotdev/api-core";
import {
  createAuthenticatedCliApiClient,
  SAVED_CLI_OAUTH_SESSION_EXPIRED_MESSAGE,
} from "../api-client.js";
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

type LogoutDeps = {
  cliLogout?: typeof cliLogout;
  createAuthenticatedCliApiClient?: typeof createAuthenticatedCliApiClient;
};

function isSavedOAuthSessionExpiredError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message === SAVED_CLI_OAUTH_SESSION_EXPIRED_MESSAGE
  );
}

export async function runLogoutWithCredentialLock(params: {
  configDir: string;
  deps?: LogoutDeps;
  flags: LogoutFlags;
}): Promise<void> {
  const deps = {
    cliLogout,
    createAuthenticatedCliApiClient,
    ...params.deps,
  };
  let credentials: ReturnType<typeof loadCliCredentials>;
  try {
    credentials = loadCliCredentials(params.configDir);
  } catch (error) {
    deleteCliCredentials(params.configDir);
    const detail = error instanceof Error ? error.message : String(error);
    process.stderr.write(
      `Removed unreadable Primitive CLI credentials. Backing OAuth grant was not revoked: ${detail}\n`,
    );
    process.exitCode = 1;
    return;
  }
  if (!credentials) {
    throw cliError(
      "Not logged in. Run `primitive signin` to create saved CLI credentials.",
    );
  }

  let authenticated: Awaited<
    ReturnType<typeof createAuthenticatedCliApiClient>
  >;
  try {
    authenticated = await deps.createAuthenticatedCliApiClient({
      apiBaseUrl1: params.flags["api-base-url-1"],
      configDir: params.configDir,
      credentialsLockHeld: true,
    });
  } catch (error) {
    if (
      isSavedOAuthSessionExpiredError(error) &&
      loadCliCredentials(params.configDir) === null
    ) {
      process.stderr.write(
        "Logged out (OAuth session was already expired or revoked on the server).\n",
      );
      return;
    }
    throw error;
  }
  const freshCredentials = authenticated.auth.credentials ?? credentials;

  const result = await deps.cliLogout({
    body: { key_id: freshCredentials.oauth_grant_id },
    client: authenticated.apiClient.client,
    responseStyle: "fields",
  });

  if (result.error) {
    const payload = extractErrorPayload(result.error);
    const code = extractErrorCode(payload);
    if (
      code === API_ERROR_CODES.unauthorized ||
      code === API_ERROR_CODES.notFound
    ) {
      deleteCliCredentials(params.configDir);
      writeErrorWithHints(payload);
      process.stderr.write(
        "Removed saved Primitive CLI credentials because the backing OAuth grant is already unavailable.\n",
      );
      process.exitCode = 1;
      return;
    }

    writeErrorWithHints(payload);
    throw cliError("Could not revoke the saved Primitive CLI OAuth grant.");
  }

  const logout = unwrapData<CliLogoutResult>(result.data);
  deleteCliCredentials(params.configDir);

  const grantId = logout?.oauth_grant_id ?? freshCredentials.oauth_grant_id;
  process.stderr.write(`Logged out and revoked OAuth grant ${grantId}.\n`);
}

class LogoutCommand extends Command {
  static description =
    "Log out by revoking the saved Primitive CLI OAuth grant and deleting local credentials.";

  static summary = "Log out and revoke the saved CLI OAuth grant";

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
      await runLogoutWithCredentialLock({
        configDir: this.config.configDir,
        flags,
      });
    } finally {
      releaseCredentialsLock();
    }
  }
}

export default LogoutCommand;
