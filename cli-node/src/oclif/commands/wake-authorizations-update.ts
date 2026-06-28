import { Args, Command, Flags } from "@oclif/core";
import { updateWakeAuthorization } from "@primitivedotdev/api-core";
import { createAuthenticatedCliApiClient } from "../api-client.js";
import {
  API_BASE_URL_FLAG_DESCRIPTION,
  extractErrorPayload,
  runWithTiming,
  surfaceUnauthorizedHint,
  TIME_FLAG_DESCRIPTION,
  writeErrorWithHints,
} from "../api-command.js";

class WakeAuthorizationsUpdateCommand extends Command {
  static description = "Toggle a wake authorization's enabled state.";

  static summary = "Update a wake authorization";

  static examples = [
    "<%= config.bin %> wake authorizations update <authorization-id> --disabled",
  ];

  static args = {
    id: Args.string({
      description: "Wake authorization id (UUID)",
      required: true,
    }),
  };

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
    time: Flags.boolean({ description: TIME_FLAG_DESCRIPTION }),
    enabled: Flags.boolean({
      description: "Enable the authorization",
      allowNo: true,
      default: true,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(WakeAuthorizationsUpdateCommand);

    const { apiClient, auth, baseUrlOverridden } =
      await createAuthenticatedCliApiClient({
        apiKey: flags["api-key"],
        apiBaseUrl: flags["api-base-url"],
        configDir: this.config.configDir,
      });

    await runWithTiming(flags.time, async () => {
      const result = await updateWakeAuthorization({
        client: apiClient.client,
        path: { id: args.id },
        body: { enabled: flags.enabled },
        responseStyle: "fields",
      });

      if (result.error) {
        const payload = extractErrorPayload(result.error);
        writeErrorWithHints(payload);
        surfaceUnauthorizedHint({
          auth,
          baseUrlOverridden,
          configDir: this.config.configDir,
          payload,
        });
        process.exitCode = 1;
        return;
      }

      this.log(
        JSON.stringify((result.data as { data: unknown }).data, null, 2),
      );
    });
  }
}

export default WakeAuthorizationsUpdateCommand;
