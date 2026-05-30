import { Command, Flags } from "@oclif/core";
import { getOrgRoutingTopology } from "@primitivedotdev/api-core";
import { createAuthenticatedCliApiClient } from "../api-client.js";
import {
  API_BASE_URL_FLAG_DESCRIPTION,
  extractErrorPayload,
  runWithTiming,
  surfaceUnauthorizedHint,
  TIME_FLAG_DESCRIPTION,
  writeErrorWithHints,
} from "../api-command.js";

// `primitive functions:routing-topology` returns the org-wide view of
// function routing: which active domain has which function bound, the
// org fallback (if any), and every deployed function with no route
// currently bound. Pair with `functions:route-get` for the per-function
// view and `functions:route-set` / `functions:route-unset` to mutate
// bindings.

class FunctionsRoutingTopologyCommand extends Command {
  static description =
    `Show the org-wide function routing topology. Lists every active domain with its bound function (if any), the org fallback function (if any), and every deployed function with no route currently bound.`;

  static summary = "Show the org-wide function routing topology";

  static examples = ["<%= config.bin %> functions routing-topology"];

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
    time: Flags.boolean({
      description: TIME_FLAG_DESCRIPTION,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(FunctionsRoutingTopologyCommand);

    const { apiClient, auth, baseUrlOverridden } =
      await createAuthenticatedCliApiClient({
        apiKey: flags["api-key"],
        apiBaseUrl: flags["api-base-url"],
        configDir: this.config.configDir,
      });

    await runWithTiming(flags.time, async () => {
      const result = await getOrgRoutingTopology({
        client: apiClient.client,
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

export default FunctionsRoutingTopologyCommand;
