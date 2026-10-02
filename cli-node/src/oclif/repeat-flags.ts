import { Errors, Flags } from "@oclif/core";
import type { RepeatInput } from "@primitivedotdev/api-core";
import {
  REPEAT_EVERY_MAX_MINUTES,
  REPEAT_EVERY_MIN_MINUTES,
  REPEAT_IDLE_MAX_MINUTES,
  REPEAT_MAX_SENDS_MAX,
  REPEAT_MAX_SENDS_MIN,
} from "@primitivedotdev/sdk/interactions";
import { extractErrorCode } from "./api-command.js";

/**
 * Flags shared by `send` and `reply` to make the message repeat. `exclusive`
 * names the command's own flags a repeat cannot combine with, and
 * `requirement` says, in that command's terms, which messages can repeat.
 */
export function repeatFlags(exclusive: string[], requirement: string) {
  return {
    "repeat-every": Flags.integer({
      description: `Send this message now and then again every N minutes (${REPEAT_EVERY_MIN_MINUTES} to ${REPEAT_EVERY_MAX_MINUTES}) in the same thread. ${requirement} Manage it later with \`primitive repeats\`.`,
      min: REPEAT_EVERY_MIN_MINUTES,
      max: REPEAT_EVERY_MAX_MINUTES,
      exclusive,
    }),
    "only-if-idle": Flags.integer({
      description:
        "With --repeat-every: skip a repeat while the recipient has sent mail within this many minutes.",
      min: 1,
      max: REPEAT_IDLE_MAX_MINUTES,
      dependsOn: ["repeat-every"],
    }),
    "recipient-stop": Flags.boolean({
      description:
        "With --repeat-every: let the recipient stop the repeat (default). Use --no-recipient-stop to keep stopping to yourself.",
      allowNo: true,
      dependsOn: ["repeat-every"],
    }),
    "max-sends": Flags.integer({
      description: `With --repeat-every: total messages including the first (${REPEAT_MAX_SENDS_MIN} to ${REPEAT_MAX_SENDS_MAX}).`,
      min: REPEAT_MAX_SENDS_MIN,
      max: REPEAT_MAX_SENDS_MAX,
      dependsOn: ["repeat-every"],
    }),
    until: Flags.string({
      description:
        "With --repeat-every: ISO 8601 time after which no repeat is sent.",
      dependsOn: ["repeat-every"],
    }),
  };
}

export type RepeatFlagValues = {
  "repeat-every"?: number;
  "only-if-idle"?: number;
  "recipient-stop"?: boolean;
  "max-sends"?: number;
  until?: string;
};

/** The `repeat` request field for these flags, or undefined without --repeat-every. */
export function repeatFromFlags(
  flags: RepeatFlagValues,
): RepeatInput | undefined {
  const every = flags["repeat-every"];
  if (every === undefined) return undefined;
  let until: string | undefined;
  if (flags.until !== undefined) {
    const time = Date.parse(flags.until);
    if (!Number.isFinite(time))
      throw new Errors.CLIError(
        "--until must be an ISO 8601 date and time, for example 2026-10-09T17:00:00Z.",
      );
    until = new Date(time).toISOString();
  }
  return {
    every_minutes: every,
    ...(flags["only-if-idle"] !== undefined
      ? { only_if_recipient_idle_minutes: flags["only-if-idle"] }
      : {}),
    ...(flags["recipient-stop"] !== undefined
      ? { stoppable_by_recipient: flags["recipient-stop"] }
      : {}),
    ...(flags["max-sends"] !== undefined
      ? { max_sends: flags["max-sends"] }
      : {}),
    ...(until !== undefined ? { until } : {}),
  };
}

/** One stderr line after a send that started a repeat. */
export function formatRepeatStarted(
  result: { data?: unknown },
  repeat: RepeatInput | undefined,
): string | null {
  if (!repeat) return null;
  const repeatId = (result.data as { data?: { repeat_id?: unknown } })?.data
    ?.repeat_id;
  if (typeof repeatId !== "string") return null;
  return `Repeating every ${repeat.every_minutes} min as repeat ${repeatId}. Manage it with \`primitive repeats get|pause|resume|cancel ${repeatId}\`.`;
}

/** Guidance for the documented repeat refusals. */
export const REPEAT_ERROR_HINTS: Record<string, string> = {
  repeat_unsupported:
    "A repeating message needs exactly one recipient and no cc, bcc, attachments or fyi.",
  repeat_recipient_external:
    "Repeating sends can only go to addresses in your own organization.",
  repeat_idle_requires_internal_recipient:
    "--only-if-idle needs a recipient in your own organization.",
  repeat_stop_not_allowed:
    "Run this as the recipient: the receiving agent's own credential (PRIMITIVE_AGENT_PROFILE) or the member whose address received it. If you did, only the sender can stop this repeat: it does not let the recipient stop it, or the sender canceled it.",
  not_a_repeating_send:
    "Pass the id of a received message that repeats (its footer names `primitive repeat stop`).",
};

/** Write the repeat hint for an API error, when it has one. */
export function writeRepeatErrorHint(payload: unknown): void {
  const code = extractErrorCode(payload);
  const hint = code ? REPEAT_ERROR_HINTS[code] : undefined;
  if (hint) process.stderr.write(`${hint}\n`);
}
