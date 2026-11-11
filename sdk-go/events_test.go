package primitive

import (
	"encoding/json"
	"errors"
	"testing"
)

const eventsTestSecret = "whsec_test_secret_for_events"

func TestParseInteractionAckFromHeader(t *testing.T) {
	// Interaction bodies have no event/type field at all.
	body := map[string]any{"interaction": map[string]any{"protocol": "ack", "step": "ack"}}

	event, err := ParseWebhookEvent(body, "interaction.ack.acked")
	if err != nil {
		t.Fatalf("ParseWebhookEvent returned error: %v", err)
	}
	interaction, ok := event.(InteractionEvent)
	if !ok {
		t.Fatalf("expected InteractionEvent, got %T", event)
	}
	if interaction.GetEvent() != "interaction.ack.acked" {
		t.Fatalf("expected interaction.ack.acked, got %q", interaction.GetEvent())
	}
}

func TestParseUnknownHeaderTypeReturnsUnknownEvent(t *testing.T) {
	event, err := ParseWebhookEvent(map[string]any{"type": "payment.settled", "challenge_id": "chl_1"}, "payment.settled")
	if err != nil {
		t.Fatalf("ParseWebhookEvent returned error: %v", err)
	}
	unknown, ok := event.(UnknownEvent)
	if !ok {
		t.Fatalf("expected UnknownEvent, got %T", event)
	}
	if unknown.GetEvent() != "payment.settled" {
		t.Fatalf("expected payment.settled, got %q", unknown.GetEvent())
	}
	if unknown.Payload["challenge_id"] != "chl_1" {
		t.Fatalf("expected the body preserved, got %v", unknown.Payload)
	}
}

func TestParseFallsBackToBodyEventWhenNoHeader(t *testing.T) {
	event, err := ParseWebhookEvent(map[string]any{"event": "interaction.ack.requested", "id": "evt_2"})
	if err != nil {
		t.Fatalf("ParseWebhookEvent returned error: %v", err)
	}
	if event.GetEvent() != "interaction.ack.requested" {
		t.Fatalf("expected interaction.ack.requested, got %q", event.GetEvent())
	}
}

func TestWebhookEventTypesCatalog(t *testing.T) {
	for _, want := range []string{
		"interaction.ack.acked",
		"email.received",
		"sent_email.delivered",
		"email_rule_request.created",
		"email_rule_request.accepted",
		"email_rule_request.declined",
		"email_rule_request.withdrawn",
	} {
		if !IsKnownWebhookEventType(want) {
			t.Fatalf("catalog missing %q", want)
		}
	}
	for _, gone := range []string{"payment.settled", "payment.failed"} {
		if IsKnownWebhookEventType(gone) {
			t.Fatalf("catalog should no longer list %q", gone)
		}
	}
}

func TestEventTypeGuards(t *testing.T) {
	if !IsEmailReceivedEventType(map[string]any{"event": "email.received"}) {
		t.Fatal("expected IsEmailReceivedEventType true")
	}
	if IsEmailReceivedEventType(map[string]any{"event": "interaction.ack.acked"}) {
		t.Fatal("did not expect IsEmailReceivedEventType for interaction.ack.acked")
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

func TestHandleWebhookEventVerifiesInteractionBody(t *testing.T) {
	body, err := json.Marshal(map[string]any{"interaction": map[string]any{"protocol": "ack"}})
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
			"x-webhook-event":     "interaction.ack.acked",
		},
		Secret: eventsTestSecret,
	})
	if err != nil {
		t.Fatalf("HandleWebhookEvent returned error: %v", err)
	}
	if event.GetEvent() != "interaction.ack.acked" {
		t.Fatalf("expected interaction.ack.acked, got %q", event.GetEvent())
	}
}
