// Whose mail a role reads, said where a person is given one from the CLI.
// While an organization uses whole-organization access (the default), a role
// whose mail scope is the organization, Member among them, reads every
// mailbox. The dashboard's role pickers say so; the CLI paths that give
// someone a role say it too.

type ApiClient = {
  get: (options: {
    responseStyle: "fields";
    security: Array<{ scheme: "bearer"; type: "http" }>;
    signal?: AbortSignal;
    url: string;
  }) => Promise<{ data?: unknown; error?: unknown }>;
};

type ListedRole = {
  id?: unknown;
  key?: unknown;
  name?: unknown;
  permissions?: unknown;
  mail_scope?: unknown;
};

/**
 * Why an invitation for Member was refused, for the refusal the server gives
 * when every Member reads all of the organization's mail: offering Member is
 * then giving that, which only a person signed in to the dashboard who can
 * assign roles may do.
 */
export const MEMBER_INVITE_READS_ALL_MAIL =
  "In this organization every Member reads all of its mail, so inviting someone as Member gives them every mailbox, and that takes a person signed in to the dashboard who can assign roles. From the CLI you can invite them with --role none, where the organization can give limited roles, and once they have joined give them a role with `primitive roles-and-members set-member-role`. Or invite them from the dashboard's Roles settings, which says what each role reads.";

/**
 * The hint for a refused invite-organization-member, or undefined when it is
 * not that refusal. That one carries no details; a refusal for a grant that
 * lacks a permission names it in its details, and is left to its own hint.
 */
export function inviteRefusalHint(
  code: string | undefined,
  body: unknown,
  payload?: unknown,
): string | undefined {
  if (code !== "grant_forbidden") return undefined;
  const details =
    payload && typeof payload === "object"
      ? (payload as { details?: unknown }).details
      : undefined;
  if (details && typeof details === "object" && Object.keys(details).length > 0)
    return undefined;
  const role =
    body && typeof body === "object"
      ? (body as { role?: unknown }).role
      : undefined;
  // Member is the role an invitation without one is for.
  if (role !== undefined && role !== "member") return undefined;
  return MEMBER_INVITE_READS_ALL_MAIL;
}

/**
 * Control characters (C0, DEL and C1), line and paragraph separators and
 * format characters, which could fake a line of output: a role's name is free
 * text. Built from code points, as commands/roles.ts builds its pattern, so the
 * source holds no control character.
 */
const UNPRINTABLE = new RegExp(
  `[${String.fromCharCode(0)}-${String.fromCharCode(31)}${String.fromCharCode(127)}-${String.fromCharCode(159)}${String.fromCharCode(0x2028)}${String.fromCharCode(0x2029)}\\p{Cf}]`,
  "gu",
);

/**
 * The warning for giving someone `role`, from GET /roles, or null when it
 * reads less or cannot be told. A role, or a template the organization has
 * not copied yet, reads every mailbox when it holds mail:read over the whole
 * organization and the organization gives such roles all of its mail (whole-
 * organization access, which the dashboard also assumes when the answer does
 * not say).
 */
export function roleReadsAllMailWarning(
  role: string,
  listed: unknown,
): string | null {
  if (!listed || typeof listed !== "object") return null;
  const data = listed as {
    roles?: unknown;
    templates?: unknown;
    invitations?: unknown;
  };
  const invitations =
    data.invitations && typeof data.invitations === "object"
      ? (data.invitations as { members_read_all_mail?: unknown })
      : null;
  if (invitations && invitations.members_read_all_mail !== true) return null;
  const wanted = role.toLowerCase();
  const matches = (value: unknown) =>
    typeof value === "string" && value.toLowerCase() === wanted;
  const roles = Array.isArray(data.roles) ? (data.roles as ListedRole[]) : [];
  const templates = Array.isArray(data.templates)
    ? (data.templates as ListedRole[])
    : [];
  const found =
    roles.find((r) => matches(r.key) || matches(r.id)) ??
    templates.find((t) => matches(t.key));
  const readsMail =
    Array.isArray(found?.permissions) &&
    found.permissions.includes("mail:read");
  if (found?.mail_scope !== "org" || !readsMail) return null;
  const name = (typeof found.name === "string" ? found.name : role)
    .replace(UNPRINTABLE, "")
    .slice(0, 80);
  return `Warning: ${name} reads all of this organization's mail while this organization uses whole-organization access, so the person given it reads every mailbox. For only their own mail, use a narrower role: \`primitive roles list --json\` shows each role's mail_scope.`;
}

/** How long the warning waits for GET /roles before leaving it out. */
export const ROLES_TIMEOUT_MS = 3_000;

/** GET /roles, or null when it cannot be read in time: the warning is then left out rather than guessed. */
export async function readRoles(
  client: ApiClient,
  timeoutMs = ROLES_TIMEOUT_MS,
): Promise<unknown> {
  try {
    const result = await client.get({
      responseStyle: "fields",
      security: [{ scheme: "bearer", type: "http" }],
      signal: AbortSignal.timeout(timeoutMs),
      url: "/roles",
    });
    if (result.error) return null;
    return (result.data as { data?: unknown } | undefined)?.data ?? null;
  } catch {
    return null;
  }
}
