package api

import (
	"io"
	"net/http"
	"strings"
	"testing"
)

func errorResponse(status int, headers http.Header) *http.Response {
	headers.Set("Content-Type", "application/json")
	return &http.Response{
		StatusCode: status,
		Header:     headers,
		Body: io.NopCloser(strings.NewReader(
			`{"success":false,"error":{"code":"rate_limit_exceeded","message":"Rate limit exceeded"}}`,
		)),
	}
}

func TestSharedErrorHeadersDecodeRetryAfter(t *testing.T) {
	res, err := decodePollCliLoginResponse(errorResponse(http.StatusBadRequest, http.Header{
		"Retry-After": {"5"},
	}))
	if err != nil {
		t.Fatal(err)
	}
	wrapper, ok := res.(*ErrorResponseHeaders)
	if !ok {
		t.Fatalf("unexpected response type %T", res)
	}
	if got, present := wrapper.RetryAfter.Get(); !present || got != 5 {
		t.Fatalf("Retry-After = %d, present = %t", got, present)
	}
}

func TestAgentConnectionRateLimitDecodesRetryAfter(t *testing.T) {
	res, err := decodeAgentConnectionSetupResponse(errorResponse(http.StatusTooManyRequests, http.Header{
		"Retry-After": {"7"},
	}))
	if err != nil {
		t.Fatal(err)
	}
	wrapper, ok := res.(*AgentConnectionSetupTooManyRequests)
	if !ok {
		t.Fatalf("unexpected response type %T", res)
	}
	if got, present := wrapper.RetryAfter.Get(); !present || got != 7 {
		t.Fatalf("Retry-After = %d, present = %t", got, present)
	}
}
