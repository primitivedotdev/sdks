package primitive

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"math"
	"regexp"
	"strconv"
	"strings"
	"unicode/utf8"
)

const MaxInteractionBytes = 65536
const MaxInteractionDepth = 64

// InteractionResult describes syntax and envelope shape only, never authenticity.
// Envelope retains unknown fields and protocols. Source is a defensive exact copy
// for parsed valid/unsupported input; decoded validation never supplies it.
type InteractionResult struct {
	Status   string
	Envelope map[string]any
	Version  int64
	Reason   string
	Source   []byte
}

var interactionUUID = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

const interactionSpace = "\t\n\v\f\r \u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff"

func interactionWireID(value string) bool {
	parts := strings.Split(value, "@")
	return len(parts) == 2 && interactionUUID.MatchString(parts[0]) && parts[1] != "" && !strings.ContainsAny(parts[1], interactionSpace)
}

var interactionNumberSyntax = regexp.MustCompile(`^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?$`)

func interactionNumber(token string) (float64, error) {
	if len(token) > 128 || !interactionNumberSyntax.MatchString(token) {
		return 0, errors.New("number too long")
	}
	n, err := strconv.ParseFloat(token, 64)
	if err != nil || math.IsNaN(n) || math.IsInf(n, 0) || (math.Trunc(n) == n && math.Abs(n) > 9007199254740991) {
		return 0, errors.New("unsafe number")
	}
	return n, nil
}

// encoding/json replaces lone surrogate escapes, so reject those before decoding.
func interactionUnicode(source []byte) bool {
	if !utf8.Valid(source) {
		return false
	}
	for i := 0; i < len(source); i++ {
		if source[i] != '"' {
			continue
		}
		i++
		for i < len(source) && source[i] != '"' {
			if source[i] == '\\' {
				i++
				if i >= len(source) {
					return false
				}
				if source[i] == 'u' {
					if i+4 >= len(source) {
						return false
					}
					code, err := strconv.ParseUint(string(source[i+1:i+5]), 16, 16)
					if err != nil {
						return false
					}
					i += 4
					if code >= 0xd800 && code <= 0xdbff {
						if i+6 >= len(source) || source[i+1] != '\\' || source[i+2] != 'u' {
							return false
						}
						low, err := strconv.ParseUint(string(source[i+3:i+7]), 16, 16)
						if err != nil || low < 0xdc00 || low > 0xdfff {
							return false
						}
						i += 6
					} else if code >= 0xdc00 && code <= 0xdfff {
						return false
					}
				}
			}
			i++
		}
	}
	return true
}

func readInteractionJSON(dec *json.Decoder, depth int) (any, error) {
	token, err := dec.Token()
	if err != nil {
		return nil, err
	}
	if delim, ok := token.(json.Delim); ok {
		if depth >= MaxInteractionDepth {
			return nil, errors.New("too deep")
		}
		switch delim {
		case '{':
			obj := map[string]any{}
			for dec.More() {
				keyToken, err := dec.Token()
				if err != nil {
					return nil, err
				}
				key, ok := keyToken.(string)
				if !ok {
					return nil, errors.New("invalid key")
				}
				if _, exists := obj[key]; exists {
					return nil, errors.New("duplicate key")
				}
				value, err := readInteractionJSON(dec, depth+1)
				if err != nil {
					return nil, err
				}
				obj[key] = value
			}
			_, err = dec.Token()
			return obj, err
		case '[':
			items := []any{}
			for dec.More() {
				value, err := readInteractionJSON(dec, depth+1)
				if err != nil {
					return nil, err
				}
				items = append(items, value)
			}
			_, err = dec.Token()
			return items, err
		}
		return nil, errors.New("invalid delimiter")
	}
	if number, ok := token.(json.Number); ok {
		return interactionNumber(string(number))
	}
	return token, nil
}

func checkInteractionEnvelope(value any) InteractionResult {
	invalid := InteractionResult{Status: "invalid", Reason: "invalid_envelope"}
	obj, ok := value.(map[string]any)
	if !ok {
		return invalid
	}
	version, ok := obj["interaction_version"].(float64)
	if !ok || version < 1 || math.Trunc(version) != version {
		return invalid
	}
	if version != 1 {
		return InteractionResult{Status: "unsupported", Version: int64(version)}
	}
	iid, iok := obj["interaction_id"].(string)
	protocol, pok := obj["protocol"].(string)
	pv, pvok := obj["protocol_version"].(float64)
	step, sok := obj["step"].(string)
	sid, sidok := obj["step_id"].(string)
	prev, prevExists := obj["prev_step_id"]
	expiry, expiryExists := obj["expires_at"]
	_, payloadExists := obj["payload"]
	if !iok || !interactionWireID(iid) || !pok || strings.Trim(protocol, interactionSpace) == "" || !pvok || pv < 1 || math.Trunc(pv) != pv || !sok || strings.Trim(step, interactionSpace) == "" || !sidok || !interactionUUID.MatchString(sid) || !prevExists || !expiryExists || !payloadExists {
		return invalid
	}
	if prev != nil {
		p, ok := prev.(string)
		if !ok || !interactionUUID.MatchString(p) {
			return invalid
		}
	}
	if expiry != nil {
		if _, ok := expiry.(string); !ok {
			return invalid
		}
	}
	return InteractionResult{Status: "valid", Envelope: obj}
}

// ParseInteractionEnvelope parses at most 64 KiB of strict UTF-8 JSON.
// For string input use ParseInteractionEnvelopeString.
func ParseInteractionEnvelope(source []byte) InteractionResult {
	if len(source) > MaxInteractionBytes {
		return InteractionResult{Status: "invalid", Reason: "too_large"}
	}
	invalid := InteractionResult{Status: "invalid", Reason: "invalid_json"}
	if !interactionUnicode(source) {
		return invalid
	}
	dec := json.NewDecoder(bytes.NewReader(source))
	dec.UseNumber()
	value, err := readInteractionJSON(dec, 0)
	if err != nil {
		return invalid
	}
	if _, err = dec.Token(); err != io.EOF {
		return invalid
	}
	result := checkInteractionEnvelope(value)
	if result.Status != "invalid" {
		result.Source = bytes.Clone(source)
	}
	return result
}

func ParseInteractionEnvelopeString(source string) InteractionResult {
	if len(source) > MaxInteractionBytes {
		return InteractionResult{Status: "invalid", Reason: "too_large"}
	}
	return ParseInteractionEnvelope([]byte(source))
}

func snapshotInteraction(value any, depth int, budget *int) (any, error) {
	*budget--
	if *budget < 0 {
		return nil, errors.New("too large")
	}
	switch value := value.(type) {
	case nil, bool:
		return value, nil
	case string:
		*budget -= len(value)
		if *budget < 0 || !utf8.ValidString(value) {
			return nil, errors.New("invalid string")
		}
		return value, nil
	case float64:
		return interactionNumber(strconv.FormatFloat(value, 'g', -1, 64))
	case int:
		return interactionNumber(strconv.FormatInt(int64(value), 10))
	case int64:
		return interactionNumber(strconv.FormatInt(value, 10))
	case json.Number:
		return interactionNumber(string(value))
	case map[string]any:
		if depth >= MaxInteractionDepth || len(value) > *budget {
			return nil, errors.New("too deep or large")
		}
		out := map[string]any{}
		for key, item := range value {
			if _, err := snapshotInteraction(key, depth+1, budget); err != nil {
				return nil, err
			}
			copy, err := snapshotInteraction(item, depth+1, budget)
			if err != nil {
				return nil, err
			}
			out[key] = copy
		}
		return out, nil
	case []any:
		if depth >= MaxInteractionDepth || len(value) > *budget {
			return nil, errors.New("too deep or large")
		}
		out := make([]any, len(value))
		for i, item := range value {
			copy, err := snapshotInteraction(item, depth+1, budget)
			if err != nil {
				return nil, err
			}
			out[i] = copy
		}
		return out, nil
	default:
		return nil, errors.New("not decoded JSON data")
	}
}

// ValidateInteractionEnvelope validates decoded JSON maps/slices/scalars only.
// It cannot detect original duplicate keys or recover original bytes.
func ValidateInteractionEnvelope(value any) InteractionResult {
	budget := MaxInteractionBytes
	snapshot, err := snapshotInteraction(value, 0, &budget)
	if err != nil {
		return InteractionResult{Status: "invalid", Reason: "invalid_input"}
	}
	return checkInteractionEnvelope(snapshot)
}
