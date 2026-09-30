package api

import (
	"net/http/httptest"
	"testing"
)

func TestListAgentConnectionsOwnerFilter(t *testing.T) {
	for _, test := range []struct {
		query string
		valid bool
	}{
		{"", true},
		{"?owner=self", true},
		{"?owner=other", false},
		{"?owner=", false},
	} {
		t.Run(test.query, func(t *testing.T) {
			request := httptest.NewRequest("GET", "/agent-connections"+test.query, nil)
			params, err := decodeListAgentConnectionsParams([0]string{}, false, request)
			if test.valid {
				if err != nil {
					t.Fatal(err)
				}
				if test.query != "" {
					value, present := params.Owner.Get()
					if !present || value != ListAgentConnectionsOwnerSelf {
						t.Fatalf("owner = %q, present = %t", value, present)
					}
				}
			} else if err == nil {
				t.Fatal("unsupported owner filter was accepted")
			}
		})
	}
}
