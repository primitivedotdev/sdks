package primitive

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"strconv"
	"strings"
	"time"
)

// PrepareStandardWebhooksSecret strips the "whsec_" prefix if present,
// then base64-decodes the remainder to produce the raw HMAC key bytes.
func PrepareStandardWebhooksSecret(secret any) ([]byte, error) {
	var keyStr string
	switch v := secret.(type) {
	case string:
		keyStr = v
	case []byte:
		if len(v) == 0 {
			return nil, NewWebhookVerificationError(
				"MISSING_SECRET",
				"Webhook secret is required but was empty or not provided.",
				"",
			)
		}
		return v, nil
	case nil:
		return nil, NewWebhookVerificationError(
			"MISSING_SECRET",
			"Webhook secret is required but was empty or not provided.",
			"",
		)
	default:
		return nil, NewWebhookVerificationError(
			"MISSING_SECRET",
			fmt.Sprintf("Unsupported secret type: %T", secret),
			"",
		)
	}

	if keyStr == "" {
		return nil, NewWebhookVerificationError(
			"MISSING_SECRET",
			"Webhook secret is required but was empty or not provided.",
			"",
		)
	}

	if strings.HasPrefix(keyStr, whsecPrefix) {
		keyStr = keyStr[len(whsecPrefix):]
	}

	decoded, err := base64.StdEncoding.DecodeString(keyStr)
	if err != nil {
		// Try with padding
		decoded, err = base64.RawStdEncoding.DecodeString(keyStr)
		if err != nil {
			return nil, NewWebhookVerificationError(
				"MISSING_SECRET",
				"Standard Webhooks secret must be base64-encoded (optionally with whsec_ prefix).",
				"",
			)
		}
	}

	if len(decoded) == 0 {
		return nil, NewWebhookVerificationError(
			"MISSING_SECRET",
			"Webhook secret is required but was empty or not provided.",
			"",
		)
	}

	return decoded, nil
}

// parseStandardWebhooksSignatures parses the webhook-signature header
// into base64 signature strings. Only v1 entries are returned.
func parseStandardWebhooksSignatures(header string) []string {
	if header == "" {
		return nil
	}
	var signatures []string
	for _, entry := range strings.Split(header, " ") {
		entry = strings.TrimSpace(entry)
		if entry == "" {
			continue
		}
		idx := strings.Index(entry, ",")
		if idx == -1 {
			continue
		}
		version := entry[:idx]
		sig := entry[idx+1:]
		if version == "v1" && sig != "" {
			signatures = append(signatures, sig)
		}
	}
	return signatures
}

// SignStandardWebhooksPayload signs a payload using the Standard Webhooks format.
func SignStandardWebhooksPayload(rawBody any, secret any, msgID string, timestamps ...int64) (StandardWebhooksSignResult, error) {
	body, err := bodyToString(rawBody, "raw body")
	if err != nil {
		return StandardWebhooksSignResult{}, err
	}
	key, err := PrepareStandardWebhooksSecret(secret)
	if err != nil {
		return StandardWebhooksSignResult{}, err
	}
	timestamp := time.Now().Unix()
	if len(timestamps) > 0 {
		timestamp = timestamps[0]
	}
	mac := hmac.New(sha256.New, key)
	_, _ = mac.Write([]byte(fmt.Sprintf("%s.%d.%s", msgID, timestamp, body)))
	sig := base64.StdEncoding.EncodeToString(mac.Sum(nil))
	return StandardWebhooksSignResult{
		Signature: fmt.Sprintf("v1,%s", sig),
		MsgID:     msgID,
		Timestamp: timestamp,
	}, nil
}

// VerifyStandardWebhooksSignature verifies a Standard Webhooks signature.
func VerifyStandardWebhooksSignature(options StandardWebhooksVerifyOptions) (bool, error) {
	key, err := PrepareStandardWebhooksSecret(options.Secret)
	if err != nil {
		return false, err
	}
	if len(key) == 0 {
		return false, NewWebhookVerificationError(
			"MISSING_SECRET",
			"Webhook secret is required but was empty or not provided.",
			"",
		)
	}

	body, err := bodyToString(options.RawBody, "request body")
	if err != nil {
		return false, err
	}

	timestamp, err := strconv.ParseInt(options.Timestamp, 10, 64)
	if err != nil || timestamp < 0 {
		return false, NewWebhookVerificationError(
			"INVALID_SIGNATURE_HEADER",
			fmt.Sprintf("Invalid webhook-timestamp header: %q. Expected a unix timestamp in seconds.", options.Timestamp),
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

	mac := hmac.New(sha256.New, key)
	_, _ = mac.Write([]byte(fmt.Sprintf("%s.%d.%s", options.MsgID, timestamp, body)))
	expectedSig := base64.StdEncoding.EncodeToString(mac.Sum(nil))

	signatures := parseStandardWebhooksSignatures(options.SignatureHeader)
	if len(signatures) == 0 {
		return false, NewWebhookVerificationError(
			"INVALID_SIGNATURE_HEADER",
			"Invalid webhook-signature header format. Expected: \"v1,<base64>\".",
			"",
		)
	}

	expectedBytes, _ := base64.StdEncoding.DecodeString(expectedSig)
	for _, sig := range signatures {
		sigBytes, err := base64.StdEncoding.DecodeString(sig)
		if err != nil {
			continue
		}
		if len(sigBytes) == len(expectedBytes) && hmac.Equal(sigBytes, expectedBytes) {
			return true, nil
		}
	}

	return false, NewWebhookVerificationError(
		"SIGNATURE_MISMATCH",
		"No valid signature found. Verify the webhook secret matches and you're using the raw request body (not re-serialized JSON).",
		"",
	)
}

// detectStandardWebhooksHeaders checks for Standard Webhooks headers.
// Returns all three values and ok=true if webhook-signature is present.
// If webhook-signature is found but other headers are missing, returns an error.
func detectStandardWebhooksHeaders(headers any) (msgID, timestamp, signature string, ok bool, err error) {
	signature = getHeaderValue(headers, StandardWebhookSignatureHeader)
	if !hasHeaderKey(headers, StandardWebhookSignatureHeader) {
		return "", "", "", false, nil
	}
	if signature == "" {
		return "", "", "", false, NewWebhookVerificationError(
			"INVALID_SIGNATURE_HEADER",
			"Empty webhook-signature header. Expected: \"v1,<base64>\".",
			"",
		)
	}
	msgID = getHeaderValue(headers, StandardWebhookIDHeader)
	timestamp = getHeaderValue(headers, StandardWebhookTimestampHeader)
	if msgID == "" || timestamp == "" {
		missing := "webhook-id"
		if msgID != "" {
			missing = "webhook-timestamp"
		}
		return "", "", "", false, NewWebhookVerificationError(
			"INVALID_SIGNATURE_HEADER",
			fmt.Sprintf("Found webhook-signature header but missing %s header. Standard Webhooks requires all three headers: webhook-id, webhook-timestamp, webhook-signature.", missing),
			"",
		)
	}
	return msgID, timestamp, signature, true, nil
}
