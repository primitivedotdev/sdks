package primitive

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"reflect"
	"strconv"
	"strings"
	"time"
)

func ParseJSONBody(rawBody any) (any, error) {
	body, err := bodyToString(rawBody, "request body")
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(body) == "" {
		return nil, NewWebhookPayloadError(
			"PAYLOAD_EMPTY_BODY",
			"Received empty request body",
			"The request body is empty. Check your web framework is correctly passing the request body.",
			nil,
		)
	}
	if strings.HasPrefix(body, "\ufeff") {
		body = strings.TrimPrefix(body, "\ufeff")
	}
	decoder := json.NewDecoder(strings.NewReader(body))
	decoder.UseNumber()
	var parsed any
	if err := decoder.Decode(&parsed); err != nil {
		return nil, NewWebhookPayloadError(
			"JSON_PARSE_FAILED",
			"Failed to parse webhook body as JSON",
			fmt.Sprintf("Invalid JSON: %s. Check the raw request body is valid JSON.", err.Error()),
			err,
		)
	}
	if err := decoder.Decode(new(any)); err != io.EOF {
		message := "unexpected trailing content after JSON value"
		if err != nil {
			message = err.Error()
		}
		return nil, NewWebhookPayloadError(
			"JSON_PARSE_FAILED",
			"Failed to parse webhook body as JSON",
			fmt.Sprintf("Invalid JSON: %s. Check the raw request body is valid JSON.", message),
			nil,
		)
	}
	return parsed, nil
}

func SignWebhookPayload(rawBody any, secret any, timestamps ...int64) (SignResult, error) {
	body, err := bodyToString(rawBody, "raw body")
	if err != nil {
		return SignResult{}, err
	}
	secretBytes, err := secretToBytes(secret)
	if err != nil {
		return SignResult{}, err
	}
	timestamp := time.Now().Unix()
	if len(timestamps) > 0 {
		timestamp = timestamps[0]
	}
	mac := hmac.New(sha256.New, secretBytes)
	_, _ = mac.Write([]byte(fmt.Sprintf("%d.%s", timestamp, body)))
	v1 := hex.EncodeToString(mac.Sum(nil))
	return SignResult{Header: fmt.Sprintf("t=%d,v1=%s", timestamp, v1), Timestamp: timestamp, V1: v1}, nil
}

func parseSignatureHeader(signatureHeader string) (int64, []string, bool) {
	if signatureHeader == "" {
		return 0, nil, false
	}
	var timestamp int64
	hasTimestamp := false
	signatures := []string{}
	for _, part := range strings.Split(signatureHeader, ",") {
		part = strings.TrimSpace(part)
		key, value, found := strings.Cut(part, "=")
		if !found || value == "" {
			continue
		}
		switch key {
		case "t":
			t, err := strconv.ParseInt(value, 10, 64)
			if err == nil {
				timestamp = t
				hasTimestamp = true
			}
		case "v1":
			signatures = append(signatures, value)
		}
	}
	if !hasTimestamp || len(signatures) == 0 {
		return 0, nil, false
	}
	return timestamp, signatures, true
}

func VerifyWebhookSignature(options VerifyOptions) (bool, error) {
	secretBytes, err := secretToBytes(options.Secret)
	if err != nil {
		return false, err
	}
	body, err := bodyToString(options.RawBody, "request body")
	if err != nil {
		return false, err
	}
	timestamp, signatures, ok := parseSignatureHeader(options.SignatureHeader)
	if !ok {
		return false, NewWebhookVerificationError(
			"INVALID_SIGNATURE_HEADER",
			"Invalid Primitive-Signature header format. Expected: t={timestamp},v1={signature}",
			"",
		)
	}
	now := time.Now().Unix()
	if options.NowSeconds != nil {
		now = *options.NowSeconds
	}
	tolerance := defaultToleranceSeconds
	if options.ToleranceSeconds != nil {
		tolerance = *options.ToleranceSeconds
	}
	age := now - timestamp
	if age > tolerance {
		return false, NewWebhookVerificationError(
			"TIMESTAMP_OUT_OF_RANGE",
			fmt.Sprintf("Webhook timestamp too old (%ds). Max age is %ds.", age, tolerance),
			"",
		)
	}
	if age < -futureToleranceSeconds {
		return false, NewWebhookVerificationError(
			"TIMESTAMP_OUT_OF_RANGE",
			"Webhook timestamp is too far in the future. Check server clock sync.",
			"",
		)
	}
	mac := hmac.New(sha256.New, secretBytes)
	_, _ = mac.Write([]byte(fmt.Sprintf("%d.%s", timestamp, body)))
	expected := hex.EncodeToString(mac.Sum(nil))
	for _, provided := range signatures {
		if len(provided) == len(expected) && hexPattern.MatchString(provided) && hmac.Equal([]byte(strings.ToLower(provided)), []byte(expected)) {
			return true, nil
		}
	}
	hint := detectReserializedBody(body)
	message := "No valid signature found. Verify the webhook secret matches and you're using the raw request body (not re-serialized JSON)."
	if hint != "" {
		message = "No valid signature found. " + hint
	}
	return false, NewWebhookVerificationError("SIGNATURE_MISMATCH", message, "")
}

func ParseWebhookEvent(input any) (WebhookEvent, error) {
	if input == nil {
		return nil, NewWebhookPayloadError("PAYLOAD_NULL", "Received null instead of webhook payload", "Check that your request body variable is defined.", nil)
	}
	switch input.(type) {
	case []byte, json.RawMessage:
		parsed, err := ParseJSONBody(input)
		if err != nil {
			return nil, err
		}
		input = parsed
	}
	if input == nil {
		return nil, NewWebhookPayloadError("PAYLOAD_NULL", "Received null instead of webhook payload", "Check that your request body variable is defined.", nil)
	}
	kind := reflect.TypeOf(input).Kind()
	if kind == reflect.Slice || kind == reflect.Array {
		return nil, NewWebhookPayloadError("PAYLOAD_IS_ARRAY", "Received array instead of webhook payload object", "Webhook payloads must be objects, not arrays.", nil)
	}
	obj, err := mapFromInput(input)
	if err != nil {
		return nil, err
	}
	eventName, ok := obj["event"].(string)
	if !ok {
		return nil, NewWebhookPayloadError("PAYLOAD_MISSING_EVENT", "Missing 'event' field in payload", "This doesn't look like a Primitive webhook payload.", nil)
	}
	if eventName == string(EventTypeEmailReceived) {
		event, err := ValidateEmailReceivedEvent(obj)
		if err != nil {
			return nil, err
		}
		return *event, nil
	}
	preserved, err := mapFromInputPreservingNumbers(input)
	if err != nil {
		return nil, err
	}
	unknown := UnknownEvent{Event: eventName, Payload: preserved}
	if id, ok := preserved["id"].(string); ok {
		unknown.ID = &id
	}
	if version, ok := preserved["version"].(string); ok {
		unknown.Version = &version
	}
	return unknown, nil
}

func IsEmailReceivedEvent(event any) bool {
	switch typed := event.(type) {
	case EmailReceivedEvent:
		return typed.Event == string(EventTypeEmailReceived)
	case *EmailReceivedEvent:
		return typed != nil && typed.Event == string(EventTypeEmailReceived)
	case UnknownEvent:
		return false
	case map[string]any:
		value, ok := typed["event"].(string)
		if !ok || value != string(EventTypeEmailReceived) {
			return false
		}
		_, err := ValidateEmailReceivedEvent(typed)
		return err == nil
	default:
		value, ok := getString(typed, "event")
		if !ok || value != string(EventTypeEmailReceived) {
			return false
		}
		_, err := ValidateEmailReceivedEvent(typed)
		return err == nil
	}
}

func getSignatureHeaderValue(headers any) string {
	if v := getHeaderValue(headers, PrimitiveSignatureHeader); v != "" {
		return v
	}
	return getHeaderValue(headers, LegacySignatureHeader)
}

func HandleWebhookEvent(options HandleWebhookOptions) (WebhookEvent, error) {
	_, err := VerifyWebhookSignature(VerifyOptions{
		RawBody:          options.Body,
		SignatureHeader:  getSignatureHeaderValue(options.Headers),
		Secret:           options.Secret,
		ToleranceSeconds: options.ToleranceSeconds,
	})
	if err != nil {
		return nil, err
	}
	parsed, err := ParseJSONBody(options.Body)
	if err != nil {
		return nil, err
	}
	return ParseWebhookEvent(parsed)
}

func HandleWebhook(options HandleWebhookOptions) (*EmailReceivedEvent, error) {
	event, err := HandleWebhookEvent(options)
	if err != nil {
		return nil, err
	}

	switch typed := event.(type) {
	case EmailReceivedEvent:
		return &typed, nil
	case *EmailReceivedEvent:
		return typed, nil
	default:
		return nil, NewWebhookPayloadError(
			"PAYLOAD_UNKNOWN_EVENT",
			fmt.Sprintf("HandleWebhook only supports email.received events, got %q", event.GetEvent()),
			"Use HandleWebhookEvent or ParseWebhookEvent to handle unknown events gracefully.",
			nil,
		)
	}
}

func ConfirmedHeaders() map[string]string {
	return map[string]string{
		PrimitiveConfirmedHeader: "true",
		LegacyConfirmedHeader:   "true",
	}
}

func missingPayloadFieldError(path string) *WebhookPayloadError {
	return NewWebhookPayloadError(
		"PAYLOAD_WRONG_TYPE",
		fmt.Sprintf("Missing required field %q in webhook payload", path),
		fmt.Sprintf("Check that %q is present in the webhook payload.", path),
		nil,
	)
}

func invalidPayloadFieldError(path string, message string, suggestion string, cause error) *WebhookPayloadError {
	return NewWebhookPayloadError("PAYLOAD_WRONG_TYPE", message, suggestion, cause)
}

func invalidAuthInputError(err error) *WebhookValidationError {
	return NewWebhookValidationError(
		"auth",
		fmt.Sprintf("Validation failed for auth: %s", err.Error()),
		"Check the structure of the auth object.",
		nil,
	)
}

func IsDownloadExpired(event any, nowMillis ...int64) (bool, error) {
	expiresAt, ok := getString(event, "email", "content", "download", "expires_at")
	if !ok {
		return false, missingPayloadFieldError("email.content.download.expires_at")
	}
	expires, err := parseRFC3339Timestamp(expiresAt)
	if err != nil {
		return false, invalidPayloadFieldError(
			"email.content.download.expires_at",
			fmt.Sprintf("Invalid value for email.content.download.expires_at: %q is not a valid RFC 3339 timestamp", expiresAt),
			"Check that \"email.content.download.expires_at\" is a valid RFC 3339 timestamp.",
			err,
		)
	}
	now := time.Now().UnixMilli()
	if len(nowMillis) > 0 {
		now = nowMillis[0]
	}
	return now >= expires.UnixMilli(), nil
}

func GetDownloadTimeRemaining(event any, nowMillis ...int64) (int64, error) {
	expiresAt, ok := getString(event, "email", "content", "download", "expires_at")
	if !ok {
		return 0, missingPayloadFieldError("email.content.download.expires_at")
	}
	expires, err := parseRFC3339Timestamp(expiresAt)
	if err != nil {
		return 0, invalidPayloadFieldError(
			"email.content.download.expires_at",
			fmt.Sprintf("Invalid value for email.content.download.expires_at: %q is not a valid RFC 3339 timestamp", expiresAt),
			"Check that \"email.content.download.expires_at\" is a valid RFC 3339 timestamp.",
			err,
		)
	}
	now := time.Now().UnixMilli()
	if len(nowMillis) > 0 {
		now = nowMillis[0]
	}
	remaining := expires.UnixMilli() - now
	if remaining < 0 {
		return 0, nil
	}
	return remaining, nil
}

func parseRFC3339Timestamp(value string) (time.Time, error) {
	return time.Parse(time.RFC3339Nano, value)
}

func IsRawIncluded(event any) (bool, error) {
	included, ok := getBool(event, "email", "content", "raw", "included")
	if !ok {
		return false, missingPayloadFieldError("email.content.raw.included")
	}
	return included, nil
}

func DecodeRawEmail(event any, verify ...bool) ([]byte, error) {
	included, ok := getBool(event, "email", "content", "raw", "included")
	if !ok {
		return nil, missingPayloadFieldError("email.content.raw.included")
	}
	if !included {
		url, _ := getString(event, "email", "content", "download", "url")
		size, _ := getMapValue(event, "email", "content", "raw", "size_bytes")
		threshold, _ := getMapValue(event, "email", "content", "raw", "max_inline_bytes")
		return nil, NewRawEmailDecodeError("NOT_INCLUDED", fmt.Sprintf("Raw email not included inline (size: %v bytes, threshold: %v bytes). Download from: %s", size, threshold, url))
	}
	data, ok := getString(event, "email", "content", "raw", "data")
	if !ok {
		return nil, missingPayloadFieldError("email.content.raw.data")
	}
	decoded, err := base64.StdEncoding.Strict().DecodeString(data)
	if err != nil {
		return nil, NewRawEmailDecodeError("INVALID_BASE64", fmt.Sprintf("Raw email data is not valid base64: %v", err))
	}
	shouldVerify := true
	if len(verify) > 0 {
		shouldVerify = verify[0]
	}
	if shouldVerify {
		expected, ok := getString(event, "email", "content", "raw", "sha256")
		if !ok || expected == "" {
			return nil, missingPayloadFieldError("email.content.raw.sha256")
		}
		digest := sha256.Sum256(decoded)
		actual := hex.EncodeToString(digest[:])
		if !strings.EqualFold(actual, expected) {
			return nil, NewRawEmailDecodeError("HASH_MISMATCH", fmt.Sprintf("SHA-256 hash mismatch. Expected: %s, got: %s. The raw email data may be corrupted.", expected, actual))
		}
	}
	return decoded, nil
}

func VerifyRawEmailDownload(downloaded []byte, event any) ([]byte, error) {
	expected, ok := getString(event, "email", "content", "raw", "sha256")
	if !ok || expected == "" {
		return nil, missingPayloadFieldError("email.content.raw.sha256")
	}
	digest := sha256.Sum256(downloaded)
	actual := hex.EncodeToString(digest[:])
	if !strings.EqualFold(actual, expected) {
		return nil, NewRawEmailDecodeError("HASH_MISMATCH", fmt.Sprintf("SHA-256 hash mismatch. Expected: %s, got: %s. The downloaded content may be corrupted.", expected, actual))
	}
	return downloaded, nil
}

func ValidateEmailAuth(input any) (ValidateEmailAuthResult, error) {
	auth, err := decodeInto[EmailAuth](input)
	if err != nil {
		return ValidateEmailAuthResult{}, invalidAuthInputError(err)
	}
	reasons := []string{}
	weakKeySignatures := []DKIMSignature{}
	for _, sig := range auth.DKIMSignatures {
		if sig.KeyBits != nil && *sig.KeyBits < 1024 {
			weakKeySignatures = append(weakKeySignatures, sig)
			reasons = append(reasons, fmt.Sprintf("Weak DKIM key (%d bits) for %s - minimum 1024 bits recommended", *sig.KeyBits, sig.Domain))
		}
	}
	switch auth.DMARC {
	case DmarcResultTemperror, DmarcResultPermerror:
		return ValidateEmailAuthResult{Verdict: AuthVerdictUnknown, Confidence: AuthConfidenceLow, Reasons: []string{fmt.Sprintf("DMARC verification error (%s)", auth.DMARC), "Cannot determine email authenticity due to DNS or policy errors"}}, nil
	}
	if auth.SPF == SpfResultTemperror || auth.SPF == SpfResultPermerror {
		reasons = append(reasons, fmt.Sprintf("SPF verification error (%s)", auth.SPF))
	}
	if auth.DMARC == DmarcResultPass {
		aligned := []string{}
		for _, sig := range auth.DKIMSignatures {
			if sig.Result == DkimResultPass && sig.Aligned {
				aligned = append(aligned, sig.Domain)
			}
		}
		if auth.DMARCDkimAligned != nil && *auth.DMARCDkimAligned && len(aligned) > 0 {
			reasons = append([]string{fmt.Sprintf("DMARC passed with DKIM alignment (%s)", strings.Join(aligned, ", "))}, reasons...)
			confidence := AuthConfidenceHigh
			if len(weakKeySignatures) > 0 {
				confidence = AuthConfidenceMedium
			}
			return ValidateEmailAuthResult{Verdict: AuthVerdictLegit, Confidence: confidence, Reasons: reasons}, nil
		}
		if auth.DMARCSpfAligned != nil && *auth.DMARCSpfAligned && auth.SPF == SpfResultPass {
			reasons = append([]string{"DMARC passed with SPF alignment"}, reasons...)
			reasons = append(reasons, "No aligned DKIM signature (SPF can break through forwarding)")
			return ValidateEmailAuthResult{Verdict: AuthVerdictLegit, Confidence: AuthConfidenceMedium, Reasons: reasons}, nil
		}
		reasons = append([]string{"DMARC passed"}, reasons...)
		return ValidateEmailAuthResult{Verdict: AuthVerdictLegit, Confidence: AuthConfidenceMedium, Reasons: reasons}, nil
	}
	if auth.DMARC == DmarcResultFail {
		policy := ""
		if auth.DMARCPolicy != nil {
			policy = string(*auth.DMARCPolicy)
		}
		switch policy {
		case string(DmarcPolicyReject):
			reasons = append([]string{"DMARC failed and domain has reject policy"}, reasons...)
			reasons = append(reasons, "The sender's domain explicitly rejects emails that fail authentication")
			return ValidateEmailAuthResult{Verdict: AuthVerdictSuspicious, Confidence: AuthConfidenceHigh, Reasons: reasons}, nil
		case string(DmarcPolicyQuarantine):
			reasons = append([]string{"DMARC failed and domain has quarantine policy"}, reasons...)
			reasons = append(reasons, "The sender's domain marks failing emails as suspicious")
			return ValidateEmailAuthResult{Verdict: AuthVerdictSuspicious, Confidence: AuthConfidenceHigh, Reasons: reasons}, nil
		default:
			reasons = append([]string{"DMARC failed (domain is in monitoring mode)"}, reasons...)
			if auth.SPF == SpfResultFail {
				reasons = append(reasons, "SPF failed - sending IP not authorized")
				return ValidateEmailAuthResult{Verdict: AuthVerdictSuspicious, Confidence: AuthConfidenceMedium, Reasons: reasons}, nil
			}
			return ValidateEmailAuthResult{Verdict: AuthVerdictSuspicious, Confidence: AuthConfidenceLow, Reasons: reasons}, nil
		}
	}
	if auth.DMARC == DmarcResultNone {
		if auth.SPF == SpfResultFail {
			reasons = append(reasons, "No DMARC record for sender domain", "SPF failed - sending IP not authorized")
			return ValidateEmailAuthResult{Verdict: AuthVerdictSuspicious, Confidence: AuthConfidenceMedium, Reasons: reasons}, nil
		}
		passing := []string{}
		for _, sig := range auth.DKIMSignatures {
			if sig.Result == DkimResultPass {
				passing = append(passing, sig.Domain)
			}
		}
		if len(passing) > 0 {
			reasons = append(reasons, "No DMARC record for sender domain", fmt.Sprintf("DKIM verified for: %s", strings.Join(passing, ", ")))
			if auth.SPF == SpfResultPass {
				reasons = append(reasons, "SPF passed")
			}
			return ValidateEmailAuthResult{Verdict: AuthVerdictUnknown, Confidence: AuthConfidenceLow, Reasons: reasons}, nil
		}
		if auth.SPF == SpfResultPass {
			reasons = append(reasons, "No DMARC record for sender domain", "No DKIM signatures present", "SPF passed (but SPF alone is weak authentication)")
			return ValidateEmailAuthResult{Verdict: AuthVerdictUnknown, Confidence: AuthConfidenceLow, Reasons: reasons}, nil
		}
		reasons = append(reasons, "No DMARC record for sender domain", "No valid authentication found")
		return ValidateEmailAuthResult{Verdict: AuthVerdictUnknown, Confidence: AuthConfidenceLow, Reasons: reasons}, nil
	}
	return ValidateEmailAuthResult{Verdict: AuthVerdictUnknown, Confidence: AuthConfidenceLow, Reasons: []string{"Unable to determine email authenticity"}}, nil
}
