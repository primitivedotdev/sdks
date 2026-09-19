import {
  type InteractionParseResult,
  parseInteractionEnvelope,
} from "./index.js";
import { signalText } from "./signals.js";

export interface SignalContentPart {
  filename: string | null;
  contentType: string | null;
}
export type SignalContentInventory =
  | { status: "complete"; parts: readonly SignalContentPart[] }
  | { status: "unavailable" };
export type SignalContentBodies =
  | { status: "complete"; text: string | null; html: string | null }
  | { status: "unavailable" };
export interface SignalContentInput {
  /** Complete means the full outer inventory, including offloaded parts. */
  inventory: SignalContentInventory;
  bodies: SignalContentBodies;
  /** Decoded bytes for the unique canonical part, never base64 text. */
  canonicalPartBytes: Uint8Array | null;
}
export type SignalContentReason =
  | "inventory_unavailable"
  | "no_canonical_part"
  | "duplicate_canonical_parts"
  | "additional_parts"
  | "part_unavailable"
  | "invalid_interaction"
  | "unsupported_signal"
  | "unsupported_content_type"
  | "bodies_unavailable"
  | "html_present"
  | "text_mismatch"
  | "informational_signal";
export interface SignalContentResult {
  classification:
    | "plain"
    | "informational_only"
    | "mixed_or_unsupported"
    | "unavailable";
  reason: SignalContentReason;
  /** Syntax/source evidence only. Never authentication or an interpreted receipt. */
  interaction?: InteractionParseResult;
}
const ENVELOPE_KEYS = [
  "interaction_version",
  "interaction_id",
  "protocol",
  "protocol_version",
  "step",
  "step_id",
  "prev_step_id",
  "expires_at",
  "payload",
];
function asciiLower(value: string): string {
  return value.replace(/[A-Z]/g, (letter) => letter.toLowerCase());
}
function mediaType(value: string): string {
  const separator = value.indexOf(";");
  let end = separator === -1 ? value.length : separator;
  let start = 0;
  const padding = (index: number) =>
    value.charCodeAt(index) === 32 || value.charCodeAt(index) === 9;
  while (start < end && padding(start)) start++;
  while (end > start && padding(end - 1)) end--;
  return asciiLower(value.slice(start, end));
}
function exactKeys(
  value: Record<string, unknown>,
  required: string[],
  optional: string[] = [],
): boolean {
  return (
    required.every((key) => Object.hasOwn(value, key)) &&
    Object.keys(value).every(
      (key) => required.includes(key) || optional.includes(key),
    )
  );
}
function utcExpiry(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?Z$/.exec(
      value,
    );
  if (!match) return false;
  const year = Number(match[1]),
    month = Number(match[2]),
    day = Number(match[3]);
  const days = [
    31,
    year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  return (
    year >= 1970 &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= (days[month - 1] ?? 0) &&
    Number(match[4]) < 24 &&
    Number(match[5]) < 60 &&
    Number(match[6]) < 60
  );
}
function fallback(result: InteractionParseResult): string | null {
  if (result.status !== "valid") return null;
  const e = result.envelope;
  if (
    !exactKeys(e, ENVELOPE_KEYS) ||
    e.protocol_version !== 1 ||
    !["ack", "read", "working", "typing"].includes(e.protocol) ||
    e.step !== e.protocol ||
    e.prev_step_id !== null ||
    e.interaction_id.split("@")[0]?.toLowerCase() === e.step_id.toLowerCase()
  )
    return null;
  if (
    ["working", "typing"].includes(e.protocol)
      ? !utcExpiry(e.expires_at)
      : e.expires_at !== null
  )
    return null;
  if (!e.payload || typeof e.payload !== "object" || Array.isArray(e.payload))
    return null;
  const p = e.payload as Record<string, unknown>;
  if (
    !exactKeys(
      p,
      e.protocol === "ack"
        ? ["subject_message_id", "status"]
        : ["subject_message_id"],
      e.protocol === "ack" ? ["note"] : [],
    )
  )
    return null;
  const target = p.subject_message_id;
  if (
    typeof target !== "string" ||
    target.length > 998 ||
    !/^<[!-~]+@[!-~]+>$/.test(target) ||
    target.slice(1, -1).includes("<") ||
    target.slice(1, -1).includes(">") ||
    target.split("@").length !== 2
  )
    return null;
  if (e.protocol !== "ack") return signalText(e.protocol);
  if (
    typeof p.status !== "string" ||
    !["received", "will_process", "will_not_process"].includes(p.status)
  )
    return null;
  if (
    Object.hasOwn(p, "note") &&
    (typeof p.note !== "string" ||
      p.note.length > 2000 ||
      p.note.includes("\0"))
  )
    return null;
  return signalText("ack", p.status, p.note as string | undefined);
}
/** Pure content classification. It establishes no sender, receipt or task authority. */
export function classifySignalContent(
  input: SignalContentInput,
): SignalContentResult {
  if (
    input.inventory.status !== "complete" ||
    !Array.isArray(input.inventory.parts)
  )
    return { classification: "unavailable", reason: "inventory_unavailable" };
  const parts = input.inventory.parts;
  const canonical = parts.filter(
    (part) =>
      part.filename !== null &&
      asciiLower(part.filename) === "interaction.json",
  );
  if (!canonical.length)
    return { classification: "plain", reason: "no_canonical_part" };
  if (canonical.length !== 1)
    return {
      classification: "mixed_or_unsupported",
      reason: "duplicate_canonical_parts",
    };
  const interaction =
    input.canonicalPartBytes === null
      ? undefined
      : parseInteractionEnvelope(input.canonicalPartBytes);
  const evidence = interaction === undefined ? {} : { interaction };
  if (parts.length !== 1)
    return {
      classification: "mixed_or_unsupported",
      reason: "additional_parts",
      ...evidence,
    };
  if (!interaction)
    return { classification: "unavailable", reason: "part_unavailable" };
  if (input.bodies.status !== "complete")
    return {
      classification: "unavailable",
      reason: "bodies_unavailable",
      interaction,
    };
  if (interaction.status === "invalid")
    return {
      classification: "mixed_or_unsupported",
      reason: "invalid_interaction",
      interaction,
    };
  if (mediaType(canonical[0]?.contentType ?? "") !== "application/json")
    return {
      classification: "mixed_or_unsupported",
      reason: "unsupported_content_type",
      interaction,
    };
  const text = fallback(interaction);
  if (text === null)
    return {
      classification: "mixed_or_unsupported",
      reason: "unsupported_signal",
      interaction,
    };
  if (input.bodies.html !== null && input.bodies.html !== "")
    return {
      classification: "mixed_or_unsupported",
      reason: "html_present",
      interaction,
    };
  const actual = (input.bodies.text ?? "").replace(/\r\n/g, "\n");
  const expected = text.replace(/\r\n/g, "\n");
  const matches =
    actual === "" ||
    actual === "\n" ||
    actual === expected ||
    actual === `${expected}\n`;
  return {
    classification: matches ? "informational_only" : "mixed_or_unsupported",
    reason: matches ? "informational_signal" : "text_mismatch",
    interaction,
  };
}
