/**
 * Transient API failures inside waits.
 *
 * A wait has a deadline. A rate limit (HTTP 429), a gateway or availability
 * failure (502, 503, 504) or a network error part way through it says
 * nothing about the thing being waited for, so the wait backs off and reads
 * again until its deadline instead of failing. Only idempotent reads go
 * through here; sends are never retried.
 *
 * The decision uses the HTTP status and headers of the generated client's
 * `responseStyle: "fields"` result, never the error text.
 */

import { sleep } from "./commands/emails-poll.js";

export type TransientFailure = {
  reason: "rate_limited" | "unavailable" | "network";
  status?: number;
  /** The server's Retry-After, in milliseconds from now, when it sent one. */
  retryAfterMs?: number;
};

export type TransientRetryOptions = {
  /**
   * When the wait ends: a timestamp in milliseconds, or null for a wait with
   * no deadline. Undefined means the call is not part of a wait, and a
   * transient failure is returned to the caller unretried.
   */
  deadline: number | null | undefined;
  /** Where the one-line backoff notice goes; stderr by default. */
  notice?: (message: string) => void;
  /** Told of each transient failure before its backoff. */
  onTransientFailure?: (failure: TransientFailure) => void;
};

type ResponseLike = {
  status?: unknown;
  headers?: { get?: (name: string) => string | null };
};

const BASE_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30_000;
const HTTP_DATE =
  /^[A-Za-z]{3}, \d{2} [A-Za-z]{3} \d{4} \d{2}:\d{2}:\d{2} GMT$/;

/**
 * Milliseconds to wait from a Retry-After value: delay-seconds or an
 * HTTP-date. Undefined when the value is missing or malformed.
 */
export function parseRetryAfter(
  value: string | null | undefined,
  now: number = Date.now(),
): number | undefined {
  const raw = value?.trim() ?? "";
  if (/^\d+$/.test(raw)) {
    const seconds = Number(raw);
    return Number.isSafeInteger(seconds) ? seconds * 1000 : undefined;
  }
  if (HTTP_DATE.test(raw)) {
    const at = Date.parse(raw);
    if (Number.isFinite(at)) return Math.max(0, at - now);
  }
  return undefined;
}

function responseOf(result: unknown): ResponseLike | undefined {
  if (!result || typeof result !== "object") return undefined;
  const response = (result as { response?: unknown }).response;
  return response && typeof response === "object"
    ? (response as ResponseLike)
    : undefined;
}

/** The HTTP status of a generated-client result, when it has a response. */
export function responseStatus(result: unknown): number | undefined {
  const status = responseOf(result)?.status;
  return typeof status === "number" ? status : undefined;
}

/**
 * Classify a generated-client result (`{ data, error, response }`). Null for
 * a success or a failure that retrying cannot fix.
 */
export function transientFailure(result: unknown): TransientFailure | null {
  if (!result || typeof result !== "object") return null;
  const error = (result as { error?: unknown }).error;
  const response = responseOf(result);
  const status = responseStatus(result);
  if (status === undefined) {
    // No response at all: the request never completed. An abort is the
    // caller's own deadline or cancellation, not a transient failure.
    return error instanceof Error && error.name !== "AbortError"
      ? { reason: "network" }
      : null;
  }
  if (status !== 429 && status !== 502 && status !== 503 && status !== 504)
    return null;
  const retryAfterMs = parseRetryAfter(response?.headers?.get?.("retry-after"));
  return {
    reason: status === 429 ? "rate_limited" : "unavailable",
    status,
    ...(retryAfterMs === undefined ? {} : { retryAfterMs }),
  };
}

/** Exponential backoff with jitter, for a failure without a Retry-After. */
export function backoffDelay(
  attempt: number,
  random: () => number = Math.random,
): number {
  const ceiling = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** attempt);
  return Math.round(ceiling / 2 + (random() * ceiling) / 2);
}

export function describeTransientFailure(failure: TransientFailure): string {
  if (failure.reason === "rate_limited") return "rate limited";
  if (failure.reason === "network") return "network error";
  return `API unavailable (HTTP ${failure.status})`;
}

function seconds(ms: number): string {
  return `${Math.ceil(ms / 1000)} s`;
}

/**
 * Print one notice and sleep before the next attempt, never past the
 * deadline. Resolves false when the deadline has passed.
 */
export async function pauseForTransientFailure(
  failure: TransientFailure,
  attempt: number,
  options: TransientRetryOptions,
): Promise<boolean> {
  options.onTransientFailure?.(failure);
  const deadline = options.deadline ?? null;
  const remaining =
    deadline === null ? Number.POSITIVE_INFINITY : deadline - Date.now();
  if (remaining <= 0) return false;
  const wanted = failure.retryAfterMs ?? backoffDelay(attempt);
  const delay = Math.min(wanted, remaining);
  const notice =
    options.notice ??
    ((message: string) => process.stderr.write(`${message}\n`));
  notice(
    delay < wanted
      ? `primitive: ${describeTransientFailure(failure)} (retry after ${seconds(wanted)}); this wait times out in ${seconds(delay)}.`
      : `primitive: ${describeTransientFailure(failure)}; retrying in ${seconds(delay)}.`,
  );
  await sleep(delay);
  return deadline === null || Date.now() < deadline;
}

/**
 * Run an idempotent read, retrying transient failures until the deadline.
 * Resolves the first result that is not transient, or null when the
 * deadline passes first (or the read itself resolved null).
 */
export async function retryTransient<T>(
  read: () => Promise<T | null>,
  options: TransientRetryOptions,
): Promise<T | null> {
  for (let attempt = 0; ; attempt += 1) {
    const result = await read();
    if (result === null) return null;
    const failure =
      options.deadline === undefined ? null : transientFailure(result);
    if (!failure) return result;
    if (!(await pauseForTransientFailure(failure, attempt, options)))
      return null;
  }
}

/** Thrown out of a wait's read when its deadline passed while backing off. */
export class WaitDeadlineReached extends Error {
  constructor() {
    super("The wait's deadline passed while retrying the API.");
    this.name = "WaitDeadlineReached";
  }
}

/**
 * Wrap a generated operation so that it retries transient failures.
 * `prepare` runs before every attempt, so an attempt can be fitted to the
 * time left (a long-poll's hold, say); returning null ends the wait.
 */
export function retryingOperation<
  F extends (options: never) => Promise<unknown>,
>(
  operation: F,
  options: TransientRetryOptions,
  prepare?: (input: Parameters<F>[0]) => Parameters<F>[0] | null,
): F {
  return (async (input: Parameters<F>[0]) => {
    const result = await retryTransient(() => {
      const attempt = prepare ? prepare(input) : input;
      return attempt === null
        ? Promise.resolve(null)
        : (operation(attempt) as Promise<unknown>);
    }, options);
    if (result === null) throw new WaitDeadlineReached();
    return result;
  }) as unknown as F;
}

function clean(text: string, max: number): string {
  // Server text goes to a terminal: fold control characters into spaces.
  let flat = "";
  for (const char of text) {
    const code = char.charCodeAt(0);
    flat += code < 0x20 || code === 0x7f ? " " : char;
  }
  flat = flat.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 3)}...` : flat;
}

/**
 * The API's own error code and message for a failed result, for a one-line
 * diagnostic: `not_found (Email not found)`, `HTTP 500`, or
 * `network error`.
 */
export function describeApiFailure(result: unknown): string {
  const raw =
    result && typeof result === "object"
      ? (result as { error?: unknown }).error
      : undefined;
  const status = responseStatus(result);
  // A transport error can carry local details (proxy URLs, paths); name it only.
  if (status === undefined && raw instanceof Error) return "network error";
  let payload: unknown = raw;
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    (payload as { error?: unknown }).error &&
    typeof (payload as { error?: unknown }).error === "object"
  )
    payload = (payload as { error: unknown }).error;
  const record =
    payload && typeof payload === "object"
      ? (payload as { code?: unknown; message?: unknown })
      : {};
  const code =
    typeof record.code === "string" && record.code
      ? clean(record.code, 80)
      : undefined;
  const message =
    typeof record.message === "string" && record.message
      ? clean(record.message, 200)
      : typeof payload === "string" && payload
        ? clean(payload, 200)
        : undefined;
  const label = code ?? (status === undefined ? "api_error" : `HTTP ${status}`);
  return message ? `${label} (${message})` : label;
}
