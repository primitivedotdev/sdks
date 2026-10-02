import { readFileSync } from "node:fs";
import { Args, Command, Flags } from "@oclif/core";
import {
  type AgentMessageSchedule,
  type AgentMessageScheduleStop,
  createAgentMessageSchedule,
  deleteAgentMessageSchedule,
  getAgentMessageSchedule,
  listAgentMessageSchedules,
  stopAgentMessageSchedule,
  updateAgentMessageSchedule,
} from "@primitivedotdev/api-core";
import {
  buildScheduleStopBody,
  SCHEDULE_IDLE_MAX_MINUTES,
  SCHEDULE_INTERVAL_MAX_MINUTES,
  SCHEDULE_INTERVAL_MIN_MINUTES,
} from "@primitivedotdev/sdk/interactions";
import { createAuthenticatedCliApiClient } from "../api-client.js";
import {
  API_BASE_URL_FLAG_DESCRIPTION,
  extractErrorCode,
  extractErrorPayload,
  runWithTiming,
  surfaceUnauthorizedHint,
  TIME_FLAG_DESCRIPTION,
  writeErrorWithHints,
} from "../api-command.js";
import { hasStoredCliLogin } from "../auth.js";

// Scheduled messages to agents. `schedule stop` is the agent side: it stops
// the schedule behind a received scheduled message. `schedules ...` is the
// owner side and needs a member login. The generated
// `agent-message-schedules:*` commands stay available for full API parity.

const COMMON_FLAGS = {
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
  json: Flags.boolean({ description: "Print the API result as JSON" }),
  time: Flags.boolean({ description: TIME_FLAG_DESCRIPTION }),
};

type CommonFlags = {
  "api-key"?: string;
  "api-base-url"?: string;
  json?: boolean;
  time?: boolean;
};

const ID_ARG = Args.string({
  description: "Schedule id (UUID)",
  required: true,
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Extra guidance for the error codes these endpoints document. */
export const SCHEDULE_ERROR_HINTS: Record<string, string> = {
  forbidden:
    "Managing schedules needs a member login (`primitive login`); API keys and agent credentials cannot.",
  agent_not_connected:
    "Pass the address of a connected agent in your org (see `primitive agent-connections list-agent-connections`).",
  member_address_missing:
    "Your login has no personal address to send from yet: run `primitive account provision-member-address`.",
  schedule_limit_reached:
    "Delete or reuse an existing schedule (`primitive schedules list`).",
  schedule_stop_not_allowed:
    "Run this with the receiving agent's own connected credential (PRIMITIVE_AGENT_PROFILE), not a member login or API key. If you did, only the schedule's owner can stop it: it does not let the agent stop it, or the owner already stopped or deleted it.",
  not_a_scheduled_message:
    "Pass the id of a received scheduled message (the email whose footer names `primitive schedule stop`).",
};

/** One line per schedule for terminal output. */
export function formatSchedule(schedule: AgentMessageSchedule): string {
  const cadence =
    schedule.idle_minutes === null || schedule.idle_minutes === undefined
      ? `every ${schedule.interval_minutes} min`
      : `every ${schedule.interval_minutes} min, after ${schedule.idle_minutes} min without agent activity`;
  const parts = [
    schedule.id,
    schedule.status,
    cadence,
    `to ${schedule.agent_address}`,
  ];
  if (schedule.status === "active" && schedule.next_run_at)
    parts.push(`next ${schedule.next_run_at}`);
  if (schedule.sent_count !== undefined)
    parts.push(`sent ${schedule.sent_count}`);
  if (!schedule.agent_can_stop) parts.push("owner-only stop");
  let line = parts.join("  ");
  if (schedule.status === "stopped_by_agent")
    line += schedule.stop_reason
      ? `\n  stopped by agent (agent-written reason): ${JSON.stringify(schedule.stop_reason)}`
      : "\n  stopped by agent";
  return line;
}

export function formatScheduleStop(stop: AgentMessageScheduleStop): string {
  const lines = [
    `Stopped schedule ${stop.schedule_id}. No more scheduled messages will be sent.`,
  ];
  if (stop.stop_reason) lines.push(`Reason: ${stop.stop_reason}`);
  if (stop.reply_sent_email_id)
    lines.push(
      `The owner was told in the thread (sent ${stop.reply_sent_email_id}).`,
    );
  return lines.join("\n");
}

type ApiResult<T> = {
  data?: { data?: T } | undefined;
  error?: unknown;
};

/**
 * Owner commands need a member login, which the API accepts and API keys do
 * not. When the only API key came from PRIMITIVE_API_KEY and a login is saved,
 * use the login. An explicit --api-key still wins.
 */
export function ownerApiKey(input: {
  apiKeyFlag: string | undefined;
  apiKeyFlagExplicit: boolean;
  hasStoredLogin: boolean;
}): { apiKey: string | undefined; usedStoredLogin: boolean } {
  if (
    input.apiKeyFlag !== undefined &&
    !input.apiKeyFlagExplicit &&
    input.hasStoredLogin
  )
    return { apiKey: undefined, usedStoredLogin: true };
  return { apiKey: input.apiKeyFlag, usedStoredLogin: false };
}

type RawToken = { type: string; flag?: string };

async function runScheduleRequest<T>(
  command: Command,
  flags: CommonFlags,
  raw: RawToken[] | null,
  request: (
    client: Awaited<
      ReturnType<typeof createAuthenticatedCliApiClient>
    >["apiClient"]["client"],
  ) => Promise<ApiResult<T>>,
  render: (data: T) => string,
): Promise<void> {
  // `raw` holds only tokens typed on the command line, so an api-key flag
  // token means --api-key was explicit; otherwise the value came from the env.
  // Null marks the agent-side command, which keeps the usual precedence.
  let apiKey = flags["api-key"];
  if (raw) {
    const owner = ownerApiKey({
      apiKeyFlag: flags["api-key"],
      apiKeyFlagExplicit: raw.some(
        (token) => token.type === "flag" && token.flag === "api-key",
      ),
      hasStoredLogin: hasStoredCliLogin(command.config.configDir),
    });
    apiKey = owner.apiKey;
    if (owner.usedStoredLogin)
      process.stderr.write(
        "PRIMITIVE_API_KEY is set, but schedules need a member login, so this command uses your saved login. Pass --api-key explicitly to override.\n",
      );
  }
  const { apiClient, auth, baseUrlOverridden } =
    await createAuthenticatedCliApiClient({
      apiKey,
      apiBaseUrl: flags["api-base-url"],
      configDir: command.config.configDir,
    });
  await runWithTiming(flags.time === true, async () => {
    const result = await request(apiClient.client);
    if (result.error || result.data?.data === undefined) {
      const payload = extractErrorPayload(result.error);
      writeErrorWithHints(payload);
      const code = extractErrorCode(payload);
      const hint = code ? SCHEDULE_ERROR_HINTS[code] : undefined;
      if (hint) process.stderr.write(`${hint}\n`);
      surfaceUnauthorizedHint({
        auth,
        baseUrlOverridden,
        configDir: command.config.configDir,
        payload,
      });
      process.exitCode = 1;
      return;
    }
    const data = result.data.data;
    command.log(flags.json ? JSON.stringify(data, null, 2) : render(data));
  });
}

function parseMinutes(
  command: Command,
  value: string,
  flag: string,
  min: number,
  max: number,
): number {
  const minutes = /^[0-9]+$/.test(value) ? Number(value) : Number.NaN;
  if (!Number.isSafeInteger(minutes) || minutes < min || minutes > max)
    command.error(
      `${flag} must be a whole number of minutes from ${min} to ${max}.`,
      {
        exit: 2,
      },
    );
  return minutes;
}

function readBody(
  command: Command,
  flags: { body?: string; "body-file"?: string; "body-stdin"?: boolean },
): string {
  const sources = [
    flags.body !== undefined ? "--body" : null,
    flags["body-file"] !== undefined ? "--body-file" : null,
    flags["body-stdin"] ? "--body-stdin" : null,
  ].filter((source): source is string => source !== null);
  if (sources.length !== 1)
    command.error(
      sources.length === 0
        ? "Pass the message with --body, --body-file or --body-stdin."
        : `Pass only one message source (got ${sources.join(", ")}).`,
      { exit: 2 },
    );
  let body: string;
  try {
    body = flags.body ?? readFileSync(flags["body-file"] ?? 0, "utf8");
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return command.error(`Could not read the message: ${detail}`, { exit: 2 });
  }
  if (!body.trim())
    command.error("The message must not be empty.", { exit: 2 });
  return body;
}

export class ScheduleStopCommand extends Command {
  static summary = "Stop the schedule behind a scheduled message";

  static description =
    "Run as the receiving agent when a scheduled message's goal is done. Pass the id of any received message of the schedule. The schedule stops when it lets the agent stop it, and the owner is told in the thread. Running it again on a schedule you already stopped returns the same result without telling the owner twice.";

  static examples = [
    '<%= config.bin %> schedule stop --id <email-id> --reason "The report is finished"',
    "<%= config.bin %> schedule stop --id <email-id> --json",
  ];

  static flags = {
    ...COMMON_FLAGS,
    id: Flags.string({
      description: "Id of a received scheduled message",
      required: true,
    }),
    reason: Flags.string({
      description: "Short reason shown to the owner (at most 280 characters)",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(ScheduleStopCommand);
    if (!UUID.test(flags.id))
      this.error("--id must be an email id (UUID).", { exit: 2 });
    let body: { reason?: string };
    try {
      body = buildScheduleStopBody({ reason: flags.reason });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      return this.error(`--reason is invalid: ${detail}.`, { exit: 2 });
    }
    await runScheduleRequest(
      this,
      flags,
      null,
      (client) =>
        stopAgentMessageSchedule({
          client,
          path: { id: flags.id },
          body,
          responseStyle: "fields",
        }),
      formatScheduleStop,
    );
  }
}

export class SchedulesListCommand extends Command {
  static summary = "List your scheduled messages to agents";

  static description =
    "List the schedules you own, newest first. Needs a member login.";

  static examples = [
    "<%= config.bin %> schedules list",
    "<%= config.bin %> schedules list --agent agent@example.com --json",
  ];

  static flags = {
    ...COMMON_FLAGS,
    agent: Flags.string({
      description: "Only list schedules to this agent address",
    }),
  };

  async run(): Promise<void> {
    const { flags, raw } = await this.parse(SchedulesListCommand);
    await runScheduleRequest(
      this,
      flags,
      raw,
      (client) =>
        listAgentMessageSchedules({
          client,
          ...(flags.agent ? { query: { agent_address: flags.agent } } : {}),
          responseStyle: "fields",
        }),
      (schedules) =>
        schedules.length === 0
          ? "No schedules."
          : schedules.map(formatSchedule).join("\n"),
    );
  }
}

export class SchedulesGetCommand extends Command {
  static summary = "Show one scheduled message";

  static description = "Show one schedule you own. Needs a member login.";

  static examples = ["<%= config.bin %> schedules get <schedule-id>"];

  static args = { id: ID_ARG };

  static flags = COMMON_FLAGS;

  async run(): Promise<void> {
    const { args, flags, raw } = await this.parse(SchedulesGetCommand);
    await runScheduleRequest(
      this,
      flags,
      raw,
      (client) =>
        getAgentMessageSchedule({
          client,
          path: { id: args.id },
          responseStyle: "fields",
        }),
      formatSchedule,
    );
  }
}

export class SchedulesCreateCommand extends Command {
  static summary = "Schedule a recurring message to an agent";

  static description =
    "Send a message from your personal address to a connected agent every N minutes, in one email thread. With --idle, a due message is skipped while the agent has sent mail within that many minutes. By default the agent may stop the schedule when its goal is done; --no-agent-stop leaves stopping to you. The first message goes out within about a minute. Needs a member login.";

  static examples = [
    "<%= config.bin %> schedules create --agent agent@example.com --every 60 --body-file prompt.txt",
    '<%= config.bin %> schedules create --agent agent@example.com --every 30 --idle 15 --body "Any progress?"',
  ];

  static flags = {
    ...COMMON_FLAGS,
    agent: Flags.string({
      description: "Connected agent address to message",
      required: true,
    }),
    every: Flags.string({
      description: `Minutes between messages (${SCHEDULE_INTERVAL_MIN_MINUTES} to ${SCHEDULE_INTERVAL_MAX_MINUTES})`,
      required: true,
    }),
    idle: Flags.string({
      description:
        "Only send after this many minutes without activity from the agent",
    }),
    "agent-stop": Flags.boolean({
      description:
        "Let the agent stop the schedule (default). Use --no-agent-stop to keep stopping to yourself.",
      allowNo: true,
      default: true,
    }),
    subject: Flags.string({ description: "Subject of the schedule's thread" }),
    body: Flags.string({ description: "Message text" }),
    "body-file": Flags.string({ description: "Read the message from a file" }),
    "body-stdin": Flags.boolean({ description: "Read the message from stdin" }),
  };

  async run(): Promise<void> {
    const { flags, raw } = await this.parse(SchedulesCreateCommand);
    const interval = parseMinutes(
      this,
      flags.every,
      "--every",
      SCHEDULE_INTERVAL_MIN_MINUTES,
      SCHEDULE_INTERVAL_MAX_MINUTES,
    );
    const idle =
      flags.idle === undefined
        ? undefined
        : parseMinutes(
            this,
            flags.idle,
            "--idle",
            1,
            SCHEDULE_IDLE_MAX_MINUTES,
          );
    const body = readBody(this, flags);
    await runScheduleRequest(
      this,
      flags,
      raw,
      (client) =>
        createAgentMessageSchedule({
          client,
          body: {
            agent_address: flags.agent,
            body_text: body,
            interval_minutes: interval,
            ...(idle !== undefined ? { idle_minutes: idle } : {}),
            agent_can_stop: flags["agent-stop"],
            ...(flags.subject !== undefined ? { subject: flags.subject } : {}),
          },
          responseStyle: "fields",
        }),
      (schedule) => `Created schedule:\n${formatSchedule(schedule)}`,
    );
  }
}

function statusCommand(
  status: "active" | "paused",
  summary: string,
  verb: string,
): typeof Command {
  class SchedulesStatusCommand extends Command {
    static summary = summary;

    static description = `${summary}. Needs a member login.`;

    static examples = [`<%= config.bin %> schedules ${verb} <schedule-id>`];

    static args = { id: ID_ARG };

    static flags = COMMON_FLAGS;

    async run(): Promise<void> {
      const { args, flags, raw } = await this.parse(SchedulesStatusCommand);
      await runScheduleRequest(
        this,
        flags,
        raw,
        (client) =>
          updateAgentMessageSchedule({
            client,
            path: { id: args.id },
            body: { status },
            responseStyle: "fields",
          }),
        formatSchedule,
      );
    }
  }
  return SchedulesStatusCommand;
}

export const SchedulesPauseCommand = statusCommand(
  "paused",
  "Pause a scheduled message",
  "pause",
);

export const SchedulesResumeCommand = statusCommand(
  "active",
  "Resume a paused or stopped scheduled message",
  "resume",
);

export class SchedulesDeleteCommand extends Command {
  static summary = "Delete a scheduled message";

  static description =
    "Delete a schedule you own. Messages already sent stay in the thread. Needs a member login.";

  static examples = ["<%= config.bin %> schedules delete <schedule-id>"];

  static args = { id: ID_ARG };

  static flags = COMMON_FLAGS;

  async run(): Promise<void> {
    const { args, flags, raw } = await this.parse(SchedulesDeleteCommand);
    await runScheduleRequest(
      this,
      flags,
      raw,
      (client) =>
        deleteAgentMessageSchedule({
          client,
          path: { id: args.id },
          responseStyle: "fields",
        }),
      () => `Deleted schedule ${args.id}.`,
    );
  }
}
