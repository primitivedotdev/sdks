package primitive

import (
	"encoding/json"
	"errors"
	"testing"
)

const eventsTestSecret = "whsec_test_secret_for_events"

func TestParsePaymentSettledFromHeader(t *testing.T) {
	// The stored payment body carries the name in "type", not "event".
	body := map[string]any{"type": "payment.settled", "id": "pay_1", "payment": map[string]any{"amount": "100"}}

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
	if payment.ID == nil || *payment.ID != "pay_1" {
		t.Fatalf("expected ID pay_1")
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
