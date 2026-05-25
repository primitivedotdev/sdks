import { Command, Errors, Flags } from "@oclif/core";
import type { Account } from "@primitivedotdev/api-core";
import { getAccount } from "@primitivedotdev/api-core";
import { createAuthenticatedCliApiClient } from "../api-client.js";
import {
  API_BASE_URL_1_FLAG_DESCRIPTION,
  API_BASE_URL_2_FLAG_DESCRIPTION,
  extractErrorPayload,
  runWithTiming,
  surfaceUnauthorizedHint,
  TIME_FLAG_DESCRIPTION,
  writeErrorWithHints,
} from "../api-command.js";

// `primitive whoami` is the credentials smoke test. Default output stays
// intentionally sparse so routine auth checks do not expose account internals;
// --json keeps the full account payload available for explicit scripting.

export function formatWhoamiSummary(account: Account): string {
  return [
    `Authenticated as ${account.email}`,
    `Account id: ${account.id}`,
    `Plan: ${account.plan}`,
  ].join("\n");
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
    "api-base-url-1": Flags.string({
      description: API_BASE_URL_1_FLAG_DESCRIPTION,
      env: "PRIMITIVE_API_BASE_URL_1",
      hidden: true,
    }),
    "api-base-url-2": Flags.string({
      description: API_BASE_URL_2_FLAG_DESCRIPTION,
      env: "PRIMITIVE_API_BASE_URL_2",
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
          apiBaseUrl1: flags["api-base-url-1"],
          apiBaseUrl2: flags["api-base-url-2"],
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

      if (flags.json) {
        this.log(JSON.stringify(account, null, 2));
        return;
      }

      this.log(formatWhoamiSummary(account));
    });
  }
}

export default WhoamiCommand;
