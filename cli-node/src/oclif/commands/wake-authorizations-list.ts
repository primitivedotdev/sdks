import { Command, Flags } from "@oclif/core";
import { listWakeAuthorizations } from "@primitivedotdev/api-core";
import { createAuthenticatedCliApiClient } from "../api-client.js";
import {
  API_BASE_URL_FLAG_DESCRIPTION,
  extractErrorPayload,
  runWithTiming,
  surfaceUnauthorizedHint,
  TIME_FLAG_DESCRIPTION,
  writeErrorWithHints,
} from "../api-command.js";

class WakeAuthorizationsListCommand extends Command {
  static description =
    "List wake authorizations (the per-target allowlist). Optionally filter by target endpoint.";

  static summary = "List wake authorizations";

  static examples = [
    "<%= config.bin %> wake authorizations list",
    "<%= config.bin %> wake authorizations list --endpoint <endpoint-id>",
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
    time: Flags.boolean({ description: TIME_FLAG_DESCRIPTION }),
    endpoint: Flags.string({
      description: "Only return grants for this target endpoint id",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(WakeAuthorizationsListCommand);

    const { apiClient, auth, baseUrlOverridden } =
      await createAuthenticatedCliApiClient({
        apiKey: flags["api-key"],
        apiBaseUrl: flags["api-base-url"],
        configDir: this.config.configDir,
      });

    await runWithTiming(flags.time, async () => {
      const result = await listWakeAuthorizations({
        client: apiClient.client,
        query: flags.endpoint ? { recipient_endpoint_id: flags.endpoint } : {},
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

export default WakeAuthorizationsListCommand;
