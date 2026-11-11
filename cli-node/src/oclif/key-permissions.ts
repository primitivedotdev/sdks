// The permissions an API key can hold, for `keys create` and `keys update`:
// their help, and the hint after the API refuses a permission with "<name>
// cannot be granted to a key".
//
// The API lists these, by area, only to the dashboard's key builder, which a
// CLI login cannot read, so the CLI keeps its own copy in the same order. The
// API still decides every key: a permission it adds later is accepted even
// before this list names it.

import { extractErrorCode, extractErrorPayload } from "./api-command.js";
import { fetchCallerIdentity } from "./commands/whoami.js";

type KeyPermissionArea = {
  label: string;
  permissions: readonly string[];
};

export const KEY_PERMISSION_AREAS: readonly KeyPermissionArea[] = [
  {
    label: "Mail",
    permissions: [
      "mail:read",
      "changes:read",
      "mail.search:semantic",
      "mail:send",
      "mail:send_batch",
      "mail:reply",
      "mail:signal",
      "mail.state:write",
      "mail:delete",
      "mail.compat:use",
    ],
  },
  { label: "Raw mail", permissions: ["mail.raw:read"] },
  {
    label: "Scheduled and repeating sends",
    permissions: ["sent:manage", "sent:cancel"],
  },
  { label: "Thread mutes", permissions: ["threads:mute"] },
  { label: "App sync state", permissions: ["mail_sync:manage"] },
  {
    label: "Endpoints and webhooks",
    permissions: [
      "webhooks:read",
      "endpoints:manage",
      "endpoints.pull:manage",
      "webhooks:replay",
    ],
  },
  { label: "Recipient routes", permissions: ["routes:manage"] },
  { label: "Filters", permissions: ["filters:manage"] },
  { label: "Domains", permissions: ["domains:read", "domains:manage"] },
  {
    label: "Account",
    permissions: [
      "org:read",
      "account:manage",
      "account:claim",
      "credentials:revoke_self",
    ],
  },
  { label: "Own activity", permissions: ["activity:read_self"] },
  {
    label: "Webhook signing secret",
    permissions: ["webhook_secret:read", "webhook_secret:manage"],
  },
  {
    label: "Functions",
    permissions: [
      "functions:read",
      "functions:manage",
      "functions:deploy",
      "github:manage",
      "templates:install",
    ],
  },
  { label: "Secrets", permissions: ["secrets:manage"] },
  {
    label: "Contacts",
    permissions: [
      "contacts:read",
      "contacts:write",
      "contacts:delete",
      "agent_contacts:manage",
    ],
  },
  {
    label: "Address notes",
    permissions: ["notes:read", "notes:write", "notes:delete"],
  },
  { label: "Memories", permissions: ["memories:read", "memories:write"] },
  { label: "Payloads", permissions: ["payloads:read", "payloads:write"] },
  {
    label: "Interactions",
    permissions: [
      "interactions:read",
      "interactions:send",
      "interactions:advance",
    ],
  },
  { label: "Wake", permissions: ["wake:manage"] },
  { label: "Credits", permissions: ["credits:read", "credits:redeem"] },
  { label: "Push devices", permissions: ["push_devices:manage"] },
];

/** Held only by a key that reaches every mailbox (--all-mailboxes). */
export const EVERY_MAILBOX_KEY_PERMISSIONS: readonly string[] = [
  "members:read",
];

/** The permissions a key can hold, by area, for --help-full. */
export function keyPermissionsHelp(): string {
  const areas = KEY_PERMISSION_AREAS.map(
    (area) => `${area.label}: ${area.permissions.join(", ")}.`,
  ).join(" ");
  return `Permissions a key can hold, by area, as this CLI version lists them (the API decides, and a key never holds more than you do): ${areas} Only a key that reaches every mailbox (--all-mailboxes) can also hold ${EVERY_MAILBOX_KEY_PERMISSIONS.join(", ")}.`;
}

/** How long the refusal hint waits on the permission check. */
const CHECK_TIMEOUT_MS = 5_000;

/**
 * The permission a refusal says cannot be granted to a key, or null for any
 * other refusal.
 */
export function ungrantablePermission(payload: unknown): string | null {
  const error = extractErrorPayload(payload);
  if (extractErrorCode(error) !== "validation_error") return null;
  const message =
    error && typeof error === "object"
      ? (error as { message?: unknown }).message
      : undefined;
  if (typeof message !== "string") return null;
  const match = /^(.+) cannot be granted to a key$/.exec(message.trim());
  return match?.[1] ?? null;
}

/**
 * Whether the API knows `name` as a permission at all: GET /whoami?check
 * answers a check for any permission it knows and refuses any other name
 * with "unknown permission". Null when the answer says neither, or does not
 * come in time: the hint never holds the command up for longer than that.
 */
async function isKnownPermission(
  client: Parameters<typeof fetchCallerIdentity>[0],
  name: string,
): Promise<boolean | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), CHECK_TIMEOUT_MS);
  });
  try {
    return await Promise.race([checkPermission(client, name), late]);
  } finally {
    clearTimeout(timer);
  }
}

async function checkPermission(
  client: Parameters<typeof fetchCallerIdentity>[0],
  name: string,
): Promise<boolean | null> {
  try {
    const { identity, error } = await fetchCallerIdentity(
      client,
      { check: name },
      {
        // Plain fetch, not the client's: a saved login's 401 would otherwise
        // exchange its token, which no signal stops. A 401 here just means
        // the hint cannot say.
        fetch: (input, init) => globalThis.fetch(input, init),
        signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
      },
    );
    if (error) {
      const payload = extractErrorPayload(error);
      const message =
        payload && typeof payload === "object"
          ? (payload as { message?: unknown }).message
          : undefined;
      return extractErrorCode(payload) === "validation_error" &&
        typeof message === "string" &&
        message.startsWith("unknown permission")
        ? false
        : null;
    }
    return identity?.check ? true : null;
  } catch {
    return null;
  }
}

/**
 * The hint after "<name> cannot be granted to a key": whether the name is
 * not a permission at all or is one a key cannot hold, then what a key can
 * hold, as this CLI lists it. `asked` is the permissions the command asked
 * for, when the request also carried others (an update sends the key's own
 * permissions too), so a refusal of one the key already holds says so.
 */
export async function ungrantablePermissionHint(
  client: Parameters<typeof fetchCallerIdentity>[0],
  name: string,
  asked?: readonly string[],
): Promise<string> {
  const known = await isKnownPermission(client, name);
  const what =
    known === false
      ? `${name} is not a permission.`
      : known === true
        ? `${name} is a permission, but an API key cannot hold it.`
        : `${name} is not a permission an API key can hold.`;
  if (asked && !asked.includes(name)) {
    return `Hint: ${what} The key already holds it, so this change cannot keep it: take it off with --remove ${name}.`;
  }
  const listed = KEY_PERMISSION_AREAS.some((area) =>
    area.permissions.includes(name),
  );
  if (listed || EVERY_MAILBOX_KEY_PERMISSIONS.includes(name)) {
    return `Hint: ${what} This CLI's list of the permissions a key can hold still names it, so the list is older than the API's: update the CLI.`;
  }
  return `Hint: ${what} As this CLI version lists them, a key can hold ${KEY_PERMISSION_AREAS.flatMap((area) => area.permissions).join(", ")}, and, only when it reaches every mailbox, ${EVERY_MAILBOX_KEY_PERMISSIONS.join(", ")}. \`primitive keys create --help-full\` lists them by area.`;
}
