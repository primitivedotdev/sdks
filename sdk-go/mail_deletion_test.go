package primitive

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"
	api "github.com/primitivedotdev/sdks/sdk-go/api"
)

func TestMailboxDeletionRoutesAndErrors(t *testing.T) {
	id := uuid.MustParse("11111111-1111-4111-8111-111111111111")
	for _, kind := range []string{"sent", "connection"} {
		for _, status := range []int{200, 409, 503} {
			if kind == "connection" && status == 503 {
				continue
			}
			t.Run(fmt.Sprintf("%s/%d", kind, status), func(t *testing.T) {
				calls := 0
				server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					calls++
					expectedMethod, expectedPath := "DELETE", "/sent-emails/"+id.String()
					if kind == "connection" {
						expectedMethod, expectedPath = "POST", "/agent-connections/agent+demo@example.com/remove"
					}
					if r.Method != expectedMethod || r.URL.Path != expectedPath {
						t.Errorf("Unexpected request %s %s", r.Method, r.URL.Path)
					}
					w.Header().Set("Content-Type", "application/json")
					w.WriteHeader(status)
					if status == 200 {
						_, _ = w.Write([]byte(`{"success":true,"data":{"deleted":true}}`))
						return
					}
					code := "sent_email_not_settled"
					if status == 503 {
						code = "sent_email_cleanup_failed"
					}
					if kind == "connection" {
						code = "connection_not_revoked"
					}
					_, _ = fmt.Fprintf(w, `{"success":false,"error":{"code":%q,"message":"Cannot delete"}}`, code)
				}))
				defer server.Close()
				client, err := api.NewClient(server.URL, attachmentPartSecurity{})
				if err != nil {
					t.Fatal(err)
				}
				var result interface{}
				if kind == "sent" {
					result, err = client.DeleteSentEmail(context.Background(), api.DeleteSentEmailParams{ID: id})
				} else {
					result, err = client.RemoveAgentConnection(context.Background(), api.RemoveAgentConnectionParams{Address: "agent+demo@example.com"})
				}
				if err != nil {
					t.Fatal(err)
				}
				switch status {
				case 200:
					if kind == "sent" {
						if v, ok := result.(*api.DeleteSentEmailOK); !ok || !v.Data.Deleted {
							t.Fatalf("Unexpected response %T", result)
						}
					} else {
						if v, ok := result.(*api.RemoveAgentConnectionOK); !ok || !v.Data.Deleted {
							t.Fatalf("Unexpected response %T", result)
						}
					}
				case 409:
					if kind == "sent" {
						if v, ok := result.(*api.DeleteSentEmailConflict); !ok || string(v.Error.Code) != "sent_email_not_settled" {
							t.Fatalf("Unexpected conflict %v", result)
						}
					} else {
						if _, ok := result.(*api.RemoveAgentConnectionConflict); !ok {
							t.Fatalf("Unexpected conflict %T", result)
						}
					}
				case 503:
					if v, ok := result.(*api.DeleteSentEmailServiceUnavailable); !ok || string(v.Error.Code) != "sent_email_cleanup_failed" {
						t.Fatalf("Unexpected cleanup failure %v", result)
					}
				}
				if calls != 1 {
					t.Fatalf("Expected one request, got %d", calls)
				}
			})
		}
	}
}

func TestDeletedSendRefusalIsPreservedWithoutRetry(t *testing.T) {
	for _, kind := range []string{"send", "reply"} {
		t.Run(kind, func(t *testing.T) {
			calls := 0
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				calls++
				if kind == "send" && r.Header.Get("Idempotency-Key") != "existing-key" {
					t.Error("Idempotency key changed")
				}
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(410)
				_, _ = w.Write([]byte(`{"success":false,"error":{"code":"sent_email_deleted","message":"Prior send deleted","details":{"idempotent_replay":true}}}`))
			}))
			defer server.Close()
			client, err := NewClientWithOptions("fixture"+"-credential", ClientOptions{APIBaseURL1: server.URL, APIBaseURL2: server.URL})
			if err != nil {
				t.Fatal(err)
			}
			if kind == "send" {
				_, err = client.Send(context.Background(), SendParams{From: "sender@example.com", To: "receiver@example.com", Subject: "Example", BodyText: "Hello", IdempotencyKey: "existing-key"})
			} else {
				_, err = client.Reply(context.Background(), receivedEmailFixture(), ReplyParams{BodyText: "Hello"})
			}
			var apiErr *APIError
			if !errors.As(err, &apiErr) || apiErr.StatusCode != 410 || apiErr.Code != "sent_email_deleted" || apiErr.Details == nil {
				t.Fatalf("Lost typed deleted-send error: %#v", err)
			}
			if string(apiErr.Details.AdditionalProps["idempotent_replay"]) != "true" {
				t.Fatal("Lost idempotent replay metadata")
			}
			if calls != 1 {
				t.Fatalf("Expected one request, got %d", calls)
			}
		})
	}
}
