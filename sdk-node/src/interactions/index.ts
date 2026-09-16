/** Portable interaction parsing and explicit signal helpers. Parsing has no effects. */
export type { InteractionEnvelope } from "../x402/sign.js";

import type { InteractionEnvelope } from "../x402/sign.js";

export const MAX_INTERACTION_BYTES = 65_536;
export const MAX_INTERACTION_DEPTH = 64;
export type InteractionValidationResult =
  | { status: "valid"; envelope: InteractionEnvelope & Record<string, unknown> }
  | { status: "unsupported"; version: number }
  | {
      status: "invalid";
      reason:
        | "invalid_input"
        | "too_large"
        | "invalid_json"
        | "invalid_envelope";
    };
export type InteractionParseResult = InteractionValidationResult & {
  /** Present on valid/unsupported input. Bytes are a defensive copy, never reserialized. */
  source?: { text: string; bytes?: Uint8Array };
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const WIRE_ID = new RegExp(`^${UUID.source.slice(1, -1)}@[^\\s@]+$`, "i");
function scalarString(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(++i);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
    } else if (code >= 0xdc00 && code <= 0xdfff) return false;
  }
  return true;
}
function safeNumber(value: number): boolean {
  return (
    Number.isFinite(value) &&
    (!Number.isInteger(value) || Number.isSafeInteger(value))
  );
}

// Scan before JSON.parse: duplicate decoded keys, Unicode and number tokens must
// not be silently normalized by the host JSON implementation.
function scan(text: string): void {
  let at = 0;
  const fail = (): never => {
    throw new Error("invalid JSON");
  };
  const space = () => {
    while (/[\x20\t\r\n]/.test(text[at] ?? "")) at++;
  };
  const string = (): string => {
    const start = at++;
    while (at < text.length) {
      const char = text[at++];
      if (char === "\\") {
        at++;
        continue;
      }
      if (char === '"') {
        const value: unknown = JSON.parse(text.slice(start, at));
        if (typeof value !== "string" || !scalarString(value)) fail();
        return value as string;
      }
    }
    return fail();
  };
  const value = (depth: number): void => {
    space();
    const char = text[at];
    if (char === "{" || char === "[") {
      if (depth >= MAX_INTERACTION_DEPTH) fail();
      at++;
      space();
      const close = char === "{" ? "}" : "]";
      const keys = new Set<string>();
      if (text[at] === close) {
        at++;
        return;
      }
      while (at < text.length) {
        if (char === "{") {
          if (text[at] !== '"') fail();
          const key = string();
          if (keys.has(key)) fail();
          keys.add(key);
          space();
          if (text[at++] !== ":") fail();
        }
        value(depth + 1);
        space();
        if (text[at] === close) {
          at++;
          return;
        }
        if (text[at++] !== ",") fail();
        space();
      }
      fail();
    } else if (char === '"') string();
    else {
      const start = at;
      while (at < text.length && !/[\x20\t\r\n,\]}]/.test(text[at] ?? "")) at++;
      const token = text.slice(start, at);
      if (["true", "false", "null"].includes(token)) return;
      if (
        token.length > 128 ||
        !/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(token) ||
        !safeNumber(Number(token))
      )
        fail();
    }
  };
  value(0);
  space();
  if (at !== text.length) fail();
}
function envelope(value: unknown): InteractionValidationResult {
  const invalid = { status: "invalid", reason: "invalid_envelope" } as const;
  if (!value || typeof value !== "object" || Array.isArray(value))
    return invalid;
  const obj = value as Record<string, unknown>;
  if (!Object.hasOwn(obj, "interaction_version")) return invalid;
  const version = obj.interaction_version;
  if (
    typeof version !== "number" ||
    !Number.isSafeInteger(version) ||
    version < 1
  )
    return invalid;
  if (version !== 1) return { status: "unsupported", version };
  if (
    ![
      "interaction_id",
      "protocol",
      "protocol_version",
      "step",
      "step_id",
      "prev_step_id",
      "expires_at",
      "payload",
    ].every((key) => Object.hasOwn(obj, key))
  )
    return invalid;
  if (
    typeof obj.interaction_id !== "string" ||
    !WIRE_ID.test(obj.interaction_id) ||
    typeof obj.protocol !== "string" ||
    !obj.protocol.trim() ||
    typeof obj.protocol_version !== "number" ||
    !Number.isSafeInteger(obj.protocol_version) ||
    obj.protocol_version < 1 ||
    typeof obj.step !== "string" ||
    !obj.step.trim() ||
    typeof obj.step_id !== "string" ||
    !UUID.test(obj.step_id) ||
    !(
      obj.prev_step_id === null ||
      (typeof obj.prev_step_id === "string" && UUID.test(obj.prev_step_id))
    ) ||
    !(obj.expires_at === null || typeof obj.expires_at === "string") ||
    !Object.hasOwn(obj, "payload")
  )
    return invalid;
  return {
    status: "valid",
    envelope: obj as InteractionEnvelope & Record<string, unknown>,
  };
}

/** Parse at most 64 KiB of strict UTF-8 JSON. Unknown protocols remain valid. */
export function parseInteractionEnvelope(
  input: string | Uint8Array,
): InteractionParseResult {
  try {
    if (typeof input !== "string" && !(input instanceof Uint8Array))
      return { status: "invalid", reason: "invalid_input" };
    if (input.length > MAX_INTERACTION_BYTES)
      return { status: "invalid", reason: "too_large" };
    const bytes = typeof input === "string" ? undefined : new Uint8Array(input);
    const text =
      typeof input === "string"
        ? input
        : new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
            bytes,
          );
    if (!scalarString(text))
      return { status: "invalid", reason: "invalid_json" };
    if (new TextEncoder().encode(text).length > MAX_INTERACTION_BYTES)
      return { status: "invalid", reason: "too_large" };
    scan(text);
    const result = envelope(JSON.parse(text));
    return result.status === "invalid"
      ? result
      : { ...result, source: bytes ? { text, bytes } : { text } };
  } catch {
    return { status: "invalid", reason: "invalid_json" };
  }
}

/** Validate a decoded JSON value. Cannot detect lost duplicate keys or original bytes. */
export function validateInteractionEnvelope(
  input: unknown,
): InteractionValidationResult {
  try {
    let budget = MAX_INTERACTION_BYTES;
    const seen = new Set<object>();
    const clone = (value: unknown, depth: number): unknown => {
      if (--budget < 0) throw new Error("too large");
      if (value === null || typeof value === "boolean") return value;
      if (typeof value === "string") {
        if (value.length > budget) throw new Error("too large");
        budget -= new TextEncoder().encode(value).length;
        if (budget < 0 || !scalarString(value))
          throw new Error("invalid string");
        return value;
      }
      if (typeof value === "number" && safeNumber(value)) return value;
      if (
        typeof value !== "object" ||
        !value ||
        depth >= MAX_INTERACTION_DEPTH ||
        seen.has(value)
      )
        throw new Error("invalid value");
      const array = Array.isArray(value);
      if (
        array
          ? Object.getPrototypeOf(value) !== Array.prototype
          : ![Object.prototype, null].includes(Object.getPrototypeOf(value))
      )
        throw new Error("not JSON");
      seen.add(value);
      const out: Record<string, unknown> | unknown[] = array
        ? []
        : Object.create(null);
      const keys = Reflect.ownKeys(value);
      if (keys.length - (array ? 1 : 0) > budget) throw new Error("too large");
      if (
        array &&
        Object.getOwnPropertyDescriptor(value, "length")?.value !==
          keys.length - 1
      )
        throw new Error("sparse array");
      for (const key of keys) {
        if (array && key === "length") continue;
        if (typeof key !== "string") throw new Error("invalid key");
        if ((!array && key.length >= budget) || (array && key.length > 10))
          throw new Error("too large");
        if (!scalarString(key)) throw new Error("invalid key");
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!descriptor?.enumerable || !("value" in descriptor))
          throw new Error("not JSON data");
        if (array && !/^(0|[1-9]\d*)$/.test(key))
          throw new Error("invalid array key");
        if (!array) {
          budget -= 1 + new TextEncoder().encode(key).length;
        }
        Object.defineProperty(out, key, {
          value: clone(descriptor.value, depth + 1),
          enumerable: true,
          writable: true,
          configurable: true,
        });
      }
      if (array && (out as unknown[]).length !== keys.length - 1)
        throw new Error("sparse array");
      seen.delete(value);
      return out;
    };
    return envelope(clone(input, 0));
  } catch {
    return { status: "invalid", reason: "invalid_input" };
  }
}

export type {
  PreparedSignal,
  SignalDependencies,
  SignalInput,
  SignalParent,
  SignalPreparation,
  SignalSendBody,
  SignalSendResult,
} from "./signals.js";
export { prepareSignalEmail, sendPreparedSignal } from "./signals.js";
