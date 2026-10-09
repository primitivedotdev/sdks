package primitive

import (
	"encoding/json"
	"sync"

	"github.com/xeipuuv/gojsonschema"
)

// Typed sent_email.* webhook events: what happened to mail you sent.
//
// These events are a separate payload family from the inbound email.* events,
// with their own version. An endpoint receives them only if its
// rules.event_types lists them by name. The body is validated against the
// canonical sent-email-event JSON schema (SentEmailEventJSONSchema).

// The four sent_email.* event names.
const (
	SentEmailEventAccepted  = "sent_email.accepted"
	SentEmailEventDelivered = "sent_email.delivered"
	SentEmailEventFailed    = "sent_email.failed"
	SentEmailEventCompleted = "sent_email.completed"
)

// Values of SentEmailEvent.Scope on delivered and failed events.
const (
	// SentEmailScopeRecipient marks an event about one recipient.
	SentEmailScopeRecipient = "recipient"
	// SentEmailScopeMessage marks a roll-up or a legacy message-level result.
	SentEmailScopeMessage = "message"
)

// Values of SentEmailEvent.Reason on message-scoped events.
const (
	SentEmailReasonRollup              = "rollup"
	SentEmailReasonLegacyMessageResult = "legacy_message_result"
)

// SentEmailEventTypes are the four opt-in sent_email.* events (subject = a
// send). An endpoint receives them only when its rules.event_types lists them.
var SentEmailEventTypes = []string{
	SentEmailEventAccepted,
	SentEmailEventDelivered,
	SentEmailEventFailed,
	SentEmailEventCompleted,
}

// IsSentEmailEventType reports whether eventType is one of the four
// sent_email.* events.
func IsSentEmailEventType(eventType string) bool {
	switch eventType {
	case SentEmailEventAccepted, SentEmailEventDelivered, SentEmailEventFailed, SentEmailEventCompleted:
		return true
	}
	return false
}

// SentEmailEvent is the body of a sent_email.* webhook delivery.
//
// Event selects the shape. sent_email.accepted carries only the common
// fields. sent_email.delivered and sent_email.failed carry Scope and Outcome:
// with Scope "recipient" the event is about one Recipient; with Scope
// "message" it is a roll-up (Reason "rollup", RecipientCount, and on failed
// roll-ups Recipients) or a legacy message-level result (Reason
// "legacy_message_result", RecipientCount). sent_email.completed carries
// Summary. Fields that do not apply to an event are nil.
type SentEmailEvent struct {
	// ID is the event id: the same on every retry and at every endpoint, and
	// equal to the X-Webhook-Id header. Deduplicate on it.
	ID    string `json:"id"`
	Event string `json:"event"`
	// Version is the version of the sent_email.* payload family.
	Version string `json:"version"`
	// CreatedAt is when the event happened, as far as Primitive knows it.
	CreatedAt string                 `json:"created_at"`
	Delivery  SentEmailEventDelivery `json:"delivery"`
	// SentEmail is the send's current state when this attempt was made. It is
	// not this event's result: use Recipient and Outcome for that.
	SentEmail      SentEmailRecord            `json:"sent_email"`
	Scope          *string                    `json:"scope,omitempty"`
	Recipient      *SentEmailRecipient        `json:"recipient,omitempty"`
	RecipientCount *int64                     `json:"recipient_count,omitempty"`
	Reason         *string                    `json:"reason,omitempty"`
	Outcome        *SentEmailOutcome          `json:"outcome,omitempty"`
	Recipients     []SentEmailRolledUpFailure `json:"recipients,omitempty"`
	Summary        *SentEmailCompletedSummary `json:"summary,omitempty"`
}

// GetEvent returns the event name.
func (e SentEmailEvent) GetEvent() string { return e.Event }

// MarshalJSON writes the event as its wire shape. Message-scoped results
// (roll-ups and legacy results) carry "recipient": null, which the schema
// requires; on every other event a nil Recipient is left out.
func (e SentEmailEvent) MarshalJSON() ([]byte, error) {
	type wire SentEmailEvent
	data, err := json.Marshal(wire(e))
	if err != nil || e.Recipient != nil || e.Scope == nil || *e.Scope != SentEmailScopeMessage {
		return data, err
	}
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(data, &fields); err != nil {
		return nil, err
	}
	fields["recipient"] = json.RawMessage("null")
	return json.Marshal(fields)
}

// IsRecipientResult reports whether the event is a delivered or failed result
// for one recipient (Scope "recipient").
func (e SentEmailEvent) IsRecipientResult() bool {
	return (e.Event == SentEmailEventDelivered || e.Event == SentEmailEventFailed) &&
		e.Scope != nil && *e.Scope == SentEmailScopeRecipient
}

// IsRollup reports whether the event is a roll-up of recipients past the
// first 100 of a mail relay send.
func (e SentEmailEvent) IsRollup() bool {
	return e.Scope != nil && *e.Scope == SentEmailScopeMessage &&
		e.Reason != nil && *e.Reason == SentEmailReasonRollup
}

// SentEmailEventDelivery describes this webhook attempt, not the email's
// delivery.
type SentEmailEventDelivery struct {
	// EndpointID is the endpoint this attempt was sent to. Every endpoint is
	// signed with the organization's secret, so check this is the endpoint
	// that received the request.
	EndpointID  string `json:"endpoint_id"`
	Attempt     int64  `json:"attempt"`
	AttemptedAt string `json:"attempted_at"`
}

// SentEmailRecord is the send, with the same fields as
// GET /v1/sent-emails/{id}.
type SentEmailRecord struct {
	ID string `json:"id"`
	// Status is the send's overall status (an open set). Never a recipient's
	// result.
	Status          string `json:"status"`
	StatusChangedAt string `json:"status_changed_at"`
	CreatedAt       string `json:"created_at"`
	// Source is how the mail entered Primitive (an open set): api or
	// mail_relay.
	Source      string   `json:"source"`
	FromAddress string   `json:"from_address"`
	ToAddresses []string `json:"to_addresses"`
	Cc          []string `json:"cc"`
	Bcc         []string `json:"bcc"`
	// RecipientCount is every recipient of the send, To, Cc and Bcc together,
	// each address counted once.
	RecipientCount *int64          `json:"recipient_count"`
	Subject        *string         `json:"subject"`
	MessageID      *string         `json:"message_id"`
	ThreadID       *string         `json:"thread_id"`
	Tags           []SentEmailTag  `json:"tags"`
	Relay          *SentEmailRelay `json:"relay"`
}

// SentEmailTag is a tag given on the send request.
type SentEmailTag struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}

// SentEmailRelay is the mail relay that took a relay send.
type SentEmailRelay struct {
	Hostname string `json:"hostname"`
	Via      string `json:"via"`
}

// SentEmailRecipient names one recipient and the list (to, cc or bcc) that
// names it.
type SentEmailRecipient struct {
	Address string `json:"address"`
	Type    string `json:"type"`
}

// SentEmailOutcome is a delivered or failed event's result. On roll-ups the
// SMTP fields are nil.
type SentEmailOutcome struct {
	Result string `json:"result"`
	// FailureKind is nil when delivered; otherwise rejected or expired.
	FailureKind            *string `json:"failure_kind"`
	SMTPResponseCode       *int64  `json:"smtp_response_code"`
	SMTPEnhancedStatusCode *string `json:"smtp_enhanced_status_code"`
	// SMTPResponseText is text from a third-party server: untrusted, never
	// render it as HTML.
	SMTPResponseText *string `json:"smtp_response_text"`
	At               *string `json:"at"`
}

// SentEmailRolledUpFailure is one recipient listed on a failed roll-up.
type SentEmailRolledUpFailure struct {
	Address                string  `json:"address"`
	Type                   string  `json:"type"`
	SMTPResponseCode       *int64  `json:"smtp_response_code"`
	SMTPEnhancedStatusCode *string `json:"smtp_enhanced_status_code"`
	SMTPResponseText       *string `json:"smtp_response_text"`
	At                     *string `json:"at"`
}

// SentEmailCompletedSummary is the totals carried on sent_email.completed:
// Delivered + Failed + NotRelayed == RecipientCount when NotRelayed is set.
type SentEmailCompletedSummary struct {
	RecipientCount int64                 `json:"recipient_count"`
	Delivered      int64                 `json:"delivered"`
	Failed         int64                 `json:"failed"`
	FailedByKind   SentEmailFailedByKind `json:"failed_by_kind"`
	// NotRelayed is nil for a relay send recorded before Primitive kept the
	// relay's envelope, when it cannot be known.
	NotRelayed           *int64               `json:"not_relayed"`
	NotRelayedRecipients []SentEmailRecipient `json:"not_relayed_recipients"`
}

// SentEmailFailedByKind counts failed recipients by failure kind.
type SentEmailFailedByKind struct {
	Rejected int64 `json:"rejected"`
	Expired  int64 `json:"expired"`
}

// SentEmailEventJSONSchema is the canonical sent_email.* JSON schema.
var SentEmailEventJSONSchema map[string]any

var (
	sentEmailSchemaMu    sync.Mutex
	sentEmailSchemaCache = map[string]*gojsonschema.Schema{}
)

func init() {
	var schema map[string]any
	if err := json.Unmarshal(sentEmailEventSchemaJSON, &schema); err != nil {
		panic("primitive: invalid embedded sent email event schema: " + err.Error())
	}
	SentEmailEventJSONSchema = schema
}

// compiledSentEmailSchema compiles the schema rooted at one definition, or the
// whole schema when definition is empty.
func compiledSentEmailSchema(definition string) (*gojsonschema.Schema, error) {
	sentEmailSchemaMu.Lock()
	defer sentEmailSchemaMu.Unlock()
	if schema, ok := sentEmailSchemaCache[definition]; ok {
		return schema, nil
	}
	var root map[string]any
	if err := json.Unmarshal(sentEmailEventSchemaJSON, &root); err != nil {
		return nil, err
	}
	if definition != "" {
		root["$ref"] = "#/definitions/" + definition
	}
	schema, err := gojsonschema.NewSchema(gojsonschema.NewGoLoader(root))
	if err != nil {
		return nil, err
	}
	sentEmailSchemaCache[definition] = schema
	return schema, nil
}

// sentEmailDefinition picks the event shape a body claims to be, from its
// event, scope and reason, so a malformed body is reported against that shape.
func sentEmailDefinition(obj map[string]any) string {
	switch obj["event"] {
	case SentEmailEventAccepted:
		return "SentEmailAcceptedEvent"
	case SentEmailEventCompleted:
		return "SentEmailCompletedEvent"
	case SentEmailEventDelivered, SentEmailEventFailed:
		if obj["scope"] == SentEmailScopeMessage {
			if obj["reason"] == SentEmailReasonLegacyMessageResult {
				return "SentEmailLegacyMessageResultEvent"
			}
			return "SentEmailRollupResultEvent"
		}
		return "SentEmailRecipientResultEvent"
	}
	return ""
}

// ValidateSentEmailEvent validates a parsed sent_email.* webhook body against
// the canonical schema and decodes it.
func ValidateSentEmailEvent(input any) (*SentEmailEvent, error) {
	normalized, _, err := normalizeJSONValue(input)
	if err != nil {
		return nil, err
	}
	definition := ""
	if obj, ok := normalized.(map[string]any); ok {
		definition = sentEmailDefinition(obj)
	}
	schema, err := compiledSentEmailSchema(definition)
	if err != nil {
		return nil, err
	}
	result, err := schema.Validate(gojsonschema.NewGoLoader(normalized))
	if err != nil {
		return nil, err
	}
	if !result.Valid() {
		return nil, createSchemaValidationError(result.Errors(), "SentEmailEventJSONSchema")
	}
	event, err := decodeInto[SentEmailEvent](normalized)
	if err != nil {
		return nil, err
	}
	return &event, nil
}

// SafeValidateSentEmailEvent is ValidateSentEmailEvent returning a result
// instead of an error.
func SafeValidateSentEmailEvent(input any) ValidationResult[*SentEmailEvent] {
	event, err := ValidateSentEmailEvent(input)
	if err != nil {
		validationErr, ok := err.(*WebhookValidationError)
		if !ok {
			return ValidationResult[*SentEmailEvent]{Success: false, Error: NewWebhookValidationError("payload", err.Error(), "Check the webhook payload structure.", nil)}
		}
		return ValidationResult[*SentEmailEvent]{Success: false, Error: validationErr}
	}
	return ValidationResult[*SentEmailEvent]{Success: true, Data: event}
}

// IsSentEmailEvent reports whether event is a sent_email.* event: a
// SentEmailEvent value, or a map that names a sent_email.* event and
// validates against the schema.
func IsSentEmailEvent(event any) bool {
	switch typed := event.(type) {
	case SentEmailEvent:
		return IsSentEmailEventType(typed.Event)
	case *SentEmailEvent:
		return typed != nil && IsSentEmailEventType(typed.Event)
	case WebhookEvent:
		return false
	case map[string]any:
		name, ok := typed["event"].(string)
		if !ok || !IsSentEmailEventType(name) {
			return false
		}
		_, err := ValidateSentEmailEvent(typed)
		return err == nil
	}
	return false
}

// IsSentEmailAcceptedEvent reports whether event is a sent_email.accepted event.
func IsSentEmailAcceptedEvent(event any) bool {
	return IsSentEmailEvent(event) && eventName(event) == SentEmailEventAccepted
}

// IsSentEmailDeliveredEvent reports whether event is a sent_email.delivered event.
func IsSentEmailDeliveredEvent(event any) bool {
	return IsSentEmailEvent(event) && eventName(event) == SentEmailEventDelivered
}

// IsSentEmailFailedEvent reports whether event is a sent_email.failed event.
func IsSentEmailFailedEvent(event any) bool {
	return IsSentEmailEvent(event) && eventName(event) == SentEmailEventFailed
}

// IsSentEmailCompletedEvent reports whether event is a sent_email.completed event.
func IsSentEmailCompletedEvent(event any) bool {
	return IsSentEmailEvent(event) && eventName(event) == SentEmailEventCompleted
}

// IsSentEmailRecipientResultEvent reports whether event is a delivered or
// failed result about one recipient (scope "recipient").
func IsSentEmailRecipientResultEvent(event any) bool {
	if !IsSentEmailEvent(event) {
		return false
	}
	switch typed := event.(type) {
	case SentEmailEvent:
		return typed.IsRecipientResult()
	case *SentEmailEvent:
		return typed.IsRecipientResult()
	case map[string]any:
		name := eventName(typed)
		return (name == SentEmailEventDelivered || name == SentEmailEventFailed) &&
			typed["scope"] == SentEmailScopeRecipient
	}
	return false
}
