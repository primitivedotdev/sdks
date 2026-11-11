import process from "node:process";
import { createInterface } from "node:readline/promises";
import { Command, Flags } from "@oclif/core";
import { startAgentClaim, verifyAgentClaim } from "@primitivedotdev/api-core";
import { createAuthenticatedCliApiClient } from "../api-client.js";
import { extractErrorPayload, writeErrorWithHints } from "../api-command.js";

/**
 * Interactive upgrade of an emailless agent account to a full developer
 * account: starts the email claim, prompts for the emailed code, and verifies
 * it. Combines the generated `agent:claim` (start) and `agent:claim-verify`
 * into one flow with a prompt, mirroring the `signup` interactive command.
 * Authenticated by the agent's own API key (the org is taken from the key).
 */
export default class AgentUpgradeCommand extends Command {
  static description =
    "Upgrade an emailless agent account to a full developer account by confirming an email. Authenticated by the agent's own API key (PRIMITIVE_API_KEY). Upgrading raises the send cap and grants the developer plan's default features (such as Functions). It does not unlock sending to arbitrary recipients: the account's recipient rules still apply (see `primitive sending permissions`). It emails a code and asks for it, so it needs a terminal; without one, use `primitive agent claim` and `primitive agent claim-verify`.";

  static summary =
    "Upgrade an agent account to developer by email code (needs a terminal)";

  static examples = ["<%= config.bin %> agent upgrade --email you@example.com"];

  static flags = {
    email: Flags.string({
      description: "Email to confirm. Prompted if omitted or blank.",
    }),
    code: Flags.string({
      description:
        "Not accepted; for a code you already have, use `primitive agent claim-verify --verification-code <code>`. This command emails a new code, which replaces any code sent before.",
    }),
    "api-key": Flags.string({
      env: "PRIMITIVE_API_KEY",
      description:
        "Agent API key (defaults to PRIMITIVE_API_KEY or saved credentials).",
    }),
    "api-base-url": Flags.string({
      description: "Override the API base URL.",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(AgentUpgradeCommand);
    const email = flags.email?.trim() || undefined;
    // This run emails a new code and then asks for it, and each start
    // replaces the code sent before, so a code passed in up front can never
    // be the one this run sends; submitting it would only void it.
    if (flags.code !== undefined) {
      this.error(
        "Not upgrading: --code cannot be used here, because `primitive agent upgrade` emails a new code, which replaces the one you have. To use the code you have, run `primitive agent claim-verify --verification-code <code>`.",
        { exit: 2 },
      );
    }
    // Without a terminal to type the new code in, nothing here can finish:
    // refuse before anything is sent.
    if (!(process.stdin.isTTY && process.stderr.isTTY)) {
      this.error(
        `Not upgrading: \`primitive agent upgrade\` emails a code and asks for it, so it needs a terminal. Without one, run \`primitive agent claim --email ${email ?? "<address>"}\` to send the code, then \`primitive agent claim-verify --verification-code <code>\`.`,
        { exit: 2 },
      );
    }
    const { apiClient } = await createAuthenticatedCliApiClient({
      apiKey: flags["api-key"],
      apiBaseUrl: flags["api-base-url"],
      configDir: this.config.configDir,
    });

    const address = email ?? (await promptRequired("Email to confirm: "));
    const started = await startAgentClaim({
      body: { email: address },
      client: apiClient.client,
      responseStyle: "fields",
    });
    if (!started.data) {
      writeErrorWithHints(extractErrorPayload(started.error));
      this.exit(1);
      return;
    }
    process.stderr.write(`Verification code sent to ${address}.\n`);

    const code = await promptRequired("Verification code: ");
    const verified = await verifyAgentClaim({
      body: { verification_code: code },
      client: apiClient.client,
      responseStyle: "fields",
    });
    const result = verified.data?.data;
    if (result) {
      this.log(JSON.stringify(result, null, 2));
      process.stderr.write(
        `Upgraded to ${result.plan}. Your API key and managed inbox carry over; the send cap is lifted. Recipient rules still apply: run \`primitive sending permissions\` to see who this account can send to.\n`,
      );
      return;
    }
    writeErrorWithHints(extractErrorPayload(verified.error));
    this.exit(1);
  }
}

// Prompt on stderr (so piping stdout stays clean) until a non-empty answer.
async function promptRequired(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  try {
    for (;;) {
      const answer = (await rl.question(question)).trim();
      if (answer) return answer;
    }
  } finally {
    rl.close();
  }
}
