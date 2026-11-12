package primitive

// The canonical webhook event-type catalog and the typed event shapes a
// non-email consumer needs.
//
// Primitive posts every webhook with the event name in the X-Webhook-Event
// HEADER, not in the body. The stored payload is sent verbatim with no
// envelope: an email.* or sent_email.* body carries "event", an
// email_rule_request.* or email_rule_objection.* body carries "type" but not
// "event", and an interaction.* body is just
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

// EmailRuleObjectionEventTypes are the four opt-in email_rule_objection.*
// events (subject = an objection a member made, asking the author of a rule
// over their own mail to turn it off). Each goes to the person who did not
// act, and an endpoint receives them only when its rules.event_types lists
// them.
var EmailRuleObjectionEventTypes = []string{
	"email_rule_objection.created",
	"email_rule_objection.accepted",
	"email_rule_objection.declined",
	"email_rule_objection.withdrawn",
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
// event type: the five email.*, the four opt-in sent_email.*, the four opt-in
// email_rule_request.*, the four opt-in email_rule_objection.*, and every
// interaction.<protocol>.<suffix>.
var WebhookEventTypes = func() []string {
	all := make([]string, 0, len(EmailEventTypes)+len(SentEmailEventTypes)+len(EmailRuleRequestEventTypes)+len(EmailRuleObjectionEventTypes)+len(InteractionEventTypes))
	all = append(all, EmailEventTypes...)
	all = append(all, SentEmailEventTypes...)
	all = append(all, EmailRuleRequestEventTypes...)
	all = append(all, EmailRuleObjectionEventTypes...)
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
