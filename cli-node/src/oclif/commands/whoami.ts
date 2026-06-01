import { Command, Errors, Flags } from "@oclif/core";
import type { Account } from "@primitivedotdev/api-core";
import { getAccount, listDomains } from "@primitivedotdev/api-core";
import { createAuthenticatedCliApiClient } from "../api-client.js";
import {
  API_BASE_URL_FLAG_DESCRIPTION,
  extractErrorPayload,
  runWithTiming,
  surfaceUnauthorizedHint,
  TIME_FLAG_DESCRIPTION,
  writeErrorWithHints,
} from "../api-command.js";

// `primitive whoami` is the credentials smoke test. Default output stays
// intentionally sparse so routine auth checks do not expose account internals;
// --json keeps the full account payload available for explicit scripting.
//
// The managed inbox line answers "where do I send mail TO this account?",
// a question the API surfaces nowhere else right now (`account show` does
// not include it). For agents that just completed `verify-agent-signup`,
// it removes the post-signup hunt for the assigned *.primitive.email
// domain that drove the original AGX pain.

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
    `Print the account currently authenticated by saved OAuth credentials or an explicit API key. Useful as a credentials smoke test: confirms auth is live and shows which account it belongs to.

  The default output is a concise human summary. Pass --json only when a script intentionally needs the full /account response.`;

  static summary = "Print the authenticated account (credentials smoke test)";

  static examples = [
    "<%= config.bin %> whoami",
    "<%= config.bin %> whoami --api-key prim_...",
    "<%= config.bin %> whoami --json | jq .id",
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
        "Print the full account JSON response. Default output hides setup and billing internals.",
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
          const envelope = domainsResult.data as
            | {
                data?: Array<{
                  domain: string;
                  managed_zone: string | null;
                  verified: boolean;
                }>;
              }
            | undefined;
          const rows = envelope?.data ?? [];
          const managed = rows.find(
            (row) => row.verified && row.managed_zone !== null,
          );
          managedInboxDomain = managed?.domain ?? null;
        }
      } catch {
        // see comment above; keep going without the inbox line
      }

      if (flags.json) {
        this.log(
          JSON.stringify(
            { ...account, managed_inbox_domain: managedInboxDomain },
            null,
            2,
          ),
        );
        return;
      }

      this.log(formatWhoamiSummary(account, managedInboxDomain));
    });
  }
}

export default WhoamiCommand;
