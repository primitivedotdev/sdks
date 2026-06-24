package primitive

// The canonical webhook event-type catalog and the typed event shapes a
// payee/payer (or any non-email consumer) needs.
//
// Primitive posts every webhook with the event name in the X-Webhook-Event
// HEADER, not in the body. The stored payload is sent verbatim with no
// envelope: an email.* body carries "event", a payment.* body carries the name
// in "type", and an interaction.* body is just {"interaction": {...}} with no
// event/type field at all. The HEADER is therefore the only reliable
// discriminator across all three families, which is why the parser keys on it.

// EmailEventTypes are the five first-party email events (subject = an email).
var EmailEventTypes = []string{
	"email.received",
	"email.bounced",
	"email.tls_report",
	"email.dmarc_report",
	"email.dmarc_failure",
}

// PaymentEventTypes are the two x402 settlement-notification events
// (subject = a payment).
var PaymentEventTypes = []string{
	"payment.settled",
	"payment.failed",
}

// InteractionEventTypes are the interaction step events (subject = an
// interaction), named interaction.<protocolShort>.<suffix>.
var InteractionEventTypes = []string{
	"interaction.ack.acked",
	"interaction.ack.canceled",
	"interaction.ack.expired",
	"interaction.ack.received",
	"interaction.ack.requested",
	"interaction.x402.challenge",
	"interaction.x402.declined",
	"interaction.x402.expired",
	"interaction.x402.payment",
	"interaction.x402.rejected",
	"interaction.x402.settled",
	"interaction.x402.verify_timeout",
}

// WebhookEventTypes is the full enumerated catalog of every current webhook
// event type: the five email.*, the two payment.*, and every
// interaction.<protocol>.<suffix>.
var WebhookEventTypes = func() []string {
	all := make([]string, 0, len(EmailEventTypes)+len(PaymentEventTypes)+len(InteractionEventTypes))
	all = append(all, EmailEventTypes...)
	all = append(all, PaymentEventTypes...)
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

// PaymentEvent is a payment.* webhook body.
//
// The stored payload carries the event name in Type (not Event); the parser
// overlays a canonical Event from the header so consumers can branch on a
// single field. Payload preserves the raw stored body verbatim.
type PaymentEvent struct {
	Event   string         `json:"event"`
	Type    string         `json:"type,omitempty"`
	ID      *string        `json:"id,omitempty"`
	Payload map[string]any `json:"-"`
}

// GetEvent returns the canonical event name (mirrored from the header).
func (e PaymentEvent) GetEvent() string { return e.Event }

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

// IsPaymentEvent reports whether event is any payment.* event.
func IsPaymentEvent(event any) bool {
	name := eventName(event)
	return name == "payment.settled" || name == "payment.failed"
}

// IsPaymentSettledEvent reports whether event is the payment.settled event.
func IsPaymentSettledEvent(event any) bool {
	return eventName(event) == "payment.settled"
}

// IsPaymentFailedEvent reports whether event is the payment.failed event.
func IsPaymentFailedEvent(event any) bool {
	return eventName(event) == "payment.failed"
}

// IsInteractionX402Event reports whether event is any interaction.x402.* event.
func IsInteractionX402Event(event any) bool {
	name := eventName(event)
	return len(name) >= len("interaction.x402.") && name[:len("interaction.x402.")] == "interaction.x402."
}
