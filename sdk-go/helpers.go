package primitive

import (
	"bytes"
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
	"unicode/utf8"
)

var prettyPrintedJSONPattern = regexp.MustCompile(`^\s*\{[\s\S]*\n\s{2,}`)
var hexPattern = regexp.MustCompile(`^[0-9a-fA-F]+$`)

func bodyToString(value any, label string) (string, error) {
	switch typed := value.(type) {
	case string:
		return typed, nil
	case []byte:
		if !utf8.Valid(typed) {
			return "", NewWebhookPayloadError(
				"INVALID_ENCODING",
				fmt.Sprintf("%s contains invalid UTF-8 bytes", label),
				fmt.Sprintf("Ensure the %s is valid UTF-8 encoded text. If the data is binary, it should be base64 encoded first.", label),
				nil,
			)
		}
		return string(typed), nil
	case json.RawMessage:
		if !utf8.Valid(typed) {
			return "", NewWebhookPayloadError(
				"INVALID_ENCODING",
				fmt.Sprintf("%s contains invalid UTF-8 bytes", label),
				fmt.Sprintf("Ensure the %s is valid UTF-8 encoded text. If the data is binary, it should be base64 encoded first.", label),
				nil,
			)
		}
		return string(typed), nil
	default:
		return "", NewWebhookPayloadError(
			"PAYLOAD_WRONG_TYPE",
			fmt.Sprintf("Received %T instead of webhook payload object", value),
			"Webhook payloads must be objects.",
			nil,
		)
	}
}

func secretToBytes(value any) ([]byte, error) {
	switch typed := value.(type) {
	case string:
		if typed == "" {
			return nil, NewWebhookVerificationError("MISSING_SECRET", "Webhook secret is required but was empty or not provided", "")
		}
		return []byte(typed), nil
	case []byte:
		if len(typed) == 0 {
			return nil, NewWebhookVerificationError("MISSING_SECRET", "Webhook secret is required but was empty or not provided", "")
		}
		return typed, nil
	case nil:
		return nil, NewWebhookVerificationError("MISSING_SECRET", "Webhook secret is required but was empty or not provided", "")
	default:
		return nil, NewWebhookVerificationError("MISSING_SECRET", "Webhook secret is required but was empty or not provided", "")
	}
}

func normalizeJSONValue(input any) (any, []byte, error) {
	data, err := json.Marshal(input)
	if err != nil {
		return nil, nil, err
	}
	var normalized any
	// data comes directly from json.Marshal, so it is already valid JSON.
	_ = json.Unmarshal(data, &normalized)
	return normalized, data, nil
}

func decodeInto[T any](input any) (T, error) {
	var out T
	_, data, err := normalizeJSONValue(input)
	if err != nil {
		return out, err
	}
	if err := json.Unmarshal(data, &out); err != nil {
		return out, err
	}
	return out, nil
}

func mapFromInput(input any) (map[string]any, error) {
	normalized, _, err := normalizeJSONValue(input)
	if err != nil {
		return nil, err
	}
	obj, ok := normalized.(map[string]any)
	if !ok {
		return nil, NewWebhookPayloadError(
			"PAYLOAD_WRONG_TYPE",
			fmt.Sprintf("Received %T instead of webhook payload object", input),
			"Webhook payloads must be objects.",
			nil,
		)
	}
	return obj, nil
}

func mapFromInputPreservingNumbers(input any) (map[string]any, error) {
	data, err := json.Marshal(input)
	if err != nil {
		return nil, err
	}
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.UseNumber()
	var normalized any
	if err := decoder.Decode(&normalized); err != nil {
		return nil, err
	}
	obj, ok := normalized.(map[string]any)
	if !ok {
		return nil, NewWebhookPayloadError(
			"PAYLOAD_WRONG_TYPE",
			fmt.Sprintf("Received %T instead of webhook payload object", input),
			"Webhook payloads must be objects.",
			nil,
		)
	}
	return obj, nil
}

func getMapValue(input any, path ...string) (any, bool) {
	current := input
	for _, key := range path {
		switch typed := current.(type) {
		case map[string]any:
			value, ok := typed[key]
			if !ok {
				return nil, false
			}
			current = value
		default:
			mapped, err := mapFromInput(typed)
			if err != nil {
				return nil, false
			}
			value, ok := mapped[key]
			if !ok {
				return nil, false
			}
			current = value
		}
	}
	return current, true
}

func getString(input any, path ...string) (string, bool) {
	value, ok := getMapValue(input, path...)
	if !ok || value == nil {
		return "", false
	}
	text, ok := value.(string)
	return text, ok
}

func getBool(input any, path ...string) (bool, bool) {
	value, ok := getMapValue(input, path...)
	if !ok {
		return false, false
	}
	flag, ok := value.(bool)
	return flag, ok
}

func getHeaderValue(headers any, target string) string {
	lowerTarget := strings.ToLower(target)
	switch typed := headers.(type) {
	case map[string]string:
		for key, value := range typed {
			if strings.ToLower(key) == lowerTarget {
				return value
			}
		}
	case map[string][]string:
		for key, values := range typed {
			if strings.ToLower(key) == lowerTarget && len(values) > 0 {
				return values[0]
			}
		}
	case map[string]any:
		for key, value := range typed {
			if strings.ToLower(key) != lowerTarget {
				continue
			}
			switch v := value.(type) {
			case string:
				return v
			case []byte:
				if utf8.Valid(v) {
					return string(v)
				}
			case json.RawMessage:
				if utf8.Valid(v) {
					return string(v)
				}
			case []string:
				if len(v) > 0 {
					return v[0]
				}
			case []any:
				if len(v) > 0 {
					return fmt.Sprint(v[0])
				}
			default:
				return fmt.Sprint(v)
			}
		}
	case interface{ Get(string) string }:
		return typed.Get(target)
	}
	return ""
}

func detectReserializedBody(body string) string {
	if prettyPrintedJSONPattern.MatchString(body) {
		return "Request body appears re-serialized (pretty-printed). Use the raw request body before any json.Unmarshal() or json.Marshal() calls."
	}
	return ""
}
