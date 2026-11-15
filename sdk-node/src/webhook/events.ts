/**
 * The canonical webhook event-type catalog and the typed event shapes a
 * non-email consumer needs.
 *
 * Primitive posts every webhook with the event name in the `X-Webhook-Event`
 * HEADER, not in the body. The stored payload is sent verbatim with no
 * envelope: an `email.*` or `sent_email.*` body carries `event`, an
 * `email_rule_request.*`, `email_rule_objection.*` or `email_rule_coverage.*`
 * body carries `type` but not `event`, and an `interaction.*` body is just
 * `{ interaction: { ... } }` with no event/type field at all. The HEADER is
 * therefore the only reliable discriminator across all the families, which is
 * why the parser keys on it.
 *
 * @packageDocumentation
 */

import type { EmailReceivedEvent } from "../types.js";
import { validateEmailReceivedEvent } from "../validation.js";
import { SENT_EMAIL_EVENT_TYPES } from "./sent-email-events.js";

/**
 * The five first-party email events (subject = an email).
 */
export const EMAIL_EVENT_TYPES = [
  "email.received",
  "email.bounced",
  "email.tls_report",
  "email.dmarc_report",
  "email.dmarc_failure",
] as const;

/**
 * The interaction step events (subject = an interaction). One event per accepted
 * protocol step, named `interaction.<protocolShort>.<suffix>`.
 *
 * These cover the acknowledgement protocols.
 */
export const INTERACTION_EVENT_TYPES = [
  "interaction.ack.acked",
  "interaction.ack.canceled",
  "interaction.ack.expired",
  "interaction.ack.received",
  "interaction.ack.requested",
] as const;

/**
 * The rule request events (subject = a request one member made to another for
 * an email rule over the other's own mail). Each goes to the person who did
 * not act: `created` and `withdrawn` to the member asked, `accepted` and
 * `declined` to the member who asked. They are opt-in, and only a webhook that
 * person made for them receives them.
 */
export const EMAIL_RULE_REQUEST_EVENT_TYPES = [
  "email_rule_request.created",
  "email_rule_request.accepted",
  "email_rule_request.declined",
  "email_rule_request.withdrawn",
] as const;

/**
 * The rule objection events (subject = an objection: a member asked the
 * author of a rule over their own mail to turn it off). Each goes to the
 * person who did not act: `created` and `withdrawn` to the rule's author,
 * `accepted`, `declined` and `amended` (the author saved a new version in
 * answer) to the member who objected. They are opt-in, and only a webhook
 * that person made for them receives them.
 */
export const EMAIL_RULE_OBJECTION_EVENT_TYPES = [
  "email_rule_objection.created",
  "email_rule_objection.accepted",
  "email_rule_objection.declined",
  "email_rule_objection.amended",
  "email_rule_objection.withdrawn",
] as const;

/**
 * The rule coverage events (subject = a coverage notice: another member's
 * rule started covering one of your own mailboxes, saved a new version
 * while covering it, or stopped). They are opt-in, and only a webhook of
 * your own that lists them receives them.
 */
export const EMAIL_RULE_COVERAGE_EVENT_TYPES = [
  "email_rule_coverage.started",
  "email_rule_coverage.new_version",
  "email_rule_coverage.stopped",
] as const;

/**
 * The credential events (subject = an API key, an app grant or the
 * organization's credential policy). They are opt-in.
 */
export const CREDENTIAL_EVENT_TYPES = [
  "credential.created",
  "credential.updated",
  "credential.rotated",
  "credential.revoked",
  "credential.expired",
  "credential.suspended",
  "credential.leak_detected",
  "credential.oauth_granted",
  "credential.oauth_revoked",
  "credential.policy_changed",
] as const;

/**
 * The full enumerated catalog of every current webhook event type: the five
 * email.*, and the opt-in sent_email.*, credential.*, email_rule_request.*,
 * email_rule_objection.* and email_rule_coverage.* families, and every
 * interaction.<protocol>.<suffix>.
 */
export const WEBHOOK_EVENT_TYPES = [
  ...EMAIL_EVENT_TYPES,
  ...SENT_EMAIL_EVENT_TYPES,
  ...CREDENTIAL_EVENT_TYPES,
  ...EMAIL_RULE_REQUEST_EVENT_TYPES,
  ...EMAIL_RULE_OBJECTION_EVENT_TYPES,
  ...EMAIL_RULE_COVERAGE_EVENT_TYPES,
  ...INTERACTION_EVENT_TYPES,
] as const;

/**
 * Any current catalog value: every `email.*`, `sent_email.*`,
 * `credential.*`, `email_rule_request.*`, `email_rule_objection.*`,
 * `email_rule_coverage.*` and `interaction.ack.*` event the platform emits,
 * surfaced in the `X-Webhook-Event` header. Use this to type a switch over
 * the header.
 */
export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];

const WEBHOOK_EVENT_TYPE_SET = new Set<string>(WEBHOOK_EVENT_TYPES);

/** True if `eventType` is a known current catalog value. */
export function isKnownWebhookEventType(
  eventType: string | null | undefined,
): eventType is WebhookEventType {
  return eventType != null && WEBHOOK_EVENT_TYPE_SET.has(eventType);
}

// -----------------------------------------------------------------------------
// Interaction events
// -----------------------------------------------------------------------------

/**
 * Common shape of an `interaction.*` webhook body. The stored payload is just
 * `{ interaction: { ... } }` with no event/type field; the parser overlays a
 * canonical `event` from the header.
 */
export interface InteractionEvent {
  /** Canonical event name, mirrored from the `X-Webhook-Event` header. */
  event: WebhookEventType;
  /** The interaction state as stored; shape is protocol/step specific. */
  interaction?: Record<string, unknown>;
  id?: string;
  [key: string]: unknown;
}

// -----------------------------------------------------------------------------
// Type guards
// -----------------------------------------------------------------------------

function eventName(event: unknown): string | undefined {
  if (typeof event !== "object" || event === null) return undefined;
  const value = (event as { event?: unknown }).event;
  return typeof value === "string" ? value : undefined;
}

/**
 * Type guard for the `email.received` event. Confirms the discriminator AND
 * that the body validates against the canonical schema, so a payload that names
 * itself `email.received` but is malformed does not narrow.
 */
export function isEmailReceivedEvent(
  event: unknown,
): event is EmailReceivedEvent {
  if (eventName(event) !== "email.received") return false;
  try {
    validateEmailReceivedEvent(event);
    return true;
  } catch {
    return false;
  }
}

// -----------------------------------------------------------------------------
// Rule request events
// -----------------------------------------------------------------------------

/**
 * The body of an `email_rule_request.*` webhook. It names the request,
 * says where it stands, and always carries the asker's message and a
 * decline's reason, null when there is none. It does not carry the rule or
 * anything read from mail: read the request with `getEmailRuleRequest` for
 * the rest. Pass the `X-Webhook-Event` header to the parser, since the body
 * has `type` and no `event`.
 */
export interface EmailRuleRequestEvent {
  /** The event name, overlaid from the `X-Webhook-Event` header by the parser. */
  event: (typeof EMAIL_RULE_REQUEST_EVENT_TYPES)[number];
  /** The webhook event's id. */
  id: string;
  /** The event name as the body carries it. */
  type: (typeof EMAIL_RULE_REQUEST_EVENT_TYPES)[number];
  occurred_at: string;
  email_rule_request: {
    id: string;
    name: string;
    status: "pending" | "accepted" | "declined" | "withdrawn";
    created_at: string;
    decided_at: string | null;
    /** On `accepted`: the share accepting created. */
    share_id?: string;
    /** On `accepted`: whether the member asked changed the rule first. */
    edited_on_accept?: boolean;
    /** What the member asking wrote about why; null when they wrote nothing. */
    message: string | null;
    /** Why the member asked declined; null unless they gave a reason. */
    decline_reason: string | null;
    [key: string]: unknown;
  };
  /** On `created` and `withdrawn`: the member who asked. */
  proposer?: { user_id: string; name: string | null };
  [key: string]: unknown;
}

/** True when `event` is an `email_rule_request.*` event. */
export function isEmailRuleRequestEvent(
  event: unknown,
): event is EmailRuleRequestEvent {
  const name = eventName(event);
  return (
    name !== undefined &&
    (EMAIL_RULE_REQUEST_EVENT_TYPES as readonly string[]).includes(name)
  );
}

// -----------------------------------------------------------------------------
// Rule objection events
// -----------------------------------------------------------------------------

/**
 * The body of an `email_rule_objection.*` webhook. It names the objection and
 * its rule, says where it stands, and carries a decline's reason, null when
 * there is none; `amended` also carries the version saved in answer and its
 * note. It never carries the objector's message
 * (`getEmailRuleObjection` returns it, null once withdrawn), the rule itself
 * or anything read from mail: read the objection with
 * `getEmailRuleObjection` for the rest. Pass the `X-Webhook-Event` header to
 * the parser, since the body has `type` and no `event`.
 */
export interface EmailRuleObjectionEvent {
  /** The event name, overlaid from the `X-Webhook-Event` header by the parser. */
  event: (typeof EMAIL_RULE_OBJECTION_EVENT_TYPES)[number];
  /** The webhook event's id. */
  id: string;
  /** The event name as the body carries it. */
  type: (typeof EMAIL_RULE_OBJECTION_EVENT_TYPES)[number];
  occurred_at: string;
  email_rule_objection: {
    id: string;
    /** The rule objected to: its id (null once deleted outright) and its name when the objection was made. */
    rule: { id: string | null; name: string; [key: string]: unknown };
    status: "pending" | "accepted" | "declined" | "amended" | "withdrawn";
    created_at: string;
    decided_at: string | null;
    /** Why the rule's author declined; null unless they gave a reason. */
    decline_reason: string | null;
    /** On `amended`: the rule version the author saved in answer. */
    amended_version?: number;
    /** On `amended`: what the author wrote about the change; null when nothing. */
    amend_note?: string | null;
    [key: string]: unknown;
  };
  /** On `created` and `withdrawn`: the member who objected. */
  objector?: { user_id: string; name: string | null };
  [key: string]: unknown;
}

/** True when `event` is an `email_rule_objection.*` event. */
export function isEmailRuleObjectionEvent(
  event: unknown,
): event is EmailRuleObjectionEvent {
  const name = eventName(event);
  return (
    name !== undefined &&
    (EMAIL_RULE_OBJECTION_EVENT_TYPES as readonly string[]).includes(name)
  );
}

// -----------------------------------------------------------------------------
// Rule coverage events
// -----------------------------------------------------------------------------

/**
 * The body of an `email_rule_coverage.*` webhook: which rule now covers your
 * mail (as it was when the notice was written), its author, how it reaches
 * you and which of your addresses it covers. `new_version` adds the version
 * it replaced and whether the wording changed; `stopped` adds why it stopped.
 * Read the rule over your mail with `getEmailRuleCoveringMe` for the rest.
 * Pass the `X-Webhook-Event` header to the parser, since the body has `type`
 * and no `event`.
 */
export interface EmailRuleCoverageEvent {
  /** The event name, overlaid from the `X-Webhook-Event` header by the parser. */
  event: (typeof EMAIL_RULE_COVERAGE_EVENT_TYPES)[number];
  /** The webhook event's id. */
  id: string;
  /** The event name as the body carries it. */
  type: (typeof EMAIL_RULE_COVERAGE_EVENT_TYPES)[number];
  occurred_at: string;
  email_rule_coverage: {
    /** The coverage notice's id. */
    id: string;
    rule: {
      id: string;
      name: string;
      kind: string;
      state: string;
      version: number;
      [key: string]: unknown;
    };
    author: { user_id: string; name: string | null };
    /** How the rule reaches your mail. */
    via: string;
    /** Your addresses the rule covers. */
    addresses: string[];
    /** On `new_version`: the version this one replaced. */
    previous_version?: number;
    /** On `new_version`: whether the rule's wording changed. */
    wording_changed?: boolean;
    /** On `stopped`: why the rule stopped covering you. */
    stop_reason?: "deleted" | "turned_off" | "no_longer_covers";
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/** True when `event` is an `email_rule_coverage.*` event. */
export function isEmailRuleCoverageEvent(
  event: unknown,
): event is EmailRuleCoverageEvent {
  const name = eventName(event);
  return (
    name !== undefined &&
    (EMAIL_RULE_COVERAGE_EVENT_TYPES as readonly string[]).includes(name)
  );
}
