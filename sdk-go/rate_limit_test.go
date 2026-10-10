package primitive

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
)

func sendAgainst(t *testing.T, headers map[string]string) *APIError {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		for name, value := range headers {
			w.Header().Set(name, value)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusTooManyRequests)
		_, _ = w.Write([]byte(`{"success":false,"error":{"code":"rate_limited","message":"Rate limit exceeded"}}`))
	}))
	t.Cleanup(server.Close)

	client, err := NewClientWithOptions("prim_test", ClientOptions{APIBaseURL1: server.URL, APIBaseURL2: server.URL})
	if err != nil {
		t.Fatal(err)
	}
	_, err = client.Send(context.Background(), SendParams{
		From:     "support@example.com",
		To:       "alice@example.com",
		Subject:  "Hello",
		BodyText: "Hi",
	})
	var apiErr *APIError
	if !errors.As(err, &apiErr) {
		t.Fatalf("expected *APIError, got %T: %v", err, err)
	}
	if apiErr.StatusCode != http.StatusTooManyRequests {
		t.Fatalf("unexpected status: %d", apiErr.StatusCode)
	}
	return apiErr
}

func TestSendSurfacesRejectingLimiterOn429(t *testing.T) {
	apiErr := sendAgainst(t, map[string]string{
		"Retry-After":         "1800",
		"Ratelimit-Limit":     "1000",
		"Ratelimit-Remaining": "0",
		"Ratelimit-Reset":     "1700003600",
		"Ratelimit-Policy":    "1000;w=3600",
	})
	if apiErr.RetryAfter == nil || *apiErr.RetryAfter != 1800 {
		t.Fatalf("unexpected retry-after: %#v", apiErr.RetryAfter)
	}
	rl := apiErr.RateLimit
	if rl == nil {
		t.Fatal("expected RateLimit")
	}
	if rl.Limit == nil || *rl.Limit != 1000 {
		t.Fatalf("unexpected limit: %#v", rl.Limit)
	}
	if rl.Remaining == nil || *rl.Remaining != 0 {
		t.Fatalf("unexpected remaining: %#v", rl.Remaining)
	}
	if rl.Reset == nil || *rl.Reset != 1700003600 {
		t.Fatalf("unexpected reset: %#v", rl.Reset)
	}
	if rl.Policy == nil || *rl.Policy != "1000;w=3600" {
		t.Fatalf("unexpected policy: %#v", rl.Policy)
	}
}

func TestSendLeavesRateLimitNilWhenOnlyRetryAfter(t *testing.T) {
	apiErr := sendAgainst(t, map[string]string{"Retry-After": "60"})
	if apiErr.RetryAfter == nil || *apiErr.RetryAfter != 60 {
		t.Fatalf("unexpected retry-after: %#v", apiErr.RetryAfter)
	}
	if apiErr.RateLimit != nil {
		t.Fatalf("expected nil RateLimit, got %#v", apiErr.RateLimit)
	}
}
