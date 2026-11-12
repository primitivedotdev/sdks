// What the CLI adds when the API refuses a webhook for rule request or
// objection events (email_rule_request.*, email_rule_objection.*). Such a
// webhook is made only at creation, by a person
// signed in as themself, belongs to them and is always a route target. The API
// refuses one made with an API key, another app or an agent; the events added
// to an existing webhook; a change to such a webhook by anyone but its maker
// acting as themself; giving it to a key; and asking for it to be a default.

/** The refusal reason the API gives for such a webhook made or changed by anyone else. */
export const RULE_REQUEST_WEBHOOK_REFUSAL_REASON =
  "rule_request_events_need_own_webhook";

export const RULE_REQUEST_WEBHOOK_CREATE_HINT =
  "Hint: a webhook for rule request or objection events is made by the person it is for, signed in as themself: after `primitive login`, run this without --api-key, PRIMITIVE_API_KEY or PRIMITIVE_AGENT_PROFILE set, or create it in the dashboard. An API key, another app or an agent cannot make one. If you are already signed in as yourself, try again. It is a route target whatever your access, so it never takes a domain's or the organization's default slot.";

export const RULE_REQUEST_WEBHOOK_HTTP_HINT =
  "Hint: rule request and objection events go only to an http webhook (kind http).";

export const RULE_REQUEST_WEBHOOK_SUBSCRIBE_HINT =
  "Hint: rule request and objection events go only to a webhook made for them. If this webhook does not list them yet, it cannot be given them: create a new one with `--event-types` naming them (such as 'email_rule_request.*' or 'email_rule_objection.*'), signed in as yourself. If it does, only its maker, signed in as themself, can change it.";

export const RULE_REQUEST_WEBHOOK_KEY_HINT =
  "Hint: a webhook for rule request or objection events is made by the person it is for, signed in as themself, and stays theirs: it cannot be given to an API key.";

export const RULE_REQUEST_WEBHOOK_CHANGE_HINT =
  "Hint: only the person who made a webhook for rule request or objection events, signed in as themself (not with an API key, another app or an agent), can change it. It can be deleted as any other webhook can.";

export const RULE_REQUEST_WEBHOOK_DEFAULT_HINT =
  "Hint: a webhook for rule request or objection events is always a route target. Leave out --no-is-route-target, --takeover and --no-takeover (is_route_target: false and takeover in a raw body).";

/** The event families, of those this CLI lists, that the API keeps to a webhook its person made for them, matched by prefix as the API matches them. */
const MEMBER_EVENT_PREFIXES = ["email_rule_request.", "email_rule_objection."];

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/**
 * Whether a create or update body lists any rule request or objection
 * event. Matched by prefix, as the API matches it, so a raw body's
 * literal `email_rule_request.*` counts too.
 */
export function listsRuleRequestEvents(body: unknown): boolean {
  const types = record(record(body)?.rules)?.event_types;
  return (
    Array.isArray(types) &&
    types.some(
      (t) =>
        typeof t === "string" &&
        MEMBER_EVENT_PREFIXES.some((prefix) => t.startsWith(prefix)),
    )
  );
}

function refusalReason(payload: unknown): unknown {
  const top = record(payload);
  return (
    record(top?.details)?.reason ?? record(record(top?.error)?.details)?.reason
  );
}

/**
 * The hint after a refused createEndpoint, or undefined when none applies.
 * The one refusal reason covers a webhook given to a key, one that is not an
 * http webhook, and one made by anyone but a person signed in as themself (or
 * whose membership could not be confirmed), told apart by what was sent.
 */
export function createEndpointRuleRequestHint(
  code: string | undefined,
  body: unknown,
  payload?: unknown,
): string | undefined {
  const asked = record(body);
  if (refusalReason(payload) === RULE_REQUEST_WEBHOOK_REFUSAL_REASON) {
    if (asked && "owner_key_id" in asked) return RULE_REQUEST_WEBHOOK_KEY_HINT;
    if (asked?.kind !== undefined && asked.kind !== "http")
      return RULE_REQUEST_WEBHOOK_HTTP_HINT;
    return RULE_REQUEST_WEBHOOK_CREATE_HINT;
  }
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
  if (asked && "owner_key_id" in asked) return RULE_REQUEST_WEBHOOK_KEY_HINT;
  return listsRuleRequestEvents(body)
    ? RULE_REQUEST_WEBHOOK_SUBSCRIBE_HINT
    : RULE_REQUEST_WEBHOOK_CHANGE_HINT;
}
