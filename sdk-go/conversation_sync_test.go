package primitive

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"reflect"
	"strconv"
	"strings"
	"testing"

	"github.com/google/uuid"
	api "github.com/primitivedotdev/sdks/sdk-go/v3/api"
)

type conversationSyncExpectedMessage struct {
	ID      string   `json:"id"`
	CopyIDs []string `json:"copy_ids"`
	Status  *string  `json:"status,omitempty"`
}

type conversationSyncCase struct {
	Name  string `json:"name"`
	State *struct {
		Cursor   string            `json:"cursor"`
		Messages []json.RawMessage `json:"messages"`
	} `json:"state"`
	Pages []struct {
		Since    string          `json:"since"`
		Response json.RawMessage `json:"response"`
	} `json:"pages"`
	Expected struct {
		Error    bool                              `json:"error"`
		Cursor   string                            `json:"cursor"`
		Messages []conversationSyncExpectedMessage `json:"messages"`
	} `json:"expected"`
}

var conversationSyncEmailID = uuid.MustParse("a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1")

func loadConversationSyncCases(t *testing.T) []conversationSyncCase {
	t.Helper()
	raw, err := os.ReadFile("../test-fixtures/conversation-sync.json")
	if err != nil {
		t.Fatal(err)
	}
	var fixture struct {
		Cases []conversationSyncCase `json:"cases"`
	}
	if err := json.Unmarshal(raw, &fixture); err != nil {
		t.Fatal(err)
	}
	return fixture.Cases
}

func decodeConversationMessages(t *testing.T, raw []json.RawMessage) []api.ConversationMessage {
	t.Helper()
	messages := make([]api.ConversationMessage, len(raw))
	for index, item := range raw {
		if err := messages[index].UnmarshalJSON(item); err != nil {
			t.Fatal(err)
		}
	}
	return messages
}

// serveConversationSyncCase serves the case's pages in order and records the
// requests it saw.
func serveConversationSyncCase(t *testing.T, testCase conversationSyncCase) (*api.Client, *[]*http.Request) {
	t.Helper()
	var requests []*http.Request
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests = append(requests, r)
		if len(requests) > len(testCase.Pages) {
			t.Errorf("read past the last fixture page")
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(testCase.Pages[len(requests)-1].Response)
	}))
	t.Cleanup(server.Close)
	client, err := api.NewClient(server.URL, attachmentPartSecurity{})
	if err != nil {
		t.Fatal(err)
	}
	return client, &requests
}

func summarizeConversationMessages(messages []api.ConversationMessage, expected []conversationSyncExpectedMessage) []conversationSyncExpectedMessage {
	out := make([]conversationSyncExpectedMessage, len(messages))
	for index, message := range messages {
		copyIDs := []string{}
		for _, copied := range message.Copies {
			copyIDs = append(copyIDs, copied.ID.String())
		}
		out[index] = conversationSyncExpectedMessage{ID: message.ID.String(), CopyIDs: copyIDs}
		// A fixture names a status only where it pins one.
		if index < len(expected) && expected[index].Status != nil {
			status := ""
			if value, ok := message.Status.Get(); ok {
				status = string(value)
			}
			out[index].Status = &status
		}
	}
	return out
}

func TestSharedConversationSyncFixtures(t *testing.T) {
	for _, testCase := range loadConversationSyncCases(t) {
		t.Run(testCase.Name, func(t *testing.T) {
			client, requests := serveConversationSyncCase(t, testCase)
			var state *ConversationSync
			if testCase.State != nil {
				state = &ConversationSync{
					Cursor:   testCase.State.Cursor,
					Messages: decodeConversationMessages(t, testCase.State.Messages),
				}
			}

			result, err := SyncConversation(context.Background(), client, conversationSyncEmailID, state)
			if testCase.Expected.Error {
				var apiErr *APIError
				if !errors.As(err, &apiErr) {
					t.Fatalf("expected an APIError, got %v", err)
				}
			} else {
				if err != nil {
					t.Fatal(err)
				}
				if result.Cursor != testCase.Expected.Cursor {
					t.Fatalf("cursor = %q, want %q", result.Cursor, testCase.Expected.Cursor)
				}
				got := summarizeConversationMessages(result.Messages, testCase.Expected.Messages)
				if !reflect.DeepEqual(got, testCase.Expected.Messages) {
					gotJSON, _ := json.Marshal(got)
					wantJSON, _ := json.Marshal(testCase.Expected.Messages)
					t.Fatalf("messages = %s, want %s", gotJSON, wantJSON)
				}
			}

			if len(*requests) != len(testCase.Pages) {
				t.Fatalf("made %d reads, want %d", len(*requests), len(testCase.Pages))
			}
			for index, request := range *requests {
				if got := request.URL.Query().Get("since"); got != testCase.Pages[index].Since {
					t.Fatalf("read %d sent since=%q, want %q", index, got, testCase.Pages[index].Since)
				}
				if !strings.HasSuffix(request.URL.Path, "/emails/"+conversationSyncEmailID.String()+"/conversation") {
					t.Fatalf("unexpected path %q", request.URL.Path)
				}
				if request.URL.Query().Has("limit") {
					t.Fatalf("since read sent limit")
				}
			}
		})
	}
}

func TestMergeConversationMessagesDoesNotModifyInputs(t *testing.T) {
	testCase := loadConversationSyncCases(t)[1]
	held := decodeConversationMessages(t, testCase.State.Messages)
	var page struct {
		Data struct {
			Messages []json.RawMessage `json:"messages"`
		} `json:"data"`
	}
	if err := json.Unmarshal(testCase.Pages[0].Response, &page); err != nil {
		t.Fatal(err)
	}
	delta := decodeConversationMessages(t, page.Data.Messages)
	heldBefore := append([]api.ConversationMessage(nil), held...)
	deltaBefore := append([]api.ConversationMessage(nil), delta...)

	merged := MergeConversationMessages(held, delta)
	if merged[0].ID == held[0].ID {
		t.Fatal("merge kept the superseded entry first")
	}
	if !reflect.DeepEqual(held, heldBefore) || !reflect.DeepEqual(delta, deltaBefore) {
		t.Fatal("merge modified its inputs")
	}
}

func TestConversationSyncCarriesConversationFields(t *testing.T) {
	testCase := loadConversationSyncCases(t)[3]
	apiClient, _ := serveConversationSyncCase(t, testCase)
	result, err := NewClientFromAPI(apiClient).SyncConversation(context.Background(), conversationSyncEmailID, nil)
	if err != nil {
		t.Fatal(err)
	}
	if threadID, ok := result.ThreadID.Get(); !ok || threadID.String() != "0c0c0c0c-0c0c-4c0c-8c0c-0c0c0c0c0c0c" {
		t.Fatalf("thread id = %v", result.ThreadID)
	}
	if subject, ok := result.Subject.Get(); !ok || subject != "Invoice" {
		t.Fatalf("subject = %v", result.Subject)
	}
	if count, ok := result.MessageCount.Get(); !ok || count != 3 {
		t.Fatalf("message count = %v", result.MessageCount)
	}
	if truncated, ok := result.Truncated.Get(); !ok || truncated {
		t.Fatalf("truncated = %v", result.Truncated)
	}
	if result.Cursor != "page-3" {
		t.Fatalf("cursor = %q", result.Cursor)
	}
}

func TestConversationSyncMapsErrorResponses(t *testing.T) {
	for _, tc := range []struct {
		status int
		code   string
	}{
		{401, "unauthorized"},
		{404, "not_found"},
		{400, "validation_error"},
	} {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("Retry-After", "7")
			w.WriteHeader(tc.status)
			_, _ = w.Write([]byte(`{"success":false,"error":{"code":"` + tc.code + `","message":"refused","request_id":"req-1"}}`))
		}))
		client, err := api.NewClient(server.URL, attachmentPartSecurity{})
		if err != nil {
			t.Fatal(err)
		}
		_, err = SyncConversation(context.Background(), client, conversationSyncEmailID, nil)
		server.Close()
		var apiErr *APIError
		if !errors.As(err, &apiErr) {
			t.Fatalf("%d: expected an APIError, got %v", tc.status, err)
		}
		if apiErr.StatusCode != tc.status || apiErr.Code != tc.code || apiErr.RequestID != "req-1" || apiErr.Message != "refused" {
			t.Fatalf("%d: got status %d code %q request %q message %q", tc.status, apiErr.StatusCode, apiErr.Code, apiErr.RequestID, apiErr.Message)
		}
		if tc.status == 401 && (apiErr.RetryAfter == nil || *apiErr.RetryAfter != 7) {
			t.Fatalf("401: Retry-After = %v, want 7", apiErr.RetryAfter)
		}
	}
}

type conversationTimestampCase struct {
	Input      string  `json:"input"`
	Normalized *string `json:"normalized"`
	Ms         *int64  `json:"ms"`
}

func loadConversationTimestampCases(t *testing.T) []conversationTimestampCase {
	t.Helper()
	raw, err := os.ReadFile("../test-fixtures/conversation-sync.json")
	if err != nil {
		t.Fatal(err)
	}
	var fixture struct {
		Timestamps []conversationTimestampCase `json:"timestamps"`
	}
	if err := json.Unmarshal(raw, &fixture); err != nil {
		t.Fatal(err)
	}
	if len(fixture.Timestamps) == 0 {
		t.Fatal("fixture has no timestamp cases")
	}
	return fixture.Timestamps
}

func TestSharedConversationSyncTimestamps(t *testing.T) {
	for _, entry := range loadConversationTimestampCases(t) {
		normalized, ok := normalizeConversationTimestamp(entry.Input)
		if entry.Normalized == nil {
			if ok {
				t.Fatalf("%q normalized to %q, want invalid", entry.Input, normalized)
			}
			continue
		}
		if !ok || normalized != *entry.Normalized {
			t.Fatalf("%q normalized to %q (%v), want %q", entry.Input, normalized, ok, *entry.Normalized)
		}
		// The decoded instant must match the fixture's milliseconds.
		var message api.ConversationMessage
		body := `{"role":"user","direction":"inbound","id":"00000000-0000-4000-8000-000000000000","text":"x","timestamp":"` + normalized + `"}`
		if err := message.UnmarshalJSON([]byte(body)); err != nil {
			t.Fatalf("%q: generated decoder refused the normalized value: %v", entry.Input, err)
		}
		if got := conversationTimestampMs(message); got != float64(*entry.Ms) {
			t.Fatalf("%q sorts at %v, want %d", entry.Input, got, *entry.Ms)
		}
	}
}

// pagingConversationReader always answers has_more with a new cursor. It has
// no ReceiverRequest, so SyncConversation takes the typed path.
type pagingConversationReader struct{ reads int }

func (r *pagingConversationReader) GetConversation(ctx context.Context, params api.GetConversationParams) (api.GetConversationRes, error) {
	r.reads++
	return &api.GetConversationOK{Success: true, Data: api.Conversation{
		ThreadID: api.NilUUID{Null: true},
		Messages: []api.ConversationMessage{},
		Cursor:   api.NewOptString("cursor-" + strconv.Itoa(r.reads)),
		HasMore:  api.NewOptBool(true),
	}}, nil
}

func TestConversationSyncStopsAfterThePageLimit(t *testing.T) {
	reader := &pagingConversationReader{}
	_, err := SyncConversation(context.Background(), reader, conversationSyncEmailID, nil)
	var apiErr *APIError
	if !errors.As(err, &apiErr) {
		t.Fatalf("expected an APIError, got %v", err)
	}
	if reader.reads != MaxConversationSyncPages {
		t.Fatalf("made %d reads, want %d", reader.reads, MaxConversationSyncPages)
	}
}
