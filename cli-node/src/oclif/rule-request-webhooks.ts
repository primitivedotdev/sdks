// What the CLI adds when the API refuses a webhook for rule request events
// (email_rule_request.*). Such a webhook belongs to the person who makes it,
// signed in as themself, and is always a route target: the API refuses one
// made with an API key or another app, one given to an existing webhook, and
// one asked to be a default.

import { EMAIL_RULE_REQUEST_EVENT_TYPES } from "@primitivedotdev/sdk/webhook";

/** The refusal reason the API gives for a rule request webhook made or changed by anyone else. */
export const RULE_REQUEST_WEBHOOK_REFUSAL_REASON =
  "rule_request_events_need_own_webhook";

export const RULE_REQUEST_WEBHOOK_CREATE_HINT =
  "Hint: a webhook for rule request events is its maker's own. Create it signed in as yourself (`primitive login`), not with an API key or another app. It is a route target whatever your access, so it never takes a domain's or the organization's default slot.";

export const RULE_REQUEST_WEBHOOK_UPDATE_HINT =
  "Hint: rule request events go only to a webhook made for them. An existing webhook cannot be given them: create a new one with `--event-types email_rule_request.*`, signed in as yourself. Only the person who made one can change it.";

export const RULE_REQUEST_WEBHOOK_DEFAULT_HINT =
  "Hint: a webhook for rule request events is always a route target. Leave out --no-is-route-target and --takeover.";

const RULE_REQUEST_EVENTS = new Set<string>(EMAIL_RULE_REQUEST_EVENT_TYPES);

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/** Whether a create or update body lists any rule request event. */
export function listsRuleRequestEvents(body: unknown): boolean {
  const types = record(record(body)?.rules)?.event_types;
  return (
    Array.isArray(types) &&
    types.some((t) => typeof t === "string" && RULE_REQUEST_EVENTS.has(t))
  );
}

function refusalReason(payload: unknown): unknown {
  const top = record(payload);
  return (
    record(top?.details)?.reason ?? record(record(top?.error)?.details)?.reason
  );
}

/** The hint after a refused createEndpoint, or undefined when none applies. */
export function createEndpointRuleRequestHint(
  code: string | undefined,
  body: unknown,
  payload?: unknown,
): string | undefined {
  if (refusalReason(payload) === RULE_REQUEST_WEBHOOK_REFUSAL_REASON)
    return RULE_REQUEST_WEBHOOK_CREATE_HINT;
  const asked = record(body);
  if (
    code === "validation_error" &&
    listsRuleRequestEvents(body) &&
    (asked?.is_route_target === false || asked?.takeover !== undefined)
  )
    return RULE_REQUEST_WEBHOOK_DEFAULT_HINT;
  return undefined;
}

/** The hint after a refused updateEndpoint, or undefined when none applies. */
export function updateEndpointRuleRequestHint(
  _code: string | undefined,
  _body: unknown,
  payload?: unknown,
): string | undefined {
  return refusalReason(payload) === RULE_REQUEST_WEBHOOK_REFUSAL_REASON
    ? RULE_REQUEST_WEBHOOK_UPDATE_HINT
    : undefined;
}
