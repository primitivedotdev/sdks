import { Command, Errors, Flags } from "@oclif/core";
import { getAccount } from "../../api/generated/sdk.gen.js";
import type { Account } from "../../api/generated/types.gen.js";
import { PrimitiveApiClient } from "../../api/index.js";
import { extractErrorPayload, formatErrorPayload } from "../api-command.js";

// `primitive whoami` is the credentials smoke-test the AGX
// walkthrough kept asking for. Before this command, a user with a
// suspect API key had no fast way to verify "is my key live and
// pointed at the org I expect" short of trying any other call and
// reading a 401. That ambiguity bit two consecutive walkthroughs.
//
// Implementation: thin wrapper over /api/v1/account that prints
// the account email, plan, id, and onboarding status. Any auth
// problem surfaces as the standard error envelope, same as the
// generated commands.

class WhoamiCommand extends Command {
  static description =
    `Print the account currently authenticated by the API key. Useful as a credentials smoke test: confirms the key is live and shows which account it belongs to.`;

  static summary = "Print the authenticated account (credentials smoke test)";

  static examples = [
    "<%= config.bin %> whoami",
    "<%= config.bin %> whoami --api-key prim_...",
  ];

  static flags = {
    "api-key": Flags.string({
      description: "Primitive API key (defaults to PRIMITIVE_API_KEY)",
      env: "PRIMITIVE_API_KEY",
    }),
    "base-url": Flags.string({
      description: "API base URL (defaults to PRIMITIVE_API_URL or production)",
      env: "PRIMITIVE_API_URL",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(WhoamiCommand);

    const apiClient = new PrimitiveApiClient({
      apiKey: flags["api-key"],
      baseUrl: flags["base-url"],
    });

    const result = await getAccount({
      client: apiClient.client,
      responseStyle: "fields",
    });

    if (result.error) {
      const errorPayload = extractErrorPayload(result.error);
      process.stderr.write(`${formatErrorPayload(errorPayload)}\n`);
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

    // Concise human-readable summary on stderr; the full account
    // JSON goes to stdout so a script can pipe it.
    const onboarding =
      account.onboarding_completed === true
        ? "complete"
        : account.onboarding_step
          ? `in progress (step: ${account.onboarding_step})`
          : "incomplete";
    process.stderr.write(`Authenticated as ${account.email}\n`);
    process.stderr.write(`  Account id: ${account.id}\n`);
    process.stderr.write(`  Plan:       ${account.plan}\n`);
    process.stderr.write(`  Onboarding: ${onboarding}\n`);

    this.log(JSON.stringify(account, null, 2));
  }
}

export default WhoamiCommand;
