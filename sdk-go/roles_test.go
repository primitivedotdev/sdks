package primitive

import (
	"encoding/json"
	"os"
	"path/filepath"
	"reflect"
	"testing"
)

func TestBuiltinRoleKeysMatchSpec(t *testing.T) {
	raw, err := os.ReadFile(filepath.Join("..", "openapi", "primitive-api.codegen.json"))
	if err != nil {
		t.Fatalf("read spec: %v", err)
	}
	var spec struct {
		Components struct {
			Schemas map[string]struct {
				Enum []string `json:"enum"`
			} `json:"schemas"`
		} `json:"components"`
	}
	if err := json.Unmarshal(raw, &spec); err != nil {
		t.Fatalf("parse spec: %v", err)
	}
	want := spec.Components.Schemas["BuiltinRoleKey"].Enum
	got := make([]string, 0, len(BuiltinRoleKeys()))
	for _, key := range BuiltinRoleKeys() {
		got = append(got, string(key))
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("BuiltinRoleKeys() = %v, spec BuiltinRoleKey = %v", got, want)
	}
}

func TestIsBuiltinRoleKey(t *testing.T) {
	if !IsBuiltinRoleKey("member") {
		t.Fatal("member should be a built-in role key")
	}
	// operator is a template role, and restricted stands for a role that
	// does not fully include member: neither is a built-in role.
	for _, key := range []string{"custom_1", "restricted", "operator"} {
		if IsBuiltinRoleKey(key) {
			t.Fatalf("%s should not be a built-in role key", key)
		}
	}
}
