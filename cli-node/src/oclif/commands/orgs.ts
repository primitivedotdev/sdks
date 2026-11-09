import { Args, Command, Errors, Flags } from "@oclif/core";
import { resolveCliApiRequestConfig } from "../api-client.js";
import { API_BASE_URL_FLAG_DESCRIPTION } from "../api-command.js";
import { loadCliCredentials, type StoredCliCredentials } from "../auth.js";
import { requireDefaultLoginProfile } from "../connected-agent-profile.js";
import {
  type CliOrgEntry,
  CliOrgRefusedError,
  fetchCliOrgs,
  switchCurrentOrg,
} from "../user-grant.js";

const API_BASE_URL_FLAG = Flags.string({
  description: API_BASE_URL_FLAG_DESCRIPTION,
  env: "PRIMITIVE_API_BASE_URL",
  hidden: true,
});

function loadSavedLogin(configDir: string): StoredCliCredentials {
  requireDefaultLoginProfile();
  const credentials = loadCliCredentials(configDir);
  if (!credentials) {
    throw new Errors.CLIError("Not logged in. Run `primitive login` first.", {
      exit: 1,
    });
  }
  return credentials;
}

export type OrgRow = CliOrgEntry & { current: boolean };

/** One line per organization, the current one marked with `*`. */
export function formatOrgRows(rows: readonly OrgRow[]): string {
  if (rows.length === 0) return "You do not belong to any organization.";
  return rows
    .map((row) => {
      const marker = row.current ? "*" : " ";
      const name = row.name ?? "(unnamed)";
      const role = row.role ? ` ${row.role}` : "";
      const status = row.available
        ? "available"
        : `unavailable: ${row.message ?? row.reason ?? "no CLI access"}${row.reason ? ` [${row.reason}]` : ""}`;
      return `${marker} ${name} (${row.id})${role}, ${status}`;
    })
    .join("\n");
}

export class OrgsCommand extends Command {
  static description =
    `List the organizations you can switch the CLI to, with your role and whether the CLI may be used there. The current organization is marked with *.

  Needs a login made with \`primitive login\` as yourself. A login bound to one organization (from an older CLI or a server without organization switching) lists only that organization.`;

  static summary = "List your organizations and CLI availability";

  static examples = ["<%= config.bin %> orgs", "<%= config.bin %> orgs --json"];

  static flags = {
    "api-base-url": API_BASE_URL_FLAG,
    json: Flags.boolean({ description: "Print the organizations as JSON." }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(OrgsCommand);
    const credentials = loadSavedLogin(this.config.configDir);
    if (credentials.auth_method !== "user_grant") {
      const row: OrgRow = {
        available: true,
        current: true,
        id: credentials.org_id,
        name: credentials.org_name,
        reason: null,
      };
      if (flags.json) {
        this.log(
          JSON.stringify(
            { login: "org_bound", orgs: [row], user: null },
            null,
            2,
          ),
        );
        return;
      }
      this.log(formatOrgRows([row]));
      process.stderr.write(
        "This saved login is bound to one organization. Run `primitive logout`, then `primitive login`, to sign in as yourself and switch between organizations.\n",
      );
      return;
    }
    const requestConfig = resolveCliApiRequestConfig({
      apiBaseUrl: flags["api-base-url"],
      configDir: this.config.configDir,
    });
    const list = await fetchCliOrgs({
      apiBaseUrl: credentials.api_base_url,
      configDir: this.config.configDir,
      credentials,
      headers: requestConfig.headers,
    });
    const current = credentials.org_id.toLowerCase();
    const rows: OrgRow[] = list.orgs.map((org) => ({
      ...org,
      current: org.id.toLowerCase() === current,
    }));
    if (flags.json) {
      this.log(
        JSON.stringify(
          {
            login: "user",
            orgs: rows,
            user: list.user,
            user_grant_id: list.user_grant_id,
          },
          null,
          2,
        ),
      );
      return;
    }
    this.log(formatOrgRows(rows));
  }
}

export class OrgUseCommand extends Command {
  static description =
    `Switch the CLI to another of your organizations without logging in again. Matches an organization id or an exact name from \`primitive orgs\`.

  Later commands act in that organization. To act in another organization for one command only, pass --org <org> to it instead.`;

  static summary = "Switch the CLI to another organization";

  static examples = [
    "<%= config.bin %> org use acme",
    "<%= config.bin %> org use 00000000-0000-4000-8000-000000000000",
  ];

  static args = {
    org: Args.string({
      description: "Organization id or name.",
      required: true,
    }),
  };

  static flags = {
    "api-base-url": API_BASE_URL_FLAG,
    json: Flags.boolean({ description: "Print the new current organization." }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(OrgUseCommand);
    const credentials = loadSavedLogin(this.config.configDir);
    if (credentials.auth_method !== "user_grant") {
      const wanted = args.org.trim().toLowerCase();
      if (
        wanted === credentials.org_id.toLowerCase() ||
        wanted === (credentials.org_name ?? "").toLowerCase()
      ) {
        this.log(
          `Already using ${credentials.org_name ?? credentials.org_id} (${credentials.org_id}).`,
        );
        return;
      }
      throw new Errors.CLIError(
        "This saved login is bound to one organization. Run `primitive logout`, then `primitive login`, to sign in as yourself and switch between organizations.",
        { exit: 1 },
      );
    }
    const requestConfig = resolveCliApiRequestConfig({
      apiBaseUrl: flags["api-base-url"],
      configDir: this.config.configDir,
    });
    try {
      const { org } = await switchCurrentOrg({
        apiBaseUrl: credentials.api_base_url,
        configDir: this.config.configDir,
        headers: requestConfig.headers,
        selection: args.org,
      });
      if (flags.json) {
        this.log(
          JSON.stringify(
            { org_id: org.org_id, org_name: org.org_name, role: org.role },
            null,
            2,
          ),
        );
        return;
      }
      this.log(
        `Now using ${org.org_name ?? org.org_id} (${org.org_id}), role ${org.role ?? "unknown"}.`,
      );
    } catch (error) {
      if (error instanceof CliOrgRefusedError) {
        throw new Errors.CLIError(
          `Cannot switch to ${args.org}: ${error.message} [${error.reason}]`,
          { code: error.reason, exit: 1 },
        );
      }
      throw error;
    }
  }
}
