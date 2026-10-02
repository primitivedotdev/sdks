package primitive

import (
	"errors"
	"fmt"
	"math"
	"strings"
	"unicode/utf16"
	"unicode/utf8"
)

// Repeating sends: repeat.tick/1 and repeat.stop/1.
//
// A send or reply with repeat goes out now and then again every few minutes in
// the same thread. Each message carries a repeat.tick/1 interaction part. When
// the repeat allows it, the recipient stops it through
// POST /v1/emails/{id}/repeat-stop, and the server replies in the thread with
// a repeat.stop/1 part for the sender. These helpers only parse and build
// data; they make no requests. A parsed part is not proof that Primitive sent
// the message: use the server-verified repeat marker on the email for that.
const (
	RepeatTickProtocol    = "repeat.tick"
	RepeatStopProtocol    = "repeat.stop"
	RepeatProtocolVersion = 1
	RepeatTickStep        = "tick"
	RepeatStopStep        = "stop"
	RepeatTickKind        = "repeat.tick/1"
	RepeatStopKind        = "repeat.stop/1"
	RepeatStopReasonMax   = 280 // UTF-16 code units; astral characters count twice.
	RepeatEveryMinMinutes = 5
	RepeatEveryMaxMinutes = 10080
	RepeatIdleMaxMinutes  = 10080
)

const repeatSafeInteger = 9007199254740991

// RepeatTick is the repeat.tick/1 payload.
type RepeatTick struct {
	RepeatID                   string `json:"repeat_id"`
	Sequence                   int64  `json:"sequence"`
	EveryMinutes               int64  `json:"every_minutes"`
	OnlyIfRecipientIdleMinutes *int64 `json:"only_if_recipient_idle_minutes"`
	StoppableByRecipient       bool   `json:"stoppable_by_recipient"`
}

// RepeatTickResult has Status "valid", "other" or "invalid"; Reason is
// "invalid_envelope", "invalid_step" or "invalid_payload" when invalid.
type RepeatTickResult struct {
	Status string
	Tick   *RepeatTick
	Reason string
}

// RepeatStop is the repeat.stop/1 payload. Reason is recipient-written and untrusted.
type RepeatStop struct {
	Reason *string `json:"reason"`
}

// RepeatStopResult has Status "valid", "other" or "invalid".
type RepeatStopResult struct {
	Status string
	Stop   *RepeatStop
	Reason string
}

// InteractionKind returns protocol/protocol_version, e.g. repeat.tick/1.
func InteractionKind(envelope map[string]any) string {
	version := envelope["protocol_version"]
	if number, ok := version.(float64); ok && number == math.Trunc(number) {
		version = int64(number)
	}
	return fmt.Sprintf("%v/%v", envelope["protocol"], version)
}

func repeatInteger(value any, low, high int64) (int64, bool) {
	number, ok := value.(float64)
	if !ok || number != math.Trunc(number) || number < float64(low) || number > float64(high) {
		return 0, false
	}
	return int64(number), true
}

func repeatProtocol(envelope map[string]any, protocol string) bool {
	version, ok := envelope["protocol_version"].(float64)
	return envelope["protocol"] == protocol && ok && version == RepeatProtocolVersion
}

// ReadRepeatTick reads the tick payload from an envelope that already passed
// envelope validation.
func ReadRepeatTick(envelope map[string]any) RepeatTickResult {
	if !repeatProtocol(envelope, RepeatTickProtocol) {
		return RepeatTickResult{Status: "other"}
	}
	if envelope["step"] != RepeatTickStep {
		return RepeatTickResult{Status: "invalid", Reason: "invalid_step"}
	}
	invalid := RepeatTickResult{Status: "invalid", Reason: "invalid_payload"}
	payload, ok := envelope["payload"].(map[string]any)
	if !ok {
		return invalid
	}
	id, idOK := payload["repeat_id"].(string)
	sequence, sequenceOK := repeatInteger(payload["sequence"], 1, repeatSafeInteger)
	every, everyOK := repeatInteger(payload["every_minutes"], RepeatEveryMinMinutes, RepeatEveryMaxMinutes)
	idleRaw, idlePresent := payload["only_if_recipient_idle_minutes"]
	var idle *int64
	idleOK := idlePresent && idleRaw == nil
	if idlePresent && idleRaw != nil {
		value, valueOK := repeatInteger(idleRaw, 1, RepeatIdleMaxMinutes)
		idle, idleOK = &value, valueOK
	}
	canStop, canStopOK := payload["stoppable_by_recipient"].(bool)
	if !idOK || !interactionUUID.MatchString(id) || !sequenceOK || !everyOK || !idleOK || !canStopOK {
		return invalid
	}
	return RepeatTickResult{Status: "valid", Tick: &RepeatTick{
		RepeatID:                   strings.ToLower(id),
		Sequence:                   sequence,
		EveryMinutes:               every,
		OnlyIfRecipientIdleMinutes: idle,
		StoppableByRecipient:       canStop,
	}}
}

// ParseRepeatTick parses interaction.json bytes and reads a repeat.tick/1 payload.
func ParseRepeatTick(source []byte) RepeatTickResult {
	parsed := ParseInteractionEnvelope(source)
	if parsed.Status != "valid" {
		return RepeatTickResult{Status: "invalid", Reason: "invalid_envelope"}
	}
	return ReadRepeatTick(parsed.Envelope)
}

// ReadRepeatStop reads the stop payload from an envelope that already passed
// envelope validation.
func ReadRepeatStop(envelope map[string]any) RepeatStopResult {
	if !repeatProtocol(envelope, RepeatStopProtocol) {
		return RepeatStopResult{Status: "other"}
	}
	if envelope["step"] != RepeatStopStep {
		return RepeatStopResult{Status: "invalid", Reason: "invalid_step"}
	}
	invalid := RepeatStopResult{Status: "invalid", Reason: "invalid_payload"}
	payload, ok := envelope["payload"].(map[string]any)
	if !ok {
		return invalid
	}
	raw := payload["reason"]
	if raw == nil {
		return RepeatStopResult{Status: "valid", Stop: &RepeatStop{}}
	}
	reason, ok := raw.(string)
	if !ok || reason == "" || len(utf16.Encode([]rune(reason))) > RepeatStopReasonMax {
		return invalid
	}
	return RepeatStopResult{Status: "valid", Stop: &RepeatStop{Reason: &reason}}
}

// ParseRepeatStop parses interaction.json bytes and reads a repeat.stop/1 payload.
func ParseRepeatStop(source []byte) RepeatStopResult {
	parsed := ParseInteractionEnvelope(source)
	if parsed.Status != "valid" {
		return RepeatStopResult{Status: "invalid", Reason: "invalid_envelope"}
	}
	return ReadRepeatStop(parsed.Envelope)
}

// NormalizeRepeatStopReason trims ASCII whitespace and returns "" for no
// reason. It rejects control characters, invalid UTF-8 and reasons longer than
// 280 UTF-16 code units.
func NormalizeRepeatStopReason(reason string) (string, error) {
	trimmed := strings.Trim(reason, " \t\r\n")
	if !utf8.ValidString(trimmed) {
		return "", errors.New("reason must be valid Unicode text")
	}
	for _, char := range trimmed {
		if char < 0x20 || char == 0x7f {
			return "", errors.New("reason must be one line without control characters")
		}
	}
	if len(utf16.Encode([]rune(trimmed))) > RepeatStopReasonMax {
		return "", fmt.Errorf("reason must be at most %d characters", RepeatStopReasonMax)
	}
	return trimmed, nil
}

// BuildRepeatStopBody returns the request body for
// POST /v1/emails/{id}/repeat-stop.
func BuildRepeatStopBody(reason string) (map[string]string, error) {
	normalized, err := NormalizeRepeatStopReason(reason)
	if err != nil {
		return nil, err
	}
	if normalized == "" {
		return map[string]string{}, nil
	}
	return map[string]string{"reason": normalized}, nil
}

// RepeatStopCommand returns the CLI command that stops the repeat behind a
// received message.
func RepeatStopCommand(emailID string) (string, error) {
	if !interactionUUID.MatchString(emailID) {
		return "", errors.New("emailID must be an email UUID")
	}
	return "primitive repeat stop --id " + strings.ToLower(emailID), nil
}
