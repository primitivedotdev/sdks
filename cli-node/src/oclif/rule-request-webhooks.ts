// What the CLI adds when the API refuses a webhook for rule request events
// (email_rule_request.*). Such a webhook is made only at creation, by a person
// signed in as themself, belongs to them and is always a route target. The API
// refuses one made with an API key, another app or an agent; the events added
// to an existing webhook; a change to such a webhook by anyone but its maker
// acting as themself; giving it to a key; and asking for it to be a default.

import { EMAIL_RULE_REQUEST_EVENT_TYPES } from "@primitivedotdev/sdk/webhook";

/** The refusal reason the API gives for a rule request webhook made or changed by anyone else. */
export const RULE_REQUEST_WEBHOOK_REFUSAL_REASON =
  "rule_request_events_need_own_webhook";

export const RULE_REQUEST_WEBHOOK_CREATE_HINT =
  "Hint: a webhook for rule request events is made by the person it is for, signed in as themself: after `primitive login`, run this without --api-key or PRIMITIVE_API_KEY and outside a connected agent's profile, or create it in the dashboard. An API key, another app or an agent cannot make one. It is a route target whatever your access, so it never takes a domain's or the organization's default slot.";

export const RULE_REQUEST_WEBHOOK_SUBSCRIBE_HINT =
  "Hint: rule request events go only to a webhook made for them. An existing webhook cannot be given them: create a new one with `--event-types 'email_rule_request.*'`, signed in as yourself.";

export const RULE_REQUEST_WEBHOOK_KEY_HINT =
  "Hint: a webhook for rule request events stays its maker's own and cannot be given to an API key.";

export const RULE_REQUEST_WEBHOOK_CHANGE_HINT =
  "Hint: only the person who made a webhook for rule request events, signed in as themself (not with an API key), can change it. Anyone who can manage endpoints can delete it.";

export const RULE_REQUEST_WEBHOOK_DEFAULT_HINT =
  "Hint: a webhook for rule request events is always a route target. Leave out --no-is-route-target, --takeover and --no-takeover (is_route_target: false and takeover in a raw body).";

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

/**
 * The hint after a refused updateEndpoint, or undefined when none applies.
 * The one refusal reason covers three changes, told apart by what was sent:
 * the events added to an existing webhook, the webhook given to a key, and
 * any other change by someone who is not its maker acting as themself.
 */
export function updateEndpointRuleRequestHint(
  _code: string | undefined,
  body: unknown,
  payload?: unknown,
): string | undefined {
  if (refusalReason(payload) !== RULE_REQUEST_WEBHOOK_REFUSAL_REASON)
    return undefined;
  const asked = record(body);
  if (asked && "owner_key_id" in asked && asked.owner_key_id !== null)
    return RULE_REQUEST_WEBHOOK_KEY_HINT;
  return listsRuleRequestEvents(body)
    ? RULE_REQUEST_WEBHOOK_SUBSCRIBE_HINT
    : RULE_REQUEST_WEBHOOK_CHANGE_HINT;
}
