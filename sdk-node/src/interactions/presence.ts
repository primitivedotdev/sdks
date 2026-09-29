/** Pure presence email preparation. Authentication and freshness belong to the caller. */
import {
  parseInteractionEnvelope,
  validateInteractionEnvelope,
} from "./index.js";

export const PRESENCE_PROTOCOL = "primitive.presence";
export const PRESENCE_VERSION = 1;
export const PRESENCE_TTL_MS = 600_000;
export const MAX_PRESENCE_ENVELOPE_BYTES = 4096;
export const MAX_PRESENCE_DECODED_BYTES = 8192;
export const MAX_PRESENCE_RENDERED_BYTES = 16384;
export const PRESENCE_PROBE_TEXT =
  "This email checks whether your receiver is available.";
export const PRESENCE_ALIVE_TEXT = "This receiver answered the presence check.";
export const PRESENCE_PROBE_SUBJECT = "Receiver presence check";
export const PRESENCE_ALIVE_SUBJECT = "Re: Receiver presence check";

export interface PresencePayload {
  nonce: string;
  issued_at: string;
  address: string;
}
export interface PresenceEnvelope {
  interaction_version: 1;
  interaction_id: string;
  protocol: typeof PRESENCE_PROTOCOL;
  protocol_version: 1;
  step: "probe" | "alive";
  step_id: string;
  prev_step_id: string | null;
  expires_at: string;
  payload: PresencePayload;
}
export type PresenceParseResult =
  | {
      status: "valid";
      envelope: PresenceEnvelope;
      source: { text: string; bytes?: Uint8Array };
    }
  | {
      status: "unsupported";
      version: number;
      source?: { text: string; bytes?: Uint8Array };
    }
  | { status: "invalid"; reason: string };
export interface PresenceProbeInput {
  accountScope: string;
  from: string;
  to: string;
}
export interface PresenceAliveInput extends PresenceProbeInput {
  /** Caller-authenticated probe. This helper does not authenticate it. */
  probe: PresenceEnvelope;
  messageId: string | null;
  references: readonly string[];
}
export interface PresenceDependencies {
  uuid: () => string;
  now: () => number;
}
export interface PresenceProbeDependencies extends PresenceDependencies {
  nonce: () => string;
}
export interface PreparedPresence {
  readonly accountScope: string;
  readonly preparedAtMs: number;
  readonly expiresAtMs: number;
  readonly idempotencyKey: string;
  readonly requestJson: string;
}
export type PresencePreparation =
  | { status: "waiting_on_parent" }
  | { status: "prepared"; prepared: PreparedPresence };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const NONCE = /^(?:[0-9a-f]{32}|[0-9a-f]{64})$/;
const LABEL = "[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?";
const HOST = new RegExp(`^${LABEL}(?:\\.${LABEL})+$`);
const MAILBOX = new RegExp(
  `^[a-z0-9!#$%&'*+/=?^_\x60{|}~-]+(?:\\.[a-z0-9!#$%&'*+/=?^_\x60{|}~-]+)*@${LABEL}(?:\\.${LABEL})+$`,
);
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
const encoder = new TextEncoder();
function check(value: boolean, message: string): asserts value {
  if (!value) throw new TypeError(message);
}
function timestamp(value: unknown): number | null {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  )
    return null;
  const time = Date.parse(value);
  return Number.isSafeInteger(time) &&
    time >= 0 &&
    time <= 253402300799999 &&
    new Date(time).toISOString() === value
    ? time
    : null;
}
function clock(value: number): number {
  check(
    Number.isSafeInteger(value) && value >= 0 && value <= 253402300799999,
    "invalid clock",
  );
  return value;
}
function mailbox(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 320 &&
    MAILBOX.test(value) &&
    (value.split("@")[1] ?? "").length <= 253
  );
}
function shape(value: unknown): PresenceEnvelope | null {
  const result = validateInteractionEnvelope(value);
  if (result.status !== "valid") return null;
  const e = result.envelope;
  if (
    Object.keys(e).length !== ENVELOPE_KEYS.length ||
    !ENVELOPE_KEYS.every((key) => Object.hasOwn(e, key)) ||
    e.protocol !== PRESENCE_PROTOCOL ||
    e.protocol_version !== 1
  )
    return null;
  const parts = e.interaction_id.split("@");
  if (
    !UUID.test(parts[0] ?? "") ||
    parts.length !== 2 ||
    !HOST.test(parts[1] ?? "") ||
    (parts[1] ?? "").length > 253 ||
    !UUID.test(e.step_id) ||
    parts[0] === e.step_id
  )
    return null;
  if (e.step !== "probe" && e.step !== "alive") return null;
  if (
    e.step === "probe"
      ? e.prev_step_id !== null
      : typeof e.prev_step_id !== "string" ||
        !UUID.test(e.prev_step_id) ||
        e.prev_step_id === e.step_id ||
        e.prev_step_id === parts[0]
  )
    return null;
  const p = e.payload;
  if (!p || typeof p !== "object" || Array.isArray(p)) return null;
  const payload = p as Record<string, unknown>;
  if (
    Object.keys(payload).length !== 3 ||
    !["nonce", "issued_at", "address"].every((key) =>
      Object.hasOwn(payload, key),
    ) ||
    typeof payload.nonce !== "string" ||
    !NONCE.test(payload.nonce) ||
    !mailbox(payload.address)
  )
    return null;
  const issued = timestamp(payload.issued_at),
    expires = timestamp(e.expires_at);
  if (
    issued === null ||
    expires === null ||
    expires - issued !== PRESENCE_TTL_MS
  )
    return null;
  return e as unknown as PresenceEnvelope;
}

/** Syntax only: valid expired controls stay valid. No clock, authentication, or IO. */
export function parsePresenceEnvelope(
  input: string | Uint8Array,
): PresenceParseResult {
  if (typeof input !== "string" && !(input instanceof Uint8Array))
    return { status: "invalid", reason: "invalid_input" };
  if (
    input.length > MAX_PRESENCE_ENVELOPE_BYTES ||
    (typeof input === "string" &&
      encoder.encode(input).length > MAX_PRESENCE_ENVELOPE_BYTES)
  )
    return { status: "invalid", reason: "too_large" };
  const parsed = parseInteractionEnvelope(input);
  if (parsed.status !== "valid") return parsed;
  if (
    parsed.envelope.protocol === PRESENCE_PROTOCOL &&
    parsed.envelope.protocol_version !== 1
  )
    return {
      status: "unsupported",
      version: parsed.envelope.protocol_version,
      source: parsed.source,
    };
  const envelope = shape(parsed.envelope);
  return envelope && parsed.source
    ? { status: "valid", envelope, source: parsed.source }
    : { status: "invalid", reason: "invalid_presence" };
}
function context(input: PresenceProbeInput): { from: string; to: string } {
  check(
    typeof input.accountScope === "string" &&
      input.accountScope.length > 0 &&
      input.accountScope.length <= 256 &&
      /^[\x20-\x7e]+$/.test(input.accountScope),
    "invalid account scope",
  );
  check(
    typeof input.from === "string" && typeof input.to === "string",
    "invalid mailbox",
  );
  check(
    /^[\x21-\x7e]+$/.test(input.from) && /^[\x21-\x7e]+$/.test(input.to),
    "use one bare ASCII mailbox per address",
  );
  const from = input.from.toLowerCase(),
    to = input.to.toLowerCase();
  check(mailbox(from) && mailbox(to), "use one bare ASCII mailbox per address");
  return { from, to };
}
function uuid(dependencies: PresenceDependencies): string {
  const value = dependencies.uuid().toLowerCase();
  check(UUID.test(value), "invalid UUID");
  return value;
}
function messageId(value: string): string {
  check(
    typeof value === "string" && value.length <= 1024,
    "invalid Message-ID",
  );
  let id = value.replace(/^ +| +$/g, "");
  if (id.startsWith("<") && id.endsWith(">")) id = id.slice(1, -1);
  check(
    id.length <= 996 &&
      /^[!-~]+@[!-~]+$/.test(id) &&
      !/[<>]/.test(id) &&
      id.split("@").length === 2,
    "invalid Message-ID",
  );
  return `<${id}>`;
}
function base64(bytes: Uint8Array): string {
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let result = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0,
      b = bytes[i + 1] ?? 0,
      c = bytes[i + 2] ?? 0;
    result +=
      alphabet.charAt(a >> 2) +
      alphabet.charAt(((a & 3) << 4) | (b >> 4)) +
      (i + 1 < bytes.length
        ? alphabet.charAt(((b & 15) << 2) | (c >> 6))
        : "=") +
      (i + 2 < bytes.length ? alphabet.charAt(c & 63) : "=");
  }
  return result;
}
function prepare(
  input: PresenceProbeInput,
  envelope: PresenceEnvelope,
  observed: number,
  threading?: { in_reply_to: string; references: string[] },
): PresencePreparation {
  const { from, to } = context(input);
  const canonical = {
    interaction_version: envelope.interaction_version,
    interaction_id: envelope.interaction_id,
    protocol: envelope.protocol,
    protocol_version: envelope.protocol_version,
    step: envelope.step,
    step_id: envelope.step_id,
    prev_step_id: envelope.prev_step_id,
    expires_at: envelope.expires_at,
    payload: {
      nonce: envelope.payload.nonce,
      issued_at: envelope.payload.issued_at,
      address: envelope.payload.address,
    },
  };
  const json = JSON.stringify(canonical),
    bytes = encoder.encode(json);
  const text =
    envelope.step === "probe" ? PRESENCE_PROBE_TEXT : PRESENCE_ALIVE_TEXT;
  check(
    bytes.length <= MAX_PRESENCE_ENVELOPE_BYTES &&
      bytes.length + text.length <= MAX_PRESENCE_DECODED_BYTES,
    "presence content too large",
  );
  const encoded = base64(bytes);
  // Reserve 4 KiB for MIME delimiters and transport headers. Hosts also enforce actual rendered size.
  const renderedBudget =
    4096 +
    from.length +
    to.length +
    encoded.length +
    Math.ceil(encoded.length / 76) * 2 +
    text.length +
    (threading
      ? threading.in_reply_to.length + threading.references.join(" ").length
      : 0);
  check(
    renderedBudget <= MAX_PRESENCE_RENDERED_BYTES,
    "presence carrier too large",
  );
  const body = {
    from,
    to,
    subject:
      envelope.step === "probe"
        ? PRESENCE_PROBE_SUBJECT
        : PRESENCE_ALIVE_SUBJECT,
    body_text: text,
    ...(threading ?? {}),
    attachments: [
      {
        filename: "interaction.json",
        content_type: "application/json",
        content_base64: encoded,
      },
    ],
  };
  const expires = timestamp(envelope.expires_at);
  check(expires !== null, "invalid expiry");
  return {
    status: "prepared",
    prepared: Object.freeze({
      accountScope: input.accountScope,
      preparedAtMs: observed,
      expiresAtMs: expires,
      idempotencyKey: `presence-${envelope.step_id}`,
      requestJson: JSON.stringify(body),
    }),
  };
}
/** Prepare once and persist the result before any ordinary send operation. */
export function preparePresenceProbeEmail(
  input: PresenceProbeInput,
  dependencies: PresenceProbeDependencies,
): PresencePreparation {
  const { from, to } = context(input);
  const observed = clock(dependencies.now());
  clock(observed + PRESENCE_TTL_MS);
  const interaction = uuid(dependencies),
    step = uuid(dependencies),
    nonce = dependencies.nonce();
  check(interaction !== step, "distinct UUIDs are required");
  check(
    typeof nonce === "string" && NONCE.test(nonce),
    "nonce must be 128 or 256 bits of lowercase hex",
  );
  return prepare(
    input,
    {
      interaction_version: 1,
      interaction_id: `${interaction}@${from.split("@")[1]}`,
      protocol: PRESENCE_PROTOCOL,
      protocol_version: 1,
      step: "probe",
      step_id: step,
      prev_step_id: null,
      expires_at: new Date(observed + PRESENCE_TTL_MS).toISOString(),
      payload: {
        nonce,
        issued_at: new Date(observed).toISOString(),
        address: to,
      },
    },
    observed,
  );
}
/** Caller verifies issuer, exact bytes, current binding and server freshness first. */
export function preparePresenceAliveEmail(
  input: PresenceAliveInput,
  dependencies: PresenceDependencies,
): PresencePreparation {
  if (input.messageId === null || input.messageId === "")
    return { status: "waiting_on_parent" };
  const target = messageId(input.messageId),
    { from } = context(input),
    probe = shape(input.probe);
  check(probe !== null && probe.step === "probe", "a valid probe is required");
  check(from === probe.payload.address, "probe recipient mismatch");
  check(
    Array.isArray(input.references) && input.references.length <= 1000,
    "too many references",
  );
  let references = input.references
    .map(messageId)
    .filter((id) => id !== target);
  references.push(target);
  while (references.length > 100 || references.join(" ").length > 8192)
    references = references.slice(1);
  const observed = clock(dependencies.now()),
    step = uuid(dependencies);
  check(
    step !== probe.step_id && step !== probe.interaction_id.split("@")[0],
    "distinct UUIDs are required",
  );
  return prepare(
    input,
    {
      ...probe,
      step: "alive",
      step_id: step,
      prev_step_id: probe.step_id,
      payload: { ...probe.payload },
    },
    observed,
    { in_reply_to: target, references },
  );
}
