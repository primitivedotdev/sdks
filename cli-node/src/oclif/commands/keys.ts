import { randomUUID } from "node:crypto";
import { Args, Command, Flags } from "@oclif/core";
import {
  type CredentialsCreateKeyInput,
  type CredentialsCreateKeyResult,
  type CredentialsGetKeyResult,
  type CredentialsListKeysResult,
  type CredentialsRevokeCredentialResult,
  type CredentialsRotateKeyResult,
  type CredentialsUpdateKeyInput,
  type CredentialsUpdateKeyResult,
  createKey,
  getKey,
  listKeys,
  revokeCredential,
  rotateKey,
  updateKey,
} from "@primitivedotdev/api-core";
import { createAuthenticatedCliApiClient } from "../api-client.js";
import {
  API_BASE_URL_FLAG_DESCRIPTION,
  extractErrorPayload,
  surfaceUnauthorizedHint,
  writeErrorWithHints,
} from "../api-command.js";
import {
  type ApprovalIo,
  approveThenRerunHint,
  BROWSER_FLAG_DESCRIPTION,
  promptLine,
  STEP_UP_HEADER,
  STEP_UP_TOKEN_FLAG_DESCRIPTION,
  stepUpUrlOf,
  terminalApprovalIo,
  withApproval,
} from "../step-up-approval.js";

// The approval helpers moved to step-up-approval.ts; re-exported for callers
// that imported them from here.
export { type ApprovalIo, stepUpUrlOf, withApproval };

// Organization API keys from the CLI, for a person signed in with
// `primitive login`. Listing and reading show metadata only, never a secret.
// Creating, rotating and changing a key from the person's own login run
// directly. When the server asks the person to approve one in the browser
// (an organization that requires it), it answers `step_up_required` with a
// link, the page shows a one-time token, and the request is sent again with
// it. A key never holds more than the person who makes it, and the
// organization's credential policy applies as in the dashboard.

export const STORE_SECRET_NOTICE =
  "Store this key now. It is shown only once, and the CLI does not save it.";

export const HELD_REQUEST_NOTICE =
  "A request already held open with this key, such as a long poll or a wait, ends once because the key's permissions changed. Run it again to use the new permissions.";

const LIST_PAGE_LIMIT = 50;

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

const APPROVAL_FLAGS = {
  "step-up-token": Flags.string({
    description: STEP_UP_TOKEN_FLAG_DESCRIPTION,
  }),
  browser: Flags.boolean({
    allowNo: true,
    default: true,
    description: BROWSER_FLAG_DESCRIPTION,
  }),
};

type KeyView = CredentialsGetKeyResult;
type KeyGrantView = KeyView["grant"];
type CreateGrant = CredentialsCreateKeyInput["grant"];

export type Outcome<T> =
  | { ok: true; data: T }
  | { ok: false; payload: unknown; stepUpUrl?: string };

type SdkResult = {
  data?: unknown;
  error?: unknown;
  response?: Response;
};

function unwrap<T>(data: unknown): T {
  return ((data as { data?: T } | undefined)?.data ?? data) as T;
}

async function call<T>(request: Promise<SdkResult>): Promise<Outcome<T>> {
  try {
    const result = await request;
    if (result.error !== undefined || !result.response?.ok) {
      const payload =
        result.error === undefined ||
        result.error === null ||
        typeof result.error === "string"
          ? {
              code: "http_error",
              message:
                (typeof result.error === "string" && result.error.trim()) ||
                `HTTP ${result.response?.status ?? ""}`.trim(),
            }
          : extractErrorPayload(result.error);
      return { ok: false, payload };
    }
    return { ok: true, data: unwrap<T>(result.data) };
  } catch (error) {
    return { ok: false, payload: extractErrorPayload(error) };
  }
}

function approvalIo(flags: {
  "step-up-token"?: string;
  browser: boolean;
  json?: boolean;
}): ApprovalIo {
  return terminalApprovalIo({
    stepUpToken: flags["step-up-token"],
    openBrowser: flags.browser,
    json: flags.json,
  });
}

/** Comma-separated and repeated values, trimmed, without duplicates. */
export function listFlag(values: readonly string[] | undefined): string[] {
  const out: string[] = [];
  for (const value of values ?? []) {
    for (const part of value.split(",")) {
      const item = part.trim();
      if (item && !out.includes(item)) out.push(item);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

function stringList(value: unknown): string[] | null {
  return Array.isArray(value) && value.every((v) => typeof v === "string")
    ? [...value]
    : null;
}

/** Which mail a key reaches, in words. */
export function describeMailScope(grant: KeyGrantView): string {
  if (grant.template === "super_admin") return "every mailbox";
  if (grant.template === "connected_agent") return "its agent's address";
  const scope = grant.mail_scope;
  if (scope === "org") return "every mailbox";
  if (!scope || typeof scope !== "object" || Array.isArray(scope)) {
    return "unknown";
  }
  const record = scope as Record<string, unknown>;
  const parts: string[] = [];
  const addresses = stringList(record.addresses) ?? [];
  const domains = stringList(record.domains) ?? [];
  const rules = stringList(record.rules) ?? [];
  if (addresses.length > 0) parts.push(`addresses ${addresses.join(", ")}`);
  if (domains.length > 0) parts.push(`domains ${domains.join(", ")}`);
  if (rules.length > 0) parts.push(`rules ${rules.join(", ")}`);
  return parts.length > 0 ? parts.join("; ") : "no mailbox";
}

/** What a key may do, in words. */
export function describePermissions(grant: KeyGrantView): string {
  if (grant.template === "super_admin") return "super admin (every permission)";
  if (grant.template) return grant.template;
  const permissions = grant.permissions ?? [];
  return permissions.length > 0 ? permissions.join(", ") : "none";
}

export function formatKeyRows(rows: readonly KeyView[]): string {
  if (rows.length === 0) return "No API keys.";
  return rows
    .map((row) => {
      const suspended = row.suspended ? " [suspended]" : "";
      return `${row.id}  ${row.key_prefix}  ${row.name ?? "(unnamed)"}  ${describePermissions(row.grant)}  mail: ${describeMailScope(row.grant)}  expires ${row.expires_at ?? "never"}  last used ${row.last_used_at ?? "never"}${suspended}`;
    })
    .join("\n");
}

export function formatKeyDetail(key: KeyView): string {
  const lines = [
    `Name:         ${key.name ?? "(unnamed)"}`,
    `Id:           ${key.id}`,
    `Prefix:       ${key.key_prefix}`,
    `Kind:         ${key.kind}`,
    `Mail:         ${describeMailScope(key.grant)}`,
    `Created:      ${key.created_at ?? "unknown"}`,
    `Expires:      ${key.expires_at ?? "never"}`,
    `Last used:    ${key.last_used_at ?? "never"}`,
    `Suspended:    ${key.suspended ? "yes" : "no"}`,
  ];
  if (key.agent_address) lines.push(`Agent:        ${key.agent_address}`);
  if (key.grant.template) {
    lines.push(`Permissions:  ${describePermissions(key.grant)}`);
  } else {
    lines.push("Permissions:");
    for (const permission of key.grant.permissions ?? []) {
      lines.push(`  ${permission}`);
    }
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Grants
// ---------------------------------------------------------------------------

const EVERY_MAILBOX_PRESETS = new Set([
  "super_admin",
  "read_only",
  "send_only",
]);
const LISTED_PRESETS = new Set(["own_addresses", "own_addresses_read_only"]);
export const KEY_PRESETS = [
  ...EVERY_MAILBOX_PRESETS,
  ...LISTED_PRESETS,
] as const;

export type GrantChoice = {
  preset?: string;
  permissions: string[];
  addresses: string[];
  domains: string[];
  rules: string[];
  allMailboxes: boolean;
};

/**
 * The grant a new key asks for. There is no default: the caller names a
 * preset or the permissions, and a key with chosen permissions also says
 * which mail it reaches (addresses, domains, email rules, or every mailbox).
 */
export function buildCreateGrant(
  choice: GrantChoice,
): { ok: true; grant: CreateGrant } | { ok: false; message: string } {
  const listed =
    choice.addresses.length > 0 ||
    choice.domains.length > 0 ||
    choice.rules.length > 0;
  const scope = {
    ...(choice.addresses.length > 0 ? { addresses: choice.addresses } : {}),
    ...(choice.domains.length > 0 ? { domains: choice.domains } : {}),
    ...(choice.rules.length > 0 ? { rules: choice.rules } : {}),
  };
  if (choice.permissions.length > 0) {
    if (choice.preset) {
      return {
        ok: false,
        message: "Pass either --preset or --permission, not both.",
      };
    }
    if (listed === choice.allMailboxes) {
      return {
        ok: false,
        message: choice.allMailboxes
          ? "--all-mailboxes reaches every mailbox, so it cannot be combined with --address, --domain or --rule."
          : "Say which mail the key reaches: --address, --domain or --rule (each repeatable), or --all-mailboxes.",
      };
    }
    return {
      ok: true,
      grant: {
        preset: "custom",
        permissions: choice.permissions,
        ...(choice.allMailboxes ? { mail_scope: "org" as const } : scope),
      },
    };
  }
  if (!choice.preset) {
    return {
      ok: false,
      message:
        "Say what the key can do: pass --preset or --permission. There is no default.",
    };
  }
  if (choice.allMailboxes) {
    return {
      ok: false,
      message: "--all-mailboxes is only for a key with --permission.",
    };
  }
  if (EVERY_MAILBOX_PRESETS.has(choice.preset)) {
    if (listed) {
      return {
        ok: false,
        message: `${choice.preset} reaches every mailbox, so it takes no --address, --domain or --rule.`,
      };
    }
    return { ok: true, grant: choice.preset as CreateGrant };
  }
  if (LISTED_PRESETS.has(choice.preset)) {
    if (!listed) {
      return {
        ok: false,
        message: `${choice.preset} needs --address, --domain or --rule.`,
      };
    }
    return {
      ok: true,
      grant: {
        preset: choice.preset as "own_addresses" | "own_addresses_read_only",
        ...scope,
      },
    };
  }
  return {
    ok: false,
    message: `--preset must be one of ${KEY_PRESETS.join(", ")}.`,
  };
}

/** The mail scope fields a change can send back unchanged. */
const RESTATABLE_SCOPE_FIELDS = new Set([
  "addresses",
  "domains",
  "rules",
  "depth",
]);

export type GrantChange = { add: string[]; remove: string[]; rules?: string[] };

/**
 * The grant that restates a key's current grant with permissions added or
 * removed, or its email rules replaced, and everything else as it is. Only a
 * key with a permission list and a mail scope the CLI can restate exactly;
 * anything else is changed in the dashboard.
 */
export function buildUpdatedGrant(
  current: KeyGrantView,
  change: GrantChange,
):
  | {
      ok: true;
      grant: NonNullable<CredentialsUpdateKeyInput["grant"]>;
      permissions: string[];
    }
  | { ok: false; message: string } {
  if (current.template === "super_admin") {
    return {
      ok: false,
      message:
        "This is a super admin key: it holds every permission already. To narrow it, create a key with only what you need, then revoke this one.",
    };
  }
  if (current.template) {
    return {
      ok: false,
      message: `This key's permissions come from its template (${current.template}) and are not changed here.`,
    };
  }
  const resources = (current as { resources?: unknown }).resources;
  if (
    resources !== undefined &&
    resources !== null &&
    (typeof resources !== "object" || Object.keys(resources).length > 0)
  ) {
    return {
      ok: false,
      message:
        "This key is limited to selected resources, which the CLI cannot restate. Change it in the dashboard.",
    };
  }
  const held = stringList(current.permissions);
  if (!held) {
    return { ok: false, message: "This key's permissions could not be read." };
  }
  const permissions = [...new Set([...held, ...change.add])]
    .filter((p) => !change.remove.includes(p))
    .sort();
  if (permissions.length === 0) {
    return {
      ok: false,
      message:
        "A key needs at least one permission. To stop it working, revoke it.",
    };
  }
  const scope = current.mail_scope;
  if (scope === "org") {
    if (change.rules) {
      return {
        ok: false,
        message:
          "This key reaches every mailbox, so email rules cannot be set on it. Create a key limited to the rules instead.",
      };
    }
    return {
      ok: true,
      grant: { preset: "custom", permissions, mail_scope: "org" },
      permissions,
    };
  }
  if (!scope || typeof scope !== "object" || Array.isArray(scope)) {
    return {
      ok: false,
      message:
        "This key's mail scope could not be read. Change it in the dashboard.",
    };
  }
  const record = scope as Record<string, unknown>;
  const addresses = stringList(record.addresses ?? []);
  const domains = stringList(record.domains ?? []);
  const rules = change.rules ?? stringList(record.rules ?? []);
  if (
    !addresses ||
    !domains ||
    !rules ||
    Object.keys(record).some((field) => !RESTATABLE_SCOPE_FIELDS.has(field))
  ) {
    return {
      ok: false,
      message:
        "This key's mail scope has settings the CLI cannot restate. Change it in the dashboard.",
    };
  }
  if (addresses.length === 0 && domains.length === 0 && rules.length === 0) {
    return {
      ok: false,
      message:
        "The key would reach no mail. Keep at least one address, domain or rule.",
    };
  }
  return {
    ok: true,
    grant: {
      preset: "custom",
      permissions,
      ...(addresses.length > 0 ? { addresses } : {}),
      ...(domains.length > 0 ? { domains } : {}),
      ...(rules.length > 0 ? { rules } : {}),
    },
    permissions,
  };
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

type CliAuth = Awaited<ReturnType<typeof createAuthenticatedCliApiClient>>;

async function authenticate(
  command: Command,
  flags: { "api-key"?: string; "api-base-url"?: string },
): Promise<CliAuth> {
  return createAuthenticatedCliApiClient({
    apiKey: flags["api-key"],
    apiBaseUrl: flags["api-base-url"],
    configDir: command.config.configDir,
  });
}

/** Print a refusal and set a failing exit code. */
function reportKeysError(
  command: Command,
  outcome: { payload: unknown; stepUpUrl?: string },
  auth: CliAuth,
  json: boolean,
): void {
  if (json) {
    process.stderr.write(`${JSON.stringify(outcome.payload)}\n`);
  } else {
    writeErrorWithHints(outcome.payload);
  }
  if (outcome.stepUpUrl) {
    process.stderr.write(approveThenRerunHint(outcome.stepUpUrl));
  }
  surfaceUnauthorizedHint({
    auth: auth.auth,
    baseUrlOverridden: auth.baseUrlOverridden,
    configDir: command.config.configDir,
    payload: outcome.payload,
  });
  process.exitCode = 1;
}

function writeWarnings(
  warnings: ReadonlyArray<{ description?: unknown }> | undefined,
): void {
  for (const warning of warnings ?? []) {
    if (typeof warning.description === "string") {
      process.stderr.write(`Note: ${warning.description}\n`);
    }
  }
}

export class KeysListCommand extends Command {
  static description =
    `List the organization's API keys with their permissions, mail scope, expiry and last use. Only metadata is shown, never a secret.

  You see your own keys, and every key if your role may read them all, as in the dashboard.`;

  static summary = "List API keys";

  static examples = [
    "<%= config.bin %> keys list",
    "<%= config.bin %> keys list --json",
  ];

  static flags = {
    "api-key": API_KEY_FLAG,
    "api-base-url": API_BASE_URL_FLAG,
    json: Flags.boolean({ description: "Print the keys as JSON." }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(KeysListCommand);
    const auth = await authenticate(this, flags);
    const items: KeyView[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < LIST_PAGE_LIMIT; page += 1) {
      const result = await call<CredentialsListKeysResult>(
        listKeys({
          client: auth.apiClient.client,
          ...(cursor ? { query: { cursor } } : {}),
        }),
      );
      if (!result.ok) {
        reportKeysError(this, result, auth, Boolean(flags.json));
        return;
      }
      items.push(...(result.data.items as KeyView[]));
      cursor = result.data.next_cursor ?? undefined;
      if (!cursor) break;
    }
    if (flags.json) {
      this.log(JSON.stringify(items, null, 2));
      return;
    }
    this.log(formatKeyRows(items));
  }
}

export class KeysGetCommand extends Command {
  static description =
    "Show one API key: its permissions, the mail it reaches, expiry and last use. Never a secret.";

  static summary = "Show an API key";

  static examples = [
    "<%= config.bin %> keys get 0f0e0d0c-0b0a-4908-8706-050403020100",
    "<%= config.bin %> keys get 0f0e0d0c-0b0a-4908-8706-050403020100 --json",
  ];

  static args = {
    id: Args.string({ description: "The key's id.", required: true }),
  };

  static flags = {
    "api-key": API_KEY_FLAG,
    "api-base-url": API_BASE_URL_FLAG,
    json: Flags.boolean({ description: "Print the key as JSON." }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(KeysGetCommand);
    const auth = await authenticate(this, flags);
    const result = await call<KeyView>(
      getKey({ client: auth.apiClient.client, path: { id: args.id } }),
    );
    if (!result.ok) {
      reportKeysError(this, result, auth, Boolean(flags.json));
      return;
    }
    this.log(
      flags.json
        ? JSON.stringify(result.data, null, 2)
        : formatKeyDetail(result.data),
    );
  }
}

/** The new secret on stdout alone, everything else on stderr. */
function printSecret(
  command: Command,
  json: boolean,
  document: Record<string, unknown>,
  secret: string,
  summary: string,
): void {
  if (json) {
    command.log(
      JSON.stringify({ ...document, notice: STORE_SECRET_NOTICE }, null, 2),
    );
    return;
  }
  process.stderr.write(`${summary}\n\n`);
  command.log(secret);
  process.stderr.write(`\n${STORE_SECRET_NOTICE}\n`);
}

export class KeysCreateCommand extends Command {
  static description =
    `Create an API key. Say what it can do with --preset or --permission; there is no default.

  The key is created directly. If your organization requires approval, the command prints the approval link, opens it where it can, and waits for the one-time token the page shows. In a script it prints the link and exits: approve, then run it again with --step-up-token. The key never holds more than you do, and your organization's credential policy applies.

  The secret is printed once, on its own line on stdout (in the JSON with --json). Store it right away: it is not shown again and the CLI does not save it.

  A key limited to email rules (--rule, repeatable) reaches only the mail those rules match. Give it mail:read with --permission, or use --preset own_addresses_read_only.`;

  static summary = "Create an API key";

  static examples = [
    "<%= config.bin %> keys create --name reader --preset read_only",
    "<%= config.bin %> keys create --name orders --permission mail:read --rule 3b0f6a1e-6c7a-4f43-9d8e-2a1b5c4d3e2f",
    "<%= config.bin %> keys create --name support --permission mail:read,mail:reply --address support@example.com --expires-in-days 90",
    "<%= config.bin %> keys create --name everything --preset super_admin",
  ];

  static flags = {
    "api-key": API_KEY_FLAG,
    "api-base-url": API_BASE_URL_FLAG,
    name: Flags.string({ description: "A name for the key." }),
    preset: Flags.string({
      description: "A preset grant.",
      options: [...KEY_PRESETS],
    }),
    permission: Flags.string({
      description:
        "A permission the key holds (repeatable, or comma-separated), for a custom key.",
      multiple: true,
    }),
    address: Flags.string({
      description: "An address the key reaches (repeatable).",
      multiple: true,
    }),
    domain: Flags.string({
      description: "A domain the key reaches (repeatable).",
      multiple: true,
    }),
    rule: Flags.string({
      description:
        "An email rule id whose matching mail the key reaches (repeatable).",
      multiple: true,
    }),
    "all-mailboxes": Flags.boolean({
      description: "A key with --permission that reaches every mailbox.",
    }),
    "expires-in-days": Flags.integer({
      description: "Expire the key after this many days.",
      min: 1,
    }),
    "expires-at": Flags.string({
      description: "Expire the key at this ISO 8601 time.",
      exclusive: ["expires-in-days"],
    }),
    ...APPROVAL_FLAGS,
    json: Flags.boolean({
      description: "Print the new key, its secret included, as JSON.",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(KeysCreateCommand);
    const grant = buildCreateGrant({
      preset: flags.preset,
      permissions: listFlag(flags.permission),
      addresses: listFlag(flags.address),
      domains: listFlag(flags.domain),
      rules: listFlag(flags.rule),
      allMailboxes: flags["all-mailboxes"],
    });
    if (!grant.ok) {
      this.error(grant.message, { exit: 2 });
    }
    const auth = await authenticate(this, flags);
    const body: CredentialsCreateKeyInput = {
      grant: grant.grant,
      ...(flags.name ? { name: flags.name } : {}),
      ...(flags["expires-in-days"]
        ? { expires_in_days: flags["expires-in-days"] }
        : {}),
      ...(flags["expires-at"] ? { expires_at: flags["expires-at"] } : {}),
    };
    // One key per run, even if the approved request is sent twice.
    const idempotencyKey = `cli-${randomUUID()}`;
    const result = await withApproval(
      (token) =>
        call<CredentialsCreateKeyResult>(
          createKey({
            client: auth.apiClient.client,
            body,
            headers: {
              "Idempotency-Key": idempotencyKey,
              ...(token ? { [STEP_UP_HEADER]: token } : {}),
            },
          }),
        ),
      approvalIo(flags),
    );
    if (!result.ok) {
      reportKeysError(this, result, auth, Boolean(flags.json));
      return;
    }
    const key = result.data;
    if (!flags.json) writeWarnings(key.warnings);
    printSecret(
      this,
      Boolean(flags.json),
      key,
      key.key,
      [
        `Created API key ${key.name ?? "(unnamed)"} (${key.id}), prefix ${key.key_prefix}.`,
        `Permissions: ${describePermissions({ template: key.grant.template, permissions: key.grant.permissions, mail_scope: key.grant.mail_scope })}`,
        `Mail: ${describeMailScope({ template: key.grant.template, permissions: key.grant.permissions, mail_scope: key.grant.mail_scope })}`,
        `Expires: ${key.expires_at ?? "never"}`,
      ].join("\n"),
    );
  }
}

export class KeysRotateCommand extends Command {
  static description =
    `Rotate an API key: make a successor with the same permissions and print its secret once. The old key keeps working for the overlap, then stops.

  The rotation runs directly; if your organization requires approval, the command prints the approval link and takes --step-up-token, as for a new key. Store the new secret right away: it is not shown again and the CLI does not save it.`;

  static summary = "Rotate an API key";

  static examples = [
    "<%= config.bin %> keys rotate 0f0e0d0c-0b0a-4908-8706-050403020100",
    "<%= config.bin %> keys rotate 0f0e0d0c-0b0a-4908-8706-050403020100 --overlap-seconds 0",
  ];

  static args = {
    id: Args.string({ description: "The key's id.", required: true }),
  };

  static flags = {
    "api-key": API_KEY_FLAG,
    "api-base-url": API_BASE_URL_FLAG,
    "overlap-seconds": Flags.integer({
      description:
        "How long the old key keeps working, in seconds. 0 stops it now.",
      min: 0,
    }),
    ...APPROVAL_FLAGS,
    json: Flags.boolean({
      description: "Print the new key, its secret included, as JSON.",
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(KeysRotateCommand);
    const auth = await authenticate(this, flags);
    const body =
      flags["overlap-seconds"] === undefined
        ? {}
        : { overlap_seconds: flags["overlap-seconds"] };
    const result = await withApproval(
      (token) =>
        call<CredentialsRotateKeyResult>(
          rotateKey({
            client: auth.apiClient.client,
            path: { id: args.id },
            body,
            ...(token ? { headers: { [STEP_UP_HEADER]: token } } : {}),
          }),
        ),
      approvalIo(flags),
    );
    if (!result.ok) {
      reportKeysError(this, result, auth, Boolean(flags.json));
      return;
    }
    const rotated = result.data;
    printSecret(
      this,
      Boolean(flags.json),
      rotated,
      rotated.key,
      `Rotated key ${rotated.previous_key_id}. The new key is ${rotated.id}, prefix ${rotated.key_prefix}. The old key works until ${rotated.previous_key_expires_at}.`,
    );
  }
}

export class KeysUpdateCommand extends Command {
  static description =
    `Change an API key's permissions, email rules or name. It keeps its id and secret.

  --add and --remove take permissions (repeatable, or comma-separated). --rule sets the email rules the key reaches, replacing the ones it has. Everything else about the key stays as it is.

  The change runs directly; if your organization requires approval, the command prints the approval link and takes --step-up-token, as for a new key. A key never holds more than you do.`;

  static summary = "Change an API key";

  static examples = [
    "<%= config.bin %> keys update 0f0e0d0c-0b0a-4908-8706-050403020100 --add mail:send,mail:reply",
    "<%= config.bin %> keys update 0f0e0d0c-0b0a-4908-8706-050403020100 --remove mail:send",
    "<%= config.bin %> keys update 0f0e0d0c-0b0a-4908-8706-050403020100 --rule 3b0f6a1e-6c7a-4f43-9d8e-2a1b5c4d3e2f",
  ];

  static args = {
    id: Args.string({ description: "The key's id.", required: true }),
  };

  static flags = {
    "api-key": API_KEY_FLAG,
    "api-base-url": API_BASE_URL_FLAG,
    add: Flags.string({
      description: "Permissions to add (repeatable, or comma-separated).",
      multiple: true,
    }),
    remove: Flags.string({
      description: "Permissions to remove (repeatable, or comma-separated).",
      multiple: true,
    }),
    rule: Flags.string({
      description:
        "An email rule id the key reaches (repeatable). Replaces the key's rules.",
      multiple: true,
    }),
    name: Flags.string({ description: "A new name for the key." }),
    ...APPROVAL_FLAGS,
    json: Flags.boolean({ description: "Print the result as JSON." }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(KeysUpdateCommand);
    const add = listFlag(flags.add);
    const remove = listFlag(flags.remove);
    const rules = flags.rule ? listFlag(flags.rule) : undefined;
    const both = add.filter((p) => remove.includes(p));
    if (both.length > 0) {
      this.error(`Both added and removed: ${both.join(", ")}.`, { exit: 2 });
    }
    const changesGrant = add.length > 0 || remove.length > 0 || !!rules;
    if (!changesGrant && flags.name === undefined) {
      this.error("Nothing to change: pass --add, --remove, --rule or --name.", {
        exit: 2,
      });
    }
    const auth = await authenticate(this, flags);
    const body: CredentialsUpdateKeyInput = {
      ...(flags.name !== undefined ? { name: flags.name } : {}),
    };
    if (changesGrant) {
      const current = await call<KeyView>(
        getKey({ client: auth.apiClient.client, path: { id: args.id } }),
      );
      if (!current.ok) {
        reportKeysError(this, current, auth, Boolean(flags.json));
        return;
      }
      const next = buildUpdatedGrant(current.data.grant, {
        add,
        remove,
        ...(rules ? { rules } : {}),
      });
      if (!next.ok) {
        this.error(next.message, { exit: 2 });
      }
      body.grant = next.grant;
      // Refused if the key's grant changed after it was read, so a change
      // approved later never overwrites one made meanwhile.
      const ref = (current.data.grant as { ref?: unknown }).ref;
      if (typeof ref === "string") body.expected_grant_ref = ref;
    }
    const result = await withApproval(
      (token) =>
        call<CredentialsUpdateKeyResult>(
          updateKey({
            client: auth.apiClient.client,
            path: { id: args.id },
            body,
            ...(token ? { headers: { [STEP_UP_HEADER]: token } } : {}),
          }),
        ),
      approvalIo(flags),
    );
    if (!result.ok) {
      reportKeysError(this, result, auth, Boolean(flags.json));
      return;
    }
    const grantChanged = result.data.changed.includes("grant");
    const after = grantChanged
      ? await call<KeyView>(
          getKey({ client: auth.apiClient.client, path: { id: args.id } }),
        )
      : null;
    if (flags.json) {
      this.log(
        JSON.stringify(
          {
            ...result.data,
            ...(after?.ok ? { key: after.data } : {}),
            ...(grantChanged ? { notice: HELD_REQUEST_NOTICE } : {}),
          },
          null,
          2,
        ),
      );
      return;
    }
    writeWarnings(result.data.warnings);
    const changed = result.data.changed;
    this.log(
      changed.length > 0
        ? `Updated key ${args.id}: ${changed.join(", ")}.`
        : `Key ${args.id} already matched; nothing changed.`,
    );
    if (after?.ok) {
      this.log(`Permissions: ${describePermissions(after.data.grant)}`);
      this.log(`Mail: ${describeMailScope(after.data.grant)}`);
    }
    if (grantChanged) process.stderr.write(`${HELD_REQUEST_NOTICE}\n`);
  }
}

export class KeysRevokeCommand extends Command {
  static description =
    `Revoke an API key. It stops working at once; what it set up keeps working and is listed for review.

  Asks for confirmation first; pass --yes to skip the prompt in scripts. Revoking runs directly. If your organization requires approval, the command prints the approval link, opens it where it can and waits for the one-time token; in a script, approve and run it again with --step-up-token.`;

  static summary = "Revoke an API key";

  static examples = [
    "<%= config.bin %> keys revoke 0f0e0d0c-0b0a-4908-8706-050403020100",
    "<%= config.bin %> keys revoke 0f0e0d0c-0b0a-4908-8706-050403020100 --yes",
  ];

  static args = {
    id: Args.string({ description: "The key's id.", required: true }),
  };

  static flags = {
    "api-key": API_KEY_FLAG,
    "api-base-url": API_BASE_URL_FLAG,
    yes: Flags.boolean({
      char: "y",
      description: "Revoke without asking for confirmation.",
    }),
    reason: Flags.string({ description: "Why, recorded with the revocation." }),
    json: Flags.boolean({ description: "Print the result as JSON." }),
    ...APPROVAL_FLAGS,
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(KeysRevokeCommand);
    if (!flags.yes) {
      if (flags.json || !(process.stdin.isTTY && process.stderr.isTTY)) {
        this.error(
          "Not revoking: no terminal to confirm in. Pass --yes to revoke without a prompt.",
          { exit: 2 },
        );
      }
      const answer = await promptLine(
        `Revoke key ${args.id}? It stops working at once. [y/N] `,
      );
      if (!/^y(es)?$/i.test(answer.trim())) {
        process.stderr.write("Cancelled. The key still works.\n");
        process.exitCode = 1;
        return;
      }
    }
    const auth = await authenticate(this, flags);
    const result = await withApproval(
      (token) =>
        call<CredentialsRevokeCredentialResult>(
          revokeCredential({
            client: auth.apiClient.client,
            body: {
              kind: "org_key",
              id: args.id,
              ...(flags.reason ? { reason: flags.reason } : {}),
            },
            ...(token ? { headers: { [STEP_UP_HEADER]: token } } : {}),
          }),
        ),
      approvalIo(flags),
    );
    if (!result.ok) {
      reportKeysError(this, result, auth, Boolean(flags.json));
      return;
    }
    if (flags.json) {
      this.log(JSON.stringify(result.data, null, 2));
      return;
    }
    this.log(`Revoked key ${args.id}.`);
    const standing = (result.data as { standing_objects?: unknown[] })
      .standing_objects;
    if (Array.isArray(standing) && standing.length > 0) {
      this.log(
        `It set up ${standing.length} item(s) that keep working. Review them with --json.`,
      );
    }
  }
}
