package primitive

import (
	"regexp"
	"strconv"
	"strings"
	"unicode/utf16"
)

// SignalContentPart describes one member of the full outer attachment inventory.
type SignalContentPart struct {
	Filename    *string `json:"filename"`
	ContentType *string `json:"contentType"`
}
type SignalContentInventory struct {
	// Complete asserts the full outer inventory, including offloaded parts.
	Status string              `json:"status"`
	Parts  []SignalContentPart `json:"parts"`
}
type SignalContentBodies struct {
	Status string  `json:"status"`
	Text   *string `json:"text"`
	HTML   *string `json:"html"`
}
type SignalContentInput struct {
	Inventory SignalContentInventory
	Bodies    SignalContentBodies
	// Nil means unavailable; an empty non-nil slice is a known empty part.
	CanonicalPartBytes []byte
}

// SignalContentResult establishes no sender, receipt or task authority.
type SignalContentResult struct {
	Classification string
	Reason         string
	Interaction    *InteractionResult
}

var signalEnvelopeKeys = []string{"interaction_version", "interaction_id", "protocol", "protocol_version", "step", "step_id", "prev_step_id", "expires_at", "payload"}
var signalExpirySyntax = regexp.MustCompile(`^([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2}):([0-9]{2})(?:\.[0-9]{1,9})?Z$`)

func signalASCIILower(value string) string {
	return strings.Map(func(r rune) rune {
		if r >= 'A' && r <= 'Z' {
			return r + ('a' - 'A')
		}
		return r
	}, value)
}
func signalExactKeys(value map[string]any, required []string, optional ...string) bool {
	allowed := map[string]bool{}
	for _, key := range required {
		if _, ok := value[key]; !ok {
			return false
		}
		allowed[key] = true
	}
	for _, key := range optional {
		allowed[key] = true
	}
	for key := range value {
		if !allowed[key] {
			return false
		}
	}
	return true
}
func signalUTCExpiry(value any) bool {
	text, ok := value.(string)
	if !ok {
		return false
	}
	match := signalExpirySyntax.FindStringSubmatch(text)
	if match == nil {
		return false
	}
	parts := make([]int, 6)
	for i := range parts {
		parts[i], _ = strconv.Atoi(match[i+1])
	}
	year, month, day := parts[0], parts[1], parts[2]
	days := []int{31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31}
	if year%4 == 0 && (year%100 != 0 || year%400 == 0) {
		days[1] = 29
	}
	return year >= 1970 && month >= 1 && month <= 12 && day >= 1 && day <= days[month-1] && parts[3] < 24 && parts[4] < 60 && parts[5] < 60
}
func signalContentFallback(result InteractionResult) (string, bool) {
	if result.Status != "valid" {
		return "", false
	}
	e := result.Envelope
	protocol, _ := e["protocol"].(string)
	iid, _ := e["interaction_id"].(string)
	sid, _ := e["step_id"].(string)
	if !signalExactKeys(e, signalEnvelopeKeys) || e["protocol_version"] != float64(1) || (protocol != "ack" && protocol != "read" && protocol != "working") || e["step"] != protocol || e["prev_step_id"] != nil || strings.EqualFold(strings.Split(iid, "@")[0], sid) {
		return "", false
	}
	if protocol == "working" {
		if !signalUTCExpiry(e["expires_at"]) {
			return "", false
		}
	} else if e["expires_at"] != nil {
		return "", false
	}
	p, ok := e["payload"].(map[string]any)
	if !ok {
		return "", false
	}
	required := []string{"subject_message_id"}
	var optional []string
	if protocol == "ack" {
		required = append(required, "status")
		optional = []string{"note"}
	}
	if !signalExactKeys(p, required, optional...) {
		return "", false
	}
	target, ok := p["subject_message_id"].(string)
	if !ok {
		return "", false
	}
	canonical, err := signalMessageID(target)
	if err != nil || canonical != target {
		return "", false
	}
	if protocol != "ack" {
		return signalText(protocol, "", nil), true
	}
	status, ok := p["status"].(string)
	if !ok || (status != "received" && status != "will_process" && status != "will_not_process") {
		return "", false
	}
	var note *string
	if value, exists := p["note"]; exists {
		text, ok := value.(string)
		if !ok || len(utf16.Encode([]rune(text))) > 2000 || strings.ContainsRune(text, 0) {
			return "", false
		}
		note = &text
	}
	return signalText("ack", status, note), true
}

// ClassifySignalContent is pure. Complete inventory/body projections are caller
// assertions, not evidence of authentication or completeness from this function.
func ClassifySignalContent(input SignalContentInput) SignalContentResult {
	result := func(classification, reason string, interaction *InteractionResult) SignalContentResult {
		return SignalContentResult{classification, reason, interaction}
	}
	if input.Inventory.Status != "complete" || input.Inventory.Parts == nil {
		return result("unavailable", "inventory_unavailable", nil)
	}
	parts := input.Inventory.Parts
	var canonical []SignalContentPart
	for _, part := range parts {
		if part.Filename != nil && signalASCIILower(*part.Filename) == "interaction.json" {
			canonical = append(canonical, part)
		}
	}
	if len(canonical) == 0 {
		return result("plain", "no_canonical_part", nil)
	}
	if len(canonical) != 1 {
		return result("mixed_or_unsupported", "duplicate_canonical_parts", nil)
	}
	var interaction *InteractionResult
	if input.CanonicalPartBytes != nil {
		parsed := ParseInteractionEnvelope(input.CanonicalPartBytes)
		interaction = &parsed
	}
	if len(parts) != 1 {
		return result("mixed_or_unsupported", "additional_parts", interaction)
	}
	if interaction == nil {
		return result("unavailable", "part_unavailable", nil)
	}
	if input.Bodies.Status != "complete" {
		return result("unavailable", "bodies_unavailable", interaction)
	}
	if interaction.Status == "invalid" {
		return result("mixed_or_unsupported", "invalid_interaction", interaction)
	}
	media := canonical[0].ContentType
	if media == nil || signalASCIILower(strings.Trim(strings.Split(*media, ";")[0], " \t")) != "application/json" {
		return result("mixed_or_unsupported", "unsupported_content_type", interaction)
	}
	expected, ok := signalContentFallback(*interaction)
	if !ok {
		return result("mixed_or_unsupported", "unsupported_signal", interaction)
	}
	if input.Bodies.HTML != nil && *input.Bodies.HTML != "" {
		return result("mixed_or_unsupported", "html_present", interaction)
	}
	actual := ""
	if input.Bodies.Text != nil {
		actual = *input.Bodies.Text
	}
	actual = strings.ReplaceAll(actual, "\r\n", "\n")
	expected = strings.ReplaceAll(expected, "\r\n", "\n")
	if actual != "" && actual != "\n" && actual != expected && actual != expected+"\n" {
		return result("mixed_or_unsupported", "text_mismatch", interaction)
	}
	return result("informational_only", "informational_signal", interaction)
}
