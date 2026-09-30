package api

import (
	"context"
	"net/http/httptest"
	"testing"
)

// The optional compatibility header retains the published generated method shape.
var (
	_ func(context.Context, *ClaimAgentConnectionReq, ClaimAgentConnectionParams) (ClaimAgentConnectionRes, error)    = (*Client)(nil).ClaimAgentConnection
	_ func(context.Context, *CreateAgentConnectionReq, CreateAgentConnectionParams) (CreateAgentConnectionRes, error) = (*Client)(nil).CreateAgentConnection
	_ func(context.Context, *InviteAgentConnectionReq, InviteAgentConnectionParams) (InviteAgentConnectionRes, error) = (*Client)(nil).InviteAgentConnection
)

func TestAgentConnectionCompatibilityHeader(t *testing.T) {
	request := httptest.NewRequest("POST", "/agent-connections", nil)
	request.Header.Set("Idempotency-Key", "compatibility-key")
	params, err := decodeCreateAgentConnectionParams([0]string{}, false, request)
	if err != nil {
		t.Fatal(err)
	}
	value, present := params.IdempotencyKey.Get()
	if !present || value != "compatibility-key" {
		t.Fatalf("compatibility header = %q, present = %t", value, present)
	}
}
