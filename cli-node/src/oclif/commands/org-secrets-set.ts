import { Command, Flags } from "@oclif/core";
import { createAuthenticatedCliApiClient } from "../api-client.js";
import {
  runWithTiming,
  surfaceUnauthorizedHint,
  TIME_FLAG_DESCRIPTION,
  writeErrorWithHints,
} from "../api-command.js";
import {
  resolveSingleSecretValue,
  SINGLE_SECRET_VALUE_SOURCE_DESCRIPTION,
} from "../secret-flags.js";
import {
  orgSecretsAuthHeaders,
  runOrgSecretsRequest,
} from "./org-secrets-shared.js";

class OrgSecretsSetCommand extends Command {
  static description =
    `Set a global secret available to every function as \`env.<KEY>\`.

  Global secrets are read into each function at deploy time, so a new or
  changed value lands in a function only on its next redeploy. A function
  secret with the same key overrides the global value for that function.

  Keys must match \`^[A-Z_][A-Z0-9_]*$\` (uppercase letters, digits,
  underscores; first character a letter or underscore). System-managed keys
  are reserved and rejected. ${SINGLE_SECRET_VALUE_SOURCE_DESCRIPTION}`;

  static summary = "Set a global secret shared across all functions";

  static examples = [
    "<%= config.bin %> org secrets set --key STRIPE_KEY --value sk_live_...",
    "<%= config.bin %> org secrets set --key OPENAI_KEY --value-from-env OPENAI_KEY",
    "printf '%s' \"$OPENAI_KEY\" | <%= config.bin %> org secrets set --key OPENAI_KEY --stdin",
  ];

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
      description:
        "Secret key. Uppercase letters, digits, underscores; must start with a letter or underscore. System-managed keys are reserved.",
      required: true,
    }),
    value: Flags.string({
      description:
        "Secret value (up to 4096 UTF-8 bytes). Encrypted at rest. Visible in shell history and process argv; prefer a non-argv source for sensitive values.",
    }),
    "value-from-env": Flags.string({
      description:
        "Environment variable to read as the secret value. Example: --value-from-env OPENAI_KEY reads process.env.OPENAI_KEY.",
    }),
    "value-file": Flags.string({
      description:
        "UTF-8 file to read as the secret value. The full file contents become the value.",
    }),
    "value-from-env-file": Flags.string({
      description:
        "Dotenv-style file to read as the secret value. Use FILE to read --key from that file, or FILE:KEY to read a different key.",
    }),
    stdin: Flags.boolean({
      description:
        "Read the secret value from stdin. A single trailing line ending is stripped.",
    }),
    time: Flags.boolean({ description: TIME_FLAG_DESCRIPTION }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(OrgSecretsSetCommand);

    await runWithTiming(flags.time, async () => {
      const { auth, baseUrlOverridden, requestConfig } =
        await createAuthenticatedCliApiClient({
          apiKey: flags["api-key"],
          apiBaseUrl: flags["api-base-url"],
          configDir: this.config.configDir,
        });

      const resolved = resolveSingleSecretValue({
        key: flags.key,
        value: flags.value,
        valueFile: flags["value-file"],
        valueFromEnv: flags["value-from-env"],
        valueFromEnvFile: flags["value-from-env-file"],
        stdin: flags.stdin,
      });
      if (resolved.kind === "error") {
        process.stderr.write(`${resolved.message}\n`);
        process.exitCode = 1;
        return;
      }

      const outcome = await runOrgSecretsRequest(
        fetch,
        requestConfig.resolvedApiBaseUrl,
        orgSecretsAuthHeaders(requestConfig.headers, auth.apiKey),
        { kind: "set", key: flags.key, value: resolved.value },
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
      // The write succeeds immediately, but deployed functions keep the old
      // binding until they redeploy. Surface that on stderr so it does not get
      // buried in the success payload on stdout.
      process.stderr.write(
        `Global secret ${flags.key} saved. Deployed functions pick it up on their next redeploy; a function secret of the same name overrides it.\n`,
      );
    });
  }
}

export default OrgSecretsSetCommand;
