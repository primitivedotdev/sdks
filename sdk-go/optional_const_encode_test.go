package primitive

import (
	"strings"
	"testing"

	api "github.com/primitivedotdev/sdks/sdk-go/v3/api"
)

// An optional field the spec gives a const value is written only when it is
// set: re-encoding a decoded rule result whose author is still a member must
// not add author_left.
func TestOptionalConstFieldEncodedOnlyWhenSet(t *testing.T) {
	const absent = `{"id":"7d6b2b0e-6a43-4b6f-9a5c-6c2a3f1b9e10","name":"Invoices","state":"observe","decision":null,"not_run_reason":null}`
	var item api.ListEmailRuleResultsResultRulesItem
	if err := item.UnmarshalJSON([]byte(absent)); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if item.AuthorLeft.Set {
		t.Fatalf("author_left decoded as set from a body without it")
	}
	encoded, err := item.MarshalJSON()
	if err != nil {
		t.Fatalf("encode: %v", err)
	}
	if strings.Contains(string(encoded), "author_left") {
		t.Fatalf("re-encoded body gained author_left: %s", encoded)
	}

	item.AuthorLeft = api.NewOptBool(true)
	encoded, err = item.MarshalJSON()
	if err != nil {
		t.Fatalf("encode: %v", err)
	}
	if !strings.Contains(string(encoded), `"author_left":true`) {
		t.Fatalf("a set author_left was not encoded: %s", encoded)
	}
}
