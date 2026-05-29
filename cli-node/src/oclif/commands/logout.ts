import { existsSync } from "node:fs";
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
  credentialsLockPath,
  credentialsPath,
  deleteCliCredentials,
  deleteCliCredentialsLock,
  loadCliCredentials,
} from "../auth.js";
import { chatStatePath } from "../chat-state.js";
import { deletePendingAgentSignup, pendingSignupPath } from "./signup.js";

function cliError(message: string): Errors.CLIError {
  return new Errors.CLIError(message, { exit: 1 });
}

function unwrapData<T>(value: unknown): T | null {
  const envelope = value as { data?: T } | null | undefined;
  return envelope?.data ?? null;
}

type LogoutFlags = {
  "api-base-url"?: string;
  force?: boolean;
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
      "Not logged in. Run `primitive login` to create saved CLI credentials.",
    );
  }

  let authenticated: Awaited<
    ReturnType<typeof createAuthenticatedCliApiClient>
  >;
  try {
    authenticated = await deps.createAuthenticatedCliApiClient({
      apiBaseUrl: params.flags["api-base-url"],
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

export function runForceLogout(params: { configDir: string }): void {
  const localCredentialsPath = credentialsPath(params.configDir);
  const pendingPath = pendingSignupPath(params.configDir);
  const lockPath = credentialsLockPath(params.configDir);
  const removed = [
    existsSync(localCredentialsPath) ? "local Primitive CLI credentials" : null,
    existsSync(chatStatePath(params.configDir))
      ? "local chat reply state"
      : null,
    existsSync(pendingPath) ? "pending email-code auth state" : null,
    existsSync(lockPath) ? "credential lock" : null,
  ].filter((value): value is string => value !== null);

  deleteCliCredentials(params.configDir);
  deletePendingAgentSignup(params.configDir);
  deleteCliCredentialsLock(params.configDir);

  if (removed.length === 0) {
    process.stderr.write(
      "No local Primitive CLI auth state was present. Backing OAuth grant was not revoked.\n",
    );
    return;
  }

  process.stderr.write(
    `Removed ${formatList(removed)}. Backing OAuth grant was not revoked.\n`,
  );
}

function formatList(values: string[]): string {
  if (values.length <= 1) return values[0] ?? "";
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
}

class LogoutCommand extends Command {
  static description =
    "Log out by revoking the saved Primitive CLI OAuth grant and deleting local credentials. Use --force to remove local credentials, pending email-code auth state, and stale credential locks without contacting Primitive.";

  static summary = "Log out and revoke the saved CLI OAuth grant";

  static examples = [
    "<%= config.bin %> logout",
    "<%= config.bin %> logout --force",
  ];

  static flags = {
    "api-base-url": Flags.string({
      description:
        "Override the primary API base URL. Internal testing only; not documented to customers.",
      env: "PRIMITIVE_API_BASE_URL",
      hidden: true,
    }),
    force: Flags.boolean({
      char: "f",
      description:
        "Remove local CLI credentials, pending email-code auth state, and any credential lock without revoking the server OAuth grant",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(LogoutCommand);
    if (flags.force) {
      runForceLogout({ configDir: this.config.configDir });
      return;
    }

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
