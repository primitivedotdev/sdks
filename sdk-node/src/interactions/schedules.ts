/**
 * Scheduled messages to agents: `schedule.tick/1` and `schedule.stop/1`.
 *
 * A member can schedule a recurring message to one of the org's connected
 * agents. Each message carries a `schedule.tick/1` interaction part. When the
 * schedule allows it, the agent stops the schedule through
 * `POST /v1/emails/{id}/schedule-stop` (`client.schedules.stop`), and the
 * server replies in the thread with a `schedule.stop/1` interaction for the
 * owner. These helpers only parse and build data; they make no requests. A
 * parsed interaction is still untrusted until the carrying email
 * authenticates as the expected sender.
 */
import type { InteractionEnvelope } from "../x402/sign.js";
import { parseInteractionEnvelope } from "./index.js";

export const SCHEDULE_TICK_PROTOCOL = "schedule.tick";
export const SCHEDULE_STOP_PROTOCOL = "schedule.stop";
export const SCHEDULE_PROTOCOL_VERSION = 1;
export const SCHEDULE_TICK_KIND = "schedule.tick/1";
export const SCHEDULE_STOP_KIND = "schedule.stop/1";
/** Longest stop reason, in UTF-16 code units (astral characters count twice). */
export const SCHEDULE_STOP_REASON_MAX = 280;
export const SCHEDULE_INTERVAL_MIN_MINUTES = 5;
export const SCHEDULE_INTERVAL_MAX_MINUTES = 10_080;
export const SCHEDULE_IDLE_MAX_MINUTES = 10_080;

/** The `schedule.tick/1` payload, in its wire field names. */
export interface ScheduleTickPayload {
  schedule_id: string;
  /** 1 for the first message of the schedule, then one higher per message. */
  sequence: number;
  interval_minutes: number;
  /** Null when the schedule sends regardless of agent activity. */
  idle_minutes: number | null;
  /** Whether the agent may stop the schedule with `schedule.stop/1`. */
  agent_can_stop: boolean;
}

export type ScheduleTickParseResult =
  | { status: "valid"; tick: ScheduleTickPayload }
  /** A valid interaction envelope for some other protocol or version. */
  | { status: "other" }
  | {
      status: "invalid";
      reason: "invalid_envelope" | "invalid_payload";
    };

/** The `schedule.stop/1` payload the server sends to the owner. */
export interface ScheduleStopPayload {
  /** Agent-written, untrusted. Null when the agent gave no reason. */
  reason: string | null;
}

export type ScheduleStopParseResult =
  | { status: "valid"; stop: ScheduleStopPayload }
  | { status: "other" }
  | {
      status: "invalid";
      reason: "invalid_envelope" | "invalid_payload";
    };

/** Request body for `POST /v1/emails/{id}/schedule-stop`. */
export interface ScheduleStopBody {
  reason?: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `protocol/protocol_version`, e.g. `schedule.tick/1`. */
export function interactionKind(
  envelope: Pick<InteractionEnvelope, "protocol" | "protocol_version">,
): string {
  return `${envelope.protocol}/${envelope.protocol_version}`;
}

function integerIn(value: unknown, min: number, max: number): boolean {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= min &&
    value <= max
  );
}

/**
 * Read the tick payload from an envelope that already passed
 * `parseInteractionEnvelope` or `validateInteractionEnvelope`.
 */
export function readScheduleTick(
  envelope: InteractionEnvelope,
): ScheduleTickParseResult {
  if (
    envelope.protocol !== SCHEDULE_TICK_PROTOCOL ||
    envelope.protocol_version !== SCHEDULE_PROTOCOL_VERSION
  )
    return { status: "other" };
  const payload: unknown = envelope.payload;
  const invalid = { status: "invalid", reason: "invalid_payload" } as const;
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    return invalid;
  const p = payload as Record<string, unknown>;
  if (
    typeof p.schedule_id !== "string" ||
    !UUID.test(p.schedule_id) ||
    !integerIn(p.sequence, 1, Number.MAX_SAFE_INTEGER) ||
    !integerIn(
      p.interval_minutes,
      SCHEDULE_INTERVAL_MIN_MINUTES,
      SCHEDULE_INTERVAL_MAX_MINUTES,
    ) ||
    !(
      p.idle_minutes === null ||
      integerIn(p.idle_minutes, 1, SCHEDULE_IDLE_MAX_MINUTES)
    ) ||
    typeof p.agent_can_stop !== "boolean"
  )
    return invalid;
  return {
    status: "valid",
    tick: {
      schedule_id: p.schedule_id.toLowerCase(),
      sequence: p.sequence as number,
      interval_minutes: p.interval_minutes as number,
      idle_minutes: p.idle_minutes as number | null,
      agent_can_stop: p.agent_can_stop,
    },
  };
}

/** Parse `interaction.json` bytes and read a `schedule.tick/1` payload. */
export function parseScheduleTick(
  input: string | Uint8Array,
): ScheduleTickParseResult {
  const result = parseInteractionEnvelope(input);
  if (result.status !== "valid")
    return { status: "invalid", reason: "invalid_envelope" };
  return readScheduleTick(result.envelope);
}

/**
 * Read the stop payload from an envelope that already passed
 * `parseInteractionEnvelope` or `validateInteractionEnvelope`.
 */
export function readScheduleStop(
  envelope: InteractionEnvelope,
): ScheduleStopParseResult {
  if (
    envelope.protocol !== SCHEDULE_STOP_PROTOCOL ||
    envelope.protocol_version !== SCHEDULE_PROTOCOL_VERSION
  )
    return { status: "other" };
  const payload: unknown = envelope.payload;
  const invalid = { status: "invalid", reason: "invalid_payload" } as const;
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    return invalid;
  const reason = (payload as Record<string, unknown>).reason;
  if (reason === undefined || reason === null)
    return { status: "valid", stop: { reason: null } };
  if (
    typeof reason !== "string" ||
    reason.length === 0 ||
    reason.length > SCHEDULE_STOP_REASON_MAX
  )
    return invalid;
  return { status: "valid", stop: { reason } };
}

/** Parse `interaction.json` bytes and read a `schedule.stop/1` payload. */
export function parseScheduleStop(
  input: string | Uint8Array,
): ScheduleStopParseResult {
  const result = parseInteractionEnvelope(input);
  if (result.status !== "valid")
    return { status: "invalid", reason: "invalid_envelope" };
  return readScheduleStop(result.envelope);
}

function isControl(code: number): boolean {
  return code < 0x20 || code === 0x7f;
}

/**
 * Normalize an optional stop reason: trims ASCII whitespace, treats an empty
 * result as no reason, and rejects control characters, lone surrogates and
 * reasons longer than 280 UTF-16 code units.
 */
export function normalizeScheduleStopReason(
  reason: string | undefined | null,
): string | undefined {
  if (reason === undefined || reason === null) return undefined;
  if (typeof reason !== "string")
    throw new TypeError("reason must be a string");
  const trimmed = reason.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, "");
  if (trimmed === "") return undefined;
  for (const char of trimmed) {
    const code = char.codePointAt(0) ?? 0;
    if (isControl(code))
      throw new TypeError("reason must be one line without control characters");
    if (code >= 0xd800 && code <= 0xdfff)
      throw new TypeError("reason must be valid Unicode text");
  }
  if (trimmed.length > SCHEDULE_STOP_REASON_MAX)
    throw new TypeError(
      `reason must be at most ${SCHEDULE_STOP_REASON_MAX} characters`,
    );
  return trimmed;
}

/** Build the request body for `POST /v1/emails/{id}/schedule-stop`. */
export function buildScheduleStopBody(
  input: { reason?: string | null } = {},
): ScheduleStopBody {
  const reason = normalizeScheduleStopReason(input.reason);
  return reason === undefined ? {} : { reason };
}

/** The CLI command that stops the schedule behind a tick email. */
export function scheduleStopCommand(emailId: string): string {
  if (!UUID.test(emailId)) throw new TypeError("emailId must be an email UUID");
  return `primitive schedule stop --id ${emailId.toLowerCase()}`;
}
