/**
 * Repeating sends: `repeat.tick/1` and `repeat.stop/1`.
 *
 * A send or reply with `repeat` goes out now and then again every few minutes
 * in the same thread. Each message carries a `repeat.tick/1` interaction part.
 * When the repeat allows it, the recipient stops it through
 * `POST /v1/emails/{id}/repeat-stop` (`client.repeats.stop`), and the server
 * replies in the thread with a `repeat.stop/1` part for the sender. These
 * helpers only parse and build data; they make no requests. A parsed part is
 * not proof that Primitive sent the message: use the server-verified `repeat`
 * marker on the email for that.
 */
import type { InteractionEnvelope } from "../x402/sign.js";
import { parseInteractionEnvelope } from "./index.js";

export const REPEAT_TICK_PROTOCOL = "repeat.tick";
export const REPEAT_STOP_PROTOCOL = "repeat.stop";
export const REPEAT_PROTOCOL_VERSION = 1;
export const REPEAT_TICK_STEP = "tick";
export const REPEAT_STOP_STEP = "stop";
export const REPEAT_TICK_KIND = "repeat.tick/1";
export const REPEAT_STOP_KIND = "repeat.stop/1";
/** Longest stop reason, in UTF-16 code units (astral characters count twice). */
export const REPEAT_STOP_REASON_MAX = 280;
export const REPEAT_EVERY_MIN_MINUTES = 5;
export const REPEAT_EVERY_MAX_MINUTES = 10_080;
export const REPEAT_IDLE_MAX_MINUTES = 10_080;
export const REPEAT_MAX_SENDS_MIN = 2;
export const REPEAT_MAX_SENDS_MAX = 10_000;

/** The `repeat.tick/1` payload, in its wire field names. */
export interface RepeatTickPayload {
  repeat_id: string;
  /** 1 for the first message of the repeat, then one higher per message. */
  sequence: number;
  every_minutes: number;
  /** Null when the repeat sends regardless of recipient activity. */
  only_if_recipient_idle_minutes: number | null;
  /** Whether the recipient may stop the repeat. */
  stoppable_by_recipient: boolean;
}

/** The `repeat.stop/1` payload the server sends to the sender. */
export interface RepeatStopPayload {
  /** Recipient-written, untrusted. Null when no reason was given. */
  reason: string | null;
}

type InvalidReason = "invalid_envelope" | "invalid_step" | "invalid_payload";

export type RepeatTickParseResult =
  | { status: "valid"; tick: RepeatTickPayload }
  /** A valid interaction envelope for some other protocol or version. */
  | { status: "other" }
  | { status: "invalid"; reason: InvalidReason };

export type RepeatStopParseResult =
  | { status: "valid"; stop: RepeatStopPayload }
  | { status: "other" }
  | { status: "invalid"; reason: InvalidReason };

/** Request body for `POST /v1/emails/{id}/repeat-stop`. */
export interface RepeatStopBody {
  reason?: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `protocol/protocol_version`, e.g. `repeat.tick/1`. */
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

function payloadObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * Read the tick payload from an envelope that already passed
 * `parseInteractionEnvelope` or `validateInteractionEnvelope`.
 */
export function readRepeatTick(
  envelope: InteractionEnvelope,
): RepeatTickParseResult {
  if (
    envelope.protocol !== REPEAT_TICK_PROTOCOL ||
    envelope.protocol_version !== REPEAT_PROTOCOL_VERSION
  )
    return { status: "other" };
  if (envelope.step !== REPEAT_TICK_STEP)
    return { status: "invalid", reason: "invalid_step" };
  const p = payloadObject(envelope.payload);
  const invalid = { status: "invalid", reason: "invalid_payload" } as const;
  if (
    !p ||
    typeof p.repeat_id !== "string" ||
    !UUID.test(p.repeat_id) ||
    !integerIn(p.sequence, 1, Number.MAX_SAFE_INTEGER) ||
    !integerIn(
      p.every_minutes,
      REPEAT_EVERY_MIN_MINUTES,
      REPEAT_EVERY_MAX_MINUTES,
    ) ||
    !(
      p.only_if_recipient_idle_minutes === null ||
      integerIn(p.only_if_recipient_idle_minutes, 1, REPEAT_IDLE_MAX_MINUTES)
    ) ||
    typeof p.stoppable_by_recipient !== "boolean"
  )
    return invalid;
  return {
    status: "valid",
    tick: {
      repeat_id: p.repeat_id.toLowerCase(),
      sequence: p.sequence as number,
      every_minutes: p.every_minutes as number,
      only_if_recipient_idle_minutes: p.only_if_recipient_idle_minutes as
        | number
        | null,
      stoppable_by_recipient: p.stoppable_by_recipient,
    },
  };
}

/** Parse `interaction.json` bytes and read a `repeat.tick/1` payload. */
export function parseRepeatTick(
  input: string | Uint8Array,
): RepeatTickParseResult {
  const result = parseInteractionEnvelope(input);
  if (result.status !== "valid")
    return { status: "invalid", reason: "invalid_envelope" };
  return readRepeatTick(result.envelope);
}

/**
 * Read the stop payload from an envelope that already passed
 * `parseInteractionEnvelope` or `validateInteractionEnvelope`.
 */
export function readRepeatStop(
  envelope: InteractionEnvelope,
): RepeatStopParseResult {
  if (
    envelope.protocol !== REPEAT_STOP_PROTOCOL ||
    envelope.protocol_version !== REPEAT_PROTOCOL_VERSION
  )
    return { status: "other" };
  if (envelope.step !== REPEAT_STOP_STEP)
    return { status: "invalid", reason: "invalid_step" };
  const p = payloadObject(envelope.payload);
  const invalid = { status: "invalid", reason: "invalid_payload" } as const;
  if (!p) return invalid;
  const reason = p.reason;
  if (reason === undefined || reason === null)
    return { status: "valid", stop: { reason: null } };
  if (
    typeof reason !== "string" ||
    reason.length === 0 ||
    reason.length > REPEAT_STOP_REASON_MAX
  )
    return invalid;
  return { status: "valid", stop: { reason } };
}

/** Parse `interaction.json` bytes and read a `repeat.stop/1` payload. */
export function parseRepeatStop(
  input: string | Uint8Array,
): RepeatStopParseResult {
  const result = parseInteractionEnvelope(input);
  if (result.status !== "valid")
    return { status: "invalid", reason: "invalid_envelope" };
  return readRepeatStop(result.envelope);
}

function isAsciiSpace(code: number): boolean {
  return code === 0x20 || code === 0x09 || code === 0x0d || code === 0x0a;
}

/** Linear-time trim of ASCII space, tab, CR and LF. */
function trimAsciiSpace(value: string): string {
  let start = 0;
  let end = value.length;
  while (start < end && isAsciiSpace(value.charCodeAt(start))) start++;
  while (end > start && isAsciiSpace(value.charCodeAt(end - 1))) end--;
  return value.slice(start, end);
}

/**
 * Normalize an optional stop reason: trims ASCII whitespace, treats an empty
 * result as no reason, and rejects control characters, lone surrogates and
 * reasons longer than 280 UTF-16 code units.
 */
export function normalizeRepeatStopReason(
  reason: string | undefined | null,
): string | undefined {
  if (reason === undefined || reason === null) return undefined;
  if (typeof reason !== "string")
    throw new TypeError("reason must be a string");
  const trimmed = trimAsciiSpace(reason);
  if (trimmed === "") return undefined;
  for (const char of trimmed) {
    const code = char.codePointAt(0) ?? 0;
    if (code < 0x20 || code === 0x7f)
      throw new TypeError("reason must be one line without control characters");
    if (code >= 0xd800 && code <= 0xdfff)
      throw new TypeError("reason must be valid Unicode text");
  }
  if (trimmed.length > REPEAT_STOP_REASON_MAX)
    throw new TypeError(
      `reason must be at most ${REPEAT_STOP_REASON_MAX} characters`,
    );
  return trimmed;
}

/** Build the request body for `POST /v1/emails/{id}/repeat-stop`. */
export function buildRepeatStopBody(
  input: { reason?: string | null } = {},
): RepeatStopBody {
  const reason = normalizeRepeatStopReason(input.reason);
  return reason === undefined ? {} : { reason };
}

/** The CLI command that stops the repeat behind a received message. */
export function repeatStopCommand(emailId: string): string {
  if (!UUID.test(emailId)) throw new TypeError("emailId must be an email UUID");
  return `primitive repeat stop --id ${emailId.toLowerCase()}`;
}
