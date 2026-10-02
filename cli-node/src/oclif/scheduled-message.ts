import { createHash } from "node:crypto";
import type {
  EmailDetail,
  PrimitiveApiClient,
} from "@primitivedotdev/api-core";
import {
  MAX_INTERACTION_BYTES,
  parseScheduleTick,
  scheduleStopCommand,
} from "@primitivedotdev/sdk/interactions";
import {
  notificationPartReader,
  type ReadNotificationPart,
} from "./notify-session-content.js";

type Client = PrimitiveApiClient["client"];

/** A `schedule.tick/1` message, as shown in the email brief. */
export type ScheduledMessage = {
  schedule_id: string;
  sequence: number;
  interval_minutes: number;
  idle_minutes: number | null;
  agent_can_stop: boolean;
  /** The command that stops the schedule, or null when only the owner can. */
  stop_command: string | null;
};

/**
 * Read the `schedule.tick/1` part of an already-authenticated email. Returns
 * null for ordinary mail and whenever the part cannot be read or verified:
 * the brief never fails because of it.
 */
export async function readScheduledMessage(input: {
  client: Client;
  detail: EmailDetail;
  signal: AbortSignal;
  readPart?: ReadNotificationPart;
}): Promise<ScheduledMessage | null> {
  const { detail } = input;
  if (detail.parsed?.status !== "complete") return null;
  const parts = (detail.parsed.attachments ?? []).filter(
    (part) => part.filename?.toLowerCase() === "interaction.json",
  );
  // One canonical part only: two interaction parts are ambiguous.
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
  const result = parseScheduleTick(bytes);
  if (result.status !== "valid") return null;
  const tick = result.tick;
  return {
    ...tick,
    stop_command: tick.agent_can_stop ? scheduleStopCommand(detail.id) : null,
  };
}

/** One brief line describing a scheduled message. */
export function renderScheduledMessage(message: ScheduledMessage): string {
  const cadence =
    message.idle_minutes === null
      ? `every ${message.interval_minutes} min`
      : `every ${message.interval_minutes} min, after ${message.idle_minutes} min without activity from you`;
  return message.stop_command
    ? `Scheduled message (${cadence}); stop with: ${message.stop_command}`
    : `Scheduled message (${cadence}); only the sender can stop it`;
}
