package primitive

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"testing"
)

func intPtr(v int64) *int64 { return &v }

func boolPtr(v bool) *bool { return &v }

func strPtr(v string) *string { return &v }

func TestPrimitiveWebhookErrors(t *testing.T) {
	verification := NewWebhookVerificationError("MISSING_SECRET", "", "")
	if verification.Error() == "" || verification.Name() != "WebhookVerificationError" {
		t.Fatalf("unexpected verification error formatting: %#v", verification)
	}
	if verification.Message() != VerificationErrors["MISSING_SECRET"].Message {
		t.Fatalf("expected default verification message")
	}
	var baseVerification *PrimitiveWebhookError
	if !errors.As(verification, &baseVerification) {
		t.Fatal("expected verification error to match PrimitiveWebhookError")
	}
	if baseVerification.Code() != "MISSING_SECRET" {
		t.Fatalf("expected base verification code, got %q", baseVerification.Code())
	}

	payloadCause := errors.New("boom")
	payload := NewWebhookPayloadError("PAYLOAD_EMPTY_BODY", "", "", payloadCause)
	if !errors.Is(payload, payloadCause) {
		t.Fatalf("expected payload error to unwrap cause")
	}
	var basePayload *PrimitiveWebhookError
	if !errors.As(payload, &basePayload) {
		t.Fatal("expected payload error to match PrimitiveWebhookError")
	}
	if basePayload.Code() != "PAYLOAD_EMPTY_BODY" {
		t.Fatalf("expected base payload code, got %q", basePayload.Code())
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

func TestValidateEmailReceivedEventReportsNestedFieldPath(t *testing.T) {
	missingNested := loadJSONFixture(t, "webhook", "valid-email-received.json")
	delete(missingNested["email"].(map[string]any), "id")

	_, err := ValidateEmailReceivedEvent(missingNested)
	var validationErr *WebhookValidationError
	if !errors.As(err, &validationErr) {
		t.Fatalf("expected WebhookValidationError, got %v", err)
	}
	if validationErr.Field != "email.id" {
		t.Fatalf("expected enriched required field path, got %q", validationErr.Field)
	}
	if len(validationErr.ValidationErrors) == 0 || validationErr.ValidationErrors[0].Path != "email.id" {
		t.Fatalf("expected validation issue path to include missing field, got %#v", validationErr.ValidationErrors)
	}
}

func TestWebhookUtilityEdges(t *testing.T) {
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
	staleTolerance := int64(10)
	if _, err := VerifyWebhookSignature(VerifyOptions{RawBody: body, SignatureHeader: goodSignature.Header, Secret: "secret", ToleranceSeconds: &staleTolerance, NowSeconds: &staleNow}); err == nil {
		t.Fatal("expected stale signature verification to fail")
	}
	zeroToleranceNow := int64(1001)
	zeroTolerance := int64(0)
	if _, err := VerifyWebhookSignature(VerifyOptions{RawBody: body, SignatureHeader: goodSignature.Header, Secret: "secret", ToleranceSeconds: &zeroTolerance, NowSeconds: &zeroToleranceNow}); err == nil {
		t.Fatal("expected explicit zero tolerance verification to fail")
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
	if IsEmailReceivedEvent(unknownEvent) {
		t.Fatal("expected unknown event wrapper to be rejected without a valid payload")
	}
	if IsEmailReceivedEvent(struct {
		Event string `json:"event"`
	}{Event: string(EventTypeEmailReceived)}) {
		t.Fatal("expected malformed struct wrapper to be rejected")
	}

	if ConfirmedHeaders()[PrimitiveConfirmedHeader] != "true" {
		t.Fatal("expected confirmed header helper to return true")
	}

	downloadOnly := map[string]any{
		"email": map[string]any{
			"content": map[string]any{
				"raw":      map[string]any{"included": false, "size_bytes": 10, "max_inline_bytes": 5},
				"download": map[string]any{"url": "https://example.com"},
			},
		},
	}
	if _, err := IsRawIncluded(map[string]any{}); err == nil {
		t.Fatal("expected missing raw included flag to fail")
	} else {
		payloadErr, ok := err.(*WebhookPayloadError)
		if !ok || payloadErr.Code() != "PAYLOAD_WRONG_TYPE" {
			t.Fatalf("expected PAYLOAD_WRONG_TYPE for missing raw included flag, got %v", err)
		}
	}
	if _, err := DecodeRawEmail(map[string]any{}); err == nil {
		t.Fatal("expected missing raw included flag to fail decode")
	} else {
		payloadErr, ok := err.(*WebhookPayloadError)
		if !ok || payloadErr.Code() != "PAYLOAD_WRONG_TYPE" {
			t.Fatalf("expected PAYLOAD_WRONG_TYPE for missing raw decode fields, got %v", err)
		}
	}
	if _, err := DecodeRawEmail(downloadOnly); err == nil {
		t.Fatal("expected download-only raw content to fail decode")
	}
	invalidData := loadJSONFixture(t, "webhook", "valid-email-received.json")
	invalidData["email"].(map[string]any)["content"].(map[string]any)["raw"].(map[string]any)["data"] = "!!!"
	if _, err := DecodeRawEmail(invalidData); err == nil {
		t.Fatal("expected invalid base64 to fail decode")
	} else {
		decodeErr, ok := err.(*RawEmailDecodeError)
		if !ok {
			t.Fatalf("expected RawEmailDecodeError, got %v", err)
		}
		if decodeErr.Code() != "INVALID_BASE64" {
			t.Fatalf("expected INVALID_BASE64 code, got %q", decodeErr.Code())
		}
	}
	if decoded, err := DecodeRawEmail(payload, false); err != nil || string(decoded) != "Hello World" {
		t.Fatalf("expected decode without verification to succeed: %q %v", string(decoded), err)
	}

	if _, err := VerifyRawEmailDownload([]byte("other"), payload); err == nil {
		t.Fatal("expected raw email download verification to fail on hash mismatch")
	}
	missingRawHash := loadJSONFixture(t, "webhook", "valid-email-received.json")
	delete(missingRawHash["email"].(map[string]any)["content"].(map[string]any)["raw"].(map[string]any), "sha256")
	if _, err := DecodeRawEmail(missingRawHash); err == nil {
		t.Fatal("expected missing raw hash to fail decode")
	} else {
		payloadErr, ok := err.(*WebhookPayloadError)
		if !ok || payloadErr.Code() != "PAYLOAD_WRONG_TYPE" {
			t.Fatalf("expected PAYLOAD_WRONG_TYPE for missing raw hash decode error, got %v", err)
		}
	}
	if _, err := VerifyRawEmailDownload([]byte("Hello World"), map[string]any{}); err == nil {
		t.Fatal("expected missing raw hash to fail download verification")
	} else {
		payloadErr, ok := err.(*WebhookPayloadError)
		if !ok || payloadErr.Code() != "PAYLOAD_WRONG_TYPE" {
			t.Fatalf("expected PAYLOAD_WRONG_TYPE for missing raw hash download error, got %v", err)
		}
	}
	missingRawData := loadJSONFixture(t, "webhook", "valid-email-received.json")
	delete(missingRawData["email"].(map[string]any)["content"].(map[string]any)["raw"].(map[string]any), "data")
	if _, err := DecodeRawEmail(missingRawData); err == nil {
		t.Fatal("expected missing raw data to fail decode")
	} else {
		payloadErr, ok := err.(*WebhookPayloadError)
		if !ok || payloadErr.Code() != "PAYLOAD_WRONG_TYPE" {
			t.Fatalf("expected PAYLOAD_WRONG_TYPE for missing raw data, got %v", err)
		}
	}

	missingDownload := map[string]any{"email": map[string]any{"content": map[string]any{"download": map[string]any{}}}}
	if _, err := IsDownloadExpired(missingDownload); err == nil {
		t.Fatal("expected missing expires_at to fail expiration check")
	} else {
		payloadErr, ok := err.(*WebhookPayloadError)
		if !ok || payloadErr.Code() != "PAYLOAD_WRONG_TYPE" {
			t.Fatalf("expected PAYLOAD_WRONG_TYPE for missing expires_at, got %v", err)
		}
	}
	badDownload := map[string]any{"email": map[string]any{"content": map[string]any{"download": map[string]any{"expires_at": "nope"}}}}
	if _, err := IsDownloadExpired(badDownload); err == nil {
		t.Fatal("expected invalid expires_at to fail expiration status check")
	} else {
		payloadErr, ok := err.(*WebhookPayloadError)
		if !ok || payloadErr.Code() != "PAYLOAD_WRONG_TYPE" {
			t.Fatalf("expected PAYLOAD_WRONG_TYPE for invalid expires_at, got %v", err)
		}
	}
	expiredDownload := map[string]any{"email": map[string]any{"content": map[string]any{"download": map[string]any{"expires_at": "2025-01-01T00:00:00Z"}}}}
	if _, err := GetDownloadTimeRemaining(missingDownload); err == nil {
		t.Fatal("expected missing expires_at to fail remaining time check")
	} else {
		payloadErr, ok := err.(*WebhookPayloadError)
		if !ok || payloadErr.Code() != "PAYLOAD_WRONG_TYPE" {
			t.Fatalf("expected PAYLOAD_WRONG_TYPE for missing remaining-time expires_at, got %v", err)
		}
	}
	if _, err := GetDownloadTimeRemaining(badDownload); err == nil {
		t.Fatal("expected invalid expires_at to fail remaining time check")
	} else {
		payloadErr, ok := err.(*WebhookPayloadError)
		if !ok || payloadErr.Code() != "PAYLOAD_WRONG_TYPE" {
			t.Fatalf("expected PAYLOAD_WRONG_TYPE for invalid remaining-time expires_at, got %v", err)
		}
	}
	if expired, err := IsDownloadExpired(expiredDownload, 1735689600001); err != nil || !expired {
		t.Fatalf("expected expired download helper branch: %v %v", expired, err)
	}
	if remaining, err := GetDownloadTimeRemaining(expiredDownload, 1735689600001); err != nil || remaining != 0 {
		t.Fatalf("expected expired download to clamp remaining time to zero: %d %v", remaining, err)
	}

	if _, err := ValidateEmailAuth("bad"); err == nil {
		t.Fatal("expected invalid auth input to fail validation")
	} else {
		validationErr, ok := err.(*WebhookValidationError)
		if !ok || validationErr.Code() != "SCHEMA_VALIDATION_FAILED" {
			t.Fatalf("expected SCHEMA_VALIDATION_FAILED for invalid auth input, got %v", err)
		}
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
	if result, err := ValidateEmailAuth(EmailAuth{SPF: SpfResultPass, DMARC: DmarcResultPass, DMARCDkimAligned: boolPtr(true), DKIMSignatures: []DKIMSignature{{Domain: "example.com", Result: DkimResultPass, Aligned: true}}}); err != nil || result.Confidence != AuthConfidenceHigh {
		t.Fatalf("expected aligned DKIM auth branch: %#v %v", result, err)
	}
	if result, err := ValidateEmailAuth(EmailAuth{SPF: SpfResultPass, DMARC: DmarcResultPass, DMARCSpfAligned: boolPtr(true)}); err != nil || result.Reasons[0] != "DMARC passed with SPF alignment" {
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
	if result, err := ValidateEmailAuth(EmailAuth{SPF: SpfResultPermerror, DMARC: DmarcResultPass, DMARCSpfAligned: boolPtr(false), DMARCDkimAligned: boolPtr(false)}); err != nil || !strings.Contains(fmt.Sprint(result.Reasons), "SPF verification error") {
		t.Fatalf("expected SPF error branch: %#v %v", result, err)
	}
	if result, err := ValidateEmailAuth(EmailAuth{SPF: SpfResultPass, DMARC: DmarcResultNone, DKIMSignatures: []DKIMSignature{{Domain: "example.com", Result: DkimResultPass, Aligned: true}}}); err != nil || !strings.Contains(fmt.Sprint(result.Reasons), "SPF passed") {
		t.Fatalf("expected no-DMARC DKIM+SPF branch: %#v %v", result, err)
	}
	if result, err := ValidateEmailAuth(EmailAuth{SPF: SpfResultPass, DMARC: DmarcResultPass, DMARCDkimAligned: boolPtr(true)}); err != nil || result.Reasons[0] != "DMARC passed" {
		t.Fatalf("expected DMARC fallback when alignment detail is missing: %#v %v", result, err)
	}
	if result, err := ValidateEmailAuth(EmailAuth{SPF: SpfResultFail, DMARC: DmarcResultNone}); err != nil || result.Confidence != AuthConfidenceMedium || result.Reasons[1] != "SPF failed - sending IP not authorized" {
		t.Fatalf("expected no-DMARC SPF-fail branch: %#v %v", result, err)
	}
	weakResult, err := ValidateEmailAuth(EmailAuth{
		SPF:              SpfResultPass,
		DMARC:            DmarcResultPass,
		DMARCDkimAligned: boolPtr(true),
		DMARCSpfAligned:  boolPtr(true),
		DKIMSignatures:   []DKIMSignature{{Domain: "example.com", Result: DkimResultPass, Aligned: true, KeyBits: intPtr(512)}},
	})
	if err != nil || weakResult.Confidence != AuthConfidenceMedium || !strings.Contains(fmt.Sprint(weakResult.Reasons), "Weak DKIM key") {
		t.Fatalf("expected weak-key auth branch: %#v %v", weakResult, err)
	}

	attachmentSkipped := false
	forwardResultJSON, err := json.Marshal(ForwardResult{
		Type:               "attachment",
		AttachmentTarPath:  strPtr("attachments/forwarded.eml"),
		AttachmentFilename: nil,
		Analyzed:           &attachmentSkipped,
		OriginalSender:     nil,
		Verification:       nil,
		Summary:            "Attachment skipped",
	})
	if err != nil {
		t.Fatalf("expected ForwardResult marshal to succeed: %v", err)
	}
	if !strings.Contains(string(forwardResultJSON), `"attachment_filename":null`) {
		t.Fatalf("expected attachment_filename null to be preserved, got %s", forwardResultJSON)
	}
}
