import { Args, Command, Errors, Flags } from "@oclif/core";
import {
  AGENT_NAME_MAX_LENGTH,
  AgentRenameApiError,
  AgentRenameUnsupportedError,
  agentDisplayName,
  renameAgentConnection,
  renameTarget,
} from "../agent-rename.js";
import { createAuthenticatedCliApiClient } from "../api-client.js";
import {
  API_BASE_URL_FLAG_DESCRIPTION,
  extractErrorPayload,
  runWithTiming,
  surfaceUnauthorizedHint,
  TIME_FLAG_DESCRIPTION,
  writeErrorWithHints,
} from "../api-command.js";

export default class AgentRenameCommand extends Command {
  static summary = "Change an agent's display name";
  static description =
    `Set the display name people see for an agent connection. Only the name changes: the address, credentials, mail and notes stay the same. A connected profile renames its own address; an owner login passes --address. The name is trimmed and must be 1-${AGENT_NAME_MAX_LENGTH} characters on one line without control characters. Offer a new name to your owner before renaming.`;
  static examples = [
    '<%= config.bin %> agent rename "Billing reviewer"',
    '<%= config.bin %> agent rename "Billing reviewer" --address agent@example.com --json',
  ];
  static args = {
    name: Args.string({
      description: `New display name, 1-${AGENT_NAME_MAX_LENGTH} characters`,
      required: true,
    }),
  };
  static flags = {
    address: Flags.string({
      description:
        "Address to rename. A connected profile defaults to, and can rename only, its own address; owner logins must pass it.",
    }),
    json: Flags.boolean({ description: "Print the result as JSON" }),
    "api-key": Flags.string({
      description: "API key override",
      env: "PRIMITIVE_API_KEY",
    }),
    "api-base-url": Flags.string({
      description: API_BASE_URL_FLAG_DESCRIPTION,
      env: "PRIMITIVE_API_BASE_URL",
      hidden: true,
    }),
    time: Flags.boolean({ description: TIME_FLAG_DESCRIPTION }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(AgentRenameCommand);
    const name = agentDisplayName(args.name);
    const { apiClient, auth, baseUrlOverridden } =
      await createAuthenticatedCliApiClient({
        configDir: this.config.configDir,
        apiKey: flags["api-key"],
        apiBaseUrl: flags["api-base-url"],
      });
    await runWithTiming(flags.time, async () => {
      const address = renameTarget(
        flags.address,
        auth.connectedAgent?.agentAddress,
      );
      try {
        const connection = await renameAgentConnection(apiClient.client, {
          address,
          name,
        });
        if (flags.json) this.log(JSON.stringify({ connection }, null, 2));
        else
          this.log(
            `Renamed ${connection.address} to "${connection.name}". The address is unchanged.`,
          );
      } catch (error) {
        if (error instanceof AgentRenameUnsupportedError)
          throw new Errors.CLIError(error.message, { exit: 1 });
        if (!(error instanceof AgentRenameApiError)) throw error;
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
    });
  }
}
