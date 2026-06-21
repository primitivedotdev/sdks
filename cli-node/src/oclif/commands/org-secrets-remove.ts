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

class OrgSecretsRemoveCommand extends Command {
  static description = `Delete a global secret.

  Deployed functions keep the previous value until each is redeployed. A
  function that defines its own secret of the same name is unaffected.`;

  static summary = "Delete a global secret";

  static aliases = ["org:secrets:delete"];

  static examples = ["<%= config.bin %> org secrets remove --key STRIPE_KEY"];

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
    key: Flags.string({
      description: "Global secret key to delete.",
      required: true,
    }),
    time: Flags.boolean({ description: TIME_FLAG_DESCRIPTION }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(OrgSecretsRemoveCommand);

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
        { kind: "remove", key: flags.key },
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

      process.stderr.write(
        `Global secret ${flags.key} deleted. Deployed functions keep the previous value until each is redeployed.\n`,
      );
    });
  }
}

export default OrgSecretsRemoveCommand;
