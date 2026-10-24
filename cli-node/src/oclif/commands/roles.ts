import { Command, Flags } from "@oclif/core";
import {
  type AccessMode,
  type GroupList,
  getAccessMode,
  listGroups,
  listMailboxAccess,
  listRoles,
  type MailboxAccessList,
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

export function formatAccessMode(mode: AccessMode): string {
  return `Access mode: ${mode.mode} (version ${mode.version}${mode.changed_at ? `, changed ${mode.changed_at}` : ""}).`;
}

export class RolesListCommand extends Command {
  static description =
    "List the organization's roles (built-in, template and custom) with their permission counts, the templates that can be assigned, and whether role assignment is available.";

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
