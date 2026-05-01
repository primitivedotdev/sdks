package primitive

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"

	primitiveapi "github.com/primitivedotdev/sdks/sdk-go/api"
)

type sendPayloadFixture struct {
	CanonicalInbound canonicalInbound `json:"canonical_inbound"`
	Send             []sendCase       `json:"send"`
	Reply            []replyCase      `json:"reply"`
	Forward          []forwardCase    `json:"forward"`
}

type canonicalInbound struct {
	ID             string            `json:"id"`
	EventID        string            `json:"event_id"`
	ReceivedAt     string            `json:"received_at"`
	Sender         canonicalAddress  `json:"sender"`
	ReplyTarget    canonicalAddress  `json:"reply_target"`
	ReceivedBy     string            `json:"received_by"`
	ReceivedByAll  []string          `json:"received_by_all"`
	Subject        *string           `json:"subject"`
	ReplySubject   string            `json:"reply_subject"`
	ForwardSubject string            `json:"forward_subject"`
	Text           *string           `json:"text"`
	Thread         canonicalInThread `json:"thread"`
	RawToHeader    string            `json:"raw_to_header"`
	RawDateHeader  string            `json:"raw_date_header"`
}

type canonicalAddress struct {
	Address string  `json:"address"`
	Name    *string `json:"name"`
}

type canonicalInThread struct {
	MessageID  *string  `json:"message_id"`
	InReplyTo  []string `json:"in_reply_to"`
	References []string `json:"references"`
}

type sendCase struct {
	Name                   string         `json:"name"`
	Input                  sendInputCase  `json:"input"`
	ExpectedBody           map[string]any `json:"expected_body"`
	ExpectedIdempotencyKey *string        `json:"expected_idempotency_key"`
}

type sendInputCase struct {
	From           string   `json:"from"`
	To             string   `json:"to"`
	Subject        string   `json:"subject"`
	BodyText       *string  `json:"body_text"`
	BodyHTML       *string  `json:"body_html"`
	InReplyTo      *string  `json:"in_reply_to"`
	References     []string `json:"references"`
	Wait           *bool    `json:"wait"`
	WaitTimeoutMs  *int     `json:"wait_timeout_ms"`
	IdempotencyKey *string  `json:"idempotency_key"`
}

type replyCase struct {
	Name                   string         `json:"name"`
	Input                  replyInputCase `json:"input"`
	ExpectedBody           map[string]any `json:"expected_body"`
	ExpectedIdempotencyKey *string        `json:"expected_idempotency_key"`
}

type replyInputCase struct {
	Text    string  `json:"text"`
	Subject *string `json:"subject"`
	From    *string `json:"from"`
}

type forwardCase struct {
	Name                     string           `json:"name"`
	Input                    forwardInputCase `json:"input"`
	ExpectedBodyMatch        map[string]any   `json:"expected_body_match"`
	ExpectedBodyTextContains []string         `json:"expected_body_text_contains"`
	ExpectedIdempotencyKey   *string          `json:"expected_idempotency_key"`
}

type forwardInputCase struct {
	To       string  `json:"to"`
	BodyText *string `json:"body_text"`
	Subject  *string `json:"subject"`
	From     *string `json:"from"`
}

type capturingSendAPI struct {
	request *primitiveapi.SendMailInput
	params  primitiveapi.SendEmailParams
}

func (s *capturingSendAPI) SendEmail(_ context.Context, request *primitiveapi.SendMailInput, params primitiveapi.SendEmailParams) (primitiveapi.SendEmailRes, error) {
	s.request = request
	s.params = params
	return &primitiveapi.SendEmailOK{
		Success: true,
		Data: primitiveapi.SendMailResult{
			ID:                   "sent-x",
			Status:               primitiveapi.SentEmailStatusSubmittedToAgent,
			QueueID:              primitiveapi.NilString{Null: true},
			Accepted:             []string{},
			Rejected:             []string{},
			ClientIdempotencyKey: "auto",
			RequestID:            "req",
			ContentHash:          "h",
		},
	}, nil
}

func loadSendPayloadFixture(t *testing.T) sendPayloadFixture {
	t.Helper()
	_, filename, _, _ := runtime.Caller(0)
	path := filepath.Join(
		filepath.Dir(filename), "..", "test-fixtures", "send-payloads", "cases.json",
	)
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read fixture: %v", err)
	}
	var f sendPayloadFixture
	if err := json.Unmarshal(data, &f); err != nil {
		t.Fatalf("decode fixture: %v", err)
	}
	return f
}

func deferenceString(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}

func buildCanonicalReceivedEmail(c canonicalInbound) *ReceivedEmail {
	subject := deferenceString(c.Subject)
	messageID := deferenceString(c.Thread.MessageID)
	senderName := deferenceString(c.Sender.Name)
	replyTargetName := deferenceString(c.ReplyTarget.Name)
	rawDate := c.RawDateHeader

	senderHeader := c.Sender.Address
	if senderName != "" {
		senderHeader = senderName + " <" + c.Sender.Address + ">"
	}

	return &ReceivedEmail{
		ID:             c.ID,
		EventID:        c.EventID,
		ReceivedAt:     c.ReceivedAt,
		Sender:         ReceivedEmailAddress{Address: c.Sender.Address, Name: senderName},
		ReplyTarget:    ReceivedEmailAddress{Address: c.ReplyTarget.Address, Name: replyTargetName},
		ReceivedBy:     c.ReceivedBy,
		ReceivedByAll:  append([]string{}, c.ReceivedByAll...),
		Subject:        subject,
		ReplySubject:   c.ReplySubject,
		ForwardSubject: c.ForwardSubject,
		Text:           deferenceString(c.Text),
		Thread: ReceivedEmailThread{
			MessageID:  messageID,
			InReplyTo:  append([]string{}, c.Thread.InReplyTo...),
			References: append([]string{}, c.Thread.References...),
		},
		Raw: EmailReceivedEvent{
			ID: c.EventID,
			Email: Email{
				ID:         c.ID,
				ReceivedAt: c.ReceivedAt,
				Headers: EmailHeaders{
					From:      senderHeader,
					To:        c.RawToHeader,
					Subject:   c.Subject,
					Date:      &rawDate,
					MessageID: c.Thread.MessageID,
				},
			},
		},
	}
}

func captureRequestBody(t *testing.T, req *primitiveapi.SendMailInput) map[string]any {
	t.Helper()
	bytes, err := json.Marshal(req)
	if err != nil {
		t.Fatalf("marshal request: %v", err)
	}
	var out map[string]any
	if err := json.Unmarshal(bytes, &out); err != nil {
		t.Fatalf("unmarshal request: %v", err)
	}
	return out
}

func TestSharedSendPayloadFixtures(t *testing.T) {
	fixture := loadSendPayloadFixture(t)

	t.Run("send", func(t *testing.T) {
		for _, testCase := range fixture.Send {
			t.Run(testCase.Name, func(t *testing.T) {
				stub := &capturingSendAPI{}
				client := NewClientFromAPI(stub)

				params := SendParams{
					From:    testCase.Input.From,
					To:      testCase.Input.To,
					Subject: testCase.Input.Subject,
				}
				if testCase.Input.BodyText != nil {
					params.BodyText = *testCase.Input.BodyText
				}
				if testCase.Input.BodyHTML != nil {
					params.BodyHTML = *testCase.Input.BodyHTML
				}
				if testCase.Input.InReplyTo != nil || len(testCase.Input.References) > 0 {
					params.Thread = &SendThread{}
					if testCase.Input.InReplyTo != nil {
						params.Thread.InReplyTo = *testCase.Input.InReplyTo
					}
					if len(testCase.Input.References) > 0 {
						params.Thread.References = testCase.Input.References
					}
				}
				if testCase.Input.Wait != nil {
					params.Wait = testCase.Input.Wait
				}
				if testCase.Input.WaitTimeoutMs != nil {
					params.WaitTimeoutMs = *testCase.Input.WaitTimeoutMs
				}
				if testCase.Input.IdempotencyKey != nil {
					params.IdempotencyKey = *testCase.Input.IdempotencyKey
				}

				if _, err := client.Send(context.Background(), params); err != nil {
					t.Fatalf("Send returned error: %v", err)
				}

				body := captureRequestBody(t, stub.request)
				assertBodyEquals(t, body, testCase.ExpectedBody)
				assertIdempotencyKey(t, stub.params, testCase.ExpectedIdempotencyKey)
			})
		}
	})

	t.Run("reply", func(t *testing.T) {
		for _, testCase := range fixture.Reply {
			t.Run(testCase.Name, func(t *testing.T) {
				stub := &capturingSendAPI{}
				client := NewClientFromAPI(stub)
				email := buildCanonicalReceivedEmail(fixture.CanonicalInbound)

				rp := ReplyParams{BodyText: testCase.Input.Text}
				if testCase.Input.Subject != nil {
					rp.Subject = *testCase.Input.Subject
				}
				if testCase.Input.From != nil {
					rp.From = *testCase.Input.From
				}

				if _, err := client.Reply(context.Background(), email, rp); err != nil {
					t.Fatalf("Reply returned error: %v", err)
				}

				body := captureRequestBody(t, stub.request)
				assertBodyEquals(t, body, testCase.ExpectedBody)
				assertIdempotencyKey(t, stub.params, testCase.ExpectedIdempotencyKey)
			})
		}
	})

	t.Run("forward", func(t *testing.T) {
		for _, testCase := range fixture.Forward {
			t.Run(testCase.Name, func(t *testing.T) {
				stub := &capturingSendAPI{}
				client := NewClientFromAPI(stub)
				email := buildCanonicalReceivedEmail(fixture.CanonicalInbound)

				fp := ForwardParams{To: testCase.Input.To}
				if testCase.Input.BodyText != nil {
					fp.BodyText = *testCase.Input.BodyText
				}
				if testCase.Input.Subject != nil {
					fp.Subject = *testCase.Input.Subject
				}
				if testCase.Input.From != nil {
					fp.From = *testCase.Input.From
				}

				if _, err := client.Forward(context.Background(), email, fp); err != nil {
					t.Fatalf("Forward returned error: %v", err)
				}

				body := captureRequestBody(t, stub.request)
				for key, want := range testCase.ExpectedBodyMatch {
					got, ok := body[key]
					if !ok {
						t.Fatalf("body missing key %q", key)
					}
					if got != want {
						t.Fatalf("body[%q] = %v, want %v", key, got, want)
					}
				}
				bodyText, _ := body["body_text"].(string)
				for _, fragment := range testCase.ExpectedBodyTextContains {
					if !strings.Contains(bodyText, fragment) {
						t.Fatalf("body_text missing fragment %q\nfull body_text:\n%s", fragment, bodyText)
					}
				}
				assertIdempotencyKey(t, stub.params, testCase.ExpectedIdempotencyKey)
			})
		}
	})
}

func assertBodyEquals(t *testing.T, got, want map[string]any) {
	t.Helper()
	gotJSON, _ := json.Marshal(got)
	wantJSON, _ := json.Marshal(want)

	var gotNorm, wantNorm any
	_ = json.Unmarshal(gotJSON, &gotNorm)
	_ = json.Unmarshal(wantJSON, &wantNorm)

	if string(gotJSON) != string(wantJSON) {
		// JSON marshaling sorts keys alphabetically in Go; if string match
		// fails, use reflect-style comparison via re-marshaling as the
		// canonical form already, then compare.
		gotCanonical, _ := json.Marshal(gotNorm)
		wantCanonical, _ := json.Marshal(wantNorm)
		if string(gotCanonical) != string(wantCanonical) {
			t.Fatalf("body mismatch\n got: %s\nwant: %s", gotCanonical, wantCanonical)
		}
	}
}

func assertIdempotencyKey(t *testing.T, params primitiveapi.SendEmailParams, expected *string) {
	t.Helper()
	got, ok := params.IdempotencyKey.Get()
	if expected == nil {
		if ok {
			t.Fatalf("unexpected idempotency key %q", got)
		}
		return
	}
	if !ok {
		t.Fatalf("missing idempotency key, want %q", *expected)
	}
	if got != *expected {
		t.Fatalf("idempotency key %q, want %q", got, *expected)
	}
}
