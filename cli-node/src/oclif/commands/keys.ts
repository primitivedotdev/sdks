import { randomUUID } from "node:crypto";
import { Args, Command, Flags } from "@oclif/core";
import {
  type CredentialsCreateKeyInput,
  type CredentialsCreateKeyResult,
  type CredentialsGetKeyResult,
  type CredentialsListKeysResult,
  type CredentialsRevokeCredentialResult,
  type CredentialsRotateKeyInput,
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
  keyPermissionsHelp,
  ungrantablePermission,
  ungrantablePermissionHint,
} from "../key-permissions.js";
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

/**
 * A new expiry from --expires-at or --no-expiry: a time with its time zone,
 * null for none, or undefined when neither was given. The API checks the date
 * itself; this refuses what is plainly not such a time before sending it.
 */
export function expiryFromFlags(flags: {
  "expires-at"?: string;
  "no-expiry"?: boolean;
}):
  | { ok: true; expiresAt: string | null | undefined }
  | { ok: false; message: string } {
  if (flags["no-expiry"]) return { ok: true, expiresAt: null };
  const at = flags["expires-at"]?.trim();
  if (at === undefined) return { ok: true, expiresAt: undefined };
  if (
    !/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d(:[0-5]\d(\.\d+)?)?(Z|[+-]([01]\d|2[0-3]):[0-5]\d)$/.test(
      at,
    ) ||
    Number.isNaN(Date.parse(at))
  ) {
    return {
      ok: false,
      message: `--expires-at takes an ISO 8601 time with its time zone, such as 2027-02-08T00:00:00Z, not ${JSON.stringify(at)}.`,
    };
  }
  return { ok: true, expiresAt: at };
}

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

/**
 * The rules a key's mail scope lists that read nothing any more, each with
 * why: a deleted rule (rule_deleted) or a share that ended (share_ended).
 */
function endedRules(
  scope: Record<string, unknown>,
): { id: string; reason: string }[] {
  if (!Array.isArray(scope.ended_rules)) return [];
  return scope.ended_rules.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const { id, reason } = entry as { id?: unknown; reason?: unknown };
    return typeof id === "string"
      ? [{ id, reason: typeof reason === "string" ? reason : "ended" }]
      : [];
  });
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
  const ended = endedRules(record);
  const reaches = parts.length > 0 ? parts.join("; ") : "no mailbox";
  return ended.length > 0
    ? `${reaches}; ended rules ${ended.map((r) => `${r.id} (${r.reason})`).join(", ")}`
    : reaches;
}

/** What a key may do, in words. */
export function describePermissions(grant: KeyGrantView): string {
  if (grant.template === "super_admin") return "super admin (every permission)";
  if (grant.template) return grant.template;
  const permissions = grant.permissions ?? [];
  return permissions.length > 0 ? permissions.join(", ") : "none";
}

/**
 * The notes the server gives on a key's grant on every read (address_warnings),
 * such as an address it reads in full beside its email rules. Read loosely:
 * an older server sends none.
 */
export function keyNotes(key: KeyView): string[] {
  const notes = (key as { address_warnings?: unknown }).address_warnings;
  if (!Array.isArray(notes)) return [];
  return notes.flatMap((note: unknown) => {
    const description = (note as { description?: unknown } | null)?.description;
    return typeof description === "string" ? [description] : [];
  });
}

export function formatKeyRows(
  rows: readonly KeyView[],
  options: { includeRevoked?: boolean } = {},
): string {
  if (rows.length === 0) {
    return options.includeRevoked
      ? "No API keys, revoked or not."
      : "No API keys. Revoked keys are left out; pass --include-revoked to list them too.";
  }
  return rows
    .map((row) => {
      // A revoked key never works again, whatever it was before.
      const suspended =
        row.suspended && row.status !== "revoked" ? " [suspended]" : "";
      const revoked =
        row.status === "revoked"
          ? ` [revoked${row.revoked_at ? ` ${row.revoked_at}` : ""}]`
          : "";
      const count = keyNotes(row).length;
      const notes =
        count > 0
          ? ` [${count} ${count === 1 ? "note" : "notes"}: primitive keys get ${row.id}]`
          : "";
      return `${row.id}  ${row.key_prefix}  ${row.name ?? "(unnamed)"}  ${describePermissions(row.grant)}  mail: ${describeMailScope(row.grant)}  expires ${row.expires_at ?? "never"}  last used ${row.last_used_at ?? "never"}${suspended}${revoked}${notes}`;
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
  // GET /keys/{id} also answers a revoked key, which never works again.
  if (key.status === "revoked") {
    const by = key.revoked_by ? ` by user ${key.revoked_by}` : "";
    lines.push(`Revoked:      ${key.revoked_at ?? "yes"}${by}`);
  }
  if (key.agent_address) lines.push(`Agent:        ${key.agent_address}`);
  if (key.grant.template) {
    lines.push(`Permissions:  ${describePermissions(key.grant)}`);
  } else {
    lines.push("Permissions:");
    for (const permission of key.grant.permissions ?? []) {
      lines.push(`  ${permission}`);
    }
  }
  const notes = keyNotes(key);
  if (notes.length > 0) {
    lines.push("Notes:");
    for (const note of notes) lines.push(`  ${note.replace(/\r?\n/g, "\n  ")}`);
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

/**
 * The mail scope fields a change can restate. `ended_rules` (rules the key
 * lists that read nothing any more: a deleted rule, or a share that ended) is
 * read only: a change never sends it back, so the key is saved without them.
 * `rule_versions` (each listed rule's current version, its state and when
 * that version was saved) is read only too, and is never sent back.
 */
const RESTATABLE_SCOPE_FIELDS = new Set([
  "addresses",
  "domains",
  "rules",
  "depth",
  "ended_rules",
  "rule_versions",
]);

export type GrantChange = {
  add: string[];
  remove: string[];
  /** Replaces the key's rules. */
  rules?: string[];
  /** Added to the rules the key has, which stay. */
  addRules?: string[];
  /** Taken off the rules the key has; the others stay. */
  removeRules?: string[];
};

/** Whether a change touches the key's email rules at all. */
function changesRules(change: GrantChange): boolean {
  return (
    change.rules !== undefined ||
    (change.addRules?.length ?? 0) > 0 ||
    (change.removeRules?.length ?? 0) > 0
  );
}

/**
 * The rules a key lists after `change`: replaced by --rule, or the ones it has
 * with --add-rule added and --remove-rule taken off. The API takes a key's
 * whole grant, so a partial change is made here on the grant just read, and
 * the update is guarded by that grant's ref. Rule ids are compared as the
 * server stores them, lowercase.
 */
export function nextRules(
  current: readonly string[],
  change: GrantChange,
): string[] {
  if (change.rules) return change.rules;
  const removing = new Set(
    (change.removeRules ?? []).map((r) => r.toLowerCase()),
  );
  const kept = current.filter((r) => !removing.has(r.toLowerCase()));
  // Once each, as the server stores them, lowercase: the same rule in two cases is one rule.
  const have = new Set(kept.map((r) => r.toLowerCase()));
  const adding: string[] = [];
  for (const rule of change.addRules ?? []) {
    const id = rule.toLowerCase();
    if (have.has(id)) continue;
    have.add(id);
    adding.push(id);
  }
  return [...kept, ...adding];
}

/** Whether two lists hold the same values, in any order. */
function sameSet(a: readonly string[], b: readonly string[]): boolean {
  const left = new Set(a);
  const right = new Set(b);
  return left.size === right.size && [...left].every((v) => right.has(v));
}

/**
 * The rules a key's grant lists, or none: the ones it reads through, and the
 * ones that read nothing any more (`ended_rules`), which a change to the key
 * takes off.
 */
export function keyRules(grant: KeyGrantView): string[] {
  const scope = grant.mail_scope;
  if (!scope || typeof scope !== "object" || Array.isArray(scope)) return [];
  const record = scope as Record<string, unknown>;
  const live = stringList(record.rules ?? []) ?? [];
  return [...live, ...endedRules(record).map((rule) => rule.id)];
}

/**
 * The grant that restates a key's current grant with permissions added or
 * removed, or its email rules replaced, added to or taken off (nextRules), and
 * everything else as it is. Only a
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
  // A change restates the whole grant, so a key's per-resource limits must be
  // seen to be kept. A server that does not say whether the key has any is
  // not restated to: the change could drop them.
  if (!("resources" in current)) {
    return {
      ok: false,
      message:
        "The server does not say whether this key is limited to selected Functions, domains, endpoints or routes, so the CLI does not restate its grant: that could drop such limits. Change it in the dashboard.",
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
        "This key is limited to selected Functions, domains, endpoints or routes, which a change to its grant cannot keep. To change what it can do, create a key with what you need and revoke this one.",
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
    if (changesRules(change)) {
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
        "This key's mail scope could not be read. Change the key in the dashboard, or create a key with what you need and revoke this one.",
    };
  }
  const record = scope as Record<string, unknown>;
  const addresses = stringList(record.addresses ?? []);
  const domains = stringList(record.domains ?? []);
  const heldRules = stringList(record.rules ?? []);
  // A rule that reads nothing any more is never put back on a key.
  const ended = endedRules(record);
  const readdedEnded = ended.find((rule) =>
    [...(change.addRules ?? []), ...(change.rules ?? [])].some(
      (asked) => asked.toLowerCase() === rule.id.toLowerCase(),
    ),
  );
  if (readdedEnded) {
    return {
      ok: false,
      message: `${readdedEnded.id} reads nothing any more (${readdedEnded.reason}), so it cannot be added back to the key.`,
    };
  }
  const rules = heldRules ? nextRules(heldRules, change) : null;
  const unknownFields = Object.keys(record).filter(
    (field) => !RESTATABLE_SCOPE_FIELDS.has(field),
  );
  if (unknownFields.length > 0) {
    const one = unknownFields.length === 1;
    return {
      ok: false,
      message: `This key's mail scope has ${one ? "a setting" : "settings"} the CLI cannot restate (${unknownFields.join(", ")}), and a change here could drop ${one ? "it" : "them"}. Change the key in the dashboard, or create a key with what you need and revoke this one.`,
    };
  }
  if (!addresses || !domains || !rules) {
    const unreadable = [
      ...(addresses ? [] : ["addresses"]),
      ...(domains ? [] : ["domains"]),
      ...(rules ? [] : ["rules"]),
    ];
    return {
      ok: false,
      message: `This key's mail scope has ${unreadable.join(" and ")} the CLI could not read. Change the key in the dashboard, or create a key with what you need and revoke this one.`,
    };
  }
  if (addresses.length === 0 && domains.length === 0 && rules.length === 0) {
    // A key whose only rules ended reaches no mail already.
    if ((heldRules?.length ?? 0) === 0 && ended.length > 0) {
      return {
        ok: false,
        message:
          "This key reads no mail any more: its only rules were deleted or their shares ended. Revoke it with `primitive keys revoke <key-id>`.",
      };
    }
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
async function reportKeysError(
  command: Command,
  outcome: { payload: unknown; stepUpUrl?: string },
  auth: CliAuth,
  json: boolean,
  /** The permissions an update asked to add, beside those the key holds. */
  askedPermissions?: readonly string[],
): Promise<void> {
  if (json) {
    process.stderr.write(`${JSON.stringify(outcome.payload)}\n`);
  } else {
    writeErrorWithHints(outcome.payload);
  }
  // "<name> cannot be granted to a key": say whether it is a permission at
  // all, and what a key can hold.
  const ungrantable = ungrantablePermission(outcome.payload);
  if (ungrantable) {
    process.stderr.write(
      `${await ungrantablePermissionHint(auth.apiClient.client, ungrantable, askedPermissions)}\n`,
    );
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

  You see your own keys, and every key if your role may read them all, as in the dashboard.

  Revoked keys are left out unless you pass --include-revoked, which lists them too, each marked [revoked] with when it was revoked. With --json, a revoked key has status "revoked", revoked_at and revoked_by. That confirms a revocation without having noted the key ids beforehand.`;

  static summary = "List API keys";

  static examples = [
    "<%= config.bin %> keys list",
    "<%= config.bin %> keys list --json",
    "<%= config.bin %> keys list --include-revoked",
  ];

  static flags = {
    "api-key": API_KEY_FLAG,
    "api-base-url": API_BASE_URL_FLAG,
    "include-revoked": Flags.boolean({
      description:
        "List revoked keys too, each marked [revoked] with when it was revoked.",
    }),
    json: Flags.boolean({ description: "Print the keys as JSON." }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(KeysListCommand);
    const includeRevoked = flags["include-revoked"] === true;
    const auth = await authenticate(this, flags);
    const items: KeyView[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < LIST_PAGE_LIMIT; page += 1) {
      const result = await call<CredentialsListKeysResult>(
        listKeys({
          client: auth.apiClient.client,
          // The cursor does not carry include_revoked: it goes with every
          // page. The client leaves an undefined parameter out.
          query: {
            cursor,
            include_revoked: includeRevoked ? "true" : undefined,
          },
        }),
      );
      if (!result.ok) {
        await reportKeysError(this, result, auth, Boolean(flags.json));
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
    this.log(formatKeyRows(items, { includeRevoked }));
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
      await reportKeysError(this, result, auth, Boolean(flags.json));
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

  A key limited to email rules (--rule, repeatable) reaches only the mail those rules match. Give it mail:read with --permission, or use --preset own_addresses_read_only.

  ${keyPermissionsHelp()}`;

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
        "A permission the key holds (repeatable, or comma-separated), for a custom key. See --help-full for the permissions a key can hold.",
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
        "An email rule id whose matching mail the key reaches (repeatable). An --address or --domain given beside it is read in full, not only the rule's mail.",
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
      await reportKeysError(this, result, auth, Boolean(flags.json));
      return;
    }
    const key = result.data;
    // address_warnings say what a listed address or domain reads, such as one
    // beside --rule, which the key reads in full; --json carries them as is.
    if (!flags.json) {
      writeWarnings(key.warnings);
      writeWarnings(key.address_warnings);
    }
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

  The new key keeps the old key's expiry: rotating alone does not extend a key. Pass --expires-at to give the new key another one, within your organization's credential policy, or --no-expiry for none where the policy allows. Either needs keys:manage. The old key never outlives the new one.

  The rotation runs directly; if your organization requires approval, the command prints the approval link and takes --step-up-token, as for a new key. Store the new secret right away: it is not shown again and the CLI does not save it.`;

  static summary = "Rotate an API key";

  static examples = [
    "<%= config.bin %> keys rotate 0f0e0d0c-0b0a-4908-8706-050403020100",
    "<%= config.bin %> keys rotate 0f0e0d0c-0b0a-4908-8706-050403020100 --overlap-seconds 0",
    "<%= config.bin %> keys rotate 0f0e0d0c-0b0a-4908-8706-050403020100 --expires-at 2027-02-08T00:00:00Z",
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
    "expires-at": Flags.string({
      description:
        "Give the new key this expiry (ISO 8601 with a time zone) instead of the old key's.",
      exclusive: ["no-expiry"],
    }),
    "no-expiry": Flags.boolean({
      description: "Give the new key no expiry, where the policy allows.",
      exclusive: ["expires-at"],
    }),
    ...APPROVAL_FLAGS,
    json: Flags.boolean({
      description: "Print the new key, its secret included, as JSON.",
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(KeysRotateCommand);
    const expiry = expiryFromFlags(flags);
    if (!expiry.ok) this.error(expiry.message, { exit: 2 });
    const auth = await authenticate(this, flags);
    const body: CredentialsRotateKeyInput = {
      ...(flags["overlap-seconds"] === undefined
        ? {}
        : { overlap_seconds: flags["overlap-seconds"] }),
      ...(expiry.expiresAt === undefined
        ? {}
        : { expires_at: expiry.expiresAt }),
    };
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
      await reportKeysError(this, result, auth, Boolean(flags.json));
      return;
    }
    const rotated = result.data;
    printSecret(
      this,
      Boolean(flags.json),
      rotated,
      rotated.key,
      `Rotated key ${rotated.previous_key_id}. The new key is ${rotated.id}, prefix ${rotated.key_prefix}${rotated.expires_at === undefined ? "" : `, and expires ${rotated.expires_at ?? "never"}`}. The old key works until ${rotated.previous_key_expires_at}.`,
    );
  }
}

export class KeysUpdateCommand extends Command {
  static description =
    `Change an API key's permissions, email rules, name or expiry. It keeps its id and secret.

  --add and --remove take permissions (repeatable, or comma-separated); \`primitive keys create --help-full\` lists the permissions a key can hold. --add-rule and --remove-rule add email rules to the key or take them off, and keep its other rules. --rule replaces every rule the key has with the ones given, so pass all the rules it should keep; it cannot be combined with --add-rule or --remove-rule. --expires-at gives it a new expiry: a later one extends it, within your organization's credential policy, and is how to keep a key working past its expiry (rotating keeps the expiry). --no-expiry removes it where the policy allows. An expired key cannot be extended. Everything else about the key stays as it is, and the output lists any rules a change took off.

  The change runs directly; if your organization requires approval, the command prints the approval link and takes --step-up-token, as for a new key. A key never holds more than you do.

  With --json it prints the key as it is now, in the shape keys get prints, with changed, warnings and address_warnings alongside, notice when its permissions or mail changed, rules_added when a change put rules on it (each with granted_emails, how many emails the rule has already shared), rules_removed when a change took rules off, and rules_not_on_key for rules asked to be taken off that it did not have. A permission or rule change that leaves the grant as it is, with no --name, --expires-at or --no-expiry, sends nothing and prints the key with changed: []. If the key cannot be read back after the change, key_error says why and only the change's fields are printed.`;

  static summary = "Change an API key";

  static examples = [
    "<%= config.bin %> keys update 0f0e0d0c-0b0a-4908-8706-050403020100 --add mail:send,mail:reply",
    "<%= config.bin %> keys update 0f0e0d0c-0b0a-4908-8706-050403020100 --remove mail:send",
    "<%= config.bin %> keys update 0f0e0d0c-0b0a-4908-8706-050403020100 --add-rule 3b0f6a1e-6c7a-4f43-9d8e-2a1b5c4d3e2f",
    "<%= config.bin %> keys update 0f0e0d0c-0b0a-4908-8706-050403020100 --remove-rule 3b0f6a1e-6c7a-4f43-9d8e-2a1b5c4d3e2f",
    "<%= config.bin %> keys update 0f0e0d0c-0b0a-4908-8706-050403020100 --rule 3b0f6a1e-6c7a-4f43-9d8e-2a1b5c4d3e2f",
    "<%= config.bin %> keys update 0f0e0d0c-0b0a-4908-8706-050403020100 --expires-at 2027-02-08T00:00:00Z",
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
        "Replaces the key's rules with these email rule ids. Pass every rule it should keep (repeatable, or comma-separated), or use --add-rule and --remove-rule, which keep its other rules.",
      multiple: true,
      exclusive: ["add-rule", "remove-rule"],
    }),
    "add-rule": Flags.string({
      description:
        "An email rule id to add to the key (repeatable, or comma-separated). Its other rules stay.",
      multiple: true,
    }),
    "remove-rule": Flags.string({
      description:
        "An email rule id to take off the key (repeatable, or comma-separated). Its other rules stay.",
      multiple: true,
    }),
    name: Flags.string({ description: "A new name for the key." }),
    "expires-at": Flags.string({
      description:
        "A new expiry, ISO 8601 with a time zone. A later one extends the key.",
      exclusive: ["no-expiry"],
    }),
    "no-expiry": Flags.boolean({
      description: "Remove the key's expiry, where the policy allows.",
      exclusive: ["expires-at"],
    }),
    ...APPROVAL_FLAGS,
    json: Flags.boolean({ description: "Print the result as JSON." }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(KeysUpdateCommand);
    const expiry = expiryFromFlags(flags);
    if (!expiry.ok) this.error(expiry.message, { exit: 2 });
    const add = listFlag(flags.add);
    const remove = listFlag(flags.remove);
    const rules = flags.rule ? listFlag(flags.rule) : undefined;
    const addRules = listFlag(flags["add-rule"]);
    const removeRules = listFlag(flags["remove-rule"]);
    const both = add.filter((p) => remove.includes(p));
    if (both.length > 0) {
      this.error(`Both added and removed: ${both.join(", ")}.`, { exit: 2 });
    }
    const bothRules = addRules.filter((r) =>
      removeRules.some((x) => x.toLowerCase() === r.toLowerCase()),
    );
    if (bothRules.length > 0) {
      this.error(`Both added and removed: ${bothRules.join(", ")}.`, {
        exit: 2,
      });
    }
    const ruleChange = {
      ...(rules ? { rules } : {}),
      ...(addRules.length > 0 ? { addRules } : {}),
      ...(removeRules.length > 0 ? { removeRules } : {}),
    };
    const changesGrant =
      add.length > 0 || remove.length > 0 || Object.keys(ruleChange).length > 0;
    if (
      !changesGrant &&
      flags.name === undefined &&
      expiry.expiresAt === undefined
    ) {
      this.error(
        "Nothing to change: pass --add, --remove, --add-rule, --remove-rule, --rule, --name, --expires-at or --no-expiry.",
        { exit: 2 },
      );
    }
    // The rules the key listed before the change, the ones the change takes
    // off (from what is sent, not a later read), and any asked to be taken
    // off that it did not have.
    let rulesBefore: string[] = [];
    let rulesRemoved: string[] = [];
    let rulesNotOnKey: string[] = [];
    const auth = await authenticate(this, flags);
    const body: CredentialsUpdateKeyInput = {
      ...(flags.name !== undefined ? { name: flags.name } : {}),
      ...(expiry.expiresAt !== undefined
        ? { expires_at: expiry.expiresAt }
        : {}),
    };
    if (changesGrant) {
      const current = await call<KeyView>(
        getKey({ client: auth.apiClient.client, path: { id: args.id } }),
      );
      if (!current.ok) {
        await reportKeysError(this, current, auth, Boolean(flags.json));
        return;
      }
      // The key read also answers a revoked key, which cannot be changed:
      // stop before asking for any approval.
      if (current.data.status === "revoked") {
        this.error(`Key ${args.id} is revoked, so it cannot be changed.`, {
          exit: 1,
        });
      }
      rulesBefore = keyRules(current.data.grant);
      const next = buildUpdatedGrant(current.data.grant, {
        add,
        remove,
        ...ruleChange,
      });
      if (!next.ok) {
        this.error(next.message.replace("<key-id>", args.id), { exit: 2 });
      }
      rulesNotOnKey = removeRules.filter(
        (r) => !rulesBefore.some((k) => k.toLowerCase() === r.toLowerCase()),
      );
      if (rulesNotOnKey.length > 0 && !flags.json) {
        process.stderr.write(
          `Not on this key, so nothing to take off: ${rulesNotOnKey.join(", ")}.\n`,
        );
      }
      const sentRules =
        stringList((next.grant as { rules?: unknown }).rules ?? []) ?? [];
      rulesRemoved = rulesBefore.filter(
        (r) => !sentRules.some((k) => k.toLowerCase() === r.toLowerCase()),
      );
      // A change that leaves the grant as it is sends no grant: a grant
      // change is a new version of the key, written, audited and announced.
      const unchanged =
        sameSet(
          next.permissions,
          stringList(current.data.grant.permissions) ?? [],
        ) &&
        sameSet(
          sentRules.map((r) => r.toLowerCase()),
          rulesBefore.map((r) => r.toLowerCase()),
        );
      if (!unchanged) {
        body.grant = next.grant;
        // Refused if the key's grant changed after it was read, so a change
        // approved later never overwrites one made meanwhile.
        const ref = (current.data.grant as { ref?: unknown }).ref;
        if (typeof ref === "string") body.expected_grant_ref = ref;
        else if (!flags.json) {
          process.stderr.write(
            "Note: the server did not say which grant this key holds, so this change is not checked against changes made since it was read.\n",
          );
        }
      } else if (flags.name === undefined && expiry.expiresAt === undefined) {
        if (flags.json) {
          this.log(
            JSON.stringify(
              {
                ...current.data,
                changed: [],
                // As the update answer carries it, so a script can always read it.
                warnings: [],
                ...(rulesNotOnKey.length > 0
                  ? { rules_not_on_key: rulesNotOnKey }
                  : {}),
              },
              null,
              2,
            ),
          );
          return;
        }
        this.log(`Key ${args.id} already matched; nothing changed.`);
        return;
      }
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
      await reportKeysError(this, result, auth, Boolean(flags.json), add);
      return;
    }
    const grantChanged = result.data.changed.includes("grant");
    // The key as it is now, read back so --json prints it in the shape
    // `keys get` and `keys create` print, with what changed alongside.
    const after =
      grantChanged || flags.json
        ? await call<KeyView>(
            getKey({ client: auth.apiClient.client, path: { id: args.id } }),
          )
        : null;
    // The key's own notes as read back, read loosely: an older server sends none.
    const standingNotes = after?.ok
      ? (after.data as { address_warnings?: unknown }).address_warnings
      : undefined;
    if (flags.json) {
      this.log(
        JSON.stringify(
          {
            ...(after?.ok ? after.data : {}),
            ...result.data,
            // A change that wrote no grant answers no notes on it; the key's
            // standing notes are the ones read back, as keys get prints them.
            ...(!grantChanged && Array.isArray(standingNotes)
              ? { address_warnings: standingNotes }
              : {}),
            ...(grantChanged ? { notice: HELD_REQUEST_NOTICE } : {}),
            ...(grantChanged && rulesRemoved.length > 0
              ? { rules_removed: rulesRemoved }
              : {}),
            ...(rulesNotOnKey.length > 0
              ? { rules_not_on_key: rulesNotOnKey }
              : {}),
            // The change was made; only reading the key back failed.
            ...(after && !after.ok ? { key_error: after.payload } : {}),
          },
          null,
          2,
        ),
      );
      return;
    }
    writeWarnings(result.data.warnings);
    writeWarnings(result.data.address_warnings);
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
    // A rule taken off stops the key reading what it granted, so it is named.
    if (grantChanged && rulesRemoved.length > 0) {
      this.log(`Rules taken off: ${rulesRemoved.join(", ")}`);
    }
    if (changed.includes("expires_at")) {
      this.log(`Expires: ${expiry.expiresAt ?? "never"}`);
    }
    if (grantChanged) process.stderr.write(`${HELD_REQUEST_NOTICE}\n`);
  }
}

/**
 * What a revoked key set up or owns, split as revocation splits it: what the
 * organization owns keeps working, and what the key itself owned (its own
 * webhooks, say) keeps working only while someone can still act for it, such
 * as a key of the same rotation that still works. Null when there is none.
 */
export function standingSummary(standing: unknown): string | null {
  if (!Array.isArray(standing) || standing.length === 0) return null;
  const keyOwned = standing.filter(
    (item) => (item as { org_owned?: unknown }).org_owned === false,
  ).length;
  const kept = standing.length - keyOwned;
  const parts = [
    ...(kept > 0
      ? [`${kept} item(s) the organization owns keep working.`]
      : []),
    ...(keyOwned > 0
      ? [
          `${keyOwned} item(s) the key owned itself or carried on for the keys it was rotated from, such as its own webhooks, which keep working only while someone can still act for them, such as a key of the same rotation that still works.`,
        ]
      : []),
  ];
  return `${parts.join(" ")} Review them with --json.`;
}

/** How many standing objects the summary lists one by one. */
const STANDING_LIST_LIMIT = 10;

const STANDING_KIND_LABELS: Record<string, string> = {
  endpoint: "webhook",
  function_trigger: "Function trigger",
  pull_subscription: "pull subscription",
  recipient_route: "route",
  filter_rule: "filter",
  wake_schedule: "wake schedule",
};

type StandingObject = {
  kind?: unknown;
  id?: unknown;
  label?: unknown;
  org_owned?: unknown;
  still_acting?: unknown;
  acting_key_id?: unknown;
  delivering?: unknown;
};

/** Whether a revoke answer says, per item, what still acts for it or delivers. */
function reportsCascade(standing: readonly StandingObject[]): boolean {
  return standing.some(
    (item) => "still_acting" in item || "delivering" in item,
  );
}

/**
 * A standing object's label. A Function trigger's label is only "function" and
 * an unnamed pull subscription's only "pull", so those carry their id. A
 * webhook's label is its URL's scheme and host (the server hides the path and
 * query); against an older server, which sent the whole URL, it is cut at
 * `?` or `#`, which can hold a token.
 */
function standingLabel(item: StandingObject): string {
  const id = typeof item.id === "string" ? item.id : String(item.id);
  const label = typeof item.label === "string" && item.label ? item.label : id;
  // A Function trigger's label is only "function": its id says which.
  if (item.kind === "function_trigger") return id;
  if (item.kind === "pull_subscription")
    return label === id || label === "pull" ? id : `${label} (${id})`;
  if (item.kind === "endpoint") {
    const cut = label.search(/[?#]/);
    return cut >= 0 ? `${label.slice(0, cut)}?...` : label;
  }
  return label;
}

/** One standing object, with who still acts for it and whether it delivers. */
function standingLine(
  item: StandingObject,
  leftWorking: ReadonlySet<string>,
): string {
  const kind =
    typeof item.kind === "string"
      ? (STANDING_KIND_LABELS[item.kind] ?? item.kind)
      : "item";
  let acting: string;
  // org_owned is always sent; read a missing one as standingSummary does.
  if (item.org_owned !== false) {
    acting = "the organization owns it, so revoking does not stop it";
  } else if (item.still_acting === true) {
    const by =
      typeof item.acting_key_id === "string" && item.acting_key_id
        ? item.acting_key_id
        : null;
    acting = !by
      ? "owned by the revoked key; someone still acts for it, so it keeps working while they do"
      : leftWorking.has(by)
        ? `owned by the revoked key; key ${by} still acts for it until that key's overlap ends`
        : `owned by the revoked key; key ${by} still acts for it, so it keeps working while that key does`;
  } else if (item.still_acting === false) {
    acting =
      "owned by the revoked key; nothing acts for it, so it does not work";
  } else if (item.still_acting === null) {
    acting =
      "owned by the revoked key; whether anything still acts for it could not be read, and it works only while something does";
  } else {
    acting =
      "owned by the revoked key; it keeps working only while someone can still act for it";
  }
  const delivering =
    item.delivering === true
      ? "; still delivering received mail"
      : item.delivering === false
        ? "; not delivering received mail"
        : item.delivering === null
          ? "; whether it still delivers could not be read"
          : "";
  return `  ${kind} ${standingLabel(item)}: ${acting}${delivering}.`;
}

/**
 * What a revoke did beyond the key itself, from the answer: the keys it
 * replaced that were revoked with it or left working, and, for each item the
 * key set up or owns, whether anything still acts for it and whether it still
 * delivers. Lines, empty when the answer has none of these. An answer from a
 * server that does not report them per item falls back to standingSummary.
 */
export function revokeCascadeLines(data: unknown): string[] {
  if (!data || typeof data !== "object") return [];
  const answer = data as {
    standing_objects?: unknown;
    predecessors_revoked_count?: unknown;
    predecessors_left?: unknown;
    predecessors_revoked?: unknown;
    predecessors_not_revoked?: unknown;
  };
  const lines: string[] = [];
  const ids = (value: unknown) =>
    Array.isArray(value)
      ? value.filter((id): id is string => typeof id === "string")
      : [];
  const named = (list: string[]) =>
    list.length > 0 ? `: ${list.join(", ")}` : "";
  const revoked = answer.predecessors_revoked_count;
  if (typeof revoked === "number" && revoked > 0)
    lines.push(
      `Also revoked ${revoked === 1 ? "1 key" : `${revoked} keys`} it replaced, still in ${revoked === 1 ? "its" : "their"} rotation overlap${named(ids(answer.predecessors_revoked))}.`,
    );
  const left = answer.predecessors_left;
  if (typeof left === "number" && left > 0)
    lines.push(
      `${left === 1 ? "1 key" : `${left} keys`} it replaced ${left === 1 ? "is" : "are"} left working until ${left === 1 ? "its" : "their"} overlap ends, because you may not revoke ${left === 1 ? "it" : "them"}${named(ids(answer.predecessors_not_revoked))}; what ${left === 1 ? "it acts" : "they act"} for keeps working until then.`,
    );
  const leftWorking = new Set(ids(answer.predecessors_not_revoked));
  const standing = Array.isArray(answer.standing_objects)
    ? (answer.standing_objects.filter(
        (item) => item !== null && typeof item === "object",
      ) as StandingObject[])
    : [];
  if (standing.length > 0 && reportsCascade(standing)) {
    lines.push(
      "What it set up, owns or carried on for the keys it replaced (revoking deletes none of it):",
    );
    for (const item of standing.slice(0, STANDING_LIST_LIMIT))
      lines.push(standingLine(item, leftWorking));
    const more = standing.length - STANDING_LIST_LIMIT;
    if (more > 0) lines.push(`  ${more} more; --json lists them all.`);
  } else {
    const summary = standingSummary(answer.standing_objects);
    if (summary) lines.push(summary);
  }
  return lines;
}

export class KeysRevokeCommand extends Command {
  static description =
    `Revoke an API key. It stops working at once. What the organization owns keeps working; what the key itself owns, such as its own webhooks, keeps working only while someone can still act for it, such as a key of the same rotation that still works. What it set up or owns is listed for review, each with whether anything still acts for it and, for a webhook, whether it still delivers received mail. Keys it replaced that are still in their rotation overlap are revoked with it, except any you may not revoke; the output counts both, and names them and the key acting for each item when you may read the organization's keys.

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
      await reportKeysError(this, result, auth, Boolean(flags.json));
      return;
    }
    if (flags.json) {
      this.log(JSON.stringify(result.data, null, 2));
      return;
    }
    // Revoking a key that is already revoked changes nothing.
    // Revoking a key already revoked still revokes the keys it replaced
    // that are in their overlap; only with none of those did nothing change.
    const replaced = (result.data as Record<string, unknown>)
      .predecessors_revoked_count;
    const alsoRevoked = typeof replaced === "number" && replaced > 0;
    this.log(
      result.data.already_revoked === true
        ? alsoRevoked
          ? `Key ${args.id} was already revoked.`
          : `Key ${args.id} was already revoked; nothing changed.`
        : `Revoked key ${args.id}.`,
    );
    for (const line of revokeCascadeLines(result.data)) this.log(line);
  }
}
