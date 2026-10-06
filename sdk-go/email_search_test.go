package primitive

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"testing"

	"github.com/google/uuid"
	api "github.com/primitivedotdev/sdks/sdk-go/api"
)

var emailSearchThread = uuid.MustParse("5c1e9a7d-3b2f-4e8a-b6d4-9f0c2a1e7b35")

// searchEmailPage serves one page of the shared email search fixture and
// records the query string of each request.
func searchEmailPage(t *testing.T, page string, params api.SearchEmailsParams) (*api.SearchEmailsOK, url.Values) {
	t.Helper()
	raw, err := os.ReadFile("../test-fixtures/email-search-pages.json")
	if err != nil {
		t.Fatal(err)
	}
	var pages map[string]json.RawMessage
	if err = json.Unmarshal(raw, &pages); err != nil {
		t.Fatal(err)
	}
	body, ok := pages[page]
	if !ok {
		t.Fatalf("fixture has no %q page", page)
	}
	var query url.Values
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		query = r.URL.Query()
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(body)
	}))
	defer server.Close()
	client, err := api.NewClient(server.URL, attachmentPartSecurity{})
	if err != nil {
		t.Fatal(err)
	}
	response, err := client.SearchEmails(context.Background(), params)
	if err != nil {
		t.Fatal(err)
	}
	result, ok := response.(*api.SearchEmailsOK)
	if !ok {
		t.Fatalf("Unexpected response %T", response)
	}
	return result, query
}

func TestEmailSearchSendsThreadPrefixAndCount(t *testing.T) {
	_, query := searchEmailPage(t, "uncounted", api.SearchEmailsParams{
		Q:        api.NewOptString("quarterly invoi"),
		ThreadID: api.NewOptUUID(emailSearchThread),
		Prefix:   api.NewOptSearchEmailsPrefix(api.SearchEmailsPrefixTrue),
		Count:    api.NewOptSearchEmailsCount(api.SearchEmailsCountFalse),
	})
	want := map[string]string{
		"q":         "quarterly invoi",
		"thread_id": emailSearchThread.String(),
		"prefix":    "true",
		"count":     "false",
	}
	for name, value := range want {
		if got := query.Get(name); got != value {
			t.Fatalf("%s = %q, want %q", name, got, value)
		}
	}
}

func TestEmailSearchOmitsThreadWhenUnset(t *testing.T) {
	_, query := searchEmailPage(t, "counted", api.SearchEmailsParams{Q: api.NewOptString("invoice")})
	if query.Has("thread_id") {
		t.Fatalf("thread_id sent without being set: %q", query.Get("thread_id"))
	}
}

func TestEmailSearchDecodesCountedPage(t *testing.T) {
	page, _ := searchEmailPage(t, "counted", api.SearchEmailsParams{Q: api.NewOptString("invoice")})
	if page.Meta.Total.Null || page.Meta.Total.Value != 1 {
		t.Fatalf("total = %+v, want 1", page.Meta.Total)
	}
	if len(page.Data) != 1 {
		t.Fatalf("got %d results, want 1", len(page.Data))
	}
	result := page.Data[0]
	if result.ThreadID.Null || result.ThreadID.Value != emailSearchThread {
		t.Fatalf("thread_id = %+v, want %s", result.ThreadID, emailSearchThread)
	}
	if result.Direction != api.EmailSearchResultDirectionInbound {
		t.Fatalf("direction = %q, want inbound", result.Direction)
	}
}

func TestEmailSearchDecodesUncountedPage(t *testing.T) {
	page, _ := searchEmailPage(t, "uncounted", api.SearchEmailsParams{
		Q:     api.NewOptString("invoi"),
		Count: api.NewOptSearchEmailsCount(api.SearchEmailsCountFalse),
	})
	if !page.Meta.Total.Null {
		t.Fatalf("total = %+v, want null", page.Meta.Total)
	}
	if page.Meta.TotalCapped {
		t.Fatal("total_capped = true, want false")
	}
	if cursor, ok := page.Meta.Cursor.Get(); !ok || cursor != "next-page-cursor" {
		t.Fatalf("cursor = %+v, want next-page-cursor", page.Meta.Cursor)
	}
	if !page.Data[0].ThreadID.Null {
		t.Fatalf("thread_id = %+v, want null", page.Data[0].ThreadID)
	}
}
