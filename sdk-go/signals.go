package primitive

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
	"time"
	"unicode/utf16"
	"unicode/utf8"
)

// SignalParent contains explicit caller-authenticated addressing and account context.
type SignalParent struct {
	AccountScope string   `json:"accountScope"`
	From         string   `json:"from"`
	To           string   `json:"to"`
	MessageID    *string  `json:"messageId"`
	Subject      string   `json:"subject"`
	References   []string `json:"references"`
}
type SignalInput struct {
	Parent      SignalParent `json:"parent"`
	Kind        string       `json:"kind"`
	Status      string       `json:"status,omitempty"`
	Note        *string      `json:"note,omitempty"`
	ExpiresAtMs *int64       `json:"expiresAtMs,omitempty"`
}
type SignalDependencies struct {
	UUID func() string
	// Now returns Unix time in integer milliseconds.
	Now func() int64
}

// PreparedSignal is a value snapshot. Persist all fields before dispatch; do not
// change fields between retries. RequestJSON fixes the ordinary send body.
type PreparedSignal struct {
	AccountScope   string `json:"accountScope"`
	PreparedAtMs   int64  `json:"preparedAtMs"`
	ExpiresAtMs    *int64 `json:"expiresAtMs"`
	IdempotencyKey string `json:"idempotencyKey"`
	RequestJSON    string `json:"requestJson"`
}
type SignalPreparation struct {
	Status   string          `json:"status"`
	Prepared *PreparedSignal `json:"prepared,omitempty"`
}

// SignalSendResult preserves the ordinary operation's response. An expired
// result is a local refusal, never evidence that an earlier attempt failed.
type SignalSendResult[T any] struct {
	Status         string
	Result         T
	IdempotencyKey string
}

var signalUUID = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)
var signalMailbox = regexp.MustCompile("^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*$")
var signalWireID = regexp.MustCompile(`^[!-~]+@[!-~]+$`)

func signalHeader(value string, limit int) bool {
	if !utf8.ValidString(value) || len(value) > limit {
		return false
	}
	for _, c := range value {
		if c < 32 || c == 127 {
			return false
		}
	}
	return true
}
func signalMessageID(value string) (string, error) {
	value = strings.Trim(value, " ")
	if strings.HasPrefix(value, "<") && strings.HasSuffix(value, ">") {
		value = value[1 : len(value)-1]
	}
	if !signalWireID.MatchString(value) || strings.ContainsAny(value, "<>") || strings.Count(value, "@") != 1 || len(value) > 996 {
		return "", fmt.Errorf("invalid Message-ID")
	}
	return "<" + value + ">", nil
}
func signalMilliseconds(value int64) bool { return value >= 0 && value <= 253402300799999 }

// signalJSON disables HTML escaping so the UTF-8 attachment is identical across SDKs.
func signalJSON(value any) (string, error) {
	var out strings.Builder
	encoder := json.NewEncoder(&out)
	encoder.SetEscapeHTML(false)
	if err := encoder.Encode(value); err != nil {
		return "", err
	}
	return strings.TrimSuffix(out.String(), "\n"), nil
}

// PrepareSignalEmail builds one explicit ordinary email without performing IO.
func PrepareSignalEmail(input SignalInput, dependencies SignalDependencies) (SignalPreparation, error) {
	var zero SignalPreparation
	p := input.Parent
	if p.MessageID == nil || *p.MessageID == "" {
		return SignalPreparation{Status: "waiting_on_parent"}, nil
	}
	target, err := signalMessageID(*p.MessageID)
	if err != nil {
		return zero, err
	}
	for _, address := range []string{p.From, p.To} {
		if !signalHeader(address, 320) || !signalMailbox.MatchString(address) {
			return zero, fmt.Errorf("use one bare mailbox per address")
		}
	}
	if !signalHeader(p.Subject, 998) || !signalHeader(p.AccountScope, 256) || p.AccountScope == "" {
		return zero, fmt.Errorf("invalid subject or account scope")
	}
	if len(p.References) > 1000 {
		return zero, fmt.Errorf("too many references")
	}
	references := make([]string, 0, len(p.References)+1)
	for _, value := range p.References {
		ref, err := signalMessageID(value)
		if err != nil {
			return zero, err
		}
		if ref != target {
			references = append(references, ref)
		}
	}
	references = append(references, target)
	length := -1
	for _, ref := range references {
		length += len(ref) + 1
	}
	start := 0
	for len(references)-start > 100 || length > 8192 {
		length -= len(references[start]) + 1
		start++
	}
	references = references[start:]
	if p.Subject == "" {
		p.Subject = "Re: Your message"
	}
	if dependencies.Now == nil || dependencies.UUID == nil {
		return zero, fmt.Errorf("clock and UUID callbacks are required")
	}
	now := dependencies.Now()
	if !signalMilliseconds(now) {
		return zero, fmt.Errorf("invalid clock")
	}
	var expires *int64
	var expiry *string
	payload := struct {
		SubjectMessageID string  `json:"subject_message_id"`
		Status           string  `json:"status,omitempty"`
		Note             *string `json:"note,omitempty"`
	}{SubjectMessageID: target}
	switch input.Kind {
	case "ack":
		if signalText("ack", input.Status, nil) == "" {
			return zero, fmt.Errorf("invalid ACK status")
		}
		payload.Status = input.Status
		if input.Note != nil {
			if !utf8.ValidString(*input.Note) || len(utf16.Encode([]rune(*input.Note))) > 2000 || strings.ContainsRune(*input.Note, 0) {
				return zero, fmt.Errorf("invalid note")
			}
			note := *input.Note
			payload.Note = &note
		}
	case "read":
	case "working":
		if input.ExpiresAtMs == nil || !signalMilliseconds(*input.ExpiresAtMs) || *input.ExpiresAtMs <= now || *input.ExpiresAtMs-now > 60000 {
			return zero, fmt.Errorf("working expiry must be within 60 seconds")
		}
		value := *input.ExpiresAtMs
		expires = &value
		formatted := time.UnixMilli(value).UTC().Format("2006-01-02T15:04:05.000Z")
		expiry = &formatted
	default:
		return zero, fmt.Errorf("invalid signal kind")
	}
	interaction, step := strings.ToLower(dependencies.UUID()), strings.ToLower(dependencies.UUID())
	if !signalUUID.MatchString(interaction) || !signalUUID.MatchString(step) || interaction == step {
		return zero, fmt.Errorf("two distinct UUIDs are required")
	}
	envelope := struct {
		Version         int     `json:"interaction_version"`
		ID              string  `json:"interaction_id"`
		Protocol        string  `json:"protocol"`
		ProtocolVersion int     `json:"protocol_version"`
		Step            string  `json:"step"`
		StepID          string  `json:"step_id"`
		Prev            *string `json:"prev_step_id"`
		Expires         *string `json:"expires_at"`
		Payload         any     `json:"payload"`
	}{1, interaction + "@" + strings.Split(p.To, "@")[1], input.Kind, 1, input.Kind, step, nil, expiry, payload}
	encoded, err := signalJSON(envelope)
	if err != nil {
		return zero, err
	}
	if len(encoded) > 65536 {
		return zero, fmt.Errorf("signal exceeds 64 KiB")
	}
	attachment := struct {
		Filename      string `json:"filename"`
		ContentType   string `json:"content_type"`
		ContentBase64 string `json:"content_base64"`
	}{"interaction.json", "application/json", base64.StdEncoding.EncodeToString([]byte(encoded))}
	body := struct {
		From        string   `json:"from"`
		To          string   `json:"to"`
		Subject     string   `json:"subject"`
		BodyText    string   `json:"body_text"`
		InReplyTo   string   `json:"in_reply_to"`
		References  []string `json:"references"`
		Attachments any      `json:"attachments"`
	}{p.To, p.From, p.Subject, signalText(input.Kind, input.Status, input.Note), target, references, []any{attachment}}
	request, err := signalJSON(body)
	if err != nil {
		return zero, err
	}
	return SignalPreparation{Status: "prepared", Prepared: &PreparedSignal{p.AccountScope, now, expires, "signal-" + step, request}}, nil
}

// SendPreparedSignal makes one ordinary attempt using the supplied operation.
// The fresh RawMessage copy cannot alter the saved request for subsequent retries.
func SendPreparedSignal[T any](ctx context.Context, sendMail func(context.Context, json.RawMessage, string) (T, error), prepared PreparedSignal, accountScope string, now func() int64) (SignalSendResult[T], error) {
	var zero SignalSendResult[T]
	if accountScope == "" || accountScope != prepared.AccountScope {
		return zero, fmt.Errorf("account scope mismatch")
	}
	if now == nil {
		return zero, fmt.Errorf("clock is required")
	}
	observed := now()
	if !signalMilliseconds(observed) {
		return zero, fmt.Errorf("invalid clock")
	}
	if prepared.ExpiresAtMs != nil && observed >= *prepared.ExpiresAtMs {
		return SignalSendResult[T]{Status: "expired", IdempotencyKey: prepared.IdempotencyKey}, nil
	}
	result, err := sendMail(ctx, json.RawMessage(prepared.RequestJSON), prepared.IdempotencyKey)
	if err != nil {
		return zero, err
	}
	return SignalSendResult[T]{Status: "response", Result: result}, nil
}

func signalText(kind, status string, note *string) string {
	if kind == "read" {
		return "I read your message."
	}
	if kind == "working" {
		return "I am working on your message."
	}
	text := map[string]string{"received": "Received your message.", "will_process": "I intend to process your message.", "will_not_process": "I will not process your message."}[status]
	if note != nil {
		text += "\n\n" + *note
	}
	return text
}
