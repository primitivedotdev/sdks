package primitive

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
	"time"
)

const PresenceProtocol = "primitive.presence"
const PresenceVersion = 1
const PresenceTTLMS int64 = 600000
const MaxPresenceEnvelopeBytes = 4096
const MaxPresenceDecodedBytes = 8192
const MaxPresenceRenderedBytes = 16384
const PresenceProbeText = "This email checks whether your receiver is available."
const PresenceAliveText = "This receiver answered the presence check."
const PresenceProbeSubject = "Receiver presence check"
const PresenceAliveSubject = "Re: Receiver presence check"

type PresencePayload struct {
	Nonce    string `json:"nonce"`
	IssuedAt string `json:"issued_at"`
	Address  string `json:"address"`
}
type PresenceEnvelope struct {
	InteractionVersion int             `json:"interaction_version"`
	InteractionID      string          `json:"interaction_id"`
	Protocol           string          `json:"protocol"`
	ProtocolVersion    int             `json:"protocol_version"`
	Step               string          `json:"step"`
	StepID             string          `json:"step_id"`
	PrevStepID         *string         `json:"prev_step_id"`
	ExpiresAt          string          `json:"expires_at"`
	Payload            PresencePayload `json:"payload"`
}

// PresenceParseResult describes syntax only, including expired controls.
type PresenceParseResult struct {
	Status   string
	Envelope *PresenceEnvelope
	Version  int64
	Reason   string
	Source   []byte
}
type PresenceProbeInput struct{ AccountScope, From, To string }
type PresenceAliveInput struct {
	PresenceProbeInput
	Probe      PresenceEnvelope
	MessageID  *string
	References []string
}
type PresenceDependencies struct {
	UUID func() string
	Now  func() int64
}
type PresenceProbeDependencies struct {
	PresenceDependencies
	Nonce func() string
}

// PreparedPresence is a value snapshot. Persist it unchanged before dispatch.
type PreparedPresence struct {
	AccountScope   string `json:"accountScope"`
	PreparedAtMs   int64  `json:"preparedAtMs"`
	ExpiresAtMs    int64  `json:"expiresAtMs"`
	IdempotencyKey string `json:"idempotencyKey"`
	RequestJSON    string `json:"requestJson"`
}
type PresencePreparation struct {
	Status   string            `json:"status"`
	Prepared *PreparedPresence `json:"prepared,omitempty"`
}

var presenceNonce = regexp.MustCompile(`^(?:[0-9a-f]{32}|[0-9a-f]{64})$`)
var presenceUUID = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)
var presenceHost = regexp.MustCompile(`^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$`)
var presenceDate = regexp.MustCompile(`^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$`)

func presenceTimestamp(value string) (int64, bool) {
	if !presenceDate.MatchString(value) {
		return 0, false
	}
	date, err := time.Parse("2006-01-02T15:04:05.000Z", value)
	if err != nil || !signalMilliseconds(date.UnixMilli()) {
		return 0, false
	}
	return date.UnixMilli(), true
}
func presenceMailbox(value string) bool {
	parts := strings.Split(value, "@")
	return value == strings.ToLower(value) && len(value) <= 320 && signalMailbox.MatchString(value) && len(parts) == 2 && len(parts[1]) <= 253 && presenceHost.MatchString(parts[1])
}
func presenceShape(e PresenceEnvelope) bool {
	parts := strings.Split(e.InteractionID, "@")
	if len(parts) != 2 || !presenceUUID.MatchString(parts[0]) || !presenceHost.MatchString(parts[1]) || len(parts[1]) > 253 || !presenceUUID.MatchString(e.StepID) || parts[0] == e.StepID || e.InteractionVersion != 1 || e.Protocol != PresenceProtocol || e.ProtocolVersion != 1 {
		return false
	}
	if e.Step == "probe" {
		if e.PrevStepID != nil {
			return false
		}
	} else if e.Step == "alive" {
		if e.PrevStepID == nil || !presenceUUID.MatchString(*e.PrevStepID) || *e.PrevStepID == e.StepID || *e.PrevStepID == parts[0] {
			return false
		}
	} else {
		return false
	}
	issued, issuedOK := presenceTimestamp(e.Payload.IssuedAt)
	expires, expiresOK := presenceTimestamp(e.ExpiresAt)
	return issuedOK && expiresOK && expires-issued == PresenceTTLMS && presenceNonce.MatchString(e.Payload.Nonce) && presenceMailbox(e.Payload.Address)
}

// ParsePresenceEnvelope authenticates nothing and consults no clock.
func ParsePresenceEnvelope(source []byte) PresenceParseResult {
	if len(source) > MaxPresenceEnvelopeBytes {
		return PresenceParseResult{Status: "invalid", Reason: "too_large"}
	}
	parsed := ParseInteractionEnvelope(source)
	if parsed.Status != "valid" {
		return PresenceParseResult{Status: parsed.Status, Version: parsed.Version, Reason: parsed.Reason, Source: parsed.Source}
	}
	e := parsed.Envelope
	if e["protocol"] == PresenceProtocol && e["protocol_version"] != float64(1) {
		return PresenceParseResult{Status: "unsupported", Version: int64(e["protocol_version"].(float64)), Source: parsed.Source}
	}
	invalid := PresenceParseResult{Status: "invalid", Reason: "invalid_presence"}
	if len(e) != 9 {
		return invalid
	}
	payload, ok := e["payload"].(map[string]any)
	if !ok || len(payload) != 3 {
		return invalid
	}
	for _, key := range []string{"nonce", "issued_at", "address"} {
		if _, ok := payload[key]; !ok {
			return invalid
		}
	}
	var envelope PresenceEnvelope
	normalized, err := json.Marshal(e)
	if err != nil || json.Unmarshal(normalized, &envelope) != nil || !presenceShape(envelope) {
		return invalid
	}
	return PresenceParseResult{Status: "valid", Envelope: &envelope, Source: parsed.Source}
}
func ParsePresenceEnvelopeString(source string) PresenceParseResult {
	return ParsePresenceEnvelope([]byte(source))
}
func presenceContext(input PresenceProbeInput) (string, string, error) {
	if len(input.AccountScope) == 0 || len(input.AccountScope) > 256 {
		return "", "", fmt.Errorf("invalid account scope")
	}
	for _, c := range input.AccountScope {
		if c < 32 || c > 126 {
			return "", "", fmt.Errorf("invalid account scope")
		}
	}
	for _, value := range []string{input.From, input.To} {
		for _, c := range value {
			if c < 33 || c > 126 {
				return "", "", fmt.Errorf("use one bare ASCII mailbox per address")
			}
		}
	}
	from, to := strings.ToLower(input.From), strings.ToLower(input.To)
	if !presenceMailbox(from) || !presenceMailbox(to) {
		return "", "", fmt.Errorf("use one bare ASCII mailbox per address")
	}
	return from, to, nil
}
func presenceNewUUID(dependencies PresenceDependencies) (string, error) {
	if dependencies.UUID == nil {
		return "", fmt.Errorf("UUID callback required")
	}
	value := strings.ToLower(dependencies.UUID())
	if !presenceUUID.MatchString(value) {
		return "", fmt.Errorf("invalid UUID")
	}
	return value, nil
}
func presenceMessageID(value string) (string, error) {
	if len(value) > 1024 {
		return "", fmt.Errorf("invalid Message-ID")
	}
	return signalMessageID(value)
}
func preparePresence(input PresenceProbeInput, e PresenceEnvelope, observed int64, target string, references []string) (PresencePreparation, error) {
	var zero PresencePreparation
	from, to, err := presenceContext(input)
	if err != nil {
		return zero, err
	}
	encoded, err := signalJSON(e)
	if err != nil {
		return zero, err
	}
	text, subject := PresenceProbeText, PresenceProbeSubject
	if e.Step == "alive" {
		text, subject = PresenceAliveText, PresenceAliveSubject
	}
	if len(encoded) > MaxPresenceEnvelopeBytes || len(encoded)+len(text) > MaxPresenceDecodedBytes {
		return zero, fmt.Errorf("presence content too large")
	}
	attachment := base64.StdEncoding.EncodeToString([]byte(encoded))
	budget := 4096 + len(from) + len(to) + len(attachment) + ((len(attachment)+75)/76)*2 + len(text) + len(target) + len(strings.Join(references, " "))
	if budget > MaxPresenceRenderedBytes {
		return zero, fmt.Errorf("presence carrier too large")
	}
	body := struct {
		From        string   `json:"from"`
		To          string   `json:"to"`
		Subject     string   `json:"subject"`
		BodyText    string   `json:"body_text"`
		InReplyTo   string   `json:"in_reply_to,omitempty"`
		References  []string `json:"references,omitempty"`
		Attachments []struct {
			Filename      string `json:"filename"`
			ContentType   string `json:"content_type"`
			ContentBase64 string `json:"content_base64"`
		} `json:"attachments"`
	}{From: from, To: to, Subject: subject, BodyText: text, InReplyTo: target, References: references}
	body.Attachments = append(body.Attachments, struct {
		Filename      string `json:"filename"`
		ContentType   string `json:"content_type"`
		ContentBase64 string `json:"content_base64"`
	}{"interaction.json", "application/json", attachment})
	request, err := signalJSON(body)
	if err != nil {
		return zero, err
	}
	expiry, _ := presenceTimestamp(e.ExpiresAt)
	return PresencePreparation{Status: "prepared", Prepared: &PreparedPresence{input.AccountScope, observed, expiry, "presence-" + e.StepID, request}}, nil
}

// PreparePresenceProbeEmail creates one fixed ordinary send body without IO.
func PreparePresenceProbeEmail(input PresenceProbeInput, dependencies PresenceProbeDependencies) (PresencePreparation, error) {
	var zero PresencePreparation
	from, to, err := presenceContext(input)
	if err != nil {
		return zero, err
	}
	if dependencies.Now == nil || dependencies.Nonce == nil {
		return zero, fmt.Errorf("clock and nonce callbacks required")
	}
	observed := dependencies.Now()
	if !signalMilliseconds(observed) || !signalMilliseconds(observed+PresenceTTLMS) {
		return zero, fmt.Errorf("invalid clock")
	}
	interaction, err := presenceNewUUID(dependencies.PresenceDependencies)
	if err != nil {
		return zero, err
	}
	step, err := presenceNewUUID(dependencies.PresenceDependencies)
	if err != nil {
		return zero, err
	}
	nonce := dependencies.Nonce()
	if interaction == step {
		return zero, fmt.Errorf("distinct UUIDs are required")
	}
	if !presenceNonce.MatchString(nonce) {
		return zero, fmt.Errorf("nonce must be 128 or 256 bits of lowercase hex")
	}
	e := PresenceEnvelope{1, interaction + "@" + strings.Split(from, "@")[1], PresenceProtocol, 1, "probe", step, nil, time.UnixMilli(observed + PresenceTTLMS).UTC().Format("2006-01-02T15:04:05.000Z"), PresencePayload{nonce, time.UnixMilli(observed).UTC().Format("2006-01-02T15:04:05.000Z"), to}}
	return preparePresence(input, e, observed, "", nil)
}

// PreparePresenceAliveEmail requires caller-verified origin, binding and server freshness.
func PreparePresenceAliveEmail(input PresenceAliveInput, dependencies PresenceDependencies) (PresencePreparation, error) {
	var zero PresencePreparation
	if input.MessageID == nil || *input.MessageID == "" {
		return PresencePreparation{Status: "waiting_on_parent"}, nil
	}
	target, err := presenceMessageID(*input.MessageID)
	if err != nil {
		return zero, err
	}
	from, _, err := presenceContext(input.PresenceProbeInput)
	if err != nil {
		return zero, err
	}
	probe := input.Probe
	if !presenceShape(probe) || probe.Step != "probe" {
		return zero, fmt.Errorf("a valid probe is required")
	}
	if from != probe.Payload.Address {
		return zero, fmt.Errorf("probe recipient mismatch")
	}
	if len(input.References) > 1000 {
		return zero, fmt.Errorf("too many references")
	}
	refs := make([]string, 0, len(input.References)+1)
	for _, value := range input.References {
		ref, err := presenceMessageID(value)
		if err != nil {
			return zero, err
		}
		if ref != target {
			refs = append(refs, ref)
		}
	}
	refs = append(refs, target)
	for len(refs) > 100 || len(strings.Join(refs, " ")) > 8192 {
		refs = refs[1:]
	}
	if dependencies.Now == nil {
		return zero, fmt.Errorf("clock required")
	}
	observed := dependencies.Now()
	if !signalMilliseconds(observed) {
		return zero, fmt.Errorf("invalid clock")
	}
	step, err := presenceNewUUID(dependencies)
	if err != nil {
		return zero, err
	}
	if step == probe.StepID || step == strings.Split(probe.InteractionID, "@")[0] {
		return zero, fmt.Errorf("distinct UUIDs are required")
	}
	previous := probe.StepID
	probe.Step = "alive"
	probe.StepID = step
	probe.PrevStepID = &previous
	return preparePresence(input.PresenceProbeInput, probe, observed, target, refs)
}
