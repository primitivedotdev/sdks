import { Command, Flags } from "@oclif/core";
import {
  type AccessMode,
  type GroupList,
  getAccessMode,
  listGroups,
  listMailboxAccess,
  listOrganizationPeople,
  listRoles,
  type MailboxAccessList,
  type ProjectsListOrganizationPeopleResult,
  type RoleList,
} from "@primitivedotdev/api-core";
import { createAuthenticatedCliApiClient } from "../api-client.js";
import {
  API_BASE_URL_FLAG_DESCRIPTION,
  extractErrorPayload,
  surfaceUnauthorizedHint,
  writeErrorWithHints,
} from "../api-command.js";

// Read-only views of roles, groups, mailbox access and the access mode.
// Changing any of them stays in the dashboard. A server where roles are not
// enabled answers 404 feature_disabled, which these commands print.

const SHARED_FLAGS = {
  "api-key": Flags.string({
    description:
      "Primitive API key override (defaults to PRIMITIVE_API_KEY or saved login credentials)",
    env: "PRIMITIVE_API_KEY",
  }),
  "api-base-url": Flags.string({
    description: API_BASE_URL_FLAG_DESCRIPTION,
    env: "PRIMITIVE_API_BASE_URL",
    hidden: true,
  }),
  json: Flags.boolean({ description: "Print the response data as JSON." }),
};

type SharedFlags = {
  "api-key"?: string;
  "api-base-url"?: string;
  json?: boolean;
};

type ReadResult = { data?: unknown; error?: unknown };

async function runRead<T>(
  command: Command,
  flags: SharedFlags,
  read: (
    client: Awaited<
      ReturnType<typeof createAuthenticatedCliApiClient>
    >["apiClient"]["client"],
  ) => Promise<ReadResult>,
  format: (data: T) => string,
  after?: (data: T) => void,
): Promise<void> {
  const { apiClient, auth, baseUrlOverridden } =
    await createAuthenticatedCliApiClient({
      apiKey: flags["api-key"],
      apiBaseUrl: flags["api-base-url"],
      configDir: command.config.configDir,
    });
  const result = await read(apiClient.client);
  if (result.error) {
    const payload = extractErrorPayload(result.error);
    writeErrorWithHints(payload);
    surfaceUnauthorizedHint({
      auth,
      baseUrlOverridden,
      configDir: command.config.configDir,
      payload,
    });
    process.exitCode = 1;
    return;
  }
  const data = (result.data as { data?: T } | undefined)?.data as T;
  command.log(flags.json ? JSON.stringify(data, null, 2) : format(data));
  if (!flags.json) after?.(data);
}

export function formatRoles(list: RoleList): string {
  const lines = list.roles.map(
    (role) =>
      `${role.key}  ${role.kind}  ${role.name}  ${role.permissions.length} permissions${role.kind === "custom" ? `  (${role.id})` : ""}`,
  );
  if (list.templates.length > 0) {
    lines.push(
      "",
      "Templates:",
      ...list.templates.map(
        (template) =>
          `${template.key}  ${template.name}  ${template.permissions.length} permissions`,
      ),
    );
  }
  lines.push(
    "",
    list.assignment.available
      ? "Role assignment is available."
      : `Role assignment is not available${list.assignment.reason ? ` (${list.assignment.reason})` : ""}.`,
  );
  return lines.join("\n");
}

export function formatGroups(list: GroupList): string {
  if (list.groups.length === 0) return "No groups.";
  return list.groups
    .map(
      (group) =>
        `${group.id}  ${group.name}  ${group.members.length} members  role ${group.role_id ?? "none"}`,
    )
    .join("\n");
}

export function formatMailboxAccess(list: MailboxAccessList): string {
  if (list.entries.length === 0) return "No mailbox access entries.";
  return list.entries.map((entry) => JSON.stringify(entry)).join("\n");
}

// Terminal control characters (C0 and DEL), built from code points so the
// pattern holds no literal control character. A member's name is theirs to
// write, so one holding a line break or an escape code cannot fake a line.
const CONTROL_CHARACTERS = new RegExp(
  `[${String.fromCharCode(0)}-${String.fromCharCode(31)}${String.fromCharCode(127)}]`,
  "g",
);

function printable(text: string): string {
  return text.replace(CONTROL_CHARACTERS, " ");
}

/**
 * What a member's access lets them do with mail, from mail_access: shown to
 * a caller who can list members, and absent when it could not be read.
 */
function mailAccessText(person: object): string {
  const access = (person as { mail_access?: unknown }).mail_access;
  if (!access || typeof access !== "object") return "";
  const { read, send } = access as { read?: unknown; send?: unknown };
  if (typeof read !== "boolean" || typeof send !== "boolean") return "";
  if (read && send) return "  mail: read and send";
  if (read) return "  mail: read only";
  if (send) return "  mail: send only";
  return "  mail: none";
}

export function formatMembers(
  list: ProjectsListOrganizationPeopleResult,
): string {
  if (list.items.length === 0) return "No members.";
  return list.items
    .map((person) => {
      // role_name is the label the dashboard shows ("Admin", or a template
      // or custom role such as "Finance reviewer (custom)").
      const role = printable(person.role_name || person.role);
      const agents =
        person.agents.length > 0
          ? `  ${person.agents.length} agent${person.agents.length === 1 ? "" : "s"}`
          : "";
      return `${printable(person.name)}  ${person.work_email ?? "no work email"}  ${role}  ${person.user_id}${agents}${mailAccessText(person)}`;
    })
    .join("\n");
}

export function formatAccessMode(mode: AccessMode): string {
  return `Access mode: ${mode.mode} (version ${mode.version}${mode.changed_at ? `, changed ${mode.changed_at}` : ""}).`;
}

export class RolesListCommand extends Command {
  static description =
    "List the organization's roles (built-in, template and custom) with their permission counts, the templates that can be assigned, and whether role assignment is available. The built-in roles are owner, admin, operator and member; operator has every permission admin has except managing members, changing roles, sending invitations and billing.";

  static summary = "List roles";

  static examples = [
    "<%= config.bin %> roles list",
    "<%= config.bin %> roles list --json",
  ];

  static flags = SHARED_FLAGS;

  async run(): Promise<void> {
    const { flags } = await this.parse(RolesListCommand);
    await runRead<RoleList>(
      this,
      flags,
      (client) => listRoles({ client, responseStyle: "fields" }),
      formatRoles,
    );
  }
}

export class RolesMembersCommand extends Command {
  static description =
    "List the organization's members with their roles: name, work email, role, user id, how many directory agents each has, and what their access lets them do with mail (read, send, both or none), where you can see it. Use it to see each member's role before you ask someone for something, for example before sending an email rule request. With --json, prints the response data, including each member's role key, role id, agents and the next page's cursor.";

  static summary = "List members and their roles";

  static examples = [
    "<%= config.bin %> roles members",
    "<%= config.bin %> roles members --query alice",
    "<%= config.bin %> members list --json",
  ];

  static flags = {
    ...SHARED_FLAGS,
    query: Flags.string({
      description:
        "Only members whose name, or email where you can see it, contains this text.",
    }),
    limit: Flags.integer({
      description: "Members per page, 1 to 100 (default 50).",
      min: 1,
      max: 100,
    }),
    cursor: Flags.string({
      description:
        "The next page's cursor: printed on stderr as `next cursor: <value>`, or `cursor` with --json.",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(RolesMembersCommand);
    const query = {
      ...(flags.query ? { query: flags.query } : {}),
      ...(flags.limit ? { limit: flags.limit } : {}),
      ...(flags.cursor ? { cursor: flags.cursor } : {}),
    };
    await runRead<ProjectsListOrganizationPeopleResult>(
      this,
      flags,
      (client) =>
        listOrganizationPeople({ client, query, responseStyle: "fields" }),
      formatMembers,
      (list) => {
        if (list.cursor) process.stderr.write(`next cursor: ${list.cursor}\n`);
      },
    );
  }
}

export class RolesGroupsCommand extends Command {
  static description =
    "List groups of members, with their member counts and roles.";

  static summary = "List groups";

  static examples = ["<%= config.bin %> roles groups"];

  static flags = SHARED_FLAGS;

  async run(): Promise<void> {
    const { flags } = await this.parse(RolesGroupsCommand);
    await runRead<GroupList>(
      this,
      flags,
      (client) => listGroups({ client, responseStyle: "fields" }),
      formatGroups,
    );
  }
}

export class RolesMailboxAccessCommand extends Command {
  static description =
    "List every mailbox and domain access entry (delegation) in the organization, one JSON object per line.";

  static summary = "List mailbox access entries";

  static examples = ["<%= config.bin %> roles mailbox-access --json"];

  static flags = SHARED_FLAGS;

  async run(): Promise<void> {
    const { flags } = await this.parse(RolesMailboxAccessCommand);
    await runRead<MailboxAccessList>(
      this,
      flags,
      (client) => listMailboxAccess({ client, responseStyle: "fields" }),
      formatMailboxAccess,
    );
  }
}

export class RolesAccessModeCommand extends Command {
  static description =
    "Show whether mailbox access follows the whole organization or explicit delegations. --json includes the switch preview owners and admins see.";

  static summary = "Show the organization access mode";

  static examples = ["<%= config.bin %> roles access-mode"];

  static flags = SHARED_FLAGS;

  async run(): Promise<void> {
    const { flags } = await this.parse(RolesAccessModeCommand);
    await runRead<AccessMode>(
      this,
      flags,
      (client) => getAccessMode({ client, responseStyle: "fields" }),
      formatAccessMode,
    );
  }
}
