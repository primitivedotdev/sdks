package primitive

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

func fixturePath(parts ...string) string {
	_, filename, _, _ := runtime.Caller(0)
	base := filepath.Join(filepath.Dir(filename), "..", "test-fixtures")
	all := append([]string{base}, parts...)
	return filepath.Join(all...)
}

func loadJSONFixture(t *testing.T, parts ...string) map[string]any {
	t.Helper()
	data, err := os.ReadFile(fixturePath(parts...))
	if err != nil {
		t.Fatalf("read fixture: %v", err)
	}
	var value map[string]any
	if err := json.Unmarshal(data, &value); err != nil {
		t.Fatalf("decode fixture: %v", err)
	}
	return value
}

func TestValidateEmailReceivedEvent(t *testing.T) {
	payload := loadJSONFixture(t, "webhook", "valid-email-received.json")
	event, err := ValidateEmailReceivedEvent(payload)
	if err != nil {
		t.Fatalf("ValidateEmailReceivedEvent returned error: %v", err)
	}
	if event.ID != "evt_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef" {
		t.Fatalf("unexpected event ID: %s", event.ID)
	}

	result := SafeValidateEmailReceivedEvent(map[string]any{"event": "email.received"})
	if result.Success {
		t.Fatal("expected safe validation to fail")
	}
	if result.Error == nil || result.Error.Code() != "SCHEMA_VALIDATION_FAILED" {
		t.Fatalf("unexpected validation error: %#v", result.Error)
	}

	delete(payload["email"].(map[string]any)["auth"].(map[string]any), "dmarcSpfAligned")
	delete(payload["email"].(map[string]any)["auth"].(map[string]any), "dmarcDkimAligned")
	eventWithoutAlignment, err := ValidateEmailReceivedEvent(payload)
	if err != nil {
		t.Fatalf("ValidateEmailReceivedEvent should accept missing DMARC alignment fields: %v", err)
	}
	if eventWithoutAlignment.Email.Auth.DMARCSpfAligned != nil || eventWithoutAlignment.Email.Auth.DMARCDkimAligned != nil {
		t.Fatalf("expected missing DMARC alignment fields to stay nil, got %#v", eventWithoutAlignment.Email.Auth)
	}
	serialized, err := json.Marshal(eventWithoutAlignment)
	if err != nil {
		t.Fatalf("json.Marshal returned error: %v", err)
	}
	if strings.Contains(string(serialized), "dmarcSpfAligned") || strings.Contains(string(serialized), "dmarcDkimAligned") {
		t.Fatalf("expected missing DMARC alignment fields to remain omitted, got %s", serialized)
	}
}

func TestParseWebhookEvent(t *testing.T) {
	payload := loadJSONFixture(t, "webhook", "valid-email-received.json")
	event, err := ParseWebhookEvent(payload)
	if err != nil {
		t.Fatalf("ParseWebhookEvent returned error: %v", err)
	}
	if !IsEmailReceivedEvent(event) {
		t.Fatal("expected email.received event")
	}

	if _, err := ParseWebhookEvent(map[string]any{"event": "email.received", "id": "evt_1"}); err == nil {
		t.Fatal("expected validation error for malformed known event")
	} else {
		var validationErr *WebhookValidationError
		if !errors.As(err, &validationErr) {
			t.Fatalf("expected WebhookValidationError, got %v", err)
		}
	}

	unknown, err := ParseWebhookEvent(map[string]any{"event": "email.bounced", "id": "evt_2"})
	if err != nil {
		t.Fatalf("ParseWebhookEvent returned error for unknown event: %v", err)
	}
	if unknown.GetEvent() != "email.bounced" {
		t.Fatalf("unexpected unknown event type: %s", unknown.GetEvent())
	}

	if _, err := ParseWebhookEvent([]map[string]any{{"event": "email.received"}}); err == nil {
		t.Fatal("expected array payload error")
	}

	fromBytes, err := ParseWebhookEvent([]byte(`{"event":"email.bounced","id":"evt_1"}`))
	if err != nil {
		t.Fatalf("expected raw byte payload to parse: %v", err)
	}
	if fromBytes.GetEvent() != "email.bounced" {
		t.Fatalf("unexpected event type from bytes: %s", fromBytes.GetEvent())
	}

	fromRawMessage, err := ParseWebhookEvent(json.RawMessage(`{"event":"email.bounced","id":"evt_1"}`))
	if err != nil {
		t.Fatalf("expected json.RawMessage payload to parse: %v", err)
	}
	if fromRawMessage.GetEvent() != "email.bounced" {
		t.Fatalf("unexpected event type from json.RawMessage: %s", fromRawMessage.GetEvent())
	}
}

func TestParseJSONBodyRejectsTrailingContent(t *testing.T) {
	if _, err := ParseJSONBody([]byte(`{"event":"email.received"} junk`)); err == nil {
		t.Fatal("expected trailing JSON content to fail")
	} else {
		var payloadErr *WebhookPayloadError
		if !errors.As(err, &payloadErr) {
			t.Fatalf("expected WebhookPayloadError, got %v", err)
		}
		if payloadErr.Code() != "JSON_PARSE_FAILED" {
			t.Fatalf("expected JSON_PARSE_FAILED, got %s", payloadErr.Code())
		}
	}
}

func TestParseJSONBodyAcceptsJSONRawMessage(t *testing.T) {
	parsed, err := ParseJSONBody(json.RawMessage(`{"event":"email.received"}`))
	if err != nil {
		t.Fatalf("ParseJSONBody returned error: %v", err)
	}
	obj, ok := parsed.(map[string]any)
	if !ok || obj["event"] != "email.received" {
		t.Fatalf("unexpected parsed JSON object: %#v", parsed)
	}
}

func TestUnknownEventMarshalJSON(t *testing.T) {
	parsed, err := ParseWebhookEvent(map[string]any{
		"id":      "evt_unknown",
		"event":   "email.bounced",
		"version": "2025-12-14",
		"reason":  "mailbox_full",
		"retry":   false,
	})
	if err != nil {
		t.Fatalf("ParseWebhookEvent returned error: %v", err)
	}

	unknown, ok := parsed.(UnknownEvent)
	if !ok {
		t.Fatalf("expected UnknownEvent, got %T", parsed)
	}

	data, err := json.Marshal(unknown)
	if err != nil {
		t.Fatalf("json.Marshal returned error: %v", err)
	}

	var roundTrip map[string]any
	if err := json.Unmarshal(data, &roundTrip); err != nil {
		t.Fatalf("json.Unmarshal returned error: %v", err)
	}

	if roundTrip["event"] != "email.bounced" {
		t.Fatalf("unexpected event after marshal: %#v", roundTrip)
	}
	if roundTrip["id"] != "evt_unknown" {
		t.Fatalf("unexpected id after marshal: %#v", roundTrip)
	}
	if roundTrip["version"] != "2025-12-14" {
		t.Fatalf("unexpected version after marshal: %#v", roundTrip)
	}
	if roundTrip["reason"] != "mailbox_full" {
		t.Fatalf("expected unknown fields to round-trip, got %#v", roundTrip)
	}
	if retry, ok := roundTrip["retry"].(bool); !ok || retry {
		t.Fatalf("unexpected retry flag after marshal: %#v", roundTrip)
	}
}

func TestParseWebhookEventPreservesLargeUnknownIntegers(t *testing.T) {
	event, err := ParseWebhookEvent(map[string]any{
		"event": "future.test",
		"seq":   int64(9007199254740993),
	})
	if err != nil {
		t.Fatalf("ParseWebhookEvent returned error: %v", err)
	}

	unknown, ok := event.(UnknownEvent)
	if !ok {
		t.Fatalf("expected UnknownEvent, got %T", event)
	}

	seq, ok := unknown.Payload["seq"].(json.Number)
	if !ok {
		t.Fatalf("expected json.Number for preserved integer, got %#v", unknown.Payload["seq"])
	}
	if string(seq) != "9007199254740993" {
		t.Fatalf("expected integer precision to be preserved, got %s", seq)
	}
}

func TestUnknownEventUnmarshalJSONPreservesPayload(t *testing.T) {
	var unknown UnknownEvent
	if err := json.Unmarshal([]byte(`{"event":"email.bounced","id":"evt_1","foo":"bar","count":9007199254740993}`), &unknown); err != nil {
		t.Fatalf("json.Unmarshal returned error: %v", err)
	}

	if unknown.Event != "email.bounced" {
		t.Fatalf("unexpected event after unmarshal: %#v", unknown)
	}
	if unknown.ID == nil || *unknown.ID != "evt_1" {
		t.Fatalf("unexpected id after unmarshal: %#v", unknown)
	}
	if unknown.Payload["foo"] != "bar" {
		t.Fatalf("expected payload field to be preserved, got %#v", unknown.Payload)
	}
	count, ok := unknown.Payload["count"].(json.Number)
	if !ok || string(count) != "9007199254740993" {
		t.Fatalf("expected numeric payload to be preserved, got %#v", unknown.Payload["count"])
	}

	data, err := json.Marshal(unknown)
	if err != nil {
		t.Fatalf("json.Marshal returned error: %v", err)
	}
	if string(data) != `{"count":9007199254740993,"event":"email.bounced","foo":"bar","id":"evt_1"}` {
		t.Fatalf("unexpected round-tripped payload: %s", data)
	}
}

func TestHandleWebhook(t *testing.T) {
	payload := loadJSONFixture(t, "webhook", "valid-email-received.json")
	body, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("marshal payload: %v", err)
	}

	signed, err := SignWebhookPayload(body, "test-webhook-secret")
	if err != nil {
		t.Fatalf("SignWebhookPayload returned error: %v", err)
	}

	event, err := HandleWebhook(HandleWebhookOptions{
		Body:    body,
		Headers: map[string]string{"primitive-signature": signed.Header},
		Secret:  "test-webhook-secret",
	})
	if err != nil {
		t.Fatalf("HandleWebhook returned error: %v", err)
	}
	if event.Event != string(EventTypeEmailReceived) {
		t.Fatalf("unexpected event type: %s", event.Event)
	}
}

func TestHandleWebhookAcceptsByteValuedSignatureHeader(t *testing.T) {
	payload := loadJSONFixture(t, "webhook", "valid-email-received.json")
	body, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("marshal payload: %v", err)
	}

	signed, err := SignWebhookPayload(body, "test-webhook-secret")
	if err != nil {
		t.Fatalf("SignWebhookPayload returned error: %v", err)
	}

	event, err := HandleWebhook(HandleWebhookOptions{
		Body:    body,
		Headers: map[string]any{"primitive-signature": []byte(signed.Header)},
		Secret:  "test-webhook-secret",
	})
	if err != nil {
		t.Fatalf("HandleWebhook returned error: %v", err)
	}
	if event.ID != "evt_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef" {
		t.Fatalf("unexpected event ID: %s", event.ID)
	}

	eventFromSequence, err := HandleWebhook(HandleWebhookOptions{
		Body:    body,
		Headers: map[string]any{"primitive-signature": []any{[]byte(signed.Header)}},
		Secret:  "test-webhook-secret",
	})
	if err != nil {
		t.Fatalf("HandleWebhook should accept byte-valued header sequences: %v", err)
	}
	if eventFromSequence.ID != "evt_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef" {
		t.Fatalf("unexpected event ID from header sequence: %s", eventFromSequence.ID)
	}
}

func TestIsEmailReceivedEventRejectsMalformedMaps(t *testing.T) {
	if IsEmailReceivedEvent(map[string]any{"event": "email.received"}) {
		t.Fatal("expected malformed email.received payload to be rejected")
	}
}

func TestHandleWebhookEventPreservesLargeUnknownIntegersFromRawJSON(t *testing.T) {
	body := []byte(`{"event":"future.test","seq":9007199254740993}`)
	signed, err := SignWebhookPayload(body, "test-webhook-secret")
	if err != nil {
		t.Fatalf("SignWebhookPayload returned error: %v", err)
	}

	event, err := HandleWebhookEvent(HandleWebhookOptions{
		Body:    body,
		Headers: map[string]string{"primitive-signature": signed.Header},
		Secret:  "test-webhook-secret",
	})
	if err != nil {
		t.Fatalf("HandleWebhookEvent returned error: %v", err)
	}

	unknown, ok := event.(UnknownEvent)
	if !ok {
		t.Fatalf("expected UnknownEvent, got %T", event)
	}

	seq, ok := unknown.Payload["seq"].(json.Number)
	if !ok {
		t.Fatalf("expected json.Number for preserved integer, got %#v", unknown.Payload["seq"])
	}
	if string(seq) != "9007199254740993" {
		t.Fatalf("expected preserved integer value, got %s", seq)
	}
}

func TestHandleWebhookEvent(t *testing.T) {
	payload := loadJSONFixture(t, "webhook", "valid-email-received.json")
	body, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("marshal payload: %v", err)
	}

	signed, err := SignWebhookPayload(body, "test-webhook-secret")
	if err != nil {
		t.Fatalf("SignWebhookPayload returned error: %v", err)
	}

	event, err := HandleWebhookEvent(HandleWebhookOptions{
		Body:    body,
		Headers: map[string]string{"primitive-signature": signed.Header},
		Secret:  "test-webhook-secret",
	})
	if err != nil {
		t.Fatalf("HandleWebhookEvent returned error: %v", err)
	}
	if !IsEmailReceivedEvent(event) {
		t.Fatalf("expected email.received event, got %T", event)
	}

	unknownBody, err := json.Marshal(map[string]any{
		"id":      "evt_unknown",
		"event":   "email.bounced",
		"version": "2025-12-14",
		"reason":  "mailbox_full",
	})
	if err != nil {
		t.Fatalf("marshal unknown payload: %v", err)
	}

	unknownSigned, err := SignWebhookPayload(unknownBody, "test-webhook-secret")
	if err != nil {
		t.Fatalf("SignWebhookPayload returned error for unknown payload: %v", err)
	}

	unknownEvent, err := HandleWebhookEvent(HandleWebhookOptions{
		Body:    unknownBody,
		Headers: map[string]string{"primitive-signature": unknownSigned.Header},
		Secret:  "test-webhook-secret",
	})
	if err != nil {
		t.Fatalf("HandleWebhookEvent returned error for unknown event: %v", err)
	}
	unknown, ok := unknownEvent.(UnknownEvent)
	if !ok {
		t.Fatalf("expected UnknownEvent, got %T", unknownEvent)
	}
	if unknown.Event != "email.bounced" {
		t.Fatalf("unexpected unknown event type: %s", unknown.Event)
	}
	if unknown.Payload["reason"] != "mailbox_full" {
		t.Fatalf("unexpected unknown event payload: %#v", unknown.Payload)
	}

	_, err = HandleWebhook(HandleWebhookOptions{
		Body:    unknownBody,
		Headers: map[string]string{"primitive-signature": unknownSigned.Header},
		Secret:  "test-webhook-secret",
	})
	var payloadErr *PrimitiveWebhookError
	if !errors.As(err, &payloadErr) {
		t.Fatalf("expected PrimitiveWebhookError for unknown event, got %v", err)
	}
	if payloadErr.Code() != "PAYLOAD_UNKNOWN_EVENT" {
		t.Fatalf("unexpected error code: %s", payloadErr.Code())
	}
}

func TestRawEmailHelpers(t *testing.T) {
	payload := loadJSONFixture(t, "webhook", "valid-email-received.json")
	included, err := IsRawIncluded(payload)
	if err != nil {
		t.Fatalf("IsRawIncluded returned error: %v", err)
	}
	if !included {
		t.Fatal("expected raw content to be included")
	}

	decoded, err := DecodeRawEmail(payload)
	if err != nil {
		t.Fatalf("DecodeRawEmail returned error: %v", err)
	}
	if string(decoded) != "Hello World" {
		t.Fatalf("unexpected decoded content: %q", string(decoded))
	}

	verified, err := VerifyRawEmailDownload([]byte("Hello World"), payload)
	if err != nil {
		t.Fatalf("VerifyRawEmailDownload returned error: %v", err)
	}
	if string(verified) != "Hello World" {
		t.Fatalf("unexpected verified content: %q", string(verified))
	}

	payload["email"].(map[string]any)["content"].(map[string]any)["raw"].(map[string]any)["sha256"] = strings.ToUpper(
		payload["email"].(map[string]any)["content"].(map[string]any)["raw"].(map[string]any)["sha256"].(string),
	)

	decodedUpper, err := DecodeRawEmail(payload)
	if err != nil {
		t.Fatalf("DecodeRawEmail should accept uppercase hashes: %v", err)
	}
	if string(decodedUpper) != "Hello World" {
		t.Fatalf("unexpected uppercase decoded content: %q", string(decodedUpper))
	}

	verifiedUpper, err := VerifyRawEmailDownload([]byte("Hello World"), payload)
	if err != nil {
		t.Fatalf("VerifyRawEmailDownload should accept uppercase hashes: %v", err)
	}
	if string(verifiedUpper) != "Hello World" {
		t.Fatalf("unexpected uppercase verified content: %q", string(verifiedUpper))
	}
}

func TestDownloadHelpers(t *testing.T) {
	payload := loadJSONFixture(t, "webhook", "valid-email-received.json")
	expired, err := IsDownloadExpired(payload, 1734177600000)
	if err != nil {
		t.Fatalf("IsDownloadExpired returned error: %v", err)
	}
	if expired {
		t.Fatal("expected download URL to still be valid")
	}
	remaining, err := GetDownloadTimeRemaining(payload, 1734177600000)
	if err != nil {
		t.Fatalf("GetDownloadTimeRemaining returned error: %v", err)
	}
	if remaining <= 0 {
		t.Fatalf("expected positive remaining time, got %d", remaining)
	}

	payload["email"].(map[string]any)["content"].(map[string]any)["download"].(map[string]any)["expires_at"] = "2025-12-15T12:00:00.123+00:00"
	expired, err = IsDownloadExpired(payload, 1765800000000)
	if err != nil {
		t.Fatalf("IsDownloadExpired should accept fractional RFC3339 timestamps: %v", err)
	}
	if expired {
		t.Fatal("expected fractional download URL to still be valid")
	}
	remaining, err = GetDownloadTimeRemaining(payload, 1765800000000)
	if err != nil {
		t.Fatalf("GetDownloadTimeRemaining should accept fractional RFC3339 timestamps: %v", err)
	}
	if remaining != 123 {
		t.Fatalf("expected remaining time to include fractional milliseconds, got %d", remaining)
	}
}

func TestValidateEmailAuth(t *testing.T) {
	payload := loadJSONFixture(t, "webhook", "valid-email-received.json")
	email := payload["email"].(map[string]any)
	auth := email["auth"]
	result, err := ValidateEmailAuth(auth)
	if err != nil {
		t.Fatalf("ValidateEmailAuth returned error: %v", err)
	}
	if result.Verdict != AuthVerdictLegit || result.Confidence != AuthConfidenceHigh {
		t.Fatalf("unexpected auth verdict: %#v", result)
	}
}

func TestDecodeRawEmailHashMismatch(t *testing.T) {
	payload := loadJSONFixture(t, "webhook", "valid-email-received.json")
	email := payload["email"].(map[string]any)
	content := email["content"].(map[string]any)
	raw := content["raw"].(map[string]any)
	sum := sha256.Sum256([]byte("other"))
	raw["sha256"] = hex.EncodeToString(sum[:])

	_, err := DecodeRawEmail(payload)
	var decodeErr *RawEmailDecodeError
	if !errors.As(err, &decodeErr) {
		t.Fatalf("expected RawEmailDecodeError, got %v", err)
	}
	if decodeErr.Code() != "HASH_MISMATCH" {
		t.Fatalf("unexpected error code: %s", decodeErr.Code())
	}
}
