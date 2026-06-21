import { Command, Flags } from "@oclif/core";
import { createAuthenticatedCliApiClient } from "../api-client.js";
import {
  runWithTiming,
  surfaceUnauthorizedHint,
  TIME_FLAG_DESCRIPTION,
  writeErrorWithHints,
} from "../api-command.js";
import {
  orgSecretsAuthHeaders,
  runOrgSecretsRequest,
} from "./org-secrets-shared.js";

class OrgSecretsListCommand extends Command {
  static description = `List your organization's global secrets.

  Global secrets apply to every function in the org and are read as
  \`env.<KEY>\` in handlers. Only the keys and timestamps are returned;
  the values are encrypted at rest and never surfaced.`;

  static summary = "List global secrets (keys only; values never returned)";

  static examples = ["<%= config.bin %> org secrets list"];

  static flags = {
    "api-key": Flags.string({
      description:
        "Primitive API key override (defaults to PRIMITIVE_API_KEY or saved OAuth login credentials)",
      env: "PRIMITIVE_API_KEY",
    }),
    "api-base-url": Flags.string({
      description:
        "Override the primary API base URL. Internal testing only; not documented to customers.",
      env: "PRIMITIVE_API_BASE_URL",
      hidden: true,
    }),
    time: Flags.boolean({ description: TIME_FLAG_DESCRIPTION }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(OrgSecretsListCommand);

    await runWithTiming(flags.time, async () => {
      const { auth, baseUrlOverridden, requestConfig } =
        await createAuthenticatedCliApiClient({
          apiKey: flags["api-key"],
          apiBaseUrl: flags["api-base-url"],
          configDir: this.config.configDir,
        });

      const outcome = await runOrgSecretsRequest(
        fetch,
        requestConfig.resolvedApiBaseUrl,
        orgSecretsAuthHeaders(requestConfig.headers, auth.apiKey),
        { kind: "list" },
      );
      if (outcome.kind === "error") {
        writeErrorWithHints(outcome.payload);
        surfaceUnauthorizedHint({
          auth,
          baseUrlOverridden,
          configDir: this.config.configDir,
          payload: outcome.payload,
        });
        process.exitCode = 1;
        return;
      }

      this.log(JSON.stringify(outcome.data, null, 2));
    });
  }
}

export default OrgSecretsListCommand;
