/** Explicit preparation of optional email signals. This module never sends automatically. */
export interface SignalParent {
  accountScope: string;
  /** Authenticated original sender, as a bare mailbox. */
  from: string;
  /** Explicit authorized recipient identity to send from, as a bare mailbox. */
  to: string;
  messageId: string | null;
  subject: string | null;
  references: readonly string[];
}
export type SignalInput = { parent: SignalParent } & (
  | {
      kind: "ack";
      status: "received" | "will_process" | "will_not_process";
      note?: string;
    }
  | { kind: "read" }
  | { kind: "working"; expiresAtMs: number }
);
export interface SignalDependencies {
  uuid: () => string;
  /** Unix time in integer milliseconds. */
  now: () => number;
}
/** Persist this whole value before dispatch. requestJson fixes the ordinary send body. */
export interface PreparedSignal {
  readonly accountScope: string;
  readonly preparedAtMs: number;
  readonly expiresAtMs: number | null;
  readonly idempotencyKey: string;
  readonly requestJson: string;
}
export type SignalPreparation =
  | { status: "waiting_on_parent" }
  | { status: "prepared"; prepared: PreparedSignal };
export interface SignalSendBody {
  from: string;
  to: string;
  subject: string;
  body_text: string;
  in_reply_to: string;
  references: string[];
  attachments: {
    filename: string;
    content_type: string;
    content_base64: string;
  }[];
}
export type SignalSendResult<T> =
  | { status: "response"; result: T }
  | { status: "expired"; idempotencyKey: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ATOM = "[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+";
const MAILBOX = new RegExp(
  `^${ATOM}(?:\\.${ATOM})*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)(?:\\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*$`,
);
const ID = /^[!-~]+@[!-~]+$/;
const encoder = new TextEncoder();
function check(condition: boolean, message: string): asserts condition {
  if (!condition) throw new TypeError(message);
}
function header(value: string, limit: number): void {
  check(
    typeof value === "string" &&
      ![...value].some(
        (char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127,
      ) &&
      !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(
        value,
      ) &&
      encoder.encode(value).length <= limit,
    "invalid header",
  );
}
function wireId(value: string): string {
  check(typeof value === "string", "invalid Message-ID");
  // Only ASCII outer spaces are normalized; CR/LF are never accepted.
  let id = value.replace(/^ +| +$/g, "");
  if (id.startsWith("<") && id.endsWith(">")) id = id.slice(1, -1);
  check(
    ID.test(id) &&
      !/[<>]/.test(id) &&
      id.split("@").length === 2 &&
      id.length <= 996,
    "invalid Message-ID",
  );
  return `<${id}>`;
}
function milliseconds(value: number): void {
  check(
    Number.isSafeInteger(value) && value >= 0 && value <= 253402300799999,
    "invalid clock or expiry",
  );
}
function signalJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
function base64(bytes: Uint8Array): string {
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0,
      b = bytes[i + 1] ?? 0,
      c = bytes[i + 2] ?? 0;
    out += alphabet[a >> 2];
    out += alphabet[((a & 3) << 4) | (b >> 4)];
    out += i + 1 < bytes.length ? alphabet[((b & 15) << 2) | (c >> 6)] : "=";
    out += i + 2 < bytes.length ? alphabet[c & 63] : "=";
  }
  return out;
}
export function prepareSignalEmail(
  input: SignalInput,
  dependencies: SignalDependencies,
): SignalPreparation {
  const p = input.parent;
  if (p.messageId === null || p.messageId === "")
    return { status: "waiting_on_parent" };
  const target = wireId(p.messageId);
  for (const address of [p.from, p.to]) {
    header(address, 320);
    check(MAILBOX.test(address), "use one bare mailbox per address");
  }
  const subject = p.subject ?? "";
  header(subject, 998);
  header(p.accountScope, 256);
  check(p.accountScope.length > 0, "accountScope is required");
  check(p.references.length <= 1000, "too many references");
  let references = p.references.map(wireId).filter((id) => id !== target);
  references.push(target);
  let length = references.reduce((total, id) => total + id.length + 1, -1);
  let start = 0;
  while (references.length - start > 100 || length > 8192) {
    length -= (references[start]?.length ?? 0) + 1;
    start++;
  }
  references = references.slice(start);
  const now = dependencies.now();
  milliseconds(now);
  let expires: number | null = null;
  const payload: Record<string, string> = { subject_message_id: target };
  let text: string;
  if (input.kind === "ack") {
    const bodies = {
      received: "Received your message.",
      will_process: "I intend to process your message.",
      will_not_process: "I will not process your message.",
    };
    check(Object.hasOwn(bodies, input.status), "invalid ACK status");
    payload.status = input.status;
    text = bodies[input.status];
    if (input.note !== undefined) {
      check(
        typeof input.note === "string" &&
          input.note.length <= 2000 &&
          !input.note.includes("\0") &&
          !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(
            input.note,
          ),
        "invalid note",
      );
      payload.note = input.note;
      text += `\n\n${input.note}`;
    }
  } else if (input.kind === "read") text = "I read your message.";
  else {
    check(input.kind === "working", "invalid signal kind");
    milliseconds(input.expiresAtMs);
    check(
      input.expiresAtMs > now && input.expiresAtMs - now <= 60_000,
      "working expiry must be within 60 seconds",
    );
    expires = input.expiresAtMs;
    text = "I am working on your message.";
  }
  const interaction = dependencies.uuid().toLowerCase(),
    step = dependencies.uuid().toLowerCase();
  check(
    UUID.test(interaction) && UUID.test(step) && interaction !== step,
    "two distinct UUIDs are required",
  );
  const envelope = signalJson({
    interaction_version: 1,
    interaction_id: `${interaction}@${p.to.split("@")[1]}`,
    protocol: input.kind,
    protocol_version: 1,
    step: input.kind,
    step_id: step,
    prev_step_id: null,
    expires_at: expires === null ? null : new Date(expires).toISOString(),
    payload,
  });
  const bytes = encoder.encode(envelope);
  check(bytes.length <= 65_536, "signal exceeds 64 KiB");
  const body: SignalSendBody = {
    from: p.to,
    to: p.from,
    subject: subject || "Re: Your message",
    body_text: text,
    in_reply_to: target,
    references,
    attachments: [
      {
        filename: "interaction.json",
        content_type: "application/json",
        content_base64: base64(bytes),
      },
    ],
  };
  return {
    status: "prepared",
    prepared: Object.freeze({
      accountScope: p.accountScope,
      preparedAtMs: now,
      expiresAtMs: expires,
      idempotencyKey: `signal-${step}`,
      requestJson: signalJson(body),
    }),
  };
}
/** One ordinary send attempt; the caller owns persistence, reconciliation and retries. */
export async function sendPreparedSignal<T>(
  sendMail: (body: SignalSendBody, idempotencyKey: string) => Promise<T>,
  prepared: PreparedSignal,
  options: { accountScope: string; now: () => number },
): Promise<SignalSendResult<T>> {
  check(
    options.accountScope === prepared.accountScope &&
      options.accountScope.length > 0,
    "account scope mismatch",
  );
  const now = options.now();
  milliseconds(now);
  if (prepared.expiresAtMs !== null && now >= prepared.expiresAtMs)
    return { status: "expired", idempotencyKey: prepared.idempotencyKey };
  // Parse a new copy for the adapter so mutations cannot alter future retries.
  return {
    status: "response",
    result: await sendMail(
      JSON.parse(prepared.requestJson) as SignalSendBody,
      prepared.idempotencyKey,
    ),
  };
}
