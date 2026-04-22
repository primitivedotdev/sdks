package primitive

import (
	"context"
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

func TestClientSendValidatesRecipientBeforeRequest(t *testing.T) {
	stub := &stubSendAPI{}
	client := NewClientFromAPI(stub)

	_, err := client.Send(context.Background(), SendParams{
		From:    "support@example.com",
		To:      "not-an-email",
		Subject: "Hello",
		Body:    "Hi",
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
		Body:    "Hi there",
	})
	if err != nil {
		t.Fatalf("Send returned error: %v", err)
	}
	if !stub.called || stub.request == nil {
		t.Fatal("SendEmail was not called")
	}
	if stub.request.From != "support@example.com" || stub.request.To != "alice@example.com" {
		t.Fatalf("unexpected request payload: %#v", stub.request)
	}
	if result.ID != messageID {
		t.Fatalf("unexpected result ID: %v", result.ID)
	}
	if result.Status != primitiveapi.SendResultStatusAccepted {
		t.Fatalf("unexpected result status: %v", result.Status)
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
		Body:    "Hi there",
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
