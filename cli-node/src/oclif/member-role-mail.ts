// Whose mail a role reads, said where a person is given one from the CLI.
// While an organization uses whole-organization access (the default), a role
// whose mail scope is the organization, Member among them, reads every
// mailbox. The dashboard's role pickers say so; the CLI paths that give
// someone a role say it too.

type ApiClient = {
  get: (options: {
    responseStyle: "fields";
    security: Array<{ scheme: "bearer"; type: "http" }>;
    url: string;
  }) => Promise<{ data?: unknown; error?: unknown }>;
};

type ListedRole = {
  id?: unknown;
  key?: unknown;
  name?: unknown;
  mail_scope?: unknown;
};

/**
 * Why an invitation for Member was refused, for the refusal the server gives
 * when every Member reads all of the organization's mail: offering Member is
 * then giving that, which only a person signed in to the dashboard who can
 * assign roles may do.
 */
export const MEMBER_INVITE_READS_ALL_MAIL =
  "Here every Member reads all of the organization's mail, so inviting someone as Member gives them every mailbox, and that takes a person signed in to the dashboard who can assign roles. From the CLI, invite them with --role none and give them a role afterwards with `primitive roles-and-members set-member-role`, or invite them from the dashboard's Roles settings, which says what each role reads.";

/** The hint for a refused invite-organization-member, or undefined when it is not that refusal. */
export function inviteRefusalHint(
  code: string | undefined,
  body: unknown,
): string | undefined {
  if (code !== "grant_forbidden") return undefined;
  const role =
    body && typeof body === "object"
      ? (body as { role?: unknown }).role
      : undefined;
  // Member is the role an invitation without one is for.
  if (role !== undefined && role !== "member") return undefined;
  return MEMBER_INVITE_READS_ALL_MAIL;
}

/**
 * The warning for giving someone `role`, from GET /roles: when the
 * organization gives every holder of an organization-wide role all of its
 * mail and `role` is one, or null when it reads less or cannot be told.
 */
export function roleReadsAllMailWarning(
  role: string,
  listed: unknown,
): string | null {
  if (!listed || typeof listed !== "object") return null;
  const data = listed as { roles?: unknown; invitations?: unknown };
  const invitations =
    data.invitations && typeof data.invitations === "object"
      ? (data.invitations as { members_read_all_mail?: unknown })
      : null;
  if (invitations?.members_read_all_mail !== true) return null;
  const roles = Array.isArray(data.roles) ? (data.roles as ListedRole[]) : [];
  const found = roles.find((r) => r.key === role || r.id === role);
  if (found?.mail_scope !== "org") return null;
  const name = typeof found.name === "string" ? found.name : role;
  return `Warning: ${name} reads all of this organization's mail while it uses whole-organization access, so the person given it reads every mailbox. To give them only their own mail, choose a narrower role (see \`primitive roles list\`).`;
}

/** GET /roles, or null when it cannot be read: the warning is then left out rather than guessed. */
export async function readRoles(client: ApiClient): Promise<unknown> {
  try {
    const result = await client.get({
      responseStyle: "fields",
      security: [{ scheme: "bearer", type: "http" }],
      url: "/roles",
    });
    if (result.error) return null;
    return (result.data as { data?: unknown } | undefined)?.data ?? null;
  } catch {
    return null;
  }
}
