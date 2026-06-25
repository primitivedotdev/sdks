import { Args, Command, Flags } from "@oclif/core";
import { simulateRoute } from "@primitivedotdev/api-core";
import { createAuthenticatedCliApiClient } from "../api-client.js";
import {
  API_BASE_URL_FLAG_DESCRIPTION,
  extractErrorPayload,
  runWithTiming,
  surfaceUnauthorizedHint,
  TIME_FLAG_DESCRIPTION,
  writeErrorWithHints,
} from "../api-command.js";

// `primitive routes test <recipient>` previews where an inbound email to that
// address would be delivered, with a trace of every rule evaluated and why.
// Read-only; creates nothing.

class RoutesTestCommand extends Command {
  static description = `Simulate routing for a recipient address.

  Shows the resolved destination and a trace of every rule evaluated (which
  matched or missed, and why). Does not create or change anything.`;

  static summary = "Simulate routing for a recipient";

  static examples = [
    "<%= config.bin %> routes test alice@acme.com",
    "<%= config.bin %> routes test bounce@acme.com --event-type email.bounced",
  ];

  static args = {
    recipient: Args.string({
      description: "Recipient address to simulate (e.g. alice@acme.com).",
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
    "event-type": Flags.string({
      description: "Event type to model (defaults to email.received).",
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(RoutesTestCommand);

    const { apiClient, auth, baseUrlOverridden } =
      await createAuthenticatedCliApiClient({
        apiKey: flags["api-key"],
        apiBaseUrl: flags["api-base-url"],
        configDir: this.config.configDir,
      });

    await runWithTiming(flags.time, async () => {
      const result = await simulateRoute({
        client: apiClient.client,
        body: {
          recipient: args.recipient,
          ...(flags["event-type"] ? { event_type: flags["event-type"] } : {}),
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

export default RoutesTestCommand;
