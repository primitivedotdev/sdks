package primitive

import (
	"encoding/json"
	"os"
	"reflect"
	"testing"
)

type repeatFixtures struct {
	Ticks []struct {
		Name, Raw, Status, Reason string
		Tick                      *RepeatTick
	}
	StopEnvelopes []struct {
		Name, Raw, Status, Reason string
		Stop                      *RepeatStop
	} `json:"stop_envelopes"`
	StopBodies []struct {
		Name   string
		Reason *string
		Status string
		Body   map[string]string
	} `json:"stop_bodies"`
}

func loadRepeatFixtures(t *testing.T) repeatFixtures {
	t.Helper()
	data, err := os.ReadFile("../test-fixtures/repeat-interactions.json")
	if err != nil {
		t.Fatal(err)
	}
	var fixtures repeatFixtures
	if err = json.Unmarshal(data, &fixtures); err != nil {
		t.Fatal(err)
	}
	return fixtures
}

func TestSharedRepeatInteractions(t *testing.T) {
	fixtures := loadRepeatFixtures(t)
	for _, f := range fixtures.Ticks {
		t.Run("tick/"+f.Name, func(t *testing.T) {
			result := ParseRepeatTick([]byte(f.Raw))
			if result.Status != f.Status || result.Reason != f.Reason {
				t.Fatalf("got %+v", result)
			}
			if f.Tick != nil && !reflect.DeepEqual(result.Tick, f.Tick) {
				t.Fatalf("tick %+v, want %+v", result.Tick, f.Tick)
			}
		})
	}
	for _, f := range fixtures.StopEnvelopes {
		t.Run("stop/"+f.Name, func(t *testing.T) {
			result := ParseRepeatStop([]byte(f.Raw))
			if result.Status != f.Status || result.Reason != f.Reason {
				t.Fatalf("got %+v", result)
			}
			if f.Stop != nil && !reflect.DeepEqual(result.Stop, f.Stop) {
				t.Fatalf("stop %+v, want %+v", result.Stop, f.Stop)
			}
		})
	}
	for _, f := range fixtures.StopBodies {
		t.Run("body/"+f.Name, func(t *testing.T) {
			reason := ""
			if f.Reason != nil {
				reason = *f.Reason
			}
			body, err := BuildRepeatStopBody(reason)
			if f.Status == "invalid" {
				if err == nil {
					t.Fatalf("expected an error, got %v", body)
				}
				return
			}
			if err != nil || !reflect.DeepEqual(body, f.Body) {
				t.Fatalf("body %v err %v, want %v", body, err, f.Body)
			}
		})
	}
}

func TestRepeatKindsAndCommand(t *testing.T) {
	fixtures := loadRepeatFixtures(t)
	parsed := ParseInteractionEnvelope([]byte(fixtures.Ticks[0].Raw))
	if InteractionKind(parsed.Envelope) != RepeatTickKind {
		t.Fatal(InteractionKind(parsed.Envelope))
	}
	if ReadRepeatStop(parsed.Envelope).Status != "other" {
		t.Fatal("a tick is not a stop")
	}
	if InteractionKind(map[string]any{"protocol": "repeat.stop", "protocol_version": float64(1)}) != RepeatStopKind {
		t.Fatal("stop kind")
	}
	command, err := RepeatStopCommand("9A8B7C6D-5E4F-4A3B-8C2D-1E0F9A8B7C6D")
	if err != nil || command != "primitive repeat stop --id 9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d" {
		t.Fatal(command, err)
	}
	if _, err = RepeatStopCommand("--id; rm"); err == nil {
		t.Fatal("expected an error")
	}
	if _, err = BuildRepeatStopBody("\xff"); err == nil {
		t.Fatal("expected invalid UTF-8 to fail")
	}
}
