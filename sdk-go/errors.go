package primitive

import "fmt"

type ErrorDefinition struct {
	Message    string
	Suggestion string
}

var VerificationErrors = map[string]ErrorDefinition{
	"INVALID_SIGNATURE_HEADER": {
		Message:    "Missing or malformed Primitive-Signature header",
		Suggestion: "Check that you're reading the correct header (Primitive-Signature) and it's being passed correctly from your web framework.",
	},
	"TIMESTAMP_OUT_OF_RANGE": {
		Message:    "Timestamp is too old (possible replay attack)",
		Suggestion: "This could indicate a replay attack, network delay, or server clock drift. Check your server's time is synced.",
	},
	"SIGNATURE_MISMATCH": {
		Message:    "Signature doesn't match expected value",
		Suggestion: "Verify the webhook secret matches and you're using the raw request body (not re-serialized JSON).",
	},
	"MISSING_SECRET": {
		Message:    "No webhook secret was provided",
		Suggestion: "Pass your webhook secret from the Primitive dashboard. Check that the environment variable is set.",
	},
}

var PayloadErrors = map[string]ErrorDefinition{
	"PAYLOAD_NULL": {
		Message:    "Webhook payload is null",
		Suggestion: "Ensure you're passing the parsed JSON body, not null. Check your framework's body parsing middleware.",
	},
	"PAYLOAD_UNDEFINED": {
		Message:    "Webhook payload is undefined",
		Suggestion: "The payload was not provided. Make sure you're passing the request body to the handler.",
	},
	"PAYLOAD_WRONG_TYPE": {
		Message:    "Webhook payload must be an object",
		Suggestion: "The payload should be a parsed JSON object. Check that you're not passing a string or other primitive.",
	},
	"PAYLOAD_IS_ARRAY": {
		Message:    "Webhook payload is an array, expected object",
		Suggestion: "Primitive webhooks are single event objects, not arrays. Check the payload structure.",
	},
	"PAYLOAD_MISSING_EVENT": {
		Message:    "Webhook payload missing 'event' field",
		Suggestion: "All webhook payloads must have an 'event' field. This may not be a valid Primitive webhook.",
	},
	"PAYLOAD_UNKNOWN_EVENT": {
		Message:    "Unknown webhook event type",
		Suggestion: "This event type is not recognized. You may need to update your SDK or handle unknown events gracefully.",
	},
	"PAYLOAD_EMPTY_BODY": {
		Message:    "Request body is empty",
		Suggestion: "The request body was empty. Ensure the webhook is sending data and your framework is parsing it correctly.",
	},
	"JSON_PARSE_FAILED": {
		Message:    "Failed to parse JSON body",
		Suggestion: "The request body is not valid JSON. Check the raw body content and Content-Type header.",
	},
	"INVALID_ENCODING": {
		Message:    "Invalid body encoding",
		Suggestion: "The request body encoding is not supported. Primitive webhooks use UTF-8 encoded JSON.",
	},
}

var RawEmailErrors = map[string]ErrorDefinition{
	"NOT_INCLUDED": {
		Message:    "Raw email content not included inline",
		Suggestion: "Use the download URL at event.email.content.download.url to fetch the raw email.",
	},
	"INVALID_BASE64": {
		Message:    "Raw email content is not valid base64",
		Suggestion: "The raw email data is malformed. Fetch the raw email from the download URL or regenerate the webhook payload.",
	},
	"HASH_MISMATCH": {
		Message:    "SHA-256 hash verification failed",
		Suggestion: "The raw email data may be corrupted. Try downloading from the URL instead.",
	},
}

type PrimitiveWebhookError struct {
	NameValue       string
	CodeValue       string
	MessageValue    string
	SuggestionValue string
	Cause           error
}

func (e *PrimitiveWebhookError) Error() string {
	return fmt.Sprintf("%s [%s]: %s\n\nSuggestion: %s", e.Name(), e.Code(), e.Message(), e.Suggestion())
}

func (e *PrimitiveWebhookError) As(target any) bool {
	primitiveTarget, ok := target.(**PrimitiveWebhookError)
	if !ok {
		return false
	}
	*primitiveTarget = e
	return true
}

func (e *PrimitiveWebhookError) Unwrap() error {
	return e.Cause
}

func (e *PrimitiveWebhookError) Name() string {
	if e.NameValue == "" {
		return "PrimitiveWebhookError"
	}
	return e.NameValue
}

func (e *PrimitiveWebhookError) Code() string {
	return e.CodeValue
}

func (e *PrimitiveWebhookError) Message() string {
	return e.MessageValue
}

func (e *PrimitiveWebhookError) Suggestion() string {
	return e.SuggestionValue
}

func (e *PrimitiveWebhookError) ToMap() map[string]any {
	return map[string]any{
		"name":       e.Name(),
		"code":       e.Code(),
		"message":    e.Message(),
		"suggestion": e.Suggestion(),
	}
}

type WebhookVerificationError struct{ PrimitiveWebhookError }

func NewWebhookVerificationError(code string, message string, suggestion string) *WebhookVerificationError {
	definition := VerificationErrors[code]
	if message == "" {
		message = definition.Message
	}
	if suggestion == "" {
		suggestion = definition.Suggestion
	}
	return &WebhookVerificationError{PrimitiveWebhookError{
		NameValue:       "WebhookVerificationError",
		CodeValue:       code,
		MessageValue:    message,
		SuggestionValue: suggestion,
	}}
}

type WebhookPayloadError struct{ PrimitiveWebhookError }

func NewWebhookPayloadError(code string, message string, suggestion string, cause error) *WebhookPayloadError {
	definition := PayloadErrors[code]
	if message == "" {
		message = definition.Message
	}
	if suggestion == "" {
		suggestion = definition.Suggestion
	}
	return &WebhookPayloadError{PrimitiveWebhookError{
		NameValue:       "WebhookPayloadError",
		CodeValue:       code,
		MessageValue:    message,
		SuggestionValue: suggestion,
		Cause:           cause,
	}}
}

type ValidationIssue struct {
	Path      string `json:"path"`
	Message   string `json:"message"`
	Validator string `json:"validator"`
}

type WebhookValidationError struct {
	PrimitiveWebhookError
	Field                string
	ValidationErrors     []ValidationIssue
	AdditionalErrorCount int
}

func NewWebhookValidationError(field string, message string, suggestion string, validationErrors []ValidationIssue) *WebhookValidationError {
	return &WebhookValidationError{
		PrimitiveWebhookError: PrimitiveWebhookError{
			NameValue:       "WebhookValidationError",
			CodeValue:       "SCHEMA_VALIDATION_FAILED",
			MessageValue:    message,
			SuggestionValue: suggestion,
		},
		Field:                field,
		ValidationErrors:     validationErrors,
		AdditionalErrorCount: max(0, len(validationErrors)-1),
	}
}

func (e *WebhookValidationError) ToMap() map[string]any {
	return map[string]any{
		"name":                 e.Name(),
		"code":                 e.Code(),
		"field":                e.Field,
		"message":              e.Message(),
		"suggestion":           e.Suggestion(),
		"additionalErrorCount": e.AdditionalErrorCount,
	}
}

type RawEmailDecodeError struct{ PrimitiveWebhookError }

func NewRawEmailDecodeError(code string, message string) *RawEmailDecodeError {
	definition := RawEmailErrors[code]
	if message == "" {
		message = definition.Message
	}
	return &RawEmailDecodeError{PrimitiveWebhookError{
		NameValue:       "RawEmailDecodeError",
		CodeValue:       code,
		MessageValue:    message,
		SuggestionValue: definition.Suggestion,
	}}
}
