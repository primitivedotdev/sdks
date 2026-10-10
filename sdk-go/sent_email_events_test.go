package primitive

import (
	"encoding/json"
	"errors"
	"reflect"
	"strconv"
	"strings"
	"testing"
)

type sentEmailInputPatch struct {
	Fixture []string       `json:"fixture"`
	Set     map[string]any `json:"set"`
	Delete  []string       `json:"delete"`
}

type sentEmailParseCase struct {
	Name         string               `json:"name"`
	Input        json.RawMessage      `json:"input"`
	InputFixture []string             `json:"input_fixture"`
	InputPatch   *sentEmailInputPatch `json:"input_patch"`
	EventType    string               `json:"event_type"`
	Expected     struct {
		Kind      string         `json:"kind"`
		Event     string         `json:"event"`
		ID        string         `json:"id"`
		ErrorCode string         `json:"error_code"`
		Fields    map[string]any `json:"fields"`
		Absent    []string       `json:"absent"`
	} `json:"expected"`
}

type sentEmailHandleCase struct {
	Name        string            `json:"name"`
	Body        string            `json:"body"`
	BodyFixture []string          `json:"body_fixture"`
	Headers     map[string]string `json:"headers"`
	Secret      string            `json:"secret"`
	SignSecret  string            `json:"sign_secret"`
	Timestamp   *int64            `json:"timestamp"`
	Expected    struct {
		Valid     bool   `json:"valid"`
		Event     string `json:"event"`
		ID        string `json:"id"`
		ErrorCode string `json:"error_code"`
	} `json:"expected"`
}

type sentEmailCases struct {
	ParseCases  []sentEmailParseCase  `json:"parse_cases"`
	HandleCases []sentEmailHandleCase `json:"handle_cases"`
}

func sentEmailPathValue(value any, path string) (any, bool) {
	current := value
	for _, segment := range strings.Split(path, ".") {
		switch typed := current.(type) {
		case map[string]any:
			next, ok := typed[segment]
			if !ok {
				return nil, false
			}
			current = next
		case []any:
			index, err := strconv.Atoi(segment)
			if err != nil || index >= len(typed) {
				return nil, false
			}
			current = typed[index]
		default:
			return nil, false
		}
	}
	return current, true
}

func sentEmailSetPath(target map[string]any, path string, value any) {
	parts := strings.Split(path, ".")
	current := target
	for _, part := range parts[:len(parts)-1] {
		current = current[part].(map[string]any)
	}
	current[parts[len(parts)-1]] = value
}

// sentEmailAsMap round-trips a parsed event through JSON, the way a consumer
// would serialize it, so the shared field paths apply to every SDK alike.
func sentEmailAsMap(t *testing.T, event any) map[string]any {
	t.Helper()
	data, err := json.Marshal(event)
	if err != nil {
		t.Fatalf("marshal event: %v", err)
	}
	var out map[string]any
	if err := json.Unmarshal(data, &out); err != nil {
		t.Fatalf("unmarshal event: %v", err)
	}
	return out
}

func (c sentEmailParseCase) input(t *testing.T) any {
	t.Helper()
	switch {
	case c.InputFixture != nil:
		return loadFixtureCases[map[string]any](t, c.InputFixture...)
	case c.InputPatch != nil:
		body := loadFixtureCases[map[string]any](t, c.InputPatch.Fixture...)
		for path, value := range c.InputPatch.Set {
			sentEmailSetPath(body, path, value)
		}
		for _, key := range c.InputPatch.Delete {
			delete(body, key)
		}
		return body
	default:
		var value any
		if err := json.Unmarshal(c.Input, &value); err != nil {
			t.Fatalf("%s: decode input: %v", c.Name, err)
		}
		return value
	}
}

func TestSharedSentEmailEvents(t *testing.T) {
	cases := loadFixtureCases[sentEmailCases](t, "sent-email-events", "cases.json")

	t.Run("parse", func(t *testing.T) {
		for _, testCase := range cases.ParseCases {
			event, err := ParseWebhookEvent(testCase.input(t), testCase.EventType)
			if testCase.Expected.Kind == "error" {
				code, ok := webhookErrorCode(err)
				if !ok || code != testCase.Expected.ErrorCode {
					t.Fatalf("%s: expected error %q, got %v", testCase.Name, testCase.Expected.ErrorCode, err)
				}
				continue
			}
			if err != nil {
				t.Fatalf("%s: unexpected error %v", testCase.Name, err)
			}
			if event.GetEvent() != testCase.Expected.Event {
				t.Fatalf("%s: event %q, want %q", testCase.Name, event.GetEvent(), testCase.Expected.Event)
			}
			if IsSentEmailEvent(event) != (testCase.Expected.Kind == "sent_email") {
				t.Fatalf("%s: IsSentEmailEvent mismatch for %T", testCase.Name, event)
			}
			data := sentEmailAsMap(t, event)
			if data["id"] != testCase.Expected.ID {
				t.Fatalf("%s: id %v, want %q", testCase.Name, data["id"], testCase.Expected.ID)
			}
			for path, want := range testCase.Expected.Fields {
				got, ok := sentEmailPathValue(data, path)
				if !ok || !reflect.DeepEqual(got, want) {
					t.Fatalf("%s: %s = %#v, want %#v", testCase.Name, path, got, want)
				}
			}
			for _, path := range testCase.Expected.Absent {
				if _, ok := sentEmailPathValue(data, path); ok {
					t.Fatalf("%s: %s should be absent", testCase.Name, path)
				}
			}
		}
	})

	t.Run("handle", func(t *testing.T) {
		for _, testCase := range cases.HandleCases {
			body := testCase.Body
			if testCase.BodyFixture != nil {
				body = loadFixtureText(t, testCase.BodyFixture...)
			}
			signSecret := testCase.SignSecret
			if signSecret == "" {
				signSecret = testCase.Secret
			}
			var timestamps []int64
			if testCase.Timestamp != nil {
				timestamps = append(timestamps, *testCase.Timestamp)
			}
			signed, err := SignWebhookPayload(body, signSecret, timestamps...)
			if err != nil {
				t.Fatalf("%s: sign: %v", testCase.Name, err)
			}
			headers := map[string]string{}
			for key, value := range testCase.Headers {
				if value == "{signed}" {
					value = signed.Header
				}
				headers[key] = value
			}

			event, err := HandleWebhookEvent(HandleWebhookOptions{Body: body, Headers: headers, Secret: testCase.Secret})
			if !testCase.Expected.Valid {
				code, ok := webhookErrorCode(err)
				if !ok || code != testCase.Expected.ErrorCode {
					t.Fatalf("%s: expected error %q, got %v", testCase.Name, testCase.Expected.ErrorCode, err)
				}
				continue
			}
			if err != nil {
				t.Fatalf("%s: unexpected error %v", testCase.Name, err)
			}
			typed, ok := event.(SentEmailEvent)
			if !ok {
				t.Fatalf("%s: expected SentEmailEvent, got %T", testCase.Name, event)
			}
			if typed.Event != testCase.Expected.Event || typed.ID != testCase.Expected.ID {
				t.Fatalf("%s: got %s %s", testCase.Name, typed.Event, typed.ID)
			}
		}
	})
}

func TestSentEmailCatalogAndGuards(t *testing.T) {
	for _, name := range SentEmailEventTypes {
		if !IsKnownWebhookEventType(name) || !IsSentEmailEventType(name) {
			t.Fatalf("%s should be a known sent_email event", name)
		}
	}
	if IsSentEmailEventType("sent_email.opened") {
		t.Fatal("sent_email.opened is not a known event")
	}

	parse := func(name string) SentEmailEvent {
		t.Helper()
		event, err := ValidateSentEmailEvent(loadFixtureCases[map[string]any](t, "sent-email-events", name))
		if err != nil {
			t.Fatalf("%s: %v", name, err)
		}
		return *event
	}
	accepted := parse("accepted.json")
	delivered := parse("delivered-recipient.json")
	failed := parse("failed-recipient.json")
	rollup := parse("failed-rollup.json")
	completed := parse("completed.json")

	checks := []struct {
		name string
		got  bool
		want bool
	}{
		{"accepted is accepted", IsSentEmailAcceptedEvent(accepted), true},
		{"failed is not accepted", IsSentEmailAcceptedEvent(failed), false},
		{"delivered is delivered", IsSentEmailDeliveredEvent(delivered), true},
		{"failed is failed", IsSentEmailFailedEvent(&failed), true},
		{"rollup is failed", IsSentEmailFailedEvent(rollup), true},
		{"completed is completed", IsSentEmailCompletedEvent(completed), true},
		{"failed is a recipient result", IsSentEmailRecipientResultEvent(failed), true},
		{"rollup is not a recipient result", IsSentEmailRecipientResultEvent(rollup), false},
		{"rollup is a rollup", rollup.IsRollup(), true},
		{"failed is not email.received", IsEmailReceivedEvent(failed), false},
		{"map body validates", IsSentEmailEvent(loadFixtureCases[map[string]any](t, "sent-email-events", "completed.json")), true},
		{"bare name map does not", IsSentEmailEvent(map[string]any{"event": "sent_email.failed"}), false},
		{"unknown event is not", IsSentEmailEvent(UnknownEvent{Event: "sent_email.failed"}), false},
	}
	for _, check := range checks {
		if check.got != check.want {
			t.Fatalf("%s: got %v", check.name, check.got)
		}
	}

	if failed.Recipient == nil || failed.Recipient.Type != "cc" || failed.Outcome == nil || *failed.Outcome.FailureKind != "rejected" {
		t.Fatalf("unexpected failed event %+v", failed)
	}
	if len(rollup.Recipients) != 2 || completed.Summary == nil || completed.Summary.Delivered != 2 {
		t.Fatal("unexpected rollup or summary")
	}
	if SentEmailEventJSONSchema["$ref"] != "#/definitions/SentEmailEvent" {
		t.Fatal("unexpected schema root")
	}
}

func TestSentEmailValidationReportsSelectedShape(t *testing.T) {
	body := loadFixtureCases[map[string]any](t, "sent-email-events", "failed-recipient.json")
	delete(body, "outcome")
	result := SafeValidateSentEmailEvent(body)
	if result.Success {
		t.Fatal("expected failure")
	}
	if result.Error.Code() != "SCHEMA_VALIDATION_FAILED" || result.Error.Field != "outcome" {
		t.Fatalf("unexpected error %q on %q", result.Error.Code(), result.Error.Field)
	}

	_, err := ValidateSentEmailEvent([]any{})
	var validationErr *WebhookValidationError
	if !errors.As(err, &validationErr) {
		t.Fatalf("expected a validation error, got %v", err)
	}

	sent := loadFixtureText(t, "sent-email-events", "completed.json")
	signed, err := SignWebhookPayload(sent, "whsec_test")
	if err != nil {
		t.Fatal(err)
	}
	_, err = HandleWebhook(HandleWebhookOptions{
		Body:    sent,
		Headers: map[string]string{"Primitive-Signature": signed.Header, "X-Webhook-Event": "sent_email.completed"},
		Secret:  "whsec_test",
	})
	if code, _ := webhookErrorCode(err); code != "PAYLOAD_UNKNOWN_EVENT" {
		t.Fatalf("HandleWebhook should stay typed to email.received, got %v", err)
	}
}

func TestSentEmailEventRoundTripsThroughValidation(t *testing.T) {
	for _, name := range []string{
		"accepted.json", "delivered-recipient.json", "failed-recipient.json", "failed-rollup.json",
		"delivered-rollup.json", "legacy-message-result.json", "completed.json", "completed-not-relayed.json",
	} {
		event, err := ValidateSentEmailEvent(loadFixtureCases[map[string]any](t, "sent-email-events", name))
		if err != nil {
			t.Fatalf("%s: %v", name, err)
		}
		// A parsed event, serialized again, must still be a valid body.
		if _, err := ValidateSentEmailEvent(*event); err != nil {
			t.Fatalf("%s: re-validating the parsed event failed: %v", name, err)
		}
		data := sentEmailAsMap(t, event)
		value, present := data["recipient"]
		messageScoped := event.Scope != nil && *event.Scope == SentEmailScopeMessage
		if messageScoped && (!present || value != nil) {
			t.Fatalf("%s: message-scoped result must carry recipient: null, got %v %v", name, present, value)
		}
		if (event.Event == SentEmailEventAccepted || event.Event == SentEmailEventCompleted) && present {
			t.Fatalf("%s: recipient must be absent", name)
		}
	}
}
