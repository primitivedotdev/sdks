package primitive

import (
	"errors"
	"fmt"
	"strings"
	"sync"
	"testing"

	"github.com/xeipuuv/gojsonschema"
)

type headerGetter struct{ value string }

func (h headerGetter) Get(string) string { return h.value }

func intPtr(v int) *int { return &v }

type invalidJSONMarshaler struct{}

func (invalidJSONMarshaler) MarshalJSON() ([]byte, error) { return []byte("{"), nil }

type decodeFailureSchemaInput int

func setSchemaState(schemaJSON []byte, loader *gojsonschema.Schema, err error) {
	emailReceivedEventSchemaJSON = schemaJSON
	schemaOnce = sync.Once{}
	schemaLoader = loader
	schemaErr = err
	if loader != nil || err != nil {
		schemaOnce.Do(func() {})
	}
}

func TestPrimitiveWebhookErrors(t *testing.T) {
	verification := NewWebhookVerificationError("MISSING_SECRET", "", "")
	if verification.Error() == "" || verification.Name() != "WebhookVerificationError" {
		t.Fatalf("unexpected verification error formatting: %#v", verification)
	}
	if verification.Message() != VerificationErrors["MISSING_SECRET"].Message {
		t.Fatalf("expected default verification message")
	}

	payloadCause := errors.New("boom")
	payload := NewWebhookPayloadError("PAYLOAD_EMPTY_BODY", "", "", payloadCause)
	if !errors.Is(payload, payloadCause) {
		t.Fatalf("expected payload error to unwrap cause")
	}
	if payload.ToMap()["code"] != "PAYLOAD_EMPTY_BODY" {
		t.Fatalf("expected payload error map to include code")
	}

	validation := NewWebhookValidationError("field", "bad", "fix", []ValidationIssue{{Path: "field"}, {Path: "other"}})
	if validation.AdditionalErrorCount != 1 {
		t.Fatalf("unexpected additional error count: %d", validation.AdditionalErrorCount)
	}
	if validation.ToMap()["additionalErrorCount"] != 1 {
		t.Fatalf("expected validation error map to include additional count")
	}

	raw := NewRawEmailDecodeError("NOT_INCLUDED", "")
	if raw.Suggestion() == "" {
		t.Fatal("expected raw email error suggestion")
	}

	base := &PrimitiveWebhookError{}
	if base.Name() != "PrimitiveWebhookError" {
		t.Fatalf("expected default primitive webhook error name, got %q", base.Name())
	}
}

func TestHelpers(t *testing.T) {
	if got, err := bodyToString("hello", "payload"); err != nil || got != "hello" {
		t.Fatalf("unexpected string conversion: %q %v", got, err)
	}
	if _, err := bodyToString([]byte{0xff}, "payload"); err == nil {
		t.Fatal("expected invalid utf-8 error")
	}
	if _, err := bodyToString(123, "payload"); err == nil {
		t.Fatal("expected wrong type error")
	}

	if got, err := secretToBytes("secret"); err != nil || string(got) != "secret" {
		t.Fatalf("unexpected secret bytes result: %q %v", string(got), err)
	}
	if got, err := secretToBytes([]byte("secret")); err != nil || string(got) != "secret" {
		t.Fatalf("unexpected byte secret result: %q %v", string(got), err)
	}
	for _, value := range []any{"", []byte{}, nil, 123} {
		if _, err := secretToBytes(value); err == nil {
			t.Fatalf("expected missing secret error for %#v", value)
		}
	}

	normalized, data, err := normalizeJSONValue(struct{ Event string `json:"event"` }{Event: "email.received"})
	if err != nil || len(data) == 0 {
		t.Fatalf("unexpected normalized json result: %#v %v", normalized, err)
	}
	if _, _, err := normalizeJSONValue(func() {}); err == nil {
		t.Fatal("expected normalizeJSONValue to fail for functions")
	}
	if _, _, err := normalizeJSONValue(invalidJSONMarshaler{}); err == nil {
		t.Fatal("expected normalizeJSONValue to fail when marshaled json is invalid")
	}

	type simpleEvent struct{ Event string `json:"event"` }
	decoded, err := decodeInto[simpleEvent](map[string]any{"event": "email.received"})
	if err != nil || decoded.Event != "email.received" {
		t.Fatalf("unexpected decodeInto result: %#v %v", decoded, err)
	}
	if _, err := decodeInto[simpleEvent](func() {}); err == nil {
		t.Fatal("expected decodeInto to fail for unsupported input")
	}

	if _, err := mapFromInput(struct{ Event string }{Event: "email.received"}); err != nil {
		t.Fatalf("expected struct input to normalize into a map: %v", err)
	}
	if _, err := mapFromInput([]string{"nope"}); err == nil {
		t.Fatal("expected array input to fail mapFromInput")
	}
	if _, err := mapFromInput(invalidJSONMarshaler{}); err == nil {
		t.Fatal("expected invalid marshaler input to fail mapFromInput")
	}

	nested := map[string]any{"email": map[string]any{"content": map[string]any{"raw": map[string]any{"included": true}}}}
	if value, ok := getMapValue(nested, "email", "content", "raw", "included"); !ok || value != true {
		t.Fatalf("unexpected nested map value: %#v %v", value, ok)
	}
	if _, ok := getMapValue(simpleEvent{Event: "email.received"}, "event"); !ok {
		t.Fatal("expected struct field lookup to work")
	}
	if _, ok := getMapValue(nested, "email", "missing"); ok {
		t.Fatal("expected missing path lookup to fail")
	}
	if _, ok := getMapValue(simpleEvent{Event: "email.received"}, "missing"); ok {
		t.Fatal("expected missing struct field lookup to fail")
	}
	if _, ok := getMapValue(invalidJSONMarshaler{}, "missing"); ok {
		t.Fatal("expected invalid marshaler lookup to fail")
	}

	if value, ok := getString(map[string]any{"event": "email.received"}, "event"); !ok || value != "email.received" {
		t.Fatalf("unexpected string lookup: %q %v", value, ok)
	}
	if _, ok := getString(map[string]any{"event": true}, "event"); ok {
		t.Fatal("expected non-string lookup to fail")
	}
	if value, ok := getBool(nested, "email", "content", "raw", "included"); !ok || !value {
		t.Fatalf("unexpected bool lookup: %v %v", value, ok)
	}
	if _, ok := getBool(map[string]any{"flag": "true"}, "flag"); ok {
		t.Fatal("expected non-bool lookup to fail")
	}

	if got := getHeaderValue(map[string]string{"Primitive-Signature": "abc"}, PrimitiveSignatureHeader); got != "abc" {
		t.Fatalf("unexpected map[string]string header value: %q", got)
	}
	if got := getHeaderValue(map[string]any{"Primitive-Signature": "abc"}, PrimitiveSignatureHeader); got != "abc" {
		t.Fatalf("unexpected map[string]any string header value: %q", got)
	}
	if got := getHeaderValue(map[string][]string{"Primitive-Signature": {}}, PrimitiveSignatureHeader); got != "" {
		t.Fatalf("expected empty []string header lookup to return empty string, got %q", got)
	}
	if got := getHeaderValue(map[string][]string{"Primitive-Signature": {"abc", "def"}}, PrimitiveSignatureHeader); got != "abc" {
		t.Fatalf("unexpected map[string][]string header value: %q", got)
	}
	if got := getHeaderValue(map[string]any{"Primitive-Signature": []string{"abc", "def"}}, PrimitiveSignatureHeader); got != "abc" {
		t.Fatalf("unexpected []string-any header value: %q", got)
	}
	if got := getHeaderValue(map[string]any{"Primitive-Signature": []string{}}, PrimitiveSignatureHeader); got != "" {
		t.Fatalf("expected empty []string-any header lookup to return empty string, got %q", got)
	}
	if got := getHeaderValue(map[string]any{"x-other": "abc"}, PrimitiveSignatureHeader); got != "" {
		t.Fatalf("expected non-matching map[string]any header lookup to return empty string, got %q", got)
	}
	if got := getHeaderValue(headerGetter{value: ""}, PrimitiveSignatureHeader); got != "" {
		t.Fatalf("expected getter header lookup to return empty string when unset, got %q", got)
	}
	if got := getHeaderValue(map[string]any{"Primitive-Signature": []any{"abc", "def"}}, PrimitiveSignatureHeader); got != "abc" {
		t.Fatalf("unexpected []any header value: %q", got)
	}
	if got := getHeaderValue(map[string]any{"Primitive-Signature": 123}, PrimitiveSignatureHeader); got != "123" {
		t.Fatalf("unexpected coerced header value: %q", got)
	}
	if got := getHeaderValue(headerGetter{value: "abc"}, PrimitiveSignatureHeader); got != "abc" {
		t.Fatalf("unexpected getter header value: %q", got)
	}
	if got := getHeaderValue(map[string]string{}, PrimitiveSignatureHeader); got != "" {
		t.Fatalf("expected missing header lookup to return empty string, got %q", got)
	}

	if hint := detectReserializedBody("{\n  \"event\": \"email.received\"\n}"); !strings.Contains(hint, "re-serialized") {
		t.Fatalf("expected pretty-printed body hint, got %q", hint)
	}
	if hint := detectReserializedBody("{}" ); hint != "" {
		t.Fatalf("expected compact json to produce no hint, got %q", hint)
	}

	if WebhookVersion == "" || PrimitiveSignatureHeader == "" || PrimitiveConfirmedHeader == "" {
		t.Fatal("expected public constants to be populated")
	}
	if len(EmailReceivedEventJSONSchema) == 0 {
		t.Fatal("expected compiled schema to be loaded")
	}
	if _, err := compiledSchema(); err != nil {
		t.Fatalf("expected compiled schema to load: %v", err)
	}
}

func TestValidationHelpers(t *testing.T) {
	if got := toFieldPath(""); got != "payload" {
		t.Fatalf("unexpected root path conversion: %q", got)
	}
	if got := toFieldPath("(root).email.id"); got != "email.id" {
		t.Fatalf("unexpected field path conversion: %q", got)
	}
	if got := toFieldPath("(root)."); got != "payload" {
		t.Fatalf("unexpected root-with-dot path conversion: %q", got)
	}
	if got := toFieldPath("(root)"); got != "payload" {
		t.Fatalf("unexpected bare root path conversion: %q", got)
	}

	payload := loadJSONFixture(t, "webhook", "valid-email-received.json")
	missingNested := loadJSONFixture(t, "webhook", "valid-email-received.json")
	delete(missingNested["email"].(map[string]any), "id")
	if _, err := ValidateEmailReceivedEvent(missingNested); err == nil {
		t.Fatal("expected nested required field validation to fail")
	} else {
		validationErr, ok := err.(*WebhookValidationError)
		if !ok {
			t.Fatalf("expected WebhookValidationError, got %v", err)
		}
		if validationErr.Field != "email.id" {
			t.Fatalf("expected enriched required field path, got %q", validationErr.Field)
		}
		if len(validationErr.ValidationErrors) == 0 || validationErr.ValidationErrors[0].Path != "email.id" {
			t.Fatalf("expected validation issue path to include missing field, got %#v", validationErr.ValidationErrors)
		}
	}
	invalidEvent := loadJSONFixture(t, "webhook", "valid-email-received.json")
	invalidEvent["event"] = "email.opened"
	if _, err := ValidateEmailReceivedEvent(invalidEvent); err == nil {
		t.Fatal("expected const validation failure for event")
	}
	invalidVersion := loadJSONFixture(t, "webhook", "valid-email-received.json")
	invalidVersion["version"] = "not-a-date"
	if _, err := ValidateEmailReceivedEvent(invalidVersion); err == nil {
		t.Fatal("expected invalid version to fail validation")
	}
	if fallbackErr := createValidationError(nil); fallbackErr.Field != "payload" || fallbackErr.AdditionalErrorCount != 0 {
		t.Fatalf("expected zero-issue validation fallback error: %#v", fallbackErr)
	}
	originalSchemaJSON := emailReceivedEventSchemaJSON
	t.Cleanup(func() {
		setSchemaState(originalSchemaJSON, nil, nil)
	})

	setSchemaState([]byte("{"), nil, nil)
	if _, err := ValidateEmailReceivedEvent(payload); err == nil {
		t.Fatal("expected invalid compiled schema to fail validation")
	}

	compiledNumberSchema, err := gojsonschema.NewSchema(gojsonschema.NewStringLoader(`{"type":"number"}`))
	if err != nil {
		t.Fatalf("failed to build test schema: %v", err)
	}
	setSchemaState(originalSchemaJSON, compiledNumberSchema, nil)
	if _, err := ValidateEmailReceivedEvent(decodeFailureSchemaInput(123)); err == nil {
		t.Fatal("expected decodeInto branch to fail after schema validation")
	}
	setSchemaState(originalSchemaJSON, nil, nil)
	if _, err := ValidateEmailReceivedEvent(func() {}); err == nil {
		t.Fatal("expected schema validation loader errors for unsupported input")
	}
	safePayloadErr := SafeValidateEmailReceivedEvent("bad")
	if safePayloadErr.Success || safePayloadErr.Error == nil || safePayloadErr.Error.Field != "payload" {
		t.Fatalf("expected safe validation to wrap payload-level errors: %#v", safePayloadErr)
	}
	setSchemaState(originalSchemaJSON, compiledNumberSchema, nil)
	safeDecodeErr := SafeValidateEmailReceivedEvent(decodeFailureSchemaInput(123))
	if safeDecodeErr.Success || safeDecodeErr.Error == nil || safeDecodeErr.Error.Field != "payload" || !strings.Contains(safeDecodeErr.Error.Message(), "cannot unmarshal number") {
		t.Fatalf("expected safe validation to wrap decode errors: %#v", safeDecodeErr)
	}
	setSchemaState(originalSchemaJSON, nil, nil)
	safeSchemaErr := SafeValidateEmailReceivedEvent(map[string]any{"event": "email.received"})
	if safeSchemaErr.Success || safeSchemaErr.Error == nil || safeSchemaErr.Error.Code() != "SCHEMA_VALIDATION_FAILED" {
		t.Fatalf("expected safe validation to return schema validation error: %#v", safeSchemaErr)
	}
	safeSuccess := SafeValidateEmailReceivedEvent(payload)
	if !safeSuccess.Success || safeSuccess.Data == nil || safeSuccess.Data.Event != string(EventTypeEmailReceived) {
		t.Fatalf("expected safe validation success: %#v", safeSuccess)
	}

	result := SafeValidateEmailReceivedEvent(map[string]any{"event": "email.received"})
	if result.Success || result.Error == nil {
		t.Fatal("expected safe validation failure")
	}

	if _, err := ValidateEmailReceivedEvent(payload); err != nil {
		t.Fatalf("expected fixture payload to validate: %v", err)
	}
}

func TestWebhookUtilityCoverage(t *testing.T) {
	payload := loadJSONFixture(t, "webhook", "valid-email-received.json")
	body := []byte(`{"event":"email.received"}`)

	if _, err := ParseJSONBody("   "); err == nil {
		t.Fatal("expected empty body parse to fail")
	}
	if parsed, err := ParseJSONBody("\ufeff{" + `"event":"email.received"` + "}"); err != nil || parsed == nil {
		t.Fatalf("expected BOM-prefixed JSON to parse: %#v %v", parsed, err)
	}
	if parsed, err := ParseJSONBody([]byte(`{"event":"email.received"}`)); err != nil || parsed == nil {
		t.Fatalf("expected byte JSON body to parse: %#v %v", parsed, err)
	}
	if _, err := ParseJSONBody("{"); err == nil {
		t.Fatal("expected invalid json parse to fail")
	}
	if _, err := ParseJSONBody([]byte("{")); err == nil {
		t.Fatal("expected invalid json bytes parse to fail")
	}
	if _, err := ParseJSONBody([]byte{0xff}); err == nil {
		t.Fatal("expected invalid utf-8 body parse to fail")
	}

	if signed, err := SignWebhookPayload(body, []byte("secret"), 123); err != nil || signed.Timestamp != 123 {
		t.Fatalf("unexpected signed payload result: %#v %v", signed, err)
	}
	if signed, err := SignWebhookPayload(body, "secret"); err != nil || signed.Timestamp == 0 {
		t.Fatalf("expected default timestamp signing path: %#v %v", signed, err)
	}
	if _, err := SignWebhookPayload(123, "secret"); err == nil {
		t.Fatal("expected invalid sign body type to fail")
	}
	if _, err := SignWebhookPayload(body, ""); err == nil {
		t.Fatal("expected empty signing secret to fail")
	}

	if _, signatures, ok := parseSignatureHeader("bad, t=123, v1=abc"); !ok || len(signatures) != 1 {
		t.Fatalf("expected signature header to parse correctly: %v %v", signatures, ok)
	}
	if _, _, ok := parseSignatureHeader("t=abc,v1=abc"); ok {
		t.Fatal("expected invalid timestamp signature header to fail")
	}
	if _, _, ok := parseSignatureHeader("t=123"); ok {
		t.Fatal("expected signature header without signatures to fail")
	}
	if _, _, ok := parseSignatureHeader(""); ok {
		t.Fatal("expected empty signature header to fail")
	}

	if _, err := parseInt64("abc"); err == nil {
		t.Fatal("expected parseInt64 to reject non-numeric values")
	}

	goodSignature, err := SignWebhookPayload(body, "secret", 1000)
	if err != nil {
		t.Fatalf("failed to sign payload for verification test: %v", err)
	}
	now := int64(1000)
	if ok, err := VerifyWebhookSignature(VerifyOptions{RawBody: body, SignatureHeader: goodSignature.Header, Secret: "secret", NowSeconds: &now}); err != nil || !ok {
		t.Fatalf("expected signature verification to pass: %v %v", ok, err)
	}
	if _, err := VerifyWebhookSignature(VerifyOptions{RawBody: body, SignatureHeader: goodSignature.Header, Secret: nil}); err == nil {
		t.Fatal("expected missing secret verification to fail")
	}
	if _, err := VerifyWebhookSignature(VerifyOptions{RawBody: body, SignatureHeader: "bad", Secret: "secret"}); err == nil {
		t.Fatal("expected invalid signature header verification to fail")
	}
	staleNow := int64(2000)
	if _, err := VerifyWebhookSignature(VerifyOptions{RawBody: body, SignatureHeader: goodSignature.Header, Secret: "secret", ToleranceSeconds: 10, NowSeconds: &staleNow}); err == nil {
		t.Fatal("expected stale signature verification to fail")
	}
	brokenBody := []byte{0xff}
	if _, err := VerifyWebhookSignature(VerifyOptions{RawBody: brokenBody, SignatureHeader: goodSignature.Header, Secret: "secret"}); err == nil {
		t.Fatal("expected invalid utf-8 verification body to fail")
	}
	futureNow := int64(800)
	if _, err := VerifyWebhookSignature(VerifyOptions{RawBody: body, SignatureHeader: goodSignature.Header, Secret: "secret", NowSeconds: &futureNow}); err == nil {
		t.Fatal("expected future timestamp verification to fail")
	}
	prettyBody := []byte("{\n  \"event\": \"email.received\"\n}")
	prettySignature, err := SignWebhookPayload(prettyBody, "secret", 1000)
	if err != nil {
		t.Fatalf("failed to sign pretty payload: %v", err)
	}
	if _, err := VerifyWebhookSignature(VerifyOptions{RawBody: body, SignatureHeader: prettySignature.Header, Secret: "secret", NowSeconds: &now}); err == nil || !strings.Contains(err.Error(), "re-serialized") {
		t.Fatalf("expected signature mismatch to include re-serialization hint: %v", err)
	}

	if IsEmailReceivedEvent(payload) != true {
		t.Fatal("expected fixture payload to be email.received")
	}
	validEvent, err := ValidateEmailReceivedEvent(payload)
	if err != nil {
		t.Fatalf("expected fixture payload to validate: %v", err)
	}
	if !IsEmailReceivedEvent(*validEvent) || !IsEmailReceivedEvent(validEvent) {
		t.Fatal("expected typed event variants to be recognized")
	}
	unknownEvent := UnknownEvent{Event: string(EventTypeEmailReceived)}
	if !IsEmailReceivedEvent(unknownEvent) {
		t.Fatal("expected unknown event wrapper to be recognized by event name")
	}
	if !IsEmailReceivedEvent(struct{ Event string `json:"event"` }{Event: string(EventTypeEmailReceived)}) {
		t.Fatal("expected struct event wrapper to be recognized")
	}

	if ConfirmedHeaders()[PrimitiveConfirmedHeader] != "true" {
		t.Fatal("expected confirmed header helper to return true")
	}

	downloadOnly := map[string]any{
		"email": map[string]any{
			"content": map[string]any{
				"raw": map[string]any{"included": false, "size_bytes": 10, "max_inline_bytes": 5},
				"download": map[string]any{"url": "https://example.com"},
			},
		},
	}
	if _, err := IsRawIncluded(map[string]any{}); err == nil {
		t.Fatal("expected missing raw included flag to fail")
	}
	if _, err := DecodeRawEmail(map[string]any{}); err == nil {
		t.Fatal("expected missing raw included flag to fail decode")
	}
	if _, err := DecodeRawEmail(downloadOnly); err == nil {
		t.Fatal("expected download-only raw content to fail decode")
	}
	invalidData := loadJSONFixture(t, "webhook", "valid-email-received.json")
	invalidData["email"].(map[string]any)["content"].(map[string]any)["raw"].(map[string]any)["data"] = "!!!"
	if _, err := DecodeRawEmail(invalidData); err == nil {
		t.Fatal("expected invalid base64 to fail decode")
	}
	if decoded, err := DecodeRawEmail(payload, false); err != nil || string(decoded) != "Hello World" {
		t.Fatalf("expected decode without verification to succeed: %q %v", string(decoded), err)
	}

	if _, err := VerifyRawEmailDownload([]byte("other"), payload); err == nil {
		t.Fatal("expected raw email download verification to fail on hash mismatch")
	}
	if _, err := VerifyRawEmailDownload([]byte("Hello World"), map[string]any{}); err == nil {
		t.Fatal("expected missing raw hash to fail download verification")
	}
	missingRawData := loadJSONFixture(t, "webhook", "valid-email-received.json")
	delete(missingRawData["email"].(map[string]any)["content"].(map[string]any)["raw"].(map[string]any), "data")
	if _, err := DecodeRawEmail(missingRawData); err == nil {
		t.Fatal("expected missing raw data to fail decode")
	}

	missingDownload := map[string]any{"email": map[string]any{"content": map[string]any{"download": map[string]any{}}}}
	if _, err := IsDownloadExpired(missingDownload); err == nil {
		t.Fatal("expected missing expires_at to fail expiration check")
	}
	badDownload := map[string]any{"email": map[string]any{"content": map[string]any{"download": map[string]any{"expires_at": "nope"}}}}
	if _, err := IsDownloadExpired(badDownload); err == nil {
		t.Fatal("expected invalid expires_at to fail expiration status check")
	}
	expiredDownload := map[string]any{"email": map[string]any{"content": map[string]any{"download": map[string]any{"expires_at": "2025-01-01T00:00:00Z"}}}}
	if _, err := GetDownloadTimeRemaining(missingDownload); err == nil {
		t.Fatal("expected missing expires_at to fail remaining time check")
	}
	if _, err := GetDownloadTimeRemaining(badDownload); err == nil {
		t.Fatal("expected invalid expires_at to fail remaining time check")
	}
	if expired, err := IsDownloadExpired(expiredDownload, 1735689600001); err != nil || !expired {
		t.Fatalf("expected expired download helper branch: %v %v", expired, err)
	}
	if remaining, err := GetDownloadTimeRemaining(expiredDownload, 1735689600001); err != nil || remaining != 0 {
		t.Fatalf("expected expired download to clamp remaining time to zero: %d %v", remaining, err)
	}

	if _, err := ValidateEmailAuth("bad"); err == nil {
		t.Fatal("expected invalid auth input to fail validation")
	}
	if result, err := ValidateEmailAuth(map[string]any{"spf": "fail", "dmarc": "fail", "dmarcPolicy": "none", "dkimSignatures": []map[string]any{}}); err != nil || result.Confidence != AuthConfidenceMedium {
		t.Fatalf("expected monitoring mode SPF fail branch: %#v %v", result, err)
	}
	rejectPolicy := DmarcPolicyReject
	if result, err := ValidateEmailAuth(EmailAuth{SPF: SpfResultNone, DMARC: DmarcResultFail, DMARCPolicy: &rejectPolicy}); err != nil || result.Reasons[0] != "DMARC failed and domain has reject policy" {
		t.Fatalf("expected DMARC reject branch: %#v %v", result, err)
	}
	if result, err := ValidateEmailAuth(map[string]any{"spf": "none", "dmarc": "mystery", "dkimSignatures": []map[string]any{}}); err != nil || result.Reasons[0] != "Unable to determine email authenticity" {
		t.Fatalf("expected fallback auth branch: %#v %v", result, err)
	}
	if result, err := ValidateEmailAuth(map[string]any{"spf": "none", "dmarc": "none", "dkimSignatures": []map[string]any{}}); err != nil || result.Reasons[1] != "No valid authentication found" {
		t.Fatalf("expected no-authentication auth branch: %#v %v", result, err)
	}
	if result, err := ValidateEmailAuth(map[string]any{"spf": "pass", "dmarc": "none", "dkimSignatures": []map[string]any{{"domain": "example.com", "result": "pass", "aligned": true}}}); err != nil || !strings.Contains(result.Reasons[1], "DKIM verified for") {
		t.Fatalf("expected passing DKIM auth branch: %#v %v", result, err)
	}
	if result, err := ValidateEmailAuth(map[string]any{"spf": "pass", "dmarc": "none", "dkimSignatures": []map[string]any{}}); err != nil || result.Reasons[2] != "SPF passed (but SPF alone is weak authentication)" {
		t.Fatalf("expected SPF-only auth branch: %#v %v", result, err)
	}
	if result, err := ValidateEmailAuth(map[string]any{"spf": "pass", "dmarc": "pass", "dmarcSpfAligned": false, "dmarcDkimAligned": false, "dkimSignatures": []map[string]any{}}); err != nil || result.Reasons[0] != "DMARC passed" {
		t.Fatalf("expected DMARC-pass fallback branch: %#v %v", result, err)
	}
	if result, err := ValidateEmailAuth(EmailAuth{SPF: SpfResultPass, DMARC: DmarcResultPass, DMARCDkimAligned: true, DKIMSignatures: []DKIMSignature{{Domain: "example.com", Result: DkimResultPass, Aligned: true}}}); err != nil || result.Confidence != AuthConfidenceHigh {
		t.Fatalf("expected aligned DKIM auth branch: %#v %v", result, err)
	}
	if result, err := ValidateEmailAuth(EmailAuth{SPF: SpfResultPass, DMARC: DmarcResultPass, DMARCSpfAligned: true}); err != nil || result.Reasons[0] != "DMARC passed with SPF alignment" {
		t.Fatalf("expected SPF-aligned DMARC branch: %#v %v", result, err)
	}
	if result, err := ValidateEmailAuth(EmailAuth{SPF: SpfResultNone, DMARC: DmarcResultFail}); err != nil || result.Confidence != AuthConfidenceLow {
		t.Fatalf("expected DMARC monitoring branch: %#v %v", result, err)
	}
	if result, err := ValidateEmailAuth(map[string]any{"spf": "none", "dmarc": "fail", "dmarcPolicy": "quarantine", "dkimSignatures": []map[string]any{}}); err != nil || result.Reasons[0] != "DMARC failed and domain has quarantine policy" {
		t.Fatalf("expected DMARC quarantine branch: %#v %v", result, err)
	}
	if result, err := ValidateEmailAuth(map[string]any{"spf": "none", "dmarc": "temperror", "dkimSignatures": []map[string]any{}}); err != nil || !strings.Contains(result.Reasons[0], "temperror") {
		t.Fatalf("expected DMARC error branch: %#v %v", result, err)
	}
	if result, err := ValidateEmailAuth(EmailAuth{SPF: SpfResultPermerror, DMARC: DmarcResultPass, DMARCSpfAligned: false, DMARCDkimAligned: false}); err != nil || !strings.Contains(fmt.Sprint(result.Reasons), "SPF verification error") {
		t.Fatalf("expected SPF error branch: %#v %v", result, err)
	}
	if result, err := ValidateEmailAuth(EmailAuth{SPF: SpfResultPass, DMARC: DmarcResultNone, DKIMSignatures: []DKIMSignature{{Domain: "example.com", Result: DkimResultPass, Aligned: true}}}); err != nil || !strings.Contains(fmt.Sprint(result.Reasons), "SPF passed") {
		t.Fatalf("expected no-DMARC DKIM+SPF branch: %#v %v", result, err)
	}
	if result, err := ValidateEmailAuth(EmailAuth{SPF: SpfResultPass, DMARC: DmarcResultPass, DMARCDkimAligned: true}); err != nil || result.Reasons[0] != "DMARC passed" {
		t.Fatalf("expected DMARC fallback when alignment detail is missing: %#v %v", result, err)
	}
	if result, err := ValidateEmailAuth(EmailAuth{SPF: SpfResultFail, DMARC: DmarcResultNone}); err != nil || result.Confidence != AuthConfidenceMedium || result.Reasons[1] != "SPF failed - sending IP not authorized" {
		t.Fatalf("expected no-DMARC SPF-fail branch: %#v %v", result, err)
	}
	weakResult, err := ValidateEmailAuth(EmailAuth{
		SPF:               SpfResultPass,
		DMARC:             DmarcResultPass,
		DMARCDkimAligned:  true,
		DMARCSpfAligned:   true,
		DKIMSignatures:    []DKIMSignature{{Domain: "example.com", Result: DkimResultPass, Aligned: true, KeyBits: intPtr(512)}},
	})
	if err != nil || weakResult.Confidence != AuthConfidenceMedium || !strings.Contains(fmt.Sprint(weakResult.Reasons), "Weak DKIM key") {
		t.Fatalf("expected weak-key auth branch: %#v %v", weakResult, err)
	}
}
