package primitive

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"reflect"
	"sync"
	"testing"
	"time"

	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"
)

type receiverFixture struct {
	InvalidNames []string          `json:"invalid_names"`
	Delivery     eventWireDelivery `json:"delivery"`
}

func loadReceiverFixture(t *testing.T) receiverFixture {
	t.Helper()
	data, err := os.ReadFile("../test-fixtures/local-event-receiver.json")
	if err != nil {
		t.Fatal(err)
	}
	var fixture receiverFixture
	if err = json.Unmarshal(data, &fixture); err != nil {
		t.Fatal(err)
	}
	return fixture
}
func TestEventsWaitReceiptLifecycle(t *testing.T) {
	fixture := loadReceiverFixture(t)
	var mu sync.Mutex
	completions := []map[string]interface{}{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var data interface{}
		switch r.URL.Path {
		case "/v1/endpoints":
			data = map[string]interface{}{"id": "endpoint", "kind": "pull", "receiver_capabilities": map[string]interface{}{"completion_modes": []string{"sdk"}, "stream_protocols": []string{"primitive.events.v1"}}}
		case "/v1/endpoints/endpoint/pull":
			data = eventOffer{Delivery: &fixture.Delivery, Retention: 86400, HandlerTimeout: 30}
		case "/v1/endpoints/endpoint/complete":
			var body map[string]interface{}
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
				t.Error(err)
			}
			mu.Lock()
			completions = append(completions, body)
			mu.Unlock()
			data = map[string]string{"result": "completed"}
		default:
			t.Errorf("unexpected path %s", r.URL.Path)
		}
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "data": data})
	}))
	defer server.Close()
	client, err := NewClientWithOptions("test", ClientOptions{APIBaseURL1: server.URL + "/v1"})
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	for _, name := range fixture.InvalidNames {
		if _, err = client.Events.Wait(ctx, EventOptions{Subscription: name, Transport: "poll"}); err == nil {
			t.Fatalf("accepted invalid name %q", name)
		}
	}
	options := EventOptions{Subscription: "agent", Transport: "poll"}
	delivery, err := client.Events.Wait(ctx, options)
	if err != nil {
		t.Fatal(err)
	}
	if delivery.Event.Body != fixture.Delivery.Body || delivery.Event.ID != fixture.Delivery.EventID {
		t.Fatal("body or identity changed")
	}
	mu.Lock()
	count := len(completions)
	mu.Unlock()
	if count != 0 {
		t.Fatal("acknowledged before application")
	}
	if _, err = client.Events.Wait(ctx, options); err == nil {
		t.Fatal("unsettled delivery did not block")
	}
	if err = delivery.Ack(); err != nil {
		t.Fatal(err)
	}
	if err = delivery.Ack(); err != nil {
		t.Fatal(err)
	}
	if err = delivery.Retry(); err == nil {
		t.Fatal("changed the chosen outcome")
	}
	mu.Lock()
	count = len(completions)
	mu.Unlock()
	if count != 1 {
		t.Fatalf("got %d completions", count)
	}
	next, err := client.Events.Wait(ctx, options)
	if err != nil {
		t.Fatal(err)
	}
	if err = next.Retry(); err != nil {
		t.Fatal(err)
	}
}
func TestEventsWebSocketLostReceipt(t *testing.T) {
	fixture := loadReceiverFixture(t)
	var mu sync.Mutex
	var completions []map[string]interface{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/v1/endpoints/endpoint/stream" {
			socket, err := websocket.Accept(w, r, &websocket.AcceptOptions{Subprotocols: []string{"primitive.events.v1"}})
			if err != nil {
				return
			}
			defer socket.CloseNow()
			for {
				var frame struct {
					Type  string                 `json:"type"`
					Token string                 `json:"token"`
					Body  map[string]interface{} `json:"body"`
				}
				if err = wsjson.Read(r.Context(), socket, &frame); err != nil {
					return
				}
				switch frame.Type {
				case "authenticate":
					if frame.Token != "test" {
						t.Error("missing token")
					}
					err = wsjson.Write(r.Context(), socket, map[string]string{"type": "ready", "protocol": "primitive.events.v1"})
				case "receive":
					err = wsjson.Write(r.Context(), socket, map[string]interface{}{"type": "event", "data": eventOffer{Delivery: &fixture.Delivery, Retention: 86400, HandlerTimeout: 30}})
				case "complete":
					mu.Lock()
					completions = append(completions, frame.Body)
					count := len(completions)
					mu.Unlock()
					if count == 1 {
						return
					}
					err = wsjson.Write(r.Context(), socket, map[string]interface{}{"type": "receipt", "data": map[string]string{"result": "already_completed"}})
				}
				if err != nil {
					return
				}
			}
		}
		var data interface{} = map[string]interface{}{"id": "endpoint", "kind": "pull", "receiver_capabilities": map[string]interface{}{"completion_modes": []string{"sdk"}, "stream_protocols": []string{"primitive.events.v1"}}}
		if r.URL.Path == "/v1/account" {
			data = map[string]string{"id": "account"}
		}
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "data": data})
	}))
	defer server.Close()
	client, err := NewClientWithOptions("test", ClientOptions{APIBaseURL1: server.URL + "/v1"})
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	delivery, err := client.Events.Wait(ctx, EventOptions{Subscription: "agent"})
	if err != nil {
		t.Fatal(err)
	}
	if err = delivery.Ack(); err != nil {
		t.Fatal(err)
	}
	mu.Lock()
	defer mu.Unlock()
	if len(completions) != 2 || !reflect.DeepEqual(completions[0], completions[1]) {
		t.Fatalf("receipt retry changed evidence: %v", completions)
	}
}
func TestEventsWaitDeadline(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/v1/endpoints" {
			_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "data": map[string]interface{}{"id": "endpoint", "kind": "pull", "receiver_capabilities": map[string]interface{}{"completion_modes": []string{"sdk"}, "stream_protocols": []string{}}}})
			return
		}
		_, _ = io.Copy(io.Discard, r.Body)
		select {
		case <-r.Context().Done():
		case <-time.After(time.Second):
		}
	}))
	defer server.Close()
	client, err := NewClientWithOptions("test", ClientOptions{APIBaseURL1: server.URL + "/v1"})
	if err != nil {
		t.Fatal(err)
	}
	for range 2 {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Millisecond)
		_, err = client.Events.Wait(ctx, EventOptions{Subscription: "agent", Transport: "poll"})
		cancel()
		if !errors.Is(err, context.DeadlineExceeded) {
			t.Fatal(err)
		}
	}
}
