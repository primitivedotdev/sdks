import { Command, Flags } from "@oclif/core";
import { createWakeSchedule } from "@primitivedotdev/api-core";
import { createAuthenticatedCliApiClient } from "../api-client.js";
import {
  API_BASE_URL_FLAG_DESCRIPTION,
  extractErrorPayload,
  runWithTiming,
  surfaceUnauthorizedHint,
  TIME_FLAG_DESCRIPTION,
  writeErrorWithHints,
} from "../api-command.js";

class WakeSchedulesCreateCommand extends Command {
  static description =
    "Create a cron schedule that sends a wake.dispatch command to one of your own function addresses.";

  static summary = "Create a wake schedule";

  static examples = [
    '<%= config.bin %> wake schedules create --from scheduler@acme.dev --to alice@acme.dev --command process_inbox --cron "0 9 * * *" --timezone America/New_York',
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
    from: Flags.string({
      description: "Sending identity address (must differ from --to)",
      required: true,
    }),
    to: Flags.string({
      description: "Target function address the wake is delivered to",
      required: true,
    }),
    command: Flags.string({ description: "Wake command name", required: true }),
    cron: Flags.string({
      description: "5-field cron expression",
      required: true,
    }),
    timezone: Flags.string({ description: "IANA timezone (default UTC)" }),
    args: Flags.string({ description: "Args as a JSON object" }),
    note: Flags.string({ description: "Optional note" }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(WakeSchedulesCreateCommand);

    const { apiClient, auth, baseUrlOverridden } =
      await createAuthenticatedCliApiClient({
        apiKey: flags["api-key"],
        apiBaseUrl: flags["api-base-url"],
        configDir: this.config.configDir,
      });

    await runWithTiming(flags.time, async () => {
      let argsObj: Record<string, unknown> | undefined;
      if (flags.args) {
        try {
          const parsed: unknown = JSON.parse(flags.args);
          if (
            typeof parsed !== "object" ||
            parsed === null ||
            Array.isArray(parsed)
          ) {
            this.error("--args must be a JSON object");
          }
          argsObj = parsed as Record<string, unknown>;
        } catch {
          this.error("--args must be valid JSON");
        }
      }
      const result = await createWakeSchedule({
        client: apiClient.client,
        body: {
          from_address: flags.from,
          target_address: flags.to,
          command: flags.command,
          cron_expr: flags.cron,
          ...(flags.timezone ? { timezone: flags.timezone } : {}),
          ...(argsObj ? { args: argsObj } : {}),
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

export default WakeSchedulesCreateCommand;
