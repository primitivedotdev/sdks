package primitive

import (
	"context"
	"strings"
	"testing"

	"github.com/google/uuid"
	primitiveapi "github.com/primitivedotdev/sdks/sdk-go/api"
)

type stubSendAPI struct {
	called  bool
	request *primitiveapi.SendInput
	result  primitiveapi.SendEmailRes
	err     error
}

func (s *stubSendAPI) SendEmail(_ context.Context, request *primitiveapi.SendInput) (primitiveapi.SendEmailRes, error) {
	s.called = true
	s.request = request
	return s.result, s.err
}

func receivedEmailFixture() *ReceivedEmail {
	subject := "Hello"
	date := "Tue, 01 Jan 2026 00:00:00 +0000"
	messageID := "<parent@example.com>"
	return &ReceivedEmail{
		ID:             "email-1",
		EventID:        "evt-1",
		ReceivedAt:     "2026-01-01T00:00:00.000Z",
		Sender:         ReceivedEmailAddress{Address: "alice@example.com", Name: "Alice"},
		ReplyTarget:    ReceivedEmailAddress{Address: "alice@example.com", Name: "Alice"},
		ReceivedBy:     "support@example.com",
		ReceivedByAll:  []string{"support@example.com"},
		Subject:        subject,
		ReplySubject:   "Re: Hello",
		ForwardSubject: "Fwd: Hello",
		Text:           "Hi there",
		Thread: ReceivedEmailThread{
			MessageID:  messageID,
			InReplyTo:  []string{},
			References: []string{"<root@example.com>"},
		},
		Raw: EmailReceivedEvent{
			ID: "evt-1",
			Email: Email{
				Headers: EmailHeaders{To: "support@example.com", Subject: &subject, Date: &date, MessageID: &messageID},
			},
		},
	}
}

func TestClientSendValidatesRecipientBeforeRequest(t *testing.T) {
	stub := &stubSendAPI{}
	client := NewClientFromAPI(stub)

	_, err := client.Send(context.Background(), SendParams{
		From:    "support@example.com",
		To:      "not-an-email",
		Subject: "Hello",
		Text:    "Hi",
	})
	if err == nil || err.Error() != "to must be a valid email address" {
		t.Fatalf("unexpected error: %v", err)
	}
	if stub.called {
		t.Fatal("SendEmail should not be called for invalid input")
	}
}

func TestClientSendReturnsSendResult(t *testing.T) {
	messageID := uuid.MustParse("00000000-0000-0000-0000-000000000001")
	stub := &stubSendAPI{
		result: &primitiveapi.SendEmailOK{
			Success: true,
			Data: primitiveapi.SendResult{
				ID:               messageID,
				Status:           primitiveapi.SendResultStatusAccepted,
				SMTPCode:         primitiveapi.NewNilInt(250),
				SMTPMessage:      primitiveapi.NewNilString("queued"),
				RemoteHost:       primitiveapi.NewNilString("mx.example.net"),
				ServiceMessageID: primitiveapi.NewNilString("svc-123"),
			},
		},
	}
	client := NewClientFromAPI(stub)

	result, err := client.Send(context.Background(), SendParams{
		From:    "support@example.com",
		To:      "alice@example.com",
		Subject: "Hello",
		Text:    "Hi there",
	})
	if err != nil {
		t.Fatalf("Send returned error: %v", err)
	}
	if !stub.called || stub.request == nil {
		t.Fatal("SendEmail was not called")
	}
	if stub.request.From != "support@example.com" || stub.request.To != "alice@example.com" || stub.request.Text != "Hi there" {
		t.Fatalf("unexpected request payload: %#v", stub.request)
	}
	if result.ID != messageID {
		t.Fatalf("unexpected result ID: %v", result.ID)
	}
	if result.Status != primitiveapi.SendResultStatusAccepted {
		t.Fatalf("unexpected result status: %v", result.Status)
	}
}

func TestClientReplyBuildsThreadedSend(t *testing.T) {
	stub := &stubSendAPI{
		result: &primitiveapi.SendEmailOK{Success: true, Data: primitiveapi.SendResult{}},
	}
	client := NewClientFromAPI(stub)

	_, err := client.Reply(context.Background(), receivedEmailFixture(), ReplyParams{Text: "Thanks"})
	if err != nil {
		t.Fatalf("Reply returned error: %v", err)
	}
	if stub.request == nil {
		t.Fatal("SendEmail was not called")
	}
	if stub.request.From != "support@example.com" || stub.request.To != "alice@example.com" {
		t.Fatalf("unexpected request payload: %#v", stub.request)
	}
	if stub.request.Subject != "Re: Hello" || stub.request.Text != "Thanks" {
		t.Fatalf("unexpected reply request: %#v", stub.request)
	}
	if value, ok := stub.request.InReplyTo.Get(); !ok || value != "<parent@example.com>" {
		t.Fatalf("unexpected in_reply_to: %#v", stub.request.InReplyTo)
	}
	if len(stub.request.References) != 2 {
		t.Fatalf("unexpected references: %#v", stub.request.References)
	}
}

func TestClientForwardBuildsSend(t *testing.T) {
	stub := &stubSendAPI{
		result: &primitiveapi.SendEmailOK{Success: true, Data: primitiveapi.SendResult{}},
	}
	client := NewClientFromAPI(stub)

	_, err := client.Forward(context.Background(), receivedEmailFixture(), ForwardParams{
		To:   "ops@example.com",
		Text: "Can you take this one?",
	})
	if err != nil {
		t.Fatalf("Forward returned error: %v", err)
	}
	if stub.request == nil {
		t.Fatal("SendEmail was not called")
	}
	if stub.request.From != "support@example.com" || stub.request.To != "ops@example.com" {
		t.Fatalf("unexpected request payload: %#v", stub.request)
	}
	if stub.request.Subject != "Fwd: Hello" {
		t.Fatalf("unexpected forward subject: %q", stub.request.Subject)
	}
	if !strings.Contains(stub.request.Text, "---------- Forwarded message ----------") {
		t.Fatalf("unexpected forward body: %q", stub.request.Text)
	}
}

func TestClientSendWrapsAPIErrors(t *testing.T) {
	stub := &stubSendAPI{
		result: &primitiveapi.SendEmailBadRequest{
			Success: false,
			Error: primitiveapi.ErrorResponseError{
				Code:    primitiveapi.ErrorResponseErrorCodeValidationError,
				Message: "We haven't received an authenticated email from this address yet",
			},
		},
	}
	client := NewClientFromAPI(stub)

	_, err := client.Send(context.Background(), SendParams{
		From:    "support@example.com",
		To:      "alice@example.com",
		Subject: "Hello",
		Text:    "Hi there",
	})
	if err == nil {
		t.Fatal("expected error")
	}
	apiErr, ok := err.(*APIError)
	if !ok {
		t.Fatalf("expected APIError, got %T", err)
	}
	if apiErr.StatusCode != 400 || apiErr.Code != "validation_error" {
		t.Fatalf("unexpected API error: %#v", apiErr)
	}
	if apiErr.Message != "We haven't received an authenticated email from this address yet" {
		t.Fatalf("unexpected error message: %q", apiErr.Message)
	}
}
