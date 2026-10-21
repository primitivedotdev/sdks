import { Errors } from "@oclif/core";
import { extractErrorCode, hasControlCharacter } from "./api-command.js";

/**
 * Options shared by `send` and `reply` that map straight onto request
 * fields: custom headers (`--header`) and, for `send`, a schedule time
 * (`--scheduled-at`). Only the shape is checked here. Which header names
 * are allowed, and how far ahead a send may be scheduled, are the
 * server's rules, and its `validation_error` says what to change.
 */

export const HEADER_FLAG_DESCRIPTION =
  "Extra header to send, as `Name: value` or `Name=value`. Repeatable, once per name (names compare case-insensitively), at most 25. The server decides which names are allowed: Auto-Submitted, Precedence, X-Auto-Response-Suppress, or a custom X- name that is not credential-like and not in a reserved family; a refused name is a validation_error. Values are 1 to 200 printable ASCII characters. Custom headers are sent as spelled and are not DKIM-signed.";

// The request schema's header-name rule: letters and digits in groups
// joined by single hyphens.
const HEADER_NAME = /^[A-Za-z0-9]+(-[A-Za-z0-9]+)*$/;
const HEADER_EXAMPLE = '--header "X-Campaign-Id: spring-sale"';

function headerError(message: string): Errors.CLIError {
  return new Errors.CLIError(message, { exit: 2 });
}

/**
 * Parse repeated `--header` values into the request's `headers` object.
 * Each value is `Name: value` or `Name=value`, split at the first `:` or
 * `=` (a header name holds neither, so the value may). Returns undefined
 * when no header was passed.
 */
export function parseHeaderFlags(
  values: readonly string[] | undefined,
): Record<string, string> | undefined {
  if (values === undefined || values.length === 0) return undefined;
  const headers: Record<string, string> = {};
  const seen = new Map<string, string>();
  for (const entry of values) {
    const separator = entry.search(/[:=]/);
    if (separator === -1)
      throw headerError(
        `--header expects "Name: value" or "Name=value" (got ${JSON.stringify(entry)}). Example: ${HEADER_EXAMPLE}`,
      );
    // Checked on the raw text: trimming first would quietly drop a
    // trailing line break instead of refusing it.
    if (hasControlCharacter(entry))
      throw headerError(
        `--header ${JSON.stringify(entry)} has a control character (such as a line break). Names and values are printable ASCII.`,
      );
    const name = entry.slice(0, separator).trim();
    const value = entry.slice(separator + 1).trim();
    if (!HEADER_NAME.test(name))
      throw headerError(
        `--header name ${JSON.stringify(name)} is not a header name: use letters and digits joined by single hyphens, such as X-Campaign-Id. Example: ${HEADER_EXAMPLE}`,
      );
    if (value === "")
      throw headerError(
        `--header ${name} has no value. Example: ${HEADER_EXAMPLE}`,
      );
    const key = name.toLowerCase();
    const earlier = seen.get(key);
    if (earlier !== undefined)
      throw headerError(
        earlier === name
          ? `--header ${name} is given more than once. Pass each header once.`
          : `--header ${earlier} and ${name} name the same header (names compare case-insensitively). Pass each header once.`,
      );
    seen.set(key, name);
    headers[name] = value;
  }
  return headers;
}

/**
 * One readable line for a `validation_error` on a request that carried
 * custom headers or a schedule time, so the server's reason is not
 * buried in the JSON error. Null for any other error, or when the
 * request carried neither.
 */
export function sendOptionsValidationHint(
  payload: unknown,
  sent: { headers?: Record<string, string>; scheduledAt?: string },
): string | null {
  if (sent.headers === undefined && sent.scheduledAt === undefined) return null;
  if (extractErrorCode(payload) !== "validation_error") return null;
  const inner =
    payload && typeof payload === "object" && "error" in payload
      ? (payload as { error?: unknown }).error
      : payload;
  const message = (inner as { message?: unknown } | null)?.message;
  if (typeof message !== "string" || message.trim() === "") return null;
  const reason = message.trim();
  const advice: string[] = [];
  if (sent.headers !== undefined && /header/i.test(reason))
    advice.push(
      "Check the --header names and values; --help lists which names are allowed.",
    );
  if (sent.scheduledAt !== undefined && /schedul/i.test(reason))
    advice.push(
      "--scheduled-at must be in the future and at most 30 days out.",
    );
  return [`The API refused the request: ${reason}`, ...advice].join(" ");
}

// An ISO 8601 date and time with an explicit zone (Z or a numeric
// offset). A zone-less time would be read as local time here but is
// refused by the API, so it is refused before any request.
const ISO_INSTANT_WITH_ZONE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/i;

/** True for an ISO 8601 date and time with Z or a numeric UTC offset. */
export function isIsoInstantWithZone(value: string): boolean {
  return ISO_INSTANT_WITH_ZONE.test(value) && !Number.isNaN(Date.parse(value));
}

export const SCHEDULED_AT_FLAG_DESCRIPTION =
  "Send later instead of now: an ISO 8601 time with Z or a numeric UTC offset, such as 2026-10-09T17:00:00Z or 2026-10-09T13:00:00-04:00. The server requires it to be in the future and at most 30 days out. The send is recorded with status scheduled and goes out at that time; cancel it before then with `primitive sent cancel --id <id>` or `primitive sent cancel --idempotency-key <key>`. Cannot be combined with --wait, --wait-timeout-ms, --attachment, --fyi or --if-latest-message-id.";

/** Validate `--scheduled-at` before any request. */
export function assertScheduledAt(value: string): string {
  const trimmed = value.trim();
  if (!isIsoInstantWithZone(trimmed))
    throw new Errors.CLIError(
      "--scheduled-at must be an ISO 8601 time with a time zone, such as 2026-10-09T17:00:00Z or 2026-10-09T13:00:00-04:00.",
      { exit: 2 },
    );
  return trimmed;
}
