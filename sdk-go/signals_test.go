package primitive

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	primitiveapi "github.com/primitivedotdev/sdks/sdk-go/api"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"reflect"
	"testing"
)

type signalFixture struct {
	Name     string
	Input    SignalInput
	Now      int64
	UUIDs    []string
	Status   string
	Prepared PreparedSignal
}

func signalFixtures(t *testing.T) []signalFixture {
	t.Helper()
	data, err := os.ReadFile("../test-fixtures/signal-emails.json")
	if err != nil {
		t.Fatal(err)
	}
	var fixtures []signalFixture
	if err = json.Unmarshal(data, &fixtures); err != nil {
		t.Fatal(err)
	}
	return fixtures
}
func prepareSignalFixture(t *testing.T, name string) PreparedSignal {
	t.Helper()
	for _, f := range signalFixtures(t) {
		if f.Name == name {
			i := 0
			result, err := PrepareSignalEmail(f.Input, SignalDependencies{func() string { value := f.UUIDs[i]; i++; return value }, func() int64 { return f.Now }})
			if err != nil || result.Prepared == nil {
				t.Fatal(result, err)
			}
			return *result.Prepared
		}
	}
	t.Fatal(name)
	return PreparedSignal{}
}
func TestSharedSignalEmails(t *testing.T) {
	for _, f := range signalFixtures(t) {
		t.Run(f.Name, func(t *testing.T) {
			calls := 0
			result, err := PrepareSignalEmail(f.Input, SignalDependencies{func() string { value := f.UUIDs[calls]; calls++; return value }, func() int64 { return f.Now }})
			if f.Status == "invalid" {
				if err == nil {
					t.Fatal("accepted invalid signal")
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
			} else if result.Prepared == nil || !reflect.DeepEqual(*result.Prepared, f.Prepared) {
				t.Fatalf("prepared mismatch\ngot: %#v\nwant: %#v", result.Prepared, f.Prepared)
			}
		})
	}
}
func TestSignalRetryScopeExpiry(t *testing.T) {
	original := prepareSignalFixture(t, "read")
	saved, _ := json.Marshal(original)
	var prepared PreparedSignal
	if err := json.Unmarshal(saved, &prepared); err != nil {
		t.Fatal(err)
	}
	var calls []string
	send := func(_ context.Context, body json.RawMessage, key string) (string, error) {
		calls = append(calls, string(body)+key)
		body[0] = '!'
		if len(calls) == 1 {
			return "", errors.New("timeout")
		}
		return "ordinary response", nil
	}
	now := func() int64 { return 1800000000123 }
	ctx := context.Background()
	if _, err := SendPreparedSignal(ctx, send, prepared, "account-one", now); err == nil {
		t.Fatal("lost timeout")
	}
	result, err := SendPreparedSignal(ctx, send, prepared, "account-one", now)
	if err != nil || result.Result != "ordinary response" || calls[0] != calls[1] {
		t.Fatal(result, err, calls)
	}
	if _, err = SendPreparedSignal(ctx, send, prepared, "other", now); err == nil {
		t.Fatal("cross account")
	}
	working := prepareSignalFixture(t, "working")
	result, err = SendPreparedSignal(ctx, send, working, "account-one", func() int64 { return 1800000060123 })
	if err != nil || result.Status != "expired" || result.IdempotencyKey != working.IdempotencyKey || len(calls) != 2 {
		t.Fatal(result, err)
	}
}

func TestSignalGeneratedAdapter(t *testing.T) {
	prepared := prepareSignalFixture(t, "read")
	var request []byte
	var key, path string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		request, _ = io.ReadAll(r.Body)
		key = r.Header.Get("Idempotency-Key")
		path = r.URL.Path
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(400)
		_, _ = w.Write([]byte(`{"success":false,"error":{"code":"validation_error","message":"fixture"}}`))
	}))
	defer server.Close()
	client, err := primitiveapi.NewClient(server.URL+"/v1", primitiveapi.NewStaticTokenSource("fixture"+"-only", ""))
	if err != nil {
		t.Fatal(err)
	}
	result, err := SendPreparedSignal(context.Background(), func(ctx context.Context, raw json.RawMessage, key string) (primitiveapi.SendEmailRes, error) {
		var body primitiveapi.SendMailInput
		if err := json.Unmarshal(raw, &body); err != nil {
			return nil, err
		}
		return client.SendEmail(ctx, &body, primitiveapi.SendEmailParams{IdempotencyKey: primitiveapi.NewOptString(key)})
	}, prepared, "account-one", func() int64 { return 1800000000123 })
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := result.Result.(*primitiveapi.SendEmailBadRequest); !ok {
		t.Fatalf("lost ordinary error response: %T", result.Result)
	}
	var got, want any
	if err = json.Unmarshal(request, &got); err != nil {
		t.Fatal(err)
	}
	if err = json.Unmarshal([]byte(prepared.RequestJSON), &want); err != nil {
		t.Fatal(err)
	}
	if key != prepared.IdempotencyKey || path != "/v1/send-mail" || !reflect.DeepEqual(got, want) {
		t.Fatal("changed send operation")
	}
}

func TestDistinctSignalsShareParentNotExplicitKey(t *testing.T) {
	f := signalFixtures(t)[0]
	sequence := 0
	dependencies := SignalDependencies{UUID: func() string { sequence++; return fmt.Sprintf("00000000-0000-4000-8000-%012d", sequence) }, Now: func() int64 { return f.Now }}
	expiry := f.Now + 60000
	inputs := []SignalInput{{Parent: f.Input.Parent, Kind: "ack", Status: "received"}, {Parent: f.Input.Parent, Kind: "read"}, {Parent: f.Input.Parent, Kind: "working", ExpiresAtMs: &expiry}}
	var prepared []PreparedSignal
	for _, input := range inputs {
		result, err := PrepareSignalEmail(input, dependencies)
		if err != nil || result.Prepared == nil {
			t.Fatal(result, err)
		}
		prepared = append(prepared, *result.Prepared)
	}
	type attempt struct{ Body, Key string }
	var attempts []attempt
	send := func(_ context.Context, body json.RawMessage, key string) (string, error) {
		attempts = append(attempts, attempt{string(body), key})
		return "ordinary response", nil
	}
	for _, value := range append(prepared, prepared[0]) {
		if _, err := SendPreparedSignal(context.Background(), send, value, "account-one", dependencies.Now); err != nil {
			t.Fatal(err)
		}
	}
	keys := map[string]bool{}
	for _, value := range attempts[:3] {
		keys[value.Key] = true
	}
	if len(keys) != 3 || attempts[0] != attempts[3] {
		t.Fatal("distinct signal or retry identity changed")
	}
	for _, value := range attempts {
		var body struct {
			InReplyTo string `json:"in_reply_to"`
		}
		if err := json.Unmarshal([]byte(value.Body), &body); err != nil {
			t.Fatal(err)
		}
		if body.InReplyTo != "<Case.123@EXAMPLE.com>" {
			t.Fatal("parent changed")
		}
	}
}
