package primitive

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"
	api "github.com/primitivedotdev/sdks/sdk-go/v2/api"
)

const (
	conversationFirstCursor = "2026-10-03T12:00:00.000000Z|12345"
	conversationNextCursor  = "2026-10-03T12:05:00.000000Z|12391"
	conversationInbound     = `{"role":"user","direction":"inbound","id":"11111111-1111-4111-8111-111111111111","message_id":"<in@example.test>","from":"alice@example.test","to":"agent@example.test","subject":"Plan","text":"hello","timestamp":"2026-10-03T11:59:00Z"}`
)

func conversationOutbound(status string) string {
	return `{"role":"assistant","direction":"outbound","id":"22222222-2222-4222-8222-222222222222","message_id":"<out@example.test>","from":"agent@example.test","to":"alice@example.test","subject":"Re: Plan","text":"on it","timestamp":"2026-10-03T11:59:30Z","status":"` + status + `"}`
}

func conversationBody(messages, cursor string) string {
	tail := ""
	if cursor != "" {
		tail = `,"cursor":"` + cursor + `"`
	}
	return `{"success":true,"data":{"thread_id":"33333333-3333-4333-8333-333333333333","subject":"Plan","message_count":2,"truncated":false,"messages":[` + messages + `]` + tail + `}}`
}

func TestConversationSinceSendsCursorBackVerbatim(t *testing.T) {
	emailID := uuid.MustParse("11111111-1111-4111-8111-111111111111")
	bodies := []string{
		conversationBody(conversationInbound+","+conversationOutbound("queued"), conversationFirstCursor),
		conversationBody(conversationOutbound("delivered"), conversationNextCursor),
	}
	var requests []*http.Request
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests = append(requests, r)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(bodies[len(requests)-1]))
	}))
	defer server.Close()
	client, err := api.NewClient(server.URL, attachmentPartSecurity{})
	if err != nil {
		t.Fatal(err)
	}

	res, err := client.GetConversation(context.Background(), api.GetConversationParams{ID: emailID, Since: api.NewOptString("start")})
	if err != nil {
		t.Fatal(err)
	}
	first, ok := res.(*api.GetConversationOK)
	if !ok {
		t.Fatalf("Unexpected response %T", res)
	}
	if got := requests[0].URL.Path; got != "/emails/"+emailID.String()+"/conversation" {
		t.Fatalf("Unexpected path %q", got)
	}
	if got := requests[0].URL.Query().Get("since"); got != "start" {
		t.Fatalf("Unexpected since %q", got)
	}
	cursor, present := first.Data.Cursor.Get()
	if !present || cursor != conversationFirstCursor {
		t.Fatalf("Unexpected cursor %q, present=%v", cursor, present)
	}
	if _, present := first.Data.Messages[0].Status.Get(); present {
		t.Fatal("Inbound message carried a status")
	}
	if status, _ := first.Data.Messages[1].Status.Get(); status != api.SentEmailStatusQueued {
		t.Fatalf("Unexpected status %q", status)
	}

	res, err = client.GetConversation(context.Background(), api.GetConversationParams{ID: emailID, Since: api.NewOptString(cursor)})
	if err != nil {
		t.Fatal(err)
	}
	next, ok := res.(*api.GetConversationOK)
	if !ok {
		t.Fatalf("Unexpected response %T", res)
	}
	if len(requests) != 2 {
		t.Fatalf("Expected 2 requests, got %d", len(requests))
	}
	if got := requests[1].URL.Query().Get("since"); got != conversationFirstCursor {
		t.Fatalf("Cursor not sent verbatim: %q", got)
	}
	if got, _ := next.Data.Cursor.Get(); got != conversationNextCursor {
		t.Fatalf("Unexpected next cursor %q", got)
	}
	// Thread fields describe the whole conversation, not the delta.
	if next.Data.MessageCount != 2 || len(next.Data.Messages) != 1 {
		t.Fatalf("Unexpected delta shape: count=%d messages=%d", next.Data.MessageCount, len(next.Data.Messages))
	}
	message := next.Data.Messages[0]
	if message.Direction != api.ConversationMessageDirectionOutbound || message.ID.String() != "22222222-2222-4222-8222-222222222222" {
		t.Fatalf("Unexpected message %+v", message)
	}
	if status, _ := message.Status.Get(); status != api.SentEmailStatusDelivered {
		t.Fatalf("Unexpected status %q", status)
	}
}

func TestConversationWithoutSinceSendsNoParameter(t *testing.T) {
	var query string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		query = r.URL.RawQuery
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(conversationBody(conversationInbound, "")))
	}))
	defer server.Close()
	client, err := api.NewClient(server.URL, attachmentPartSecurity{})
	if err != nil {
		t.Fatal(err)
	}
	res, err := client.GetConversation(context.Background(), api.GetConversationParams{ID: uuid.MustParse("11111111-1111-4111-8111-111111111111")})
	if err != nil {
		t.Fatal(err)
	}
	ok, isOK := res.(*api.GetConversationOK)
	if !isOK {
		t.Fatalf("Unexpected response %T", res)
	}
	if query != "" {
		t.Fatalf("Unexpected query %q", query)
	}
	if _, present := ok.Data.Cursor.Get(); present {
		t.Fatal("Cursor present on a read without since")
	}
}
