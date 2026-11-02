package primitive

import (
	"encoding/json"
	"reflect"
	"testing"
)

// The shared fixture runner compares decoded structs with each other, so it
// cannot catch a wrong json tag. This pins every field by name.
func TestEmailUnderstandingDecodesEveryField(t *testing.T) {
	raw := `{
		"version": 1, "status": "ready", "classification_id": "cls_1",
		"vocabulary": "v1", "classified_at": "2025-12-14T11:59:58.912Z",
		"facts": {"intent": {"value": ["request"], "confidence": 0.91}},
		"rules": [{
			"id": "rule_1", "version": 2, "name": "Internship applicants",
			"description": "college students looking for internships",
			"conditions": [{"explanation": "The sender is cold outreach", "matched": true}],
			"questions": [{"question": "Is the sender a student?", "answer": true, "confidence": 0.99}]
		}]
	}`
	var u EmailUnderstanding
	if err := json.Unmarshal([]byte(raw), &u); err != nil {
		t.Fatalf("decode understanding: %v", err)
	}
	if u.Version != 1 || u.Status != "ready" || u.ClassificationID != "cls_1" || u.Vocabulary != "v1" || u.ClassifiedAt != "2025-12-14T11:59:58.912Z" {
		t.Fatalf("unexpected top-level fields %+v", u)
	}
	if c := u.Facts["intent"].Confidence; c == nil || *c != 0.91 {
		t.Fatalf("unexpected fact confidence %v", c)
	}
	if len(u.Rules) != 1 {
		t.Fatalf("unexpected rules %+v", u.Rules)
	}
	rule := u.Rules[0]
	if rule.ID != "rule_1" || rule.Version != 2 || rule.Name != "Internship applicants" || rule.Description != "college students looking for internships" {
		t.Fatalf("unexpected rule %+v", rule)
	}
	if len(rule.Conditions) != 1 || rule.Conditions[0].Explanation != "The sender is cold outreach" || !rule.Conditions[0].Matched {
		t.Fatalf("unexpected conditions %+v", rule.Conditions)
	}
	q := rule.Questions
	if len(q) != 1 || q[0].Question != "Is the sender a student?" || !q[0].Answer || q[0].Confidence == nil || *q[0].Confidence != 0.99 {
		t.Fatalf("unexpected questions %+v", q)
	}

	var sender SenderAnalysis
	if err := json.Unmarshal([]byte(`{"authenticated": true, "basis": "spf_aligned", "reasons": ["SPF aligned and passing"]}`), &sender); err != nil {
		t.Fatalf("decode sender: %v", err)
	}
	if !sender.Authenticated || sender.Basis != "spf_aligned" || !reflect.DeepEqual(sender.Reasons, []string{"SPF aligned and passing"}) {
		t.Fatalf("unexpected sender %+v", sender)
	}
}

func TestUnderstandingFactAccessors(t *testing.T) {
	var facts map[string]UnderstandingFact
	raw := `{
		"is_cold_outreach": {"value": true, "confidence": 0.97},
		"intent": {"value": ["request", "scheduling"], "confidence": 0.91},
		"sender_relationship": {"value": "candidate"}
	}`
	if err := json.Unmarshal([]byte(raw), &facts); err != nil {
		t.Fatalf("decode facts: %v", err)
	}

	if v, ok := facts["is_cold_outreach"].AsBool(); !ok || !v {
		t.Fatalf("AsBool = %v, %v; want true, true", v, ok)
	}
	if _, ok := facts["is_cold_outreach"].AsString(); ok {
		t.Fatal("AsString on a boolean fact should report false")
	}
	if c := facts["is_cold_outreach"].Confidence; c == nil || *c != 0.97 {
		t.Fatalf("Confidence = %v; want 0.97", c)
	}

	if v, ok := facts["intent"].AsStrings(); !ok || !reflect.DeepEqual(v, []string{"request", "scheduling"}) {
		t.Fatalf("AsStrings = %#v, %v", v, ok)
	}
	if _, ok := facts["intent"].AsBool(); ok {
		t.Fatal("AsBool on a list fact should report false")
	}

	if v, ok := facts["sender_relationship"].AsString(); !ok || v != "candidate" {
		t.Fatalf("AsString = %q, %v", v, ok)
	}
	if facts["sender_relationship"].Confidence != nil {
		t.Fatal("Confidence should be nil when the payload omits it")
	}

	if v, ok := (UnderstandingFact{Value: 3.5}).AsNumber(); !ok || v != 3.5 {
		t.Fatalf("AsNumber = %v, %v; want 3.5, true", v, ok)
	}

	mixed := UnderstandingFact{Value: []any{"request", 1.0}}
	if _, ok := mixed.AsStrings(); ok {
		t.Fatal("AsStrings on a list with a non-string item should report false")
	}
}

func TestEmailReceivedEventDecodesRouting(t *testing.T) {
	var event EmailReceivedEvent
	raw := `{"id": "evt_1", "event": "email.received", "routing": {
		"version": 1, "outcome": "matched", "endpoint_id": "ep_1",
		"matched_route_id": "rt_1", "matched_tier": "exact", "default_scope": null
	}}`
	if err := json.Unmarshal([]byte(raw), &event); err != nil {
		t.Fatalf("decode event: %v", err)
	}
	endpoint, route, tier := "ep_1", "rt_1", "exact"
	want := &RoutingDecision{Version: 1, Outcome: "matched", EndpointID: &endpoint, MatchedRouteID: &route, MatchedTier: &tier}
	if !reflect.DeepEqual(event.Routing, want) {
		t.Fatalf("Routing = %+v; want %+v", event.Routing, want)
	}

	var withoutRouting EmailReceivedEvent
	if err := json.Unmarshal([]byte(`{"id": "evt_2", "event": "email.received"}`), &withoutRouting); err != nil {
		t.Fatalf("decode event: %v", err)
	}
	if withoutRouting.Routing != nil {
		t.Fatalf("Routing = %+v; want nil", withoutRouting.Routing)
	}
}
