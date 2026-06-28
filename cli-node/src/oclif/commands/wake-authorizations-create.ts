import { Command, Flags } from "@oclif/core";
import { createWakeAuthorization } from "@primitivedotdev/api-core";
import { createAuthenticatedCliApiClient } from "../api-client.js";
import {
  API_BASE_URL_FLAG_DESCRIPTION,
  extractErrorPayload,
  runWithTiming,
  surfaceUnauthorizedHint,
  TIME_FLAG_DESCRIPTION,
  writeErrorWithHints,
} from "../api-command.js";

class WakeAuthorizationsCreateCommand extends Command {
  static description =
    "Grant a sender domain (and optionally an address and command set) permission to wake a target function.";

  static summary = "Create a wake authorization";

  static examples = [
    "<%= config.bin %> wake authorizations create --endpoint <endpoint-id> --domain agents.acme.dev --command process_inbox",
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
      description: "Target endpoint id (recipient_endpoint_id)",
      required: true,
    }),
    domain: Flags.string({
      description: "Allowed sender domain (fully-qualified)",
      required: true,
    }),
    address: Flags.string({
      description: "Optional specific allowed sender address",
    }),
    command: Flags.string({
      description: "Allowed command (repeatable); omit for any",
      multiple: true,
    }),
    note: Flags.string({ description: "Optional note" }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(WakeAuthorizationsCreateCommand);

    const { apiClient, auth, baseUrlOverridden } =
      await createAuthenticatedCliApiClient({
        apiKey: flags["api-key"],
        apiBaseUrl: flags["api-base-url"],
        configDir: this.config.configDir,
      });

    await runWithTiming(flags.time, async () => {
      const result = await createWakeAuthorization({
        client: apiClient.client,
        body: {
          recipient_endpoint_id: flags.endpoint,
          allowed_sender_domain: flags.domain,
          ...(flags.address ? { allowed_sender_address: flags.address } : {}),
          ...(flags.command && flags.command.length > 0
            ? { allowed_commands: flags.command }
            : {}),
          ...(flags.note ? { note: flags.note } : {}),
        },
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

export default WakeAuthorizationsCreateCommand;
