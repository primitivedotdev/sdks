package primitive

// The canonical webhook event-type catalog and the typed event shapes a
// non-email consumer needs.
//
// Primitive posts every webhook with the event name in the X-Webhook-Event
// HEADER, not in the body. The stored payload is sent verbatim with no
// envelope: an email.* or sent_email.* body carries "event", an
// email_rule_request.*, email_rule_objection.* or email_rule_coverage.* body
// carries "type" but not "event", and an interaction.* body is just
// {"interaction": {...}} with no event/type field at all. The HEADER is
// therefore the only reliable discriminator across all the families, which is
// why the parser keys on it.

// EmailEventTypes are the five first-party email events (subject = an email).
var EmailEventTypes = []string{
	"email.received",
	"email.bounced",
	"email.tls_report",
	"email.dmarc_report",
	"email.dmarc_failure",
}

// EmailRuleRequestEventTypes are the four opt-in email_rule_request.* events
// (subject = a rule request one member made to another). Each goes to the
// person who did not act, and an endpoint receives them only when its
// rules.event_types lists them.
var EmailRuleRequestEventTypes = []string{
	"email_rule_request.created",
	"email_rule_request.accepted",
	"email_rule_request.declined",
	"email_rule_request.withdrawn",
}

// EmailRuleObjectionEventTypes are the five opt-in email_rule_objection.*
// events (subject = an objection a member made, asking the author of a rule
// over their own mail to turn it off). Each goes to the person who did not
// act (amended: the author saved a new version in answer), and an endpoint
// receives them only when its rules.event_types lists them.
var EmailRuleObjectionEventTypes = []string{
	"email_rule_objection.created",
	"email_rule_objection.accepted",
	"email_rule_objection.declined",
	"email_rule_objection.amended",
	"email_rule_objection.withdrawn",
}

// EmailRuleCoverageEventTypes are the three opt-in email_rule_coverage.*
// events (subject = a coverage notice: another member's rule started covering
// one of your own mailboxes, saved a new version while covering it, or
// stopped). Only a webhook of your own whose rules.event_types lists them
// receives them.
var EmailRuleCoverageEventTypes = []string{
	"email_rule_coverage.started",
	"email_rule_coverage.new_version",
	"email_rule_coverage.stopped",
}

// CredentialEventTypes are the opt-in credential.* events (subject = an API
// key, an app grant or the organization's credential policy).
var CredentialEventTypes = []string{
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
}

// InteractionEventTypes are the interaction step events (subject = an
// interaction), named interaction.<protocolShort>.<suffix>.
var InteractionEventTypes = []string{
	"interaction.ack.acked",
	"interaction.ack.canceled",
	"interaction.ack.expired",
	"interaction.ack.received",
	"interaction.ack.requested",
}

// WebhookEventTypes is the full enumerated catalog of every current webhook
// event type: the five email.*, the opt-in sent_email.*, credential.*,
// email_rule_request.*, email_rule_objection.* and email_rule_coverage.*
// families, and every interaction.<protocol>.<suffix>.
var WebhookEventTypes = func() []string {
	all := make([]string, 0, len(EmailEventTypes)+len(SentEmailEventTypes)+len(CredentialEventTypes)+len(EmailRuleRequestEventTypes)+len(EmailRuleObjectionEventTypes)+len(EmailRuleCoverageEventTypes)+len(InteractionEventTypes))
	all = append(all, EmailEventTypes...)
	all = append(all, SentEmailEventTypes...)
	all = append(all, CredentialEventTypes...)
	all = append(all, EmailRuleRequestEventTypes...)
	all = append(all, EmailRuleObjectionEventTypes...)
	all = append(all, EmailRuleCoverageEventTypes...)
	all = append(all, InteractionEventTypes...)
	return all
}()

var webhookEventTypeSet = func() map[string]struct{} {
	set := make(map[string]struct{}, len(WebhookEventTypes))
	for _, t := range WebhookEventTypes {
		set[t] = struct{}{}
	}
	return set
}()

// IsKnownWebhookEventType reports whether eventType is a known current catalog
// value.
func IsKnownWebhookEventType(eventType string) bool {
	_, ok := webhookEventTypeSet[eventType]
	return ok
}

// InteractionEvent is an interaction.* webhook body.
//
// The stored payload is just {"interaction": {...}} with no event/type field;
// the parser overlays a canonical Event from the header. Payload preserves the
// raw stored body verbatim.
type InteractionEvent struct {
	Event   string         `json:"event"`
	Payload map[string]any `json:"-"`
}

// GetEvent returns the canonical event name (mirrored from the header).
func (e InteractionEvent) GetEvent() string { return e.Event }

func eventName(event any) string {
	switch typed := event.(type) {
	case WebhookEvent:
		return typed.GetEvent()
	case map[string]any:
		if name, ok := typed["event"].(string); ok {
			return name
		}
	}
	if name, ok := getString(event, "event"); ok {
		return name
	}
	return ""
}

// IsEmailReceivedEventType reports whether event names the email.received event.
func IsEmailReceivedEventType(event any) bool {
	return eventName(event) == string(EventTypeEmailReceived)
}
