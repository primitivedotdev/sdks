import { Args, Command, Flags } from "@oclif/core";
import {
  getRepeatingSend,
  listRepeatingSends,
  type RepeatingSend,
  type RepeatingSendStatus,
  type RepeatStopResult,
  stopRepeatFromEmail,
  updateRepeatingSend,
} from "@primitivedotdev/api-core";
import { buildRepeatStopBody } from "@primitivedotdev/sdk/interactions";
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
import { writeRepeatErrorHint } from "../repeat-flags.js";

// Repeating sends. Start one with `send` or `reply` and --repeat-every.
// `repeat stop` is the recipient side; `repeats ...` manages repeats you
// created. The generated `repeating-sends:*` commands stay available for full
// API parity.

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
  description: "Repeat id (UUID), as returned by send or reply",
  required: true,
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const STATUSES: RepeatingSendStatus[] = [
  "active",
  "paused",
  "stopped_by_recipient",
  "canceled",
  "completed",
];

/** One line per repeat for terminal output. */
export function formatRepeat(repeat: RepeatingSend): string {
  const cadence =
    repeat.only_if_recipient_idle_minutes === null ||
    repeat.only_if_recipient_idle_minutes === undefined
      ? `every ${repeat.every_minutes} min`
      : `every ${repeat.every_minutes} min, after ${repeat.only_if_recipient_idle_minutes} min without recipient activity`;
  const parts = [repeat.id, repeat.status, cadence, `to ${repeat.to_address}`];
  if (repeat.status === "active" && repeat.next_run_at)
    parts.push(`next ${repeat.next_run_at}`);
  parts.push(
    repeat.max_sends
      ? `sent ${repeat.sent_count}/${repeat.max_sends}`
      : `sent ${repeat.sent_count}`,
  );
  if (repeat.until) parts.push(`until ${repeat.until}`);
  if (!repeat.stoppable_by_recipient) parts.push("sender-only stop");
  let line = parts.join("  ");
  if (repeat.status === "stopped_by_recipient")
    line += repeat.stop_reason
      ? `\n  stopped by recipient (recipient-written reason): ${JSON.stringify(repeat.stop_reason)}`
      : "\n  stopped by recipient";
  return line;
}

export function formatRepeatStop(stop: RepeatStopResult): string {
  const lines = [
    `Stopped repeat ${stop.repeat_id}. No more repeats will be sent.`,
  ];
  if (stop.stop_reason) lines.push(`Reason: ${stop.stop_reason}`);
  if (stop.reply_sent_email_id)
    lines.push(
      `The sender was told in the thread (sent ${stop.reply_sent_email_id}).`,
    );
  return lines.join("\n");
}

type ApiResult<T> = {
  data?: { data?: T } | undefined;
  error?: unknown;
};

type Client = Awaited<
  ReturnType<typeof createAuthenticatedCliApiClient>
>["apiClient"]["client"];

/** Shown when a management command is refused as forbidden. */
export const REPEATS_FORBIDDEN_HINT =
  "Repeats are managed with the member login or organization API key that created them; connected-agent credentials cannot manage repeats.";

async function runRepeatRequest<T>(
  command: Command,
  flags: CommonFlags,
  request: (client: Client) => Promise<ApiResult<T>>,
  render: (data: T) => string,
  manages = true,
): Promise<void> {
  const { apiClient, auth, baseUrlOverridden } =
    await createAuthenticatedCliApiClient({
      apiKey: flags["api-key"],
      apiBaseUrl: flags["api-base-url"],
      configDir: command.config.configDir,
    });
  await runWithTiming(flags.time === true, async () => {
    const result = await request(apiClient.client);
    if (result.error || result.data?.data === undefined) {
      const payload = extractErrorPayload(result.error);
      writeErrorWithHints(payload);
      writeRepeatErrorHint(payload);
      const code = extractErrorCode(payload);
      if (
        manages &&
        (code === "forbidden" || code === "agent_connection_scope_forbidden")
      )
        process.stderr.write(`${REPEATS_FORBIDDEN_HINT}\n`);
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

export class RepeatStopCommand extends Command {
  static summary = "Stop a message that repeats to you";

  static description =
    "Run as the recipient when a repeating message is no longer needed. Pass the id of any received message of the repeat. The repeat stops when it lets the recipient stop it, and the sender is told in the thread. Running it again on a repeat you already stopped returns the same result without telling the sender twice.";

  static examples = [
    '<%= config.bin %> repeat stop --id <email-id> --reason "The report is finished"',
    "<%= config.bin %> repeat stop --id <email-id> --json",
  ];

  static flags = {
    ...COMMON_FLAGS,
    id: Flags.string({
      description: "Id of a received message that repeats",
      required: true,
    }),
    reason: Flags.string({
      description: "Short reason shown to the sender (at most 280 characters)",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(RepeatStopCommand);
    if (!UUID.test(flags.id))
      this.error("--id must be an email id (UUID).", { exit: 2 });
    let body: { reason?: string };
    try {
      body = buildRepeatStopBody({ reason: flags.reason });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      return this.error(`--reason is invalid: ${detail}.`, { exit: 2 });
    }
    await runRepeatRequest(
      this,
      flags,
      (client) =>
        stopRepeatFromEmail({
          client,
          path: { id: flags.id },
          body,
          responseStyle: "fields",
        }),
      formatRepeatStop,
      false,
    );
  }
}

export class RepeatsListCommand extends Command {
  static summary = "List repeating sends you created";

  static description =
    "List the repeats you created, newest first. Start one with `primitive send` or `primitive reply` and --repeat-every.";

  static examples = [
    "<%= config.bin %> repeats list",
    "<%= config.bin %> repeats list --to agent@example.com --status active --json",
  ];

  static flags = {
    ...COMMON_FLAGS,
    to: Flags.string({ description: "Only list repeats sent to this address" }),
    status: Flags.string({
      description: "Only list repeats in this status",
      options: STATUSES,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(RepeatsListCommand);
    const query = {
      ...(flags.to ? { to: flags.to } : {}),
      ...(flags.status ? { status: flags.status as RepeatingSendStatus } : {}),
    };
    await runRepeatRequest(
      this,
      flags,
      (client) =>
        listRepeatingSends({
          client,
          ...(Object.keys(query).length > 0 ? { query } : {}),
          responseStyle: "fields",
        }),
      (repeats) =>
        repeats.length === 0
          ? "No repeats."
          : repeats.map(formatRepeat).join("\n"),
    );
  }
}

export class RepeatsGetCommand extends Command {
  static summary = "Show one repeating send";

  static description = "Show one repeat you created.";

  static examples = ["<%= config.bin %> repeats get <repeat-id>"];

  static args = { id: ID_ARG };

  static flags = COMMON_FLAGS;

  async run(): Promise<void> {
    const { args, flags } = await this.parse(RepeatsGetCommand);
    await runRepeatRequest(
      this,
      flags,
      (client) =>
        getRepeatingSend({
          client,
          path: { id: args.id },
          responseStyle: "fields",
        }),
      formatRepeat,
    );
  }
}

function statusCommand(
  status: "active" | "paused" | "canceled",
  summary: string,
  description: string,
  verb: string,
): typeof Command {
  class RepeatsStatusCommand extends Command {
    static summary = summary;

    static description = description;

    static examples = [`<%= config.bin %> repeats ${verb} <repeat-id>`];

    static args = { id: ID_ARG };

    static flags = COMMON_FLAGS;

    async run(): Promise<void> {
      const { args, flags } = await this.parse(RepeatsStatusCommand);
      await runRepeatRequest(
        this,
        flags,
        (client) =>
          updateRepeatingSend({
            client,
            path: { id: args.id },
            body: { status },
            responseStyle: "fields",
          }),
        formatRepeat,
      );
    }
  }
  return RepeatsStatusCommand;
}

export const RepeatsPauseCommand = statusCommand(
  "paused",
  "Pause a repeating send",
  "Pause a repeat you created. Resume it later with `primitive repeats resume`.",
  "pause",
);

export const RepeatsResumeCommand = statusCommand(
  "active",
  "Resume a paused or stopped repeating send",
  "Resume a paused repeat, or one its recipient stopped. The next message goes out within about a minute.",
  "resume",
);

export const RepeatsCancelCommand = statusCommand(
  "canceled",
  "Cancel a repeating send",
  "Cancel a repeat you created and its pending message. Messages already sent stay in the thread.",
  "cancel",
);
