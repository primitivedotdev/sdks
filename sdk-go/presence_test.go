package primitive

import (
	"encoding/json"
	"os"
	"reflect"
	"testing"
)

type presenceFixture struct {
	Name, Kind string
	Input      struct {
		AccountScope string `json:"accountScope"`
		From, To     string
		Probe        PresenceEnvelope
		MessageID    *string `json:"messageId"`
		References   []string
	}
	Now           int64
	UUIDs         []string
	Nonce, Status string
	Prepared      PreparedPresence
}

func TestSharedPresenceEmails(t *testing.T) {
	data, err := os.ReadFile("../test-fixtures/presence-emails.json")
	if err != nil {
		t.Fatal(err)
	}
	var fixtures struct {
		Preparation []presenceFixture
		Parse       []struct{ Name, Raw, Status string }
	}
	if err = json.Unmarshal(data, &fixtures); err != nil {
		t.Fatal(err)
	}
	for _, f := range fixtures.Preparation {
		t.Run(f.Name, func(t *testing.T) {
			calls := 0
			dependencies := PresenceDependencies{UUID: func() string {
				if calls >= len(f.UUIDs) {
					t.Fatal("unexpected UUID call")
				}
				value := f.UUIDs[calls]
				calls++
				return value
			}, Now: func() int64 { return f.Now }}
			input := PresenceProbeInput{f.Input.AccountScope, f.Input.From, f.Input.To}
			var result PresencePreparation
			var err error
			if f.Kind == "probe" {
				result, err = PreparePresenceProbeEmail(input, PresenceProbeDependencies{dependencies, func() string { return f.Nonce }})
			} else {
				result, err = PreparePresenceAliveEmail(PresenceAliveInput{input, f.Input.Probe, f.Input.MessageID, f.Input.References}, dependencies)
			}
			if f.Status == "invalid" {
				if err == nil {
					t.Fatal("invalid input accepted")
				}
				return
			}
			if err != nil {
				t.Fatal(err)
			}
			if result.Status != f.Status {
				t.Fatal(result.Status)
			}
			if f.Status == "waiting_on_parent" {
				if calls != 0 {
					t.Fatal("minted IDs")
				}
				return
			}
			if result.Prepared == nil || !reflect.DeepEqual(*result.Prepared, f.Prepared) {
				t.Fatalf("prepared mismatch\ngot: %#v\nwant: %#v", result.Prepared, f.Prepared)
			}
		})
	}
	for _, f := range fixtures.Parse {
		t.Run("parse/"+f.Name, func(t *testing.T) {
			result := ParsePresenceEnvelopeString(f.Raw)
			if result.Status != f.Status {
				t.Fatalf("got %#v, want %s", result, f.Status)
			}
			if result.Status == "valid" && string(result.Source) != f.Raw {
				t.Fatal("lost exact source")
			}
		})
	}
}
func TestPresenceSourceCopy(t *testing.T) {
	data, err := os.ReadFile("../test-fixtures/presence-emails.json")
	if err != nil {
		t.Fatal(err)
	}
	var fixture struct{ Parse []struct{ Raw string } }
	if json.Unmarshal(data, &fixture) != nil {
		t.Fatal("fixture")
	}
	bytes := []byte(fixture.Parse[0].Raw)
	result := ParsePresenceEnvelope(bytes)
	bytes[0] = 0
	if result.Status != "valid" || result.Source[0] != '{' {
		t.Fatal("source aliases input")
	}
	if ParsePresenceEnvelope([]byte{255}).Status != "invalid" {
		t.Fatal("invalid UTF8")
	}
}
