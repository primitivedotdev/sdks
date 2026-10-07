package primitive

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/go-faster/jx"
	"github.com/google/uuid"
	api "github.com/primitivedotdev/sdks/sdk-go/v2/api"
)

var sentEmailRecipientFields = []string{"to_addresses", "cc", "bcc", "reply_to", "tags"}

type sentEmailRecipientCase struct {
	Name   string                     `json:"name"`
	Fields map[string]json.RawMessage `json:"fields"`
}

func loadSentEmailRecipientCases(t *testing.T) (map[string]json.RawMessage, []sentEmailRecipientCase) {
	t.Helper()
	raw, err := os.ReadFile("../test-fixtures/sent-email-attachment.json")
	if err != nil {
		t.Fatal(err)
	}
	var base struct {
		Data map[string]json.RawMessage `json:"data"`
	}
	if err = json.Unmarshal(raw, &base); err != nil {
		t.Fatal(err)
	}
	raw, err = os.ReadFile("../test-fixtures/sent-email-recipients.json")
	if err != nil {
		t.Fatal(err)
	}
	var cases []sentEmailRecipientCase
	if err = json.Unmarshal(raw, &cases); err != nil {
		t.Fatal(err)
	}
	return base.Data, cases
}

// nilStringArray reports a decoded optional nullable string list as JSON, or
// ok=false when the field was absent.
func nilStringArray(value api.OptNilStringArray) (json.RawMessage, bool) {
	if !value.Set {
		return nil, false
	}
	if value.Null {
		return json.RawMessage("null"), true
	}
	encoded, _ := json.Marshal(value.Value)
	return encoded, true
}

func nilTagArray(value api.OptNilSentEmailDetailTagsItemArray) (json.RawMessage, bool) {
	if !value.Set {
		return nil, false
	}
	if value.Null {
		return json.RawMessage("null"), true
	}
	encoded, _ := json.Marshal(value.Value)
	return encoded, true
}

func sameJSON(t *testing.T, left, right json.RawMessage) bool {
	t.Helper()
	var a, b any
	if err := json.Unmarshal(left, &a); err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(right, &b); err != nil {
		t.Fatal(err)
	}
	x, _ := json.Marshal(a)
	y, _ := json.Marshal(b)
	return bytes.Equal(x, y)
}

func TestSentEmailRecipientLists(t *testing.T) {
	base, cases := loadSentEmailRecipientCases(t)
	for _, item := range cases {
		t.Run(item.Name, func(t *testing.T) {
			data := make(map[string]json.RawMessage)
			for key, value := range base {
				data[key] = value
			}
			for key, value := range item.Fields {
				data[key] = value
			}
			body, err := json.Marshal(map[string]any{"success": true, "data": data})
			if err != nil {
				t.Fatal(err)
			}
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				_, _ = w.Write(body)
			}))
			defer server.Close()
			client, err := api.NewClient(server.URL, attachmentPartSecurity{})
			if err != nil {
				t.Fatal(err)
			}
			response, err := client.GetSentEmail(context.Background(), api.GetSentEmailParams{ID: uuid.MustParse("11111111-1111-4111-8111-111111111111")})
			if err != nil {
				t.Fatal(err)
			}
			result, ok := response.(*api.GetSentEmailOK)
			if !ok {
				t.Fatalf("Unexpected response %T", response)
			}
			detail := result.Data
			decoded := map[string]func() (json.RawMessage, bool){
				"to_addresses": func() (json.RawMessage, bool) { return nilStringArray(detail.ToAddresses) },
				"cc":           func() (json.RawMessage, bool) { return nilStringArray(detail.Cc) },
				"bcc":          func() (json.RawMessage, bool) { return nilStringArray(detail.Bcc) },
				"reply_to":     func() (json.RawMessage, bool) { return nilStringArray(detail.ReplyTo) },
				"tags":         func() (json.RawMessage, bool) { return nilTagArray(detail.Tags) },
			}

			encoder := &jx.Encoder{}
			detail.Encode(encoder)
			var reencoded map[string]json.RawMessage
			if err = json.Unmarshal(encoder.Bytes(), &reencoded); err != nil {
				t.Fatal(err)
			}

			for _, field := range sentEmailRecipientFields {
				expected, present := item.Fields[field]
				actual, set := decoded[field]()
				if set != present {
					t.Fatalf("%s: decoded presence %v, fixture presence %v", field, set, present)
				}
				if present && !sameJSON(t, actual, expected) {
					t.Fatalf("%s: decoded %s, want %s", field, actual, expected)
				}
				encoded, encodedPresent := reencoded[field]
				if encodedPresent != present {
					t.Fatalf("%s: encoded presence %v, fixture presence %v", field, encodedPresent, present)
				}
				if present && !sameJSON(t, encoded, expected) {
					t.Fatalf("%s: encoded %s, want %s", field, encoded, expected)
				}
			}
		})
	}
}
