package primitive

import (
	"errors"
	"fmt"
	"math"
	"strings"
	"unicode/utf16"
	"unicode/utf8"
)

// Scheduled messages to agents: schedule.tick/1 and schedule.stop/1.
//
// Each scheduled message carries a schedule.tick/1 interaction part. When the
// schedule allows it, the agent stops the schedule through
// POST /v1/emails/{id}/schedule-stop, and the server replies in the thread
// with a schedule.stop/1 interaction for the owner. These helpers only parse
// and build data; they make no requests. A parsed interaction is still
// untrusted until the carrying email authenticates as the expected sender.
const (
	ScheduleTickProtocol       = "schedule.tick"
	ScheduleStopProtocol       = "schedule.stop"
	ScheduleProtocolVersion    = 1
	ScheduleTickStep           = "tick"
	ScheduleStopStep           = "stop"
	ScheduleTickKind           = "schedule.tick/1"
	ScheduleStopKind           = "schedule.stop/1"
	ScheduleStopReasonMax      = 280 // UTF-16 code units; astral characters count twice.
	ScheduleIntervalMinMinutes = 5
	ScheduleIntervalMaxMinutes = 10080
	ScheduleIdleMaxMinutes     = 10080
)

const scheduleSafeInteger = 9007199254740991

// ScheduleTick is the schedule.tick/1 payload.
type ScheduleTick struct {
	ScheduleID      string `json:"schedule_id"`
	Sequence        int64  `json:"sequence"`
	IntervalMinutes int64  `json:"interval_minutes"`
	IdleMinutes     *int64 `json:"idle_minutes"`
	AgentCanStop    bool   `json:"agent_can_stop"`
}

// ScheduleTickResult has Status "valid", "other" or "invalid"; Reason is
// "invalid_envelope", "invalid_step" or "invalid_payload" when invalid.
type ScheduleTickResult struct {
	Status string
	Tick   *ScheduleTick
	Reason string
}

// ScheduleStop is the schedule.stop/1 payload. Reason is agent-written and untrusted.
type ScheduleStop struct {
	Reason *string `json:"reason"`
}

// ScheduleStopResult has Status "valid", "other" or "invalid".
type ScheduleStopResult struct {
	Status string
	Stop   *ScheduleStop
	Reason string
}

// InteractionKind returns protocol/protocol_version, e.g. schedule.tick/1.
func InteractionKind(envelope map[string]any) string {
	version := envelope["protocol_version"]
	if number, ok := version.(float64); ok && number == math.Trunc(number) {
		version = int64(number)
	}
	return fmt.Sprintf("%v/%v", envelope["protocol"], version)
}

func scheduleInteger(value any, low, high int64) (int64, bool) {
	number, ok := value.(float64)
	if !ok || number != math.Trunc(number) || number < float64(low) || number > float64(high) {
		return 0, false
	}
	return int64(number), true
}

func scheduleProtocol(envelope map[string]any, protocol string) bool {
	version, ok := envelope["protocol_version"].(float64)
	return envelope["protocol"] == protocol && ok && version == ScheduleProtocolVersion
}

// ReadScheduleTick reads the tick payload from an envelope that already passed
// envelope validation.
func ReadScheduleTick(envelope map[string]any) ScheduleTickResult {
	if !scheduleProtocol(envelope, ScheduleTickProtocol) {
		return ScheduleTickResult{Status: "other"}
	}
	if envelope["step"] != ScheduleTickStep {
		return ScheduleTickResult{Status: "invalid", Reason: "invalid_step"}
	}
	invalid := ScheduleTickResult{Status: "invalid", Reason: "invalid_payload"}
	payload, ok := envelope["payload"].(map[string]any)
	if !ok {
		return invalid
	}
	id, idOK := payload["schedule_id"].(string)
	sequence, sequenceOK := scheduleInteger(payload["sequence"], 1, scheduleSafeInteger)
	interval, intervalOK := scheduleInteger(payload["interval_minutes"], ScheduleIntervalMinMinutes, ScheduleIntervalMaxMinutes)
	idleRaw, idlePresent := payload["idle_minutes"]
	var idle *int64
	idleOK := idlePresent && idleRaw == nil
	if idlePresent && idleRaw != nil {
		value, valueOK := scheduleInteger(idleRaw, 1, ScheduleIdleMaxMinutes)
		idle, idleOK = &value, valueOK
	}
	canStop, canStopOK := payload["agent_can_stop"].(bool)
	if !idOK || !interactionUUID.MatchString(id) || !sequenceOK || !intervalOK || !idleOK || !canStopOK {
		return invalid
	}
	return ScheduleTickResult{Status: "valid", Tick: &ScheduleTick{
		ScheduleID:      strings.ToLower(id),
		Sequence:        sequence,
		IntervalMinutes: interval,
		IdleMinutes:     idle,
		AgentCanStop:    canStop,
	}}
}

// ParseScheduleTick parses interaction.json bytes and reads a schedule.tick/1 payload.
func ParseScheduleTick(source []byte) ScheduleTickResult {
	parsed := ParseInteractionEnvelope(source)
	if parsed.Status != "valid" {
		return ScheduleTickResult{Status: "invalid", Reason: "invalid_envelope"}
	}
	return ReadScheduleTick(parsed.Envelope)
}

// ReadScheduleStop reads the stop payload from an envelope that already passed
// envelope validation.
func ReadScheduleStop(envelope map[string]any) ScheduleStopResult {
	if !scheduleProtocol(envelope, ScheduleStopProtocol) {
		return ScheduleStopResult{Status: "other"}
	}
	if envelope["step"] != ScheduleStopStep {
		return ScheduleStopResult{Status: "invalid", Reason: "invalid_step"}
	}
	invalid := ScheduleStopResult{Status: "invalid", Reason: "invalid_payload"}
	payload, ok := envelope["payload"].(map[string]any)
	if !ok {
		return invalid
	}
	raw := payload["reason"]
	if raw == nil {
		return ScheduleStopResult{Status: "valid", Stop: &ScheduleStop{}}
	}
	reason, ok := raw.(string)
	if !ok || reason == "" || len(utf16.Encode([]rune(reason))) > ScheduleStopReasonMax {
		return invalid
	}
	return ScheduleStopResult{Status: "valid", Stop: &ScheduleStop{Reason: &reason}}
}

// ParseScheduleStop parses interaction.json bytes and reads a schedule.stop/1 payload.
func ParseScheduleStop(source []byte) ScheduleStopResult {
	parsed := ParseInteractionEnvelope(source)
	if parsed.Status != "valid" {
		return ScheduleStopResult{Status: "invalid", Reason: "invalid_envelope"}
	}
	return ReadScheduleStop(parsed.Envelope)
}

// NormalizeScheduleStopReason trims ASCII whitespace and returns "" for no
// reason. It rejects control characters, invalid UTF-8 and reasons longer than
// 280 UTF-16 code units.
func NormalizeScheduleStopReason(reason string) (string, error) {
	trimmed := strings.Trim(reason, " \t\r\n")
	if !utf8.ValidString(trimmed) {
		return "", errors.New("reason must be valid Unicode text")
	}
	for _, char := range trimmed {
		if char < 0x20 || char == 0x7f {
			return "", errors.New("reason must be one line without control characters")
		}
	}
	if len(utf16.Encode([]rune(trimmed))) > ScheduleStopReasonMax {
		return "", fmt.Errorf("reason must be at most %d characters", ScheduleStopReasonMax)
	}
	return trimmed, nil
}

// BuildScheduleStopBody returns the request body for
// POST /v1/emails/{id}/schedule-stop.
func BuildScheduleStopBody(reason string) (map[string]string, error) {
	normalized, err := NormalizeScheduleStopReason(reason)
	if err != nil {
		return nil, err
	}
	if normalized == "" {
		return map[string]string{}, nil
	}
	return map[string]string{"reason": normalized}, nil
}

// ScheduleStopCommand returns the CLI command that stops the schedule behind a
// scheduled message.
func ScheduleStopCommand(emailID string) (string, error) {
	if !interactionUUID.MatchString(emailID) {
		return "", errors.New("emailID must be an email UUID")
	}
	return "primitive schedule stop --id " + strings.ToLower(emailID), nil
}
