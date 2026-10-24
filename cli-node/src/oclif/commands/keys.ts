import { Command, Flags } from "@oclif/core";
import {
  type CredentialList,
  type CredentialRow,
  listCredentials,
} from "@primitivedotdev/api-core";
import { createAuthenticatedCliApiClient } from "../api-client.js";
import {
  API_BASE_URL_FLAG_DESCRIPTION,
  extractErrorPayload,
  surfaceUnauthorizedHint,
  writeErrorWithHints,
} from "../api-command.js";

// Organization API keys, read only. The CLI lists key metadata and never
// shows a secret. Keys are created, rotated and revoked in the dashboard.
// Listing goes through the credential inventory, which the server answers
// only for an owner or admin in a dashboard session; from the CLI the command
// shows the server's refusal.

export const KEYS_MANAGED_IN_DASHBOARD =
  "API keys are created, rotated and revoked in the dashboard.";

const API_KEY_FLAG = Flags.string({
  description:
    "Primitive API key override (defaults to PRIMITIVE_API_KEY or saved login credentials).",
  env: "PRIMITIVE_API_KEY",
  hidden: true,
});

const API_BASE_URL_FLAG = Flags.string({
  description: API_BASE_URL_FLAG_DESCRIPTION,
  env: "PRIMITIVE_API_BASE_URL",
  hidden: true,
});

/** Print a refusal and set a failing exit code. */
function reportKeysError(
  error: unknown,
  context: Omit<Parameters<typeof surfaceUnauthorizedHint>[0], "payload">,
  json: boolean,
): void {
  const payload = extractErrorPayload(error);
  if (json) {
    process.stderr.write(`${JSON.stringify(payload)}\n`);
  } else {
    writeErrorWithHints(payload);
    const body = payload as { code?: unknown } | null;
    if (body?.code === "forbidden") {
      process.stderr.write(
        "Listing keys needs an owner or admin. Some of it is available only in the dashboard.\n",
      );
    }
  }
  surfaceUnauthorizedHint({ ...context, payload });
  process.exitCode = 1;
}

function unwrap<T>(data: unknown): T | null {
  return ((data as { data?: T } | undefined)?.data ?? null) as T | null;
}

export function formatKeyRows(rows: readonly CredentialRow[]): string {
  if (rows.length === 0) return "No API keys.";
  return rows
    .map((row) => {
      const grant = row.grant.template
        ? row.grant.template
        : `${row.grant.permissions?.length ?? 0} permissions`;
      const flags = row.flags.length > 0 ? ` [${row.flags.join(", ")}]` : "";
      return `${row.id}  ${row.prefix ?? ""}  ${row.name ?? "(unnamed)"}  ${grant}  expires ${row.expires_at ?? "never"}  last used ${row.last_used_at ?? "never"}${flags}`;
    })
    .join("\n");
}

export class KeysListCommand extends Command {
  static description =
    `List the organization's API keys from the credential inventory, with grant, expiry and last use. Only metadata is shown, never a secret.

  ${KEYS_MANAGED_IN_DASHBOARD} The server answers this list only for an owner or admin in a dashboard session; from a CLI login it shows the server's refusal.`;

  static summary = "List API keys";

  static examples = [
    "<%= config.bin %> keys list",
    "<%= config.bin %> keys list --json",
  ];

  static flags = {
    "api-key": API_KEY_FLAG,
    "api-base-url": API_BASE_URL_FLAG,
    json: Flags.boolean({ description: "Print the inventory rows as JSON." }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(KeysListCommand);
    const { apiClient, auth, baseUrlOverridden } =
      await createAuthenticatedCliApiClient({
        apiKey: flags["api-key"],
        apiBaseUrl: flags["api-base-url"],
        configDir: this.config.configDir,
      });
    const result = await listCredentials({
      client: apiClient.client,
      query: { kind: "org_key" },
      responseStyle: "fields",
    });
    if (result.error) {
      reportKeysError(
        result.error,
        { auth, baseUrlOverridden, configDir: this.config.configDir },
        Boolean(flags.json),
      );
      return;
    }
    const list = unwrap<CredentialList>(result.data);
    const rows = list?.items ?? [];
    if (flags.json) {
      this.log(JSON.stringify(rows, null, 2));
      return;
    }
    this.log(formatKeyRows(rows));
  }
}
