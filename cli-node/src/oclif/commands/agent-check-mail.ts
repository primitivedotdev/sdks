import { Command, Flags } from "@oclif/core";
import { checkAgentMail, MailCheckApiError } from "../agent-mail-check.js";
import { createAuthenticatedCliApiClient } from "../api-client.js";
import {
  extractErrorPayload,
  surfaceUnauthorizedHint,
  writeErrorWithHints,
} from "../api-command.js";
import { AGENT_PROFILE_ENV } from "../connected-agent-profile.js";

/** npx runs the CLI from its cache; print follow-up commands the same way. */
function invocation(entry: string | undefined): string {
  return entry && /[\\/]_npx[\\/]/.test(entry)
    ? "npx -y primitive@latest"
    : "primitive";
}

export default class AgentCheckMailCommand extends Command {
  static summary = "Check a connected agent's mail since its last check";
  static description =
    `Print the mail that reached the selected connected agent profile since its previous check, oldest first, once, without waiting. This is how an agent connected with poll receiving (no local session ID or hooks, so nothing can wake it) receives mail: run it at the start of each turn and after sending, then read each email with \`primitive emails get --id <id> --brief\`.

Acknowledgements marked fyi and mail in muted threads are left out. Setup and presence mail from the connection's control address is handled by the CLI and only counted. The position is saved privately with the profile and moves forward only after mail was read, so mail is reported again rather than lost when a check fails or is interrupted; deduplicate by email ID. The first check starts before the address's first email. \`more: true\` means more new mail remains: handle these and check again.

Requires a connected agent profile selected with ${AGENT_PROFILE_ENV}. Output is one JSON document: \`outcome\` ("mail" | "empty"), \`emails\` (id, received_at, sender, thread_id; never subject or body), \`more\`, \`control_skipped\` and \`read_command\`.`;
  static examples = [
    `${AGENT_PROFILE_ENV}=connection-0123456789ab <%= config.bin %> agent check-mail --json`,
  ];
  static flags = {
    json: Flags.boolean({ description: "Print JSON (already the default)" }),
  };

  async run(): Promise<void> {
    await this.parse(AgentCheckMailCommand);
    if (!process.env[AGENT_PROFILE_ENV]?.trim()) {
      this.error(
        `Select a connected agent profile with ${AGENT_PROFILE_ENV}=<profile>. The profile is printed by agent connect.`,
        { exit: 1 },
      );
    }
    const { apiClient, auth, baseUrlOverridden } =
      await createAuthenticatedCliApiClient({
        configDir: this.config.configDir,
      });
    if (!auth.connectedAgent) {
      this.error(
        `Select a connected agent profile with ${AGENT_PROFILE_ENV}=<profile>.`,
        { exit: 1 },
      );
    }
    try {
      await checkAgentMail({
        configDir: this.config.configDir,
        identity: auth.connectedAgent,
        client: apiClient,
        invocation: invocation(process.argv[1]),
        emit: (result) => this.log(JSON.stringify(result)),
      });
    } catch (error) {
      if (!(error instanceof MailCheckApiError)) throw error;
      const payload = extractErrorPayload(error.payload);
      writeErrorWithHints(payload);
      surfaceUnauthorizedHint({
        auth,
        baseUrlOverridden,
        configDir: this.config.configDir,
        payload,
      });
      process.exitCode = 1;
    }
  }
}
