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
    "Upgrade an emailless agent account to a full developer account by confirming an email. Authenticated by the agent's own API key (PRIMITIVE_API_KEY).";

  static summary = "Upgrade an agent account to developer (email confirmation)";

  static examples = ["<%= config.bin %> agent upgrade --email you@example.com"];

  static flags = {
    email: Flags.string({
      description: "Email to confirm. Prompted if omitted.",
    }),
    code: Flags.string({
      description: "Verification code from the email. Prompted if omitted.",
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
    const { apiClient } = await createAuthenticatedCliApiClient({
      apiKey: flags["api-key"],
      apiBaseUrl: flags["api-base-url"],
      configDir: this.config.configDir,
    });

    const email = flags.email ?? (await promptRequired("Email to confirm: "));
    const started = await startAgentClaim({
      body: { email },
      client: apiClient.client,
      responseStyle: "fields",
    });
    if (!started.data) {
      writeErrorWithHints(extractErrorPayload(started.error));
      this.exit(1);
      return;
    }
    process.stderr.write(`Verification code sent to ${email}.\n`);

    const code = flags.code ?? (await promptRequired("Verification code: "));
    const verified = await verifyAgentClaim({
      body: { verification_code: code },
      client: apiClient.client,
      responseStyle: "fields",
    });
    const result = verified.data?.data;
    if (result) {
      this.log(JSON.stringify(result, null, 2));
      process.stderr.write(
        `Upgraded to ${result.plan}. Your API key and managed inbox carry over; the send cap is lifted.\n`,
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
