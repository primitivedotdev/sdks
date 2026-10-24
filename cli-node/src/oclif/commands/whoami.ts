import { Command, Errors, Flags } from "@oclif/core";
import type {
  Account,
  CallerIdentity,
  GrantDescription,
  PermissionCheck,
} from "@primitivedotdev/api-core";
import { getAccount, listDomains } from "@primitivedotdev/api-core";
import { receiverStatusCommand } from "../agent-connect.js";
import { cliInvocation } from "../agent-identity-suggestions.js";
import { createAuthenticatedCliApiClient } from "../api-client.js";
import {
  API_BASE_URL_FLAG_DESCRIPTION,
  extractErrorPayload,
  runWithTiming,
  surfaceUnauthorizedHint,
  TIME_FLAG_DESCRIPTION,
  writeErrorWithHints,
} from "../api-command.js";
import { isConnectedChatCredential } from "../scoped-chat.js";
import { agentIdentitySource } from "../session-agent-env.js";

// `primitive whoami` is the credentials smoke test. Default output stays
// intentionally sparse so routine auth checks do not expose account internals;
// --json keeps the full account payload available for explicit scripting.
//
// The managed inbox line answers "where do I send mail TO this account?",
// a question the API surfaces nowhere else right now (`account show` does
// not include it). For agents that just completed `verify-agent-signup`,
// it removes the post-signup hunt for the assigned *.primitive.email
// domain that drove the original AGX pain.

type GeneratedApiClient = Awaited<
  ReturnType<typeof createAuthenticatedCliApiClient>
>["apiClient"]["client"];

/**
 * `GET /whoami` with its grant query parameters. The spec describes them
 * without declaring them, so they are sent directly. A server without grants
 * ignores them and answers without `grant` or `check`.
 */
export async function fetchCallerIdentity(
  client: GeneratedApiClient,
  query: Record<string, string>,
): Promise<{ identity: CallerIdentity | null; error: unknown }> {
  const result = await client.get<
    { 200: { success: true; data: CallerIdentity } },
    unknown,
    false
  >({
    query,
    responseStyle: "fields",
    security: [{ scheme: "bearer", type: "http" }],
    url: "/whoami",
  });
  if (result.error) return { identity: null, error: result.error };
  const identity =
    (result.data as { data?: CallerIdentity } | undefined)?.data ?? null;
  return { identity, error: null };
}

/** Lines describing the caller's organization, role and grant. */
export function formatGrantLines(
  identity: CallerIdentity,
  options: { orgName?: string | null; userLogin?: boolean } = {},
): string[] {
  const lines: string[] = [];
  const org = options.orgName
    ? `${options.orgName} (${identity.org_id})`
    : identity.org_id;
  lines.push(`Organization: ${org}`);
  lines.push(`Role: ${identity.role}`);
  const grant = identity.grant as GrantDescription | null | undefined;
  if (grant) {
    const what = grant.template
      ? `template ${grant.template}`
      : `${grant.grant_type ?? "grant"} with ${grant.permissions.length} permissions`;
    const scope =
      grant.mail_scope === "org" || grant.mail_scope === undefined
        ? "all mail in the organization"
        : "a narrowed mail scope";
    lines.push(`Grant: ${what}, ${scope} (${grant.credential_kind})`);
    if (grant.expires_at) lines.push(`Credential expires: ${grant.expires_at}`);
  }
  if (options.userLogin) {
    lines.push(
      "Signed in as yourself. Switch organizations with `primitive org use <org>`.",
    );
  }
  return lines;
}

export function formatPermissionCheck(check: PermissionCheck): string {
  if (check.allow) return `${check.permission}: allowed`;
  return `${check.permission}: not allowed${check.reason ? ` (${check.reason})` : ""}`;
}

export function formatWhoamiSummary(
  account: Account,
  managedInboxDomain: string | null,
): string {
  const lines = [
    `Authenticated as ${account.email}`,
    `Account id: ${account.id}`,
    `Plan: ${account.plan}`,
  ];
  if (managedInboxDomain) {
    lines.push(`Managed inbox: any-local-part@${managedInboxDomain}`);
  }
  return lines.join("\n");
}

class WhoamiCommand extends Command {
  static description =
    `Print the account currently authenticated by saved OAuth credentials or an explicit API key. For account credentials this is a live credentials smoke test. Use account whoami for the authenticated caller, their assigned member address and an address suggestion; account provision-member-address --address <email> saves your chosen personal address.

  With PRIMITIVE_AGENT_PROFILE selected, print the saved connected-agent identity offline, with no API call. The first line is the agent's email address alone; --json adds address, profile and source (session_hook when the selected profile is this Claude Code session's own agent exported by the session start hook, env otherwise). This does not verify live authentication, app pairing, or listener readiness. Inspect the receiver separately: the output names the command for the profile's receiver mode (agent connect --status for Claude hook and poll receivers, listen --status --notify-session for a native listener).

  The default output is a concise human summary. Pass --json for the full /account response or the explicit offline connected-agent identity envelope.`;

  static summary = "Print the live account or saved connected-agent identity";

  static examples = [
    "<%= config.bin %> whoami",
    "<%= config.bin %> whoami --api-key prim_...",
    "<%= config.bin %> whoami --json | jq .id",
    "PRIMITIVE_AGENT_PROFILE=work <%= config.bin %> whoami --json",
  ];

  static flags = {
    "api-key": Flags.string({
      description:
        "Primitive API key override (defaults to PRIMITIVE_API_KEY or saved OAuth login credentials)",
      env: "PRIMITIVE_API_KEY",
    }),
    "api-base-url": Flags.string({
      description: API_BASE_URL_FLAG_DESCRIPTION,
      env: "PRIMITIVE_API_BASE_URL",
      hidden: true,
    }),
    json: Flags.boolean({
      description:
        "Print the account JSON response, or the saved connected identity marked verification: offline. Never prints credentials.",
    }),
    grant: Flags.boolean({
      description:
        "With --json, add `grant`: the organization, role and grant of this credential. The summary always shows them when the server reports them.",
    }),
    check: Flags.string({
      description:
        "Ask whether this credential may use a permission, such as mail:send. Prints the decision and exits 1 when it is not allowed. Nothing is enforced by asking.",
    }),
    resource: Flags.string({
      description:
        "With --check, the resource to check against, as function:<id>, domain:<id>, endpoint:<id> or route:<id>.",
      dependsOn: ["check"],
    }),
    time: Flags.boolean({
      description: TIME_FLAG_DESCRIPTION,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(WhoamiCommand);

    await runWithTiming(flags.time, async () => {
      const { apiClient, auth, baseUrlOverridden } =
        await createAuthenticatedCliApiClient({
          apiKey: flags["api-key"],
          apiBaseUrl: flags["api-base-url"],
          configDir: this.config.configDir,
        });

      if (auth.connectedAgent && flags.check !== undefined) {
        throw new Errors.CLIError(
          "--check needs a live account credential. A selected connected-agent profile is shown offline; rerun with `PRIMITIVE_AGENT_PROFILE=` in front of the command to check the member login.",
          { exit: 1 },
        );
      }
      if (auth.connectedAgent) {
        const identity = auth.connectedAgent;
        const statusCommand = `${cliInvocation(process.argv[1])} agent connect --profile ${identity.profileName} --status --json`;
        const receiver = receiverStatusCommand(
          this.config.configDir,
          identity.profileName,
        );
        const guidance = `Saved identity only. Live authentication, app pairing, and receiving readiness are not verified. Inspect the ${
          receiver.mode === "external"
            ? "Claude hook receiver"
            : receiver.mode === "poll"
              ? "poll receiver"
              : "receiver"
        } with \`${receiver.command}\`.`;
        const source = agentIdentitySource(identity);
        const selectedBy =
          source === "session_hook"
            ? `this Claude Code session's start hook (PRIMITIVE_AGENT_PROFILE=${identity.profileName})`
            : `PRIMITIVE_AGENT_PROFILE=${identity.profileName}`;
        this.log(
          flags.json
            ? JSON.stringify(
                {
                  address: identity.agentAddress,
                  profile: identity.profileName,
                  source,
                  auth_method: "agent_connection",
                  verification: "offline",
                  identity,
                  status_command: statusCommand,
                  guidance,
                },
                null,
                2,
              )
            : `${identity.agentAddress}\nSelected by: ${selectedBy}. Prefix a command with \`PRIMITIVE_AGENT_PROFILE=\` to run it as the member login instead.\nSaved connected-agent profile: ${identity.profileName}\nAgent address: ${identity.agentAddress}\nOwner personal address (send reports here): ${identity.ownerMemberAddress ?? "unknown; reply to the member who wrote to you"}\nControl address (setup and presence only): ${identity.ownerAddress}\nAPI origin: ${identity.apiBaseUrl}\n${guidance}\nSaved profile status: ${statusCommand}`,
        );
        return;
      }
      if (isConnectedChatCredential(auth.apiKey)) {
        throw new Errors.CLIError(
          "This connection credential cannot inspect an account. Select its saved profile with PRIMITIVE_AGENT_PROFILE to inspect the connected identity offline.",
          { exit: 1 },
        );
      }

      if (flags.check !== undefined) {
        const check = flags.check.trim();
        if (!/^[a-z][a-z0-9_.]*:[a-z][a-z0-9_]*$/.test(check)) {
          throw new Errors.CLIError(
            `--check ${JSON.stringify(flags.check)} is not a permission. Permissions look like \`mail:send\`.`,
            { exit: 2 },
          );
        }
        const { identity, error } = await fetchCallerIdentity(
          apiClient.client,
          {
            check,
            ...(flags.resource ? { resource: flags.resource.trim() } : {}),
          },
        );
        if (error) {
          const errorPayload = extractErrorPayload(error);
          writeErrorWithHints(errorPayload);
          surfaceUnauthorizedHint({
            auth,
            baseUrlOverridden,
            configDir: this.config.configDir,
            payload: errorPayload,
          });
          process.exitCode = 1;
          return;
        }
        const decision = identity?.check;
        if (!decision) {
          throw new Errors.CLIError(
            "This Primitive server does not answer permission checks.",
            { exit: 1 },
          );
        }
        this.log(
          flags.json
            ? JSON.stringify(decision, null, 2)
            : formatPermissionCheck(decision),
        );
        if (!decision.allow) process.exitCode = 1;
        return;
      }

      const result = await getAccount({
        client: apiClient.client,
        responseStyle: "fields",
      });

      if (result.error) {
        const errorPayload = extractErrorPayload(result.error);
        writeErrorWithHints(errorPayload);
        surfaceUnauthorizedHint({
          auth,
          baseUrlOverridden,
          configDir: this.config.configDir,
          payload: errorPayload,
        });
        process.exitCode = 1;
        return;
      }

      const envelope = result.data as { data?: Account } | undefined;
      const account = envelope?.data;
      if (!account) {
        process.stderr.write(
          "Server returned an empty account body; this should not happen for a valid key.\n",
        );
        throw new Errors.CLIError("unexpected empty response");
      }

      // Best-effort managed inbox lookup. Failure here MUST NOT take
      // whoami down: it is the credentials smoke test and people rely
      // on the exit code. If domains can't be listed (network blip,
      // brand-new account with no rows yet, an entitlement gate landing
      // here later), we silently drop the inbox line and let the
      // primary auth check stand.
      let managedInboxDomain: string | null = null;
      try {
        const domainsResult = await listDomains({
          client: apiClient.client,
          responseStyle: "fields",
        });
        if (!domainsResult.error) {
          // listDomains has no queryParams in the operation manifest:
          // the server returns the full domain set in one response, no
          // pagination cursor to follow. (Confirmed against
          // packages/api-core/src/openapi/operations.generated.ts.) So
          // a single fetch is the full set, and rows.find covers any
          // managed zone the account owns.
          const domainsEnvelope = domainsResult.data as
            | {
                data?: Array<{
                  domain: string;
                  managed_zone: string | null;
                  verified: boolean;
                }>;
              }
            | undefined;
          const rows = domainsEnvelope?.data ?? [];
          const managed = rows.find(
            (row) => row.verified && row.managed_zone !== null,
          );
          managedInboxDomain = managed?.domain ?? null;
        }
      } catch {
        // see comment above; keep going without the inbox line
      }

      // Best effort, like the managed inbox: the organization, role and
      // grant. An older server answers without `grant`; any failure only
      // drops these lines.
      // Skipped for --json without --grant, whose output does not use it.
      let identity: CallerIdentity | null = null;
      if (!flags.json || flags.grant) {
        try {
          identity = (
            await fetchCallerIdentity(apiClient.client, { include: "grant" })
          ).identity;
        } catch {
          identity = null;
        }
      }

      if (flags.json) {
        this.log(
          JSON.stringify(
            {
              ...account,
              managed_inbox_domain: managedInboxDomain,
              ...(flags.grant
                ? {
                    grant: identity?.grant ?? null,
                    org_id: identity?.org_id ?? null,
                    role: identity?.role ?? null,
                  }
                : {}),
            },
            null,
            2,
          ),
        );
        return;
      }

      const summary = [formatWhoamiSummary(account, managedInboxDomain)];
      // Only where the server reports a grant, so the summary from a server
      // without grants reads exactly as before.
      if (identity?.grant) {
        summary.push(
          ...formatGrantLines(identity, {
            orgName: auth.credentials?.org_name ?? null,
            userLogin: auth.credentials?.auth_method === "user_grant",
          }),
        );
      }
      this.log(summary.join("\n"));
    });
  }
}

export default WhoamiCommand;
