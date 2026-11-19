package api

import (
	"testing"

	"github.com/go-faster/jx"
)

// A null list in a later answer clears what an earlier one decoded into the same value.
func TestNullListClearsAReusedValue(t *testing.T) {
	var result ListEmailRuleResultsResult
	first := `{"attachments":[{"name":"rate-card.pdf","description":null}],"attachment_count":1,"rules":[],"hidden":0,"not_listed":0}`
	if err := result.Decode(jx.DecodeStr(first)); err != nil {
		t.Fatalf("decode first: %v", err)
	}
	if len(result.Attachments) != 1 {
		t.Fatalf("first answer: got %d attachments, want 1", len(result.Attachments))
	}

	second := `{"attachments":null,"attachment_count":null,"rules":[],"hidden":0,"not_listed":0}`
	if err := result.Decode(jx.DecodeStr(second)); err != nil {
		t.Fatalf("decode second: %v", err)
	}
	if result.Attachments != nil {
		t.Fatalf("second answer: got %v, want nil", result.Attachments)
	}

	empty := `{"attachments":[],"attachment_count":0,"rules":[],"hidden":0,"not_listed":0}`
	if err := result.Decode(jx.DecodeStr(empty)); err != nil {
		t.Fatalf("decode third: %v", err)
	}
	if result.Attachments == nil || len(result.Attachments) != 0 {
		t.Fatalf("third answer: got %v, want an empty list", result.Attachments)
	}
}
