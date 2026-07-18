package primitive

import (
	"encoding/json"
	"errors"
	"testing"
)

const eventsTestSecret = "whsec_test_secret_for_events"

func TestParsePaymentSettledFromHeader(t *testing.T) {
	// The stored payment body is FLAT and carries the name in "type", not
	// "event": challenge_id/network/amount/asset/payer_org plus settle_tx, with
	// no id and no nested payment object.
	body := map[string]any{
		"type":         "payment.settled",
		"challenge_id": "chl_1",
		"network":      "base-sepolia",
		"amount":       "10000",
		"asset":        "0xToken",
		"payer_org":    "org_1",
		"settle_tx":    "0xdeadbeef",
	}

	event, err := ParseWebhookEvent(body, "payment.settled")
	if err != nil {
		t.Fatalf("ParseWebhookEvent returned error: %v", err)
	}
	if !IsPaymentSettledEvent(event) {
		t.Fatalf("expected payment.settled, got %q", event.GetEvent())
	}
	if IsPaymentFailedEvent(event) {
		t.Fatalf("did not expect payment.failed")
	}
	payment, ok := event.(PaymentEvent)
	if !ok {
		t.Fatalf("expected PaymentEvent, got %T", event)
	}
	if payment.Type != "payment.settled" {
		t.Fatalf("expected Type payment.settled, got %q", payment.Type)
	}
	if payment.ChallengeID != "chl_1" {
		t.Fatalf("expected ChallengeID chl_1, got %q", payment.ChallengeID)
	}
	if payment.Amount != "10000" {
		t.Fatalf("expected Amount 10000, got %q", payment.Amount)
	}
	if payment.Network != "base-sepolia" {
		t.Fatalf("expected Network base-sepolia, got %q", payment.Network)
	}
	if payment.Asset != "0xToken" {
		t.Fatalf("expected Asset 0xToken, got %q", payment.Asset)
	}
	if payment.PayerOrg == nil || *payment.PayerOrg != "org_1" {
		t.Fatalf("expected PayerOrg org_1")
	}
	if payment.SettleTx != "0xdeadbeef" {
		t.Fatalf("expected SettleTx 0xdeadbeef, got %q", payment.SettleTx)
	}
}

func TestParsePaymentAmountJSONNumber(t *testing.T) {
	body := []byte(`{"type":"payment.settled","challenge_id":"chl_1","network":"base-sepolia","amount":9007199254740993,"asset":"0xToken","payer_org":"org_1","settle_tx":"0xdeadbeef"}`)

	event, err := ParseWebhookEvent(body, "payment.settled")
	if err != nil {
		t.Fatalf("ParseWebhookEvent returned error: %v", err)
	}
	payment, ok := event.(PaymentEvent)
	if !ok {
		t.Fatalf("expected PaymentEvent, got %T", event)
	}
	if payment.Amount != "9007199254740993" {
		t.Fatalf("expected Amount 9007199254740993, got %q", payment.Amount)
	}
	payloadAmount, ok := payment.Payload["amount"].(json.Number)
	if !ok {
		t.Fatalf("expected payload amount json.Number, got %T", payment.Payload["amount"])
	}
	if payloadAmount.String() != "9007199254740993" {
		t.Fatalf("expected payload amount 9007199254740993, got %q", payloadAmount.String())
	}
}

func TestParsePaymentFailedFromHeader(t *testing.T) {
	// payment.failed carries failure_reason (and no settle_tx), payer_org null.
	body := map[string]any{
		"type":           "payment.failed",
		"challenge_id":   "chl_2",
		"network":        "base",
		"amount":         "250",
		"asset":          "0xToken",
		"payer_org":      nil,
		"failure_reason": "insufficient funds",
	}

	event, err := ParseWebhookEvent(body, "payment.failed")
	if err != nil {
		t.Fatalf("ParseWebhookEvent returned error: %v", err)
	}
	if !IsPaymentFailedEvent(event) {
		t.Fatalf("expected payment.failed, got %q", event.GetEvent())
	}
	payment, ok := event.(PaymentEvent)
	if !ok {
		t.Fatalf("expected PaymentEvent, got %T", event)
	}
	if payment.ChallengeID != "chl_2" {
		t.Fatalf("expected ChallengeID chl_2, got %q", payment.ChallengeID)
	}
	if payment.FailureReason != "insufficient funds" {
		t.Fatalf("expected FailureReason, got %q", payment.FailureReason)
	}
	if payment.PayerOrg != nil {
		t.Fatalf("expected nil PayerOrg for null payer_org, got %q", *payment.PayerOrg)
	}
	if payment.SettleTx != "" {
		t.Fatalf("expected empty SettleTx on failed, got %q", payment.SettleTx)
	}
}

func TestParseInteractionX402SettledFromHeader(t *testing.T) {
	// Interaction bodies have no event/type field at all.
	body := map[string]any{"interaction": map[string]any{"protocol": "x402", "step": "receipt"}}

	event, err := ParseWebhookEvent(body, "interaction.x402.settled")
	if err != nil {
		t.Fatalf("ParseWebhookEvent returned error: %v", err)
	}
	if !IsInteractionX402Event(event) {
		t.Fatalf("expected interaction.x402.*, got %q", event.GetEvent())
	}
	if _, ok := event.(InteractionEvent); !ok {
		t.Fatalf("expected InteractionEvent, got %T", event)
	}
}

func TestParseUnknownHeaderTypeReturnsUnknownEvent(t *testing.T) {
	event, err := ParseWebhookEvent(map[string]any{"foo": "bar"}, "payment.refunded")
	if err != nil {
		t.Fatalf("ParseWebhookEvent returned error: %v", err)
	}
	if _, ok := event.(UnknownEvent); !ok {
		t.Fatalf("expected UnknownEvent, got %T", event)
	}
	if event.GetEvent() != "payment.refunded" {
		t.Fatalf("expected payment.refunded, got %q", event.GetEvent())
	}
}

func TestParseFallsBackToBodyEventWhenNoHeader(t *testing.T) {
	event, err := ParseWebhookEvent(map[string]any{"event": "payment.failed", "id": "pay_2"})
	if err != nil {
		t.Fatalf("ParseWebhookEvent returned error: %v", err)
	}
	if !IsPaymentFailedEvent(event) {
		t.Fatalf("expected payment.failed, got %q", event.GetEvent())
	}
}

func TestWebhookEventTypesCatalog(t *testing.T) {
	for _, want := range []string{
		"payment.settled",
		"payment.failed",
		"interaction.x402.settled",
		"interaction.x402.verify_timeout",
		"interaction.ack.acked",
		"email.received",
	} {
		if !IsKnownWebhookEventType(want) {
			t.Fatalf("catalog missing %q", want)
		}
	}
}

func TestEventTypeGuards(t *testing.T) {
	if !IsPaymentEvent(map[string]any{"event": "payment.settled"}) {
		t.Fatal("expected IsPaymentEvent true for payment.settled")
	}
	if !IsPaymentEvent(map[string]any{"event": "payment.failed"}) {
		t.Fatal("expected IsPaymentEvent true for payment.failed")
	}
	if IsPaymentEvent(map[string]any{"event": "email.received"}) {
		t.Fatal("did not expect IsPaymentEvent for email.received")
	}
	if !IsEmailReceivedEventType(map[string]any{"event": "email.received"}) {
		t.Fatal("expected IsEmailReceivedEventType true")
	}
	if IsEmailReceivedEventType(map[string]any{"event": "payment.settled"}) {
		t.Fatal("did not expect IsEmailReceivedEventType for payment.settled")
	}
	if IsKnownWebhookEventType("payment.refunded") {
		t.Fatal("payment.refunded should not be a known catalog type")
	}
}

func TestParseWebhookEventMissingDiscriminator(t *testing.T) {
	_, err := ParseWebhookEvent(map[string]any{"id": "x"})
	if err == nil {
		t.Fatal("expected PAYLOAD_MISSING_EVENT error")
	}
	var payloadErr *WebhookPayloadError
	if !errors.As(err, &payloadErr) || payloadErr.Code() != "PAYLOAD_MISSING_EVENT" {
		t.Fatalf("expected PAYLOAD_MISSING_EVENT, got %v", err)
	}
}

func TestHandleWebhookEventVerifiesPaymentBody(t *testing.T) {
	body, err := json.Marshal(map[string]any{"type": "payment.settled", "id": "pay_3", "payment": map[string]any{"amount": "250"}})
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	signed, err := SignWebhookPayload(body, eventsTestSecret)
	if err != nil {
		t.Fatalf("SignWebhookPayload returned error: %v", err)
	}
	event, err := HandleWebhookEvent(HandleWebhookOptions{
		Body: body,
		Headers: map[string]string{
			"primitive-signature": signed.Header,
			"x-webhook-event":     "payment.settled",
		},
		Secret: eventsTestSecret,
	})
	if err != nil {
		t.Fatalf("HandleWebhookEvent returned error: %v", err)
	}
	if !IsPaymentSettledEvent(event) {
		t.Fatalf("expected payment.settled, got %q", event.GetEvent())
	}
}

func TestHandleWebhookEventVerifiesInteractionBody(t *testing.T) {
	body, err := json.Marshal(map[string]any{"interaction": map[string]any{"protocol": "x402"}})
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	signed, err := SignWebhookPayload(body, eventsTestSecret)
	if err != nil {
		t.Fatalf("SignWebhookPayload returned error: %v", err)
	}
	event, err := HandleWebhookEvent(HandleWebhookOptions{
		Body: body,
		Headers: map[string]string{
			"primitive-signature": signed.Header,
			"x-webhook-event":     "interaction.x402.settled",
		},
		Secret: eventsTestSecret,
	})
	if err != nil {
		t.Fatalf("HandleWebhookEvent returned error: %v", err)
	}
	if !IsInteractionX402Event(event) {
		t.Fatalf("expected interaction.x402.*, got %q", event.GetEvent())
	}
}
