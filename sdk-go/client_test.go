package primitive

import (
	"context"
	"strings"
	"testing"

	primitiveapi "github.com/primitivedotdev/sdks/sdk-go/api"
)

type stubSendAPI struct {
	called  bool
	request *primitiveapi.SendMailInput
	params  primitiveapi.SendEmailParams
	result  primitiveapi.SendEmailRes
	err     error
}

func (s *stubSendAPI) SendEmail(_ context.Context, request *primitiveapi.SendMailInput, params primitiveapi.SendEmailParams) (primitiveapi.SendEmailRes, error) {
	s.called = true
	s.request = request
	s.params = params
	return s.result, s.err
}

func sendMailResult() primitiveapi.SendMailResult {
	return primitiveapi.SendMailResult{
		ID:                   "sent-123",
		Status:               primitiveapi.SentEmailStatusSubmittedToAgent,
		QueueID:              primitiveapi.NewNilString("qid-123"),
		Accepted:             []string{"alice@example.com"},
		Rejected:             []string{},
		ClientIdempotencyKey: "idem-123",
		RequestID:            "req-123",
		ContentHash:          "hash-123",
	}
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

func TestNormalizeReceivedEmailRejectsEmptySMTPRecipients(t *testing.T) {
	defer func() {
		recovered := recover()
		if recovered == nil {
			t.Fatal("expected NormalizeReceivedEmail to panic")
		}
		if recovered != "email.smtp.rcpt_to must contain at least one recipient" {
			t.Fatalf("unexpected panic: %v", recovered)
		}
	}()

	NormalizeReceivedEmail(EmailReceivedEvent{
		ID: "evt-1",
		Email: Email{
			ID:         "email-1",
			ReceivedAt: "2026-01-01T00:00:00.000Z",
			SMTP: SMTPEnvelope{
				MailFrom: "bounce@example.com",
				RcptTo:   []string{},
			},
			Headers: EmailHeaders{From: "Alice <alice@example.com>"},
		},
	})
}

func TestClientSendValidatesRecipientBeforeRequest(t *testing.T) {
	stub := &stubSendAPI{}
	client := NewClientFromAPI(stub)

	_, err := client.Send(context.Background(), SendParams{
		From:     "support@example.com",
		To:       "not-an-email",
		Subject:  "Hello",
		BodyText: "Hi",
	})
	if err == nil || err.Error() != "to must be a valid email address" {
		t.Fatalf("unexpected error: %v", err)
	}
	if stub.called {
		t.Fatal("SendEmail should not be called for invalid input")
	}
}

func TestClientSendReturnsSendResult(t *testing.T) {
	stub := &stubSendAPI{
		result: &primitiveapi.SendEmailOK{
			Success: true,
			Data:    sendMailResult(),
		},
	}
	client := NewClientFromAPI(stub)

	result, err := client.Send(context.Background(), SendParams{
		From:     "support@example.com",
		To:       "alice@example.com",
		Subject:  "Hello",
		BodyText: "Hi there",
	})
	if err != nil {
		t.Fatalf("Send returned error: %v", err)
	}
	if !stub.called || stub.request == nil {
		t.Fatal("SendEmail was not called")
	}
	if bodyText, ok := stub.request.BodyText.Get(); stub.request.From != "support@example.com" || stub.request.To != "alice@example.com" || !ok || bodyText != "Hi there" {
		t.Fatalf("unexpected request payload: %#v", stub.request)
	}
	if queueID, ok := result.QueueID.Get(); !ok || queueID != "qid-123" {
		t.Fatalf("unexpected queue ID: %#v", result.QueueID)
	}
	if result.ID != "sent-123" || result.Status != primitiveapi.SentEmailStatusSubmittedToAgent || result.ClientIdempotencyKey != "idem-123" || result.RequestID != "req-123" || result.ContentHash != "hash-123" {
		t.Fatalf("unexpected result metadata: %#v", result)
	}
	if len(result.Accepted) != 1 || result.Accepted[0] != "alice@example.com" || len(result.Rejected) != 0 {
		t.Fatalf("unexpected result recipients: %#v", result)
	}
}

func TestClientSendAcceptsDisplayNameFrom(t *testing.T) {
	stub := &stubSendAPI{result: &primitiveapi.SendEmailOK{Success: true, Data: sendMailResult()}}
	client := NewClientFromAPI(stub)

	_, err := client.Send(context.Background(), SendParams{
		From:     "Support Team <support@example.com>",
		To:       "alice@example.com",
		Subject:  "Hello",
		BodyText: "Hi there",
	})
	if err != nil {
		t.Fatalf("Send returned error: %v", err)
	}
	if stub.request.From != "Support Team <support@example.com>" {
		t.Fatalf("unexpected from: %q", stub.request.From)
	}
}

func TestClientSendPassesWaitOptionsAndIdempotencyKey(t *testing.T) {
	data := sendMailResult()
	data.Status = primitiveapi.SentEmailStatusDelivered
	data.DeliveryStatus = primitiveapi.NewOptDeliveryStatus(primitiveapi.DeliveryStatusDelivered)
	data.SMTPResponseCode = primitiveapi.NewOptNilInt(250)
	data.SMTPResponseText = primitiveapi.NewOptString("250 OK")
	stub := &stubSendAPI{result: &primitiveapi.SendEmailOK{Success: true, Data: data}}
	client := NewClientFromAPI(stub)
	wait := true

	result, err := client.Send(context.Background(), SendParams{
		From:           "support@example.com",
		To:             "alice@example.com",
		Subject:        "Hello",
		BodyText:       "Hi there",
		Wait:           &wait,
		WaitTimeoutMs:  5000,
		IdempotencyKey: "customer-key",
	})
	if err != nil {
		t.Fatalf("Send returned error: %v", err)
	}
	if value, ok := stub.request.Wait.Get(); !ok || !value {
		t.Fatalf("unexpected wait: %#v", stub.request.Wait)
	}
	if value, ok := stub.request.WaitTimeoutMs.Get(); !ok || value != 5000 {
		t.Fatalf("unexpected wait timeout: %#v", stub.request.WaitTimeoutMs)
	}
	if value, ok := stub.params.IdempotencyKey.Get(); !ok || value != "customer-key" {
		t.Fatalf("unexpected idempotency key: %#v", stub.params.IdempotencyKey)
	}
	if value, ok := result.DeliveryStatus.Get(); !ok || value != primitiveapi.DeliveryStatusDelivered {
		t.Fatalf("unexpected delivery status: %#v", result.DeliveryStatus)
	}
}

func TestClientReplyBuildsThreadedSend(t *testing.T) {
	stub := &stubSendAPI{
		result: &primitiveapi.SendEmailOK{Success: true, Data: sendMailResult()},
	}
	client := NewClientFromAPI(stub)

	_, err := client.Reply(context.Background(), receivedEmailFixture(), ReplyParams{BodyText: "Thanks"})
	if err != nil {
		t.Fatalf("Reply returned error: %v", err)
	}
	if stub.request == nil {
		t.Fatal("SendEmail was not called")
	}
	if stub.request.From != "support@example.com" || stub.request.To != "alice@example.com" {
		t.Fatalf("unexpected request payload: %#v", stub.request)
	}
	if bodyText, ok := stub.request.BodyText.Get(); stub.request.Subject != "Re: Hello" || !ok || bodyText != "Thanks" {
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
		result: &primitiveapi.SendEmailOK{Success: true, Data: sendMailResult()},
	}
	client := NewClientFromAPI(stub)

	_, err := client.Forward(context.Background(), receivedEmailFixture(), ForwardParams{
		To:       "ops@example.com",
		BodyText: "Can you take this one?",
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
	if bodyText, ok := stub.request.BodyText.Get(); !ok || !strings.Contains(bodyText, "---------- Forwarded message ----------") {
		t.Fatalf("unexpected forward body: %#v", stub.request.BodyText)
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
		From:     "support@example.com",
		To:       "alice@example.com",
		Subject:  "Hello",
		BodyText: "Hi there",
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
