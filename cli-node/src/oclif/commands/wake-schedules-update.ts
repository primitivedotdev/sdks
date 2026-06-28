import { Args, Command, Flags } from "@oclif/core";
import { updateWakeSchedule } from "@primitivedotdev/api-core";
import { createAuthenticatedCliApiClient } from "../api-client.js";
import {
  API_BASE_URL_FLAG_DESCRIPTION,
  extractErrorPayload,
  runWithTiming,
  surfaceUnauthorizedHint,
  TIME_FLAG_DESCRIPTION,
  writeErrorWithHints,
} from "../api-command.js";

class WakeSchedulesUpdateCommand extends Command {
  static description =
    "Update a wake schedule's command, args, cadence, addresses, note, or enabled state.";

  static summary = "Update a wake schedule";

  static examples = [
    '<%= config.bin %> wake schedules update <schedule-id> --cron "*/15 * * * *"',
    "<%= config.bin %> wake schedules update <schedule-id> --no-enabled",
  ];

  static args = {
    id: Args.string({ description: "Wake schedule id (UUID)", required: true }),
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
    from: Flags.string({
      description: "Sending identity address (must differ from --to)",
    }),
    to: Flags.string({
      description: "Target function address the wake is delivered to",
    }),
    command: Flags.string({ description: "Wake command name" }),
    cron: Flags.string({ description: "5-field cron expression" }),
    timezone: Flags.string({ description: "IANA timezone" }),
    args: Flags.string({ description: "Args as a JSON object" }),
    note: Flags.string({ description: "Optional note" }),
    enabled: Flags.boolean({
      description: "Enable the schedule (use --no-enabled to pause)",
      allowNo: true,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(WakeSchedulesUpdateCommand);

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
      const result = await updateWakeSchedule({
        client: apiClient.client,
        path: { id: args.id },
        body: {
          ...(flags.enabled !== undefined ? { enabled: flags.enabled } : {}),
          ...(flags.command ? { command: flags.command } : {}),
          ...(flags.cron ? { cron_expr: flags.cron } : {}),
          ...(flags.timezone ? { timezone: flags.timezone } : {}),
          ...(flags.from ? { from_address: flags.from } : {}),
          ...(flags.to ? { target_address: flags.to } : {}),
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

export default WakeSchedulesUpdateCommand;
