import { Args, Command, Errors, Flags } from "@oclif/core";
import {
  type CreatedKey,
  type CreateKeyInput,
  type CredentialList,
  type CredentialRow,
  createKey,
  type KeyGrant,
  type KeyPreset,
  listCredentials,
  type RevokeCredentialResult,
  type RotatedKey,
  revokeCredential,
  rotateKey,
} from "@primitivedotdev/api-core";
import { createAuthenticatedCliApiClient } from "../api-client.js";
import {
  API_BASE_URL_FLAG_DESCRIPTION,
  extractErrorPayload,
  surfaceUnauthorizedHint,
  writeErrorWithHints,
} from "../api-command.js";

// Organization API keys. Creating and rotating a key from the CLI needs a
// single-use step-up token from the dashboard (--step-up): a CLI login is an
// OAuth token, and the server asks an OAuth token for a step-up here.
// Listing and revoking go through the credential inventory, which the server
// answers only for an owner or admin in a dashboard session; from the CLI
// those commands show the server's refusal.

const KEY_PRESETS: readonly KeyPreset[] = [
  "super_admin",
  "send_only",
  "read_only",
  "own_addresses",
  "own_addresses_read_only",
  "custom",
];

const PERMISSION_PATTERN = /^[a-z][a-z0-9_.]*:[a-z][a-z0-9_]*$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const API_KEY_FLAG = Flags.string({
  description:
    "Primitive API key override (defaults to PRIMITIVE_API_KEY or saved login credentials). The server does not let API keys create or rotate keys.",
  env: "PRIMITIVE_API_KEY",
  hidden: true,
});

const API_BASE_URL_FLAG = Flags.string({
  description: API_BASE_URL_FLAG_DESCRIPTION,
  env: "PRIMITIVE_API_BASE_URL",
  hidden: true,
});

const STEP_UP_FLAG = Flags.string({
  description:
    "Single-use step-up token (pstep_...) from the dashboard's step-up page. Needed when a CLI login creates or rotates a key.",
  env: "PRIMITIVE_STEP_UP",
});

function usageError(message: string): Errors.CLIError {
  return new Errors.CLIError(message, { exit: 2 });
}

const DURATION_UNITS: Record<string, number> = {
  s: 1,
  m: 60,
  h: 3600,
  d: 86400,
  w: 7 * 86400,
};

/** Parse `90s`, `15m`, `12h`, `30d` or `2w` to seconds. Null when not a duration. */
export function parseDurationSeconds(value: string): number | null {
  const match = /^(\d+)\s*([smhdw])$/i.exec(value.trim());
  if (!match) return null;
  const amount = Number.parseInt(match[1] as string, 10);
  const unit = DURATION_UNITS[(match[2] as string).toLowerCase()] as number;
  return amount * unit;
}

/**
 * `--expires` as the request fields: a whole number of days becomes
 * `expires_in_days`; any other duration or a date becomes `expires_at`.
 */
export function parseExpires(
  value: string,
  now: () => number = Date.now,
): Pick<CreateKeyInput, "expires_at" | "expires_in_days"> {
  const trimmed = value.trim();
  const days = /^(\d+)\s*d$/i.exec(trimmed);
  if (days) {
    const count = Number.parseInt(days[1] as string, 10);
    if (count < 1 || count > 3650) {
      throw usageError("--expires in days must be from 1d to 3650d.");
    }
    return { expires_in_days: count };
  }
  const seconds = parseDurationSeconds(trimmed);
  if (seconds !== null) {
    if (seconds <= 0) throw usageError("--expires must be in the future.");
    return { expires_at: new Date(now() + seconds * 1000).toISOString() };
  }
  const at = Date.parse(trimmed);
  if (Number.isNaN(at)) {
    throw usageError(
      `--expires ${JSON.stringify(value)} is not a duration (such as 30d or 12h) or a date (such as 2026-12-31).`,
    );
  }
  if (at <= now()) throw usageError("--expires must be in the future.");
  return { expires_at: new Date(at).toISOString() };
}

/** Build the key's grant from --preset, --permission, --address and --domain. */
export function buildKeyGrant(flags: {
  preset?: string;
  permission?: string[];
  address?: string[];
  domain?: string[];
}): KeyGrant | undefined {
  const permissions = (flags.permission ?? [])
    .flatMap((value) => value.split(/[\s,]+/))
    .filter(Boolean);
  for (const permission of permissions) {
    if (!PERMISSION_PATTERN.test(permission)) {
      throw usageError(
        `--permission ${JSON.stringify(permission)} is not a permission. Permissions look like \`mail:send\`.`,
      );
    }
  }
  const preset = (flags.preset ??
    (permissions.length > 0 ? "custom" : undefined)) as KeyPreset | undefined;
  if (preset !== undefined && !KEY_PRESETS.includes(preset)) {
    throw usageError(`--preset must be one of ${KEY_PRESETS.join(", ")}.`);
  }
  if (permissions.length > 0 && preset !== "custom") {
    throw usageError(
      "--permission builds a custom grant; drop --preset or pass --preset custom.",
    );
  }
  const addresses = flags.address ?? [];
  const domains = flags.domain ?? [];
  if (preset === undefined) {
    if (addresses.length > 0 || domains.length > 0) {
      throw usageError(
        "--address and --domain narrow a --preset or --permission grant.",
      );
    }
    return undefined;
  }
  if (preset === "custom" && permissions.length === 0) {
    throw usageError("A custom grant needs at least one --permission.");
  }
  if (
    permissions.length === 0 &&
    addresses.length === 0 &&
    domains.length === 0
  ) {
    return preset;
  }
  return {
    preset,
    ...(permissions.length > 0
      ? { permissions: [...new Set(permissions)] }
      : {}),
    ...(addresses.length > 0 ? { addresses } : {}),
    ...(domains.length > 0 ? { domains } : {}),
  };
}

function stepUpHeaders(
  stepUp: string | undefined,
): Record<string, string> | undefined {
  if (!stepUp) return undefined;
  const token = stepUp.trim();
  if (!token || /[\r\n]/.test(token)) {
    throw usageError("--step-up must be the token the dashboard showed.");
  }
  return { "Primitive-Step-Up": token };
}

type ErrorDetails = { step_up_url?: unknown; reason?: unknown };

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
    const body = payload as { code?: unknown; details?: ErrorDetails } | null;
    if (body?.code === "step_up_required") {
      const url =
        typeof body.details?.step_up_url === "string"
          ? body.details.step_up_url
          : null;
      process.stderr.write(
        `Confirm in the dashboard${url ? ` (${url})` : ""}, then rerun this command with --step-up <token>.\n`,
      );
    }
    if (body?.code === "forbidden") {
      process.stderr.write(
        "Managing credentials needs an owner or admin. Some of it is available only in the dashboard.\n",
      );
    }
  }
  surfaceUnauthorizedHint({ ...context, payload });
  process.exitCode = 1;
}

function unwrap<T>(data: unknown): T | null {
  return ((data as { data?: T } | undefined)?.data ?? null) as T | null;
}

export function formatCreatedKey(key: CreatedKey): string[] {
  const grant = key.grant.template
    ? `preset ${key.grant.template}`
    : `${key.grant.permissions?.length ?? 0} permissions`;
  const lines = [
    `Created key ${key.id}${key.name ? ` (${key.name})` : ""}: ${grant}, expires ${key.expires_at ?? "never"}.`,
  ];
  for (const warning of key.warnings) {
    lines.push(`Also added ${warning.adds.join(", ")}: ${warning.why}`);
  }
  return lines;
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

export class KeysCreateCommand extends Command {
  static description =
    `Create an organization API key, optionally narrowed and with an expiry.

  The secret is printed once on stdout; store it now. Details go to stderr.

  From a CLI login, the server asks for a step-up: confirm in the dashboard, then pass the token it shows with --step-up. A grant you may not give, or one this server does not offer, is refused with its reason.`;

  static summary = "Create an API key";

  static examples = [
    "<%= config.bin %> keys create --name ci --preset send_only --expires 30d --step-up pstep_...",
    "<%= config.bin %> keys create --name reader --permission mail:read --address support@example.com --step-up pstep_...",
  ];

  static flags = {
    "api-key": API_KEY_FLAG,
    "api-base-url": API_BASE_URL_FLAG,
    name: Flags.string({ description: "Key name shown in the dashboard." }),
    preset: Flags.string({
      description: `Grant preset: ${KEY_PRESETS.join(", ")}. Defaults to the server's default (super_admin) without --permission.`,
      options: [...KEY_PRESETS],
    }),
    permission: Flags.string({
      description:
        "Add a permission to a custom grant, such as mail:send. Repeat for more.",
      multiple: true,
    }),
    address: Flags.string({
      description: "Limit mail to this address. Repeat for more.",
      multiple: true,
    }),
    domain: Flags.string({
      description: "Limit mail to this domain. Repeat for more.",
      multiple: true,
    }),
    expires: Flags.string({
      description:
        "When the key stops working: a duration (30d, 12h) or a date (2026-12-31).",
    }),
    ip: Flags.string({
      description: "Allow use only from this CIDR range. Repeat for more.",
      multiple: true,
    }),
    "rate-limit": Flags.integer({
      description: "Requests per minute this key may make.",
      min: 1,
    }),
    "step-up": STEP_UP_FLAG,
    json: Flags.boolean({ description: "Print the created key as JSON." }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(KeysCreateCommand);
    const grant = buildKeyGrant(flags);
    const body: CreateKeyInput = {
      ...(flags.name ? { name: flags.name } : {}),
      ...(grant !== undefined ? { grant } : {}),
      ...(flags.expires ? parseExpires(flags.expires) : {}),
      ...(flags.ip?.length || flags["rate-limit"] !== undefined
        ? {
            conditions: {
              ...(flags.ip?.length ? { ip_allowlist: flags.ip } : {}),
              ...(flags["rate-limit"] !== undefined
                ? { rate_limit_per_minute: flags["rate-limit"] }
                : {}),
            },
          }
        : {}),
    };
    const headers = stepUpHeaders(flags["step-up"]);
    const { apiClient, auth, baseUrlOverridden } =
      await createAuthenticatedCliApiClient({
        apiKey: flags["api-key"],
        apiBaseUrl: flags["api-base-url"],
        configDir: this.config.configDir,
      });
    const result = await createKey({
      body,
      client: apiClient.client,
      ...(headers ? { headers } : {}),
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
    const key = unwrap<CreatedKey>(result.data);
    if (!key) throw new Errors.CLIError("Primitive API returned no key.");
    if (flags.json) {
      this.log(JSON.stringify(key, null, 2));
      return;
    }
    this.log(key.key);
    for (const line of formatCreatedKey(key)) process.stderr.write(`${line}\n`);
    process.stderr.write("The secret above is shown once.\n");
  }
}

export class KeysListCommand extends Command {
  static description =
    `List the organization's API keys from the credential inventory, with grant, expiry and last use.

  The server answers this only for an owner or admin in a dashboard session; from a CLI login it shows the server's refusal.`;

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

function requireKeyId(id: string): string {
  if (!UUID_PATTERN.test(id.trim())) {
    throw usageError(
      "The key id must be a UUID, as `primitive keys list` shows it.",
    );
  }
  return id.trim();
}

export class KeysRotateCommand extends Command {
  static description =
    `Rotate an API key: mint a successor with the same grant, name, expiry and conditions. The old key keeps working for --overlap (default one day; 0 stops it at once).

  The new secret is printed once on stdout. From a CLI login, pass a dashboard step-up token with --step-up.`;

  static summary = "Rotate an API key";

  static examples = [
    "<%= config.bin %> keys rotate 00000000-0000-4000-8000-000000000000 --step-up pstep_...",
    "<%= config.bin %> keys rotate 00000000-0000-4000-8000-000000000000 --overlap 0 --step-up pstep_...",
  ];

  static args = {
    id: Args.string({ description: "API key id.", required: true }),
  };

  static flags = {
    "api-key": API_KEY_FLAG,
    "api-base-url": API_BASE_URL_FLAG,
    overlap: Flags.string({
      description:
        "How long the old key keeps working: 0, or a duration such as 1h or 7d (at most 7d).",
    }),
    "step-up": STEP_UP_FLAG,
    json: Flags.boolean({ description: "Print the rotated key as JSON." }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(KeysRotateCommand);
    const id = requireKeyId(args.id);
    let overlap: number | undefined;
    if (flags.overlap !== undefined) {
      overlap =
        flags.overlap.trim() === "0"
          ? 0
          : (parseDurationSeconds(flags.overlap) ?? -1);
      if (overlap < 0 || overlap > 7 * 86400) {
        throw usageError(
          "--overlap must be 0 or a duration up to 7d, such as 1h.",
        );
      }
    }
    const headers = stepUpHeaders(flags["step-up"]);
    const { apiClient, auth, baseUrlOverridden } =
      await createAuthenticatedCliApiClient({
        apiKey: flags["api-key"],
        apiBaseUrl: flags["api-base-url"],
        configDir: this.config.configDir,
      });
    const result = await rotateKey({
      body: overlap === undefined ? {} : { overlap_seconds: overlap },
      client: apiClient.client,
      ...(headers ? { headers } : {}),
      path: { id },
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
    const rotated = unwrap<RotatedKey>(result.data);
    if (!rotated) throw new Errors.CLIError("Primitive API returned no key.");
    if (flags.json) {
      this.log(JSON.stringify(rotated, null, 2));
      return;
    }
    this.log(rotated.key);
    process.stderr.write(
      `Rotated ${rotated.previous_key_id} to ${rotated.id}. The old key stops working at ${rotated.previous_key_expires_at}. The secret above is shown once.\n`,
    );
  }
}

export class KeysRevokeCommand extends Command {
  static description = `Revoke an API key. It stops working at once.

  Revoking goes through the credential inventory, which the server answers only for an owner or admin in a dashboard session; from a CLI login it shows the server's refusal.`;

  static summary = "Revoke an API key";

  static examples = [
    "<%= config.bin %> keys revoke 00000000-0000-4000-8000-000000000000",
  ];

  static args = {
    id: Args.string({ description: "API key id.", required: true }),
  };

  static flags = {
    "api-key": API_KEY_FLAG,
    "api-base-url": API_BASE_URL_FLAG,
    reason: Flags.string({
      description: "Why the key is revoked, kept in the audit trail.",
    }),
    json: Flags.boolean({ description: "Print the result as JSON." }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(KeysRevokeCommand);
    const id = requireKeyId(args.id);
    const { apiClient, auth, baseUrlOverridden } =
      await createAuthenticatedCliApiClient({
        apiKey: flags["api-key"],
        apiBaseUrl: flags["api-base-url"],
        configDir: this.config.configDir,
      });
    const result = await revokeCredential({
      body: {
        id,
        kind: "org_key",
        ...(flags.reason ? { reason: flags.reason } : {}),
      },
      client: apiClient.client,
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
    const revoked = unwrap<RevokeCredentialResult>(result.data);
    if (flags.json) {
      this.log(JSON.stringify(revoked, null, 2));
      return;
    }
    this.log(`Revoked key ${id}.`);
  }
}
