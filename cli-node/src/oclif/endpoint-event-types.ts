// `--event-types` on `endpoints create` and `endpoints update`.
//
// An endpoint's subscription lives in `rules.event_types`, a nested array
// the generated commands could only take through `--raw-body` JSON, so this
// flag sets it:
//
//   primitive endpoints create --url https://... \
//     --event-types email.received,sent_email.*
//
// The API expands a `family.*` name to every event in the family and refuses
// names it does not know. A webhook create that names no event types, by this
// flag or in the body, sends email.received.
//
// PATCH replaces `rules` as a whole. So on update, unless the caller also
// passes `rules` through `--raw-body`, the CLI reads the endpoint's current
// rules and changes only `event_types`, keeping its sender and size rules.
// It never fills in the URL: adding rule events to a webhook takes --url
// from the person, as the API asks.

import type { ListEndpointsFn } from "./endpoints-test-redirect.js";

export const EVENT_TYPES_FLAG_OPERATIONS = new Set([
  "createEndpoint",
  "updateEndpoint",
]);

export const EVENT_TYPES_FLAG_DESCRIPTION =
  "Event types this endpoint receives, comma separated or repeated (sets rules.event_types); `family.*` names a whole family. A webhook created without it receives email.received. On update it replaces the stored list, so restate the types to keep (--event-types email.received,email_rule_request.*); the endpoint's other rules are kept. Rule event types need a webhook of your own; to add them to an existing one, pass --url again.";

/** What a create that names no event types receives. */
export const DEFAULT_EVENT_TYPES: readonly string[] = ["email.received"];

export class EventTypesFlagError extends Error {}

/**
 * Turn the raw `--event-types` values into the list to send: split on
 * commas, trim, and drop duplicates while keeping the order the caller gave.
 */
export function parseEventTypesFlag(values: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    for (const raw of value.split(",")) {
      const name = raw.trim();
      if (name === "") continue;
      if (seen.has(name)) continue;
      seen.add(name);
      out.push(name);
    }
  }
  if (out.length === 0) {
    throw new EventTypesFlagError(
      "--event-types needs at least one event type, such as email.received.",
    );
  }
  return out;
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

/**
 * A webhook create's body with DEFAULT_EVENT_TYPES in rules.event_types when
 * it names none; any other body (a Function or pull endpoint, or no body at
 * all) as it is.
 */
export function withDefaultEventTypes(body: unknown): unknown {
  if (!isPlainObject(body)) return body;
  if (body.kind !== undefined && body.kind !== "http") return body;
  const rules = body.rules;
  if (rules !== undefined && !isPlainObject(rules)) return body;
  if (isPlainObject(rules) && rules.event_types !== undefined) return body;
  return withEventTypes(body, DEFAULT_EVENT_TYPES, {});
}
