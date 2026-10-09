// `--event-types` on `endpoints create` and `endpoints update`.
//
// An endpoint's subscription lives in `rules.event_types`, a nested array
// the generated commands could only take through `--raw-body` JSON. The
// opt-in `sent_email.*` events reach an endpoint only when that list names
// them, so this flag makes the common case one flag:
//
//   primitive endpoints create --url https://... \
//     --event-types sent_email.accepted,sent_email.delivered,sent_email.failed,sent_email.completed
//
// The server matches the list by exact string and does not reject unknown
// names, so a typo silently matches nothing. The CLI warns about names it
// does not know, and expands the `sent_email.*` shorthand (which the server
// would otherwise store as a literal that matches nothing) to the four
// events.
//
// PATCH replaces `rules` as a whole. So on update, unless the caller also
// passes `rules` through `--raw-body`, the CLI reads the endpoint's current
// rules and changes only `event_types`, keeping its sender and size rules.

import {
  SENT_EMAIL_EVENT_TYPES,
  WEBHOOK_EVENT_TYPES,
} from "@primitivedotdev/sdk/webhook";
import type { ListEndpointsFn } from "./endpoints-test-redirect.js";

export const EVENT_TYPES_FLAG_OPERATIONS = new Set([
  "createEndpoint",
  "updateEndpoint",
]);

export const EVENT_TYPES_FLAG_DESCRIPTION =
  "Event types this endpoint subscribes to, comma separated or repeated (sets rules.event_types). Omitting the subscription means every event type except the opt-in sent_email.* events, which an endpoint receives only when it lists them; sent_email.* expands to all four. Keep email.received in the list if the endpoint also handles inbound mail. On update, the endpoint's other rules are kept.";

export const MAX_EVENT_TYPES = 50;

const SENT_EMAIL_WILDCARD = "sent_email.*";
const KNOWN_EVENT_TYPES = new Set<string>(WEBHOOK_EVENT_TYPES);

export class EventTypesFlagError extends Error {}

/**
 * Turn the raw `--event-types` values into the list to store: split on
 * commas, trim, expand `sent_email.*`, and drop duplicates while keeping the
 * order the caller gave.
 */
export function parseEventTypesFlag(values: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    for (const raw of value.split(",")) {
      const name = raw.trim();
      if (name === "") continue;
      const names =
        name === SENT_EMAIL_WILDCARD ? [...SENT_EMAIL_EVENT_TYPES] : [name];
      for (const entry of names) {
        if (seen.has(entry)) continue;
        seen.add(entry);
        out.push(entry);
      }
    }
  }
  if (out.length === 0) {
    throw new EventTypesFlagError(
      "--event-types needs at least one event type. To receive every event type except the opt-in sent_email.* events, omit the subscription instead.",
    );
  }
  if (out.length > MAX_EVENT_TYPES) {
    throw new EventTypesFlagError(
      `--event-types accepts at most ${MAX_EVENT_TYPES} event types (got ${out.length}).`,
    );
  }
  return out;
}

/** The names in `eventTypes` this CLI does not recognise. */
export function unknownEventTypes(eventTypes: readonly string[]): string[] {
  return eventTypes.filter((name) => !KNOWN_EVENT_TYPES.has(name));
}

export function unknownEventTypesWarning(unknown: readonly string[]): string {
  return `Warning: ${unknown.join(", ")} ${unknown.length === 1 ? "is" : "are"} not an event type this CLI knows. Subscriptions match exact names, so a misspelled name receives nothing. Continuing; newer event types may not be known to this CLI yet.\n`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * The rules an update starts from: the endpoint's current rules, read from
 * the endpoint list. Throws when the endpoint cannot be found, so an update
 * never replaces rules it could not read.
 */
export async function currentEndpointRules(
  endpointId: string,
  listEndpoints: ListEndpointsFn,
): Promise<Record<string, unknown>> {
  const response = await listEndpoints();
  if (response.error) {
    throw new EventTypesFlagError(
      "Could not read the endpoint's current rules to keep them. Retry, or pass the full rules with --raw-body.",
    );
  }
  const row = (response.data?.data ?? []).find(
    (endpoint) => endpoint.id === endpointId,
  );
  if (!row) {
    throw new EventTypesFlagError(
      `No endpoint ${endpointId} is visible to this credential, so its rules cannot be updated.`,
    );
  }
  return isPlainObject(row.rules) ? row.rules : {};
}

/**
 * Put `eventTypes` in the request body's `rules.event_types`, on top of
 * `baseRules` (rules the caller passed in the body win over `baseRules`).
 */
export function withEventTypes(
  body: unknown,
  eventTypes: readonly string[],
  baseRules: Record<string, unknown> = {},
): Record<string, unknown> {
  if (body !== undefined && !isPlainObject(body)) {
    throw new EventTypesFlagError(
      "--raw-body must be a JSON object when also passing --event-types.",
    );
  }
  const current = body ?? {};
  if (current.rules !== undefined && !isPlainObject(current.rules)) {
    throw new EventTypesFlagError(
      "rules in --raw-body must be a JSON object when also passing --event-types.",
    );
  }
  const explicitRules = (current.rules as Record<string, unknown>) ?? {};
  return {
    ...current,
    rules: { ...baseRules, ...explicitRules, event_types: [...eventTypes] },
  };
}

/** True when the caller already passed `rules` in the request body. */
export function bodyHasRules(body: unknown): boolean {
  return isPlainObject(body) && body.rules !== undefined;
}
