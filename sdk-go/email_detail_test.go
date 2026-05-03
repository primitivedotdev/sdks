package primitive

import (
	"encoding/json"
	"testing"

	primitiveapi "github.com/primitivedotdev/sdks/sdk-go/api"
)

// Round-trip pin for the new EmailDetail fields (replies,
// from_known_address, body_text, body_html). A future regen that
// drops one of these fields silently breaks the SDK contract; this
// test fails loudly when that happens.

const emailDetailSampleJSON = `{
  "id": "00000000-0000-0000-0000-000000000001",
  "message_id": "<msg@example.com>",
  "domain_id": "11111111-1111-1111-1111-111111111111",
  "org_id": "22222222-2222-2222-2222-222222222222",
  "sender": "alice@example.com",
  "recipient": "support@example.com",
  "subject": "Hello",
  "body_text": "Hi there",
  "body_html": "<p>Hi there</p>",
  "status": "completed",
  "domain": "example.com",
  "spam_score": 0,
  "raw_size_bytes": 1234,
  "raw_sha256": "abc",
  "created_at": "2026-05-03T00:00:00Z",
  "received_at": "2026-05-03T00:00:00Z",
  "rejection_reason": null,
  "webhook_status": "fired",
  "webhook_attempt_count": 1,
  "webhook_last_attempt_at": null,
  "webhook_last_status_code": 200,
  "webhook_last_error": null,
  "webhook_fired_at": "2026-05-03T00:00:00Z",
  "smtp_helo": "mail.example.com",
  "smtp_mail_from": "alice@example.com",
  "smtp_rcpt_to": ["support@example.com"],
  "from_header": "Alice <alice@example.com>",
  "content_discarded_at": null,
  "content_discarded_by_delivery_id": null,
  "from_email": "alice@example.com",
  "to_email": "support@example.com",
  "from_known_address": true,
  "replies": [
    {
      "id": "33333333-3333-3333-3333-333333333333",
      "status": "submitted_to_agent",
      "to_address": "alice@example.com",
      "subject": "Re: Hello",
      "created_at": "2026-05-03T00:00:01Z",
      "queue_id": null
    }
  ]
}`

func TestEmailDetailUnmarshalsBodyTextAndBodyHTML(t *testing.T) {
	var detail primitiveapi.EmailDetail
	if err := json.Unmarshal([]byte(emailDetailSampleJSON), &detail); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	bodyText, ok := detail.BodyText.Get()
	if !ok || bodyText != "Hi there" {
		t.Errorf("body_text: got (%q, %v), want (\"Hi there\", true)", bodyText, ok)
	}
	bodyHTML, ok := detail.BodyHTML.Get()
	if !ok || bodyHTML != "<p>Hi there</p>" {
		t.Errorf("body_html: got (%q, %v), want (\"<p>Hi there</p>\", true)", bodyHTML, ok)
	}
}

func TestEmailDetailUnmarshalsFromKnownAddress(t *testing.T) {
	var detail primitiveapi.EmailDetail
	if err := json.Unmarshal([]byte(emailDetailSampleJSON), &detail); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	got, ok := detail.FromKnownAddress.Get()
	if !ok || got != true {
		t.Errorf("from_known_address: got (%v, %v), want (true, true)", got, ok)
	}
}

func TestEmailDetailUnmarshalsRepliesArray(t *testing.T) {
	var detail primitiveapi.EmailDetail
	if err := json.Unmarshal([]byte(emailDetailSampleJSON), &detail); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if len(detail.Replies) != 1 {
		t.Fatalf("replies: got %d, want 1", len(detail.Replies))
	}
	reply := detail.Replies[0]
	if reply.ID.String() != "33333333-3333-3333-3333-333333333333" {
		t.Errorf("reply id: got %q", reply.ID.String())
	}
	subject, ok := reply.Subject.Get()
	if !ok || subject != "Re: Hello" {
		t.Errorf("reply subject: got (%q, %v)", subject, ok)
	}
}
