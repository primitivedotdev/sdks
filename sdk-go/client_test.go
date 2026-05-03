package primitive

import (
	"context"
	"strings"
	"testing"

	primitiveapi "github.com/primitivedotdev/sdks/sdk-go/api"
)

type stubSendAPI struct {
	called       bool
	request      *primitiveapi.SendMailInput
	params       primitiveapi.SendEmailParams
	result       primitiveapi.SendEmailRes
	err          error
	replyCalled  bool
	replyRequest *primitiveapi.ReplyInput
	replyParams  primitiveapi.ReplyToEmailParams
	replyResult  primitiveapi.ReplyToEmailRes
	replyErr     error
}

func (s *stubSendAPI) SendEmail(_ context.Context, request *primitiveapi.SendMailInput, params primitiveapi.SendEmailParams) (primitiveapi.SendEmailRes, error) {
	s.called = true
	s.request = request
	s.params = params
	return s.result, s.err
}

func (s *stubSendAPI) ReplyToEmail(_ context.Context, request *primitiveapi.ReplyInput, params primitiveapi.ReplyToEmailParams) (primitiveapi.ReplyToEmailRes, error) {
	s.replyCalled = true
	s.replyRequest = request
	s.replyParams = params
	return s.replyResult, s.replyErr
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
		ID:             "00000000-0000-0000-0000-000000000001",
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
	got, err := NormalizeReceivedEmail(EmailReceivedEvent{
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
	if got != nil {
		t.Fatalf("expected nil ReceivedEmail, got %#v", got)
	}
	if err == nil ||
		err.Error() != "email.smtp.rcpt_to must contain at least one recipient" {
		t.Fatalf("unexpected error: %v", err)
	}
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

func TestClientReplyPostsToReplyEndpointWithMinimalBody(t *testing.T) {
	// Reply now forwards to /emails/{id}/reply on the server. The
	// captured request is the small ReplyInput shape; threading,
	// recipients, and the Re: subject are all server-derived. The
	// path id assertion pins which inbound the reply targets.
	stub := &stubSendAPI{
		replyResult: &primitiveapi.ReplyToEmailOK{Success: true, Data: sendMailResult()},
	}
	client := NewClientFromAPI(stub)

	_, err := client.Reply(context.Background(), receivedEmailFixture(), ReplyParams{BodyText: "Thanks"})
	if err != nil {
		t.Fatalf("Reply returned error: %v", err)
	}
	if !stub.replyCalled {
		t.Fatal("ReplyToEmail was not called")
	}
	if stub.replyParams.ID.String() != receivedEmailFixture().ID {
		t.Fatalf("unexpected reply id: %v", stub.replyParams.ID)
	}
	if stub.replyRequest == nil {
		t.Fatal("ReplyToEmail request was nil")
	}
	if bodyText, ok := stub.replyRequest.BodyText.Get(); !ok || bodyText != "Thanks" {
		t.Fatalf("unexpected reply body_text: %#v", stub.replyRequest.BodyText)
	}
	if _, ok := stub.replyRequest.From.Get(); ok {
		t.Fatalf("from should be unset when not overridden, got: %#v", stub.replyRequest.From)
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

func TestClientSendSurfacesGatesAndRequestID(t *testing.T) {
	details := primitiveapi.ErrorResponseErrorDetails{}
	details.SentEmailID = primitiveapi.NewOptString("se_abc")
	details.RequiredEntitlements = []string{"send_to_confirmed_domains"}

	respErr := primitiveapi.ErrorResponseError{
		Code:    primitiveapi.ErrorResponseErrorCodeRecipientNotAllowed,
		Message: "cannot send to alice@example.com",
		Details: primitiveapi.NewOptErrorResponseErrorDetails(details),
		Gates: []primitiveapi.GateDenial{
			{
				Name:    primitiveapi.GateDenialNameSendToKnownAddresses,
				Reason:  primitiveapi.GateDenialReasonRecipientNotKnown,
				Subject: "alice@example.com",
				Message: "alice@example.com has not previously sent mail",
				Fix: primitiveapi.NewOptGateFix(primitiveapi.GateFix{
					Action:  primitiveapi.GateFixActionWaitForInbound,
					Subject: "alice@example.com",
				}),
			},
		},
		RequestID: primitiveapi.NewOptString("req_test_123"),
	}

	stub := &stubSendAPI{
		result: &primitiveapi.SendEmailForbidden{
			Success: false,
			Error:   respErr,
		},
	}
	client := NewClientFromAPI(stub)

	_, err := client.Send(context.Background(), SendParams{
		From:     "support@example.com",
		To:       "alice@example.com",
		Subject:  "Hello",
		BodyText: "Hi",
	})
	if err == nil {
		t.Fatal("expected error")
	}
	apiErr, ok := err.(*APIError)
	if !ok {
		t.Fatalf("expected APIError, got %T", err)
	}
	if apiErr.StatusCode != 403 || apiErr.Code != "recipient_not_allowed" {
		t.Fatalf("unexpected API error: %#v", apiErr)
	}
	if apiErr.RequestID != "req_test_123" {
		t.Fatalf("missing request id: %q", apiErr.RequestID)
	}
	if len(apiErr.Gates) != 1 ||
		apiErr.Gates[0].Reason != primitiveapi.GateDenialReasonRecipientNotKnown {
		t.Fatalf("unexpected gates: %#v", apiErr.Gates)
	}
	if apiErr.Details == nil {
		t.Fatal("missing details")
	}
	if got, ok := apiErr.Details.SentEmailID.Get(); !ok || got != "se_abc" {
		t.Fatalf("missing sent_email_id: %#v", apiErr.Details.SentEmailID)
	}
}

func TestClientSendSurfacesRetryAfterOn429(t *testing.T) {
	retryAfter := 12
	stub := &stubSendAPI{
		result: &primitiveapi.RateLimitedHeaders{
			RetryAfter: primitiveapi.NewOptInt(retryAfter),
			Response: primitiveapi.ErrorResponse{
				Success: false,
				Error: primitiveapi.ErrorResponseError{
					Code:    primitiveapi.ErrorResponseErrorCodeRateLimitExceeded,
					Message: "Rate limit exceeded",
				},
			},
		},
	}
	client := NewClientFromAPI(stub)

	_, err := client.Send(context.Background(), SendParams{
		From:     "support@example.com",
		To:       "alice@example.com",
		Subject:  "Hello",
		BodyText: "Hi",
	})
	if err == nil {
		t.Fatal("expected error")
	}
	apiErr, ok := err.(*APIError)
	if !ok {
		t.Fatalf("expected APIError, got %T", err)
	}
	if apiErr.StatusCode != 429 || apiErr.Code != "rate_limit_exceeded" {
		t.Fatalf("unexpected API error: %#v", apiErr)
	}
	if apiErr.RetryAfter == nil || *apiErr.RetryAfter != 12 {
		t.Fatalf("unexpected retry-after: %#v", apiErr.RetryAfter)
	}
}

func TestClientReplyHonorsFromOverride(t *testing.T) {
	stub := &stubSendAPI{
		replyResult: &primitiveapi.ReplyToEmailOK{Success: true, Data: sendMailResult()},
	}
	client := NewClientFromAPI(stub)

	_, err := client.Reply(context.Background(), receivedEmailFixture(), ReplyParams{
		BodyText: "Thanks",
		From:     "notifications@example.com",
	})
	if err != nil {
		t.Fatalf("Reply returned error: %v", err)
	}
	if value, ok := stub.replyRequest.From.Get(); !ok || value != "notifications@example.com" {
		t.Fatalf("expected from override, got %#v", stub.replyRequest.From)
	}
}
