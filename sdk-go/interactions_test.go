package primitive

import (
	"bytes"
	"encoding/hex"
	"encoding/json"
	"math"
	"os"
	"strings"
	"testing"
)

func TestSharedInteractionEnvelopes(t *testing.T) {
	data, err := os.ReadFile("../test-fixtures/interaction-envelopes.json")
	if err != nil {
		t.Fatal(err)
	}
	var fixtures []struct {
		Name, Source, Hex, Status string
		Padding                   int
	}
	if err = json.Unmarshal(data, &fixtures); err != nil {
		t.Fatal(err)
	}
	for _, fixture := range fixtures {
		t.Run(fixture.Name, func(t *testing.T) {
			text := fixture.Source + strings.Repeat(" ", fixture.Padding)
			source := []byte(text)
			if fixture.Hex != "" {
				source, err = hex.DecodeString(fixture.Hex)
				if err != nil {
					t.Fatal(err)
				}
			}
			result := ParseInteractionEnvelope(source)
			if result.Status != fixture.Status {
				t.Fatalf("got %s (%s), want %s", result.Status, result.Reason, fixture.Status)
			}
			if fixture.Hex == "" && ParseInteractionEnvelopeString(text).Status != fixture.Status {
				t.Fatal("string differs")
			}
			if result.Status != "invalid" {
				if !bytes.Equal(result.Source, source) {
					t.Fatal("source changed")
				}
				source[0] = '!'
				if result.Source[0] == '!' {
					t.Fatal("source aliased")
				}
			}
		})
	}
}

func TestValidateInteractionEnvelope(t *testing.T) {
	source := `{"interaction_version":1,"interaction_id":"11111111-1111-4111-8111-111111111111@agent.example","protocol":"future","protocol_version":1,"step":"offer","step_id":"22222222-2222-4222-8222-222222222222","prev_step_id":null,"expires_at":null,"payload":null}`
	var value map[string]any
	if err := json.Unmarshal([]byte(source), &value); err != nil {
		t.Fatal(err)
	}
	result := ValidateInteractionEnvelope(value)
	if result.Status != "valid" || result.Source != nil {
		t.Fatal(result)
	}
	cyclic := map[string]any{}
	cyclic["self"] = cyclic
	for _, payload := range []any{math.NaN(), math.Inf(1), int64(9007199254740992), cyclic, string([]byte{0xff}), func() {}, strings.Repeat("a", 65537), json.Number("+1"), json.Number("01"), json.Number("0x1p2"), json.Number("1_0")} {
		value["payload"] = payload
		if ValidateInteractionEnvelope(value).Status != "invalid" {
			t.Fatal("accepted invalid value")
		}
	}
}

func TestSharedDecodedInteractions(t *testing.T) {
	source, err := os.ReadFile("../test-fixtures/interaction-envelopes.json")
	if err != nil {
		t.Fatal(err)
	}
	var originals []struct{ Source string }
	if err = json.Unmarshal(source, &originals); err != nil {
		t.Fatal(err)
	}
	var base map[string]any
	if err = json.Unmarshal([]byte(originals[0].Source), &base); err != nil {
		t.Fatal(err)
	}
	source, err = os.ReadFile("../test-fixtures/interaction-decoded.json")
	if err != nil {
		t.Fatal(err)
	}
	var fixtures []struct {
		Name, Status string
		ArrayLength  int `json:"array_length"`
	}
	if err = json.Unmarshal(source, &fixtures); err != nil {
		t.Fatal(err)
	}
	for _, fixture := range fixtures {
		t.Run(fixture.Name, func(t *testing.T) {
			items := make([]any, fixture.ArrayLength)
			for i := range items {
				items[i] = 0
			}
			base["payload"] = items
			result := ValidateInteractionEnvelope(base)
			if result.Status != fixture.Status {
				t.Fatalf("got %s want %s", result.Status, fixture.Status)
			}
		})
	}
}
