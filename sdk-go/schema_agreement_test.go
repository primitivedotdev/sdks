package primitive

import (
	"encoding/json"
	"errors"
	"reflect"
	"testing"

	"github.com/xeipuuv/gojsonschema"
)

// The exported schema must describe exactly what the SDK accepts: a payload
// that passes EmailReceivedEventJSONSchema must pass ValidateEmailReceivedEvent
// and Receive, and a payload the schema refuses must be refused by both.

const schemaAgreementSecret = "whsec_schema_agreement"

var schemaAgreementPayloadFiles = []string{"valid-email-received.json", "address-scoped-email.json"}

type schemaAgreementPayload struct {
	name    string
	payload any
}

func schemaAgreementPayloads(t *testing.T) []schemaAgreementPayload {
	t.Helper()
	fixtures := loadFixtureCases[struct {
		Cases []struct {
			Name    string `json:"name"`
			Payload any    `json:"payload"`
		} `json:"cases"`
	}](t, "webhook", "validation-cases.json")

	payloads := make([]schemaAgreementPayload, 0, len(fixtures.Cases)+len(schemaAgreementPayloadFiles))
	for _, testCase := range fixtures.Cases {
		payloads = append(payloads, schemaAgreementPayload{name: "validation-cases.json " + testCase.Name, payload: testCase.Payload})
	}
	for _, file := range schemaAgreementPayloadFiles {
		payloads = append(payloads, schemaAgreementPayload{name: file, payload: loadFixtureCases[any](t, "webhook", file)})
	}
	return payloads
}

func exportedSchemaAccepts(t *testing.T, schema *gojsonschema.Schema, payload any) bool {
	t.Helper()
	result, err := schema.Validate(gojsonschema.NewGoLoader(payload))
	if err != nil {
		t.Fatalf("validate against the exported schema: %v", err)
	}
	return result.Valid()
}

func refusedWithValidationError(t *testing.T, name string, err error) bool {
	t.Helper()
	if err == nil {
		return false
	}
	var validationErr *WebhookValidationError
	if !errors.As(err, &validationErr) {
		t.Fatalf("%s: expected a WebhookValidationError, got %v", name, err)
	}
	return true
}

func receiveSignedBody(t *testing.T, body string) (*ReceivedEmail, error) {
	t.Helper()
	signed, err := SignWebhookPayload(body, schemaAgreementSecret)
	if err != nil {
		t.Fatalf("SignWebhookPayload returned error: %v", err)
	}
	return Receive(HandleWebhookOptions{
		Body:    body,
		Headers: map[string]string{PrimitiveSignatureHeader: signed.Header},
		Secret:  schemaAgreementSecret,
	})
}

func TestExportedSchemaAgreesWithValidator(t *testing.T) {
	schema, err := gojsonschema.NewSchema(gojsonschema.NewGoLoader(EmailReceivedEventJSONSchema))
	if err != nil {
		t.Fatalf("compile the exported schema: %v", err)
	}

	verdicts := map[bool]bool{}
	for _, item := range schemaAgreementPayloads(t) {
		accepted := exportedSchemaAccepts(t, schema, item.payload)
		verdicts[accepted] = true

		_, err := ValidateEmailReceivedEvent(item.payload)
		if refused := refusedWithValidationError(t, item.name, err); refused == accepted {
			t.Fatalf("%s: exported schema accepted=%v but ValidateEmailReceivedEvent error=%v", item.name, accepted, err)
		}

		// HandleWebhook, and so Receive, takes email.received events only and
		// refuses the other email.* events with PAYLOAD_UNKNOWN_EVENT.
		if event, _ := item.payload.(map[string]any)["event"].(string); event != string(EventTypeEmailReceived) {
			continue
		}
		body, err := json.Marshal(item.payload)
		if err != nil {
			t.Fatalf("%s: encode payload: %v", item.name, err)
		}
		_, err = receiveSignedBody(t, string(body))
		if refused := refusedWithValidationError(t, item.name, err); refused == accepted {
			t.Fatalf("%s: exported schema accepted=%v but Receive error=%v", item.name, accepted, err)
		}
	}
	if !verdicts[true] || !verdicts[false] {
		t.Fatalf("agreement payloads should include accepted and refused payloads, got %v", verdicts)
	}
}

func TestReceiveRoundTripsSignedFixtures(t *testing.T) {
	for _, file := range schemaAgreementPayloadFiles {
		body := loadFixtureText(t, "webhook", file)
		event, err := ValidateEmailReceivedEvent(loadFixtureCases[any](t, "webhook", file))
		if err != nil {
			t.Fatalf("%s: ValidateEmailReceivedEvent returned error: %v", file, err)
		}

		email, err := receiveSignedBody(t, body)
		if err != nil {
			t.Fatalf("%s: Receive returned error: %v", file, err)
		}
		if email.ID != event.Email.ID || email.EventID != event.ID {
			t.Fatalf("%s: unexpected ids %q / %q", file, email.ID, email.EventID)
		}
		if !reflect.DeepEqual(email.Raw, *event) {
			t.Fatalf("%s: Receive returned %+v, want %+v", file, email.Raw, *event)
		}
	}
}
