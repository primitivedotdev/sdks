import { createHash } from "node:crypto";
import type {
  EmailDetail,
  PrimitiveApiClient,
} from "@primitivedotdev/api-core";
import {
  MAX_INTERACTION_BYTES,
  parseRepeatTick,
  repeatStopCommand,
} from "@primitivedotdev/sdk/interactions";
import {
  notificationPartReader,
  type ReadNotificationPart,
} from "./notify-session-content.js";

type Client = PrimitiveApiClient["client"];

/** A message Primitive sent as part of a repeating send, as shown in the brief. */
export type RepeatedMessage = {
  repeat_id: string;
  sequence: number;
  /** From the message's `repeat.tick/1` part; null when it could not be read. */
  every_minutes: number | null;
  only_if_recipient_idle_minutes: number | null;
  /** Null when the part could not be read. */
  stoppable_by_recipient: boolean | null;
  /** The command that stops the repeat, unless only the sender can. */
  stop_command: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The server-verified repeat marker on an email read, if any. */
export function repeatMarker(
  detail: unknown,
): { repeat_id: string; sequence: number } | null {
  const marker =
    detail && typeof detail === "object"
      ? (detail as { repeat?: unknown }).repeat
      : undefined;
  if (!marker || typeof marker !== "object") return null;
  const { repeat_id, sequence } = marker as Record<string, unknown>;
  return typeof repeat_id === "string" &&
    UUID.test(repeat_id) &&
    typeof sequence === "number" &&
    Number.isSafeInteger(sequence) &&
    sequence >= 1
    ? { repeat_id: repeat_id.toLowerCase(), sequence }
    : null;
}

async function readTickPart(input: {
  client: Client;
  detail: EmailDetail;
  signal: AbortSignal;
  readPart?: ReadNotificationPart;
}) {
  const { detail } = input;
  if (detail.parsed?.status !== "complete") return null;
  const parts = (detail.parsed.attachments ?? []).filter(
    (part) => part.filename?.toLowerCase() === "interaction.json",
  );
  const part = parts.length === 1 ? parts[0] : undefined;
  if (
    !part ||
    part.content_type?.split(";")[0]?.trim().toLowerCase() !==
      "application/json" ||
    part.part_index === undefined ||
    !Number.isSafeInteger(part.part_index) ||
    part.part_index < 0 ||
    !Number.isSafeInteger(part.size_bytes) ||
    part.size_bytes <= 0 ||
    part.size_bytes > MAX_INTERACTION_BYTES ||
    typeof part.sha256 !== "string" ||
    !/^[a-f0-9]{64}$/i.test(part.sha256)
  )
    return null;
  const readPart =
    input.readPart ?? notificationPartReader(async () => input.client);
  let bytes: Uint8Array;
  try {
    bytes = await readPart(detail.id, part.part_index, input.signal);
  } catch {
    input.signal.throwIfAborted();
    return null;
  }
  if (
    bytes.byteLength !== part.size_bytes ||
    createHash("sha256").update(bytes).digest("hex") !==
      part.sha256.toLowerCase()
  )
    return null;
  const result = parseRepeatTick(bytes);
  return result.status === "valid" ? result.tick : null;
}

/**
 * Describe a repeated message for the brief. Only the server's `repeat`
 * marker establishes that Primitive sent the email as a repeat; the
 * `repeat.tick/1` part adds the cadence and whether the recipient may stop
 * it, and is used only when its repeat id matches the marker. Returns null
 * for every other email, and never fails the brief.
 */
export async function readRepeatedMessage(input: {
  client: Client;
  detail: EmailDetail;
  signal: AbortSignal;
  readPart?: ReadNotificationPart;
}): Promise<RepeatedMessage | null> {
  const marker = repeatMarker(input.detail);
  if (!marker) return null;
  const tick = await readTickPart(input);
  const matched = tick && tick.repeat_id === marker.repeat_id ? tick : null;
  const command = repeatStopCommand(input.detail.id);
  return {
    repeat_id: marker.repeat_id,
    sequence: marker.sequence,
    every_minutes: matched?.every_minutes ?? null,
    only_if_recipient_idle_minutes:
      matched?.only_if_recipient_idle_minutes ?? null,
    stoppable_by_recipient: matched?.stoppable_by_recipient ?? null,
    stop_command: matched?.stoppable_by_recipient === false ? null : command,
  };
}

/** One brief line describing a repeated message. */
export function renderRepeatedMessage(message: RepeatedMessage): string {
  if (message.every_minutes === null)
    return `Repeating message (repeat ${message.repeat_id}, message ${message.sequence}); to stop it, if the sender allows: ${message.stop_command}`;
  const cadence =
    message.only_if_recipient_idle_minutes === null
      ? `every ${message.every_minutes} min`
      : `every ${message.every_minutes} min, after ${message.only_if_recipient_idle_minutes} min without activity from you`;
  return message.stop_command
    ? `Repeating message (${cadence}); stop with: ${message.stop_command}`
    : `Repeating message (${cadence}); only the sender can stop it`;
}
