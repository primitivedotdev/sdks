package primitive

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/rand/v2"
	"net/http"
	"net/url"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"
)

type receiverAPI interface {
	ReceiverRequest(context.Context, string, []byte) (*http.Response, error)
	ReceiverConnection(context.Context) (string, string, error)
	ReceiverDo(*http.Request) (*http.Response, error)
}

type EventReceiverError struct {
	Code       string
	Status     int
	RetryAfter time.Duration
}

func (e *EventReceiverError) Error() string {
	return fmt.Sprintf("event receiver failed (%s, HTTP %d)", e.Code, e.Status)
}

var ErrDeliveryExpired = &EventReceiverError{Code: "delivery_expired", Status: 409}

type LocalEvent struct {
	ID      string
	Type    string
	Data    json.RawMessage
	Body    string
	Headers map[string]string
}

// Decode provides typed access while preserving unknown future event payloads.
func (e LocalEvent) Decode(target interface{}) error { return json.Unmarshal(e.Data, target) }

type EventStatus struct {
	Type          string
	Backlog       int
	GapCount      int
	LastGapReason *string
	Err           error
}
type EventOptions struct {
	Subscription string
	Events       []string
	// Transport defaults to websocket. Set poll explicitly for HTTP polling.
	Transport  string
	OnStatus   func(EventStatus)
	OnGapError bool
	// Dial supports specialized proxy or TLS setup. The default retains the API HTTP client.
	Dial func(context.Context, string, *websocket.DialOptions) (*websocket.Conn, *http.Response, error)
}

type EventsResource struct {
	api    receiverAPI
	mu     sync.Mutex
	active map[string]bool
}

func newEventsResource(api interface{}) *EventsResource {
	transport, _ := api.(receiverAPI)
	return &EventsResource{api: transport, active: make(map[string]bool)}
}

var subscriptionPattern = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$`)

func (r *EventsResource) reserve(options EventOptions) (func(), error) {
	if !subscriptionPattern.MatchString(options.Subscription) {
		return nil, errors.New("subscription must be 1-64 letters, digits, underscores or hyphens, starting with a letter or digit")
	}
	if options.Events != nil && (len(options.Events) == 0 || len(options.Events) > 50) {
		return nil, errors.New("events must contain 1-50 nonempty names")
	}
	for _, event := range options.Events {
		if strings.TrimSpace(event) == "" {
			return nil, errors.New("events must contain nonempty names")
		}
	}
	if options.Transport != "" && options.Transport != "websocket" && options.Transport != "poll" {
		return nil, errors.New("transport must be websocket or poll")
	}
	if r.api == nil {
		return nil, &EventReceiverError{Code: "unsupported"}
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.active[options.Subscription] {
		return nil, &EventReceiverError{Code: "busy", Status: 409}
	}
	r.active[options.Subscription] = true
	var once sync.Once
	return func() { once.Do(func() { r.mu.Lock(); delete(r.active, options.Subscription); r.mu.Unlock() }) }, nil
}
func pauseEvent(ctx context.Context, duration time.Duration) error {
	timer := time.NewTimer(duration)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		return nil
	}
}
func retryEvent[T any](ctx context.Context, operation func() (T, error), status func(EventStatus)) (T, error) {
	var zero T
	for attempt := 0; ; attempt++ {
		if err := ctx.Err(); err != nil {
			return zero, err
		}
		value, err := operation()
		if err == nil {
			return value, nil
		}
		if ctx.Err() != nil {
			return zero, ctx.Err()
		}
		var failure *EventReceiverError
		delay := time.Duration(float64(min(10000, 250*(1<<min(attempt, 6))))*(0.8+rand.Float64()*0.4)) * time.Millisecond
		if errors.As(err, &failure) {
			if slices.Contains([]string{"unsupported", "invalid_response", "pull_unavailable", "subscription_unavailable"}, failure.Code) || !(failure.Status == 0 || failure.Status == 408 || failure.Status == 429 || failure.Status >= 500) {
				return zero, err
			}
			delay = max(delay, failure.RetryAfter)
		}
		if status != nil {
			status(EventStatus{Type: "reconnecting", Err: err})
		}
		if err := pauseEvent(ctx, delay); err != nil {
			return zero, err
		}
	}
}
func retryAfterEvent(value string) time.Duration {
	if seconds, err := strconv.ParseFloat(value, 64); err == nil && seconds >= 0 && seconds < 86400*365 {
		return time.Duration(seconds * float64(time.Second))
	}
	if timestamp, err := http.ParseTime(value); err == nil {
		return max(0, time.Until(timestamp))
	}
	return 0
}

type eventEnvelope struct {
	Success bool            `json:"success"`
	Data    json.RawMessage `json:"data"`
	Error   struct {
		Code string `json:"code"`
	} `json:"error"`
}
type eventWireDelivery struct {
	QueueID        string            `json:"queue_id"`
	EventID        string            `json:"event_id"`
	EventType      string            `json:"event_type"`
	DeliveryID     string            `json:"delivery_id"`
	LeaseToken     string            `json:"lease_token"`
	LeaseExpiresAt time.Time         `json:"lease_expires_at"`
	Body           string            `json:"body"`
	Headers        map[string]string `json:"headers"`
}
type eventOffer struct {
	Delivery       *eventWireDelivery `json:"delivery"`
	Backlog        int                `json:"backlog"`
	GapCount       int                `json:"gap_count"`
	LastGapReason  *string            `json:"last_gap_reason"`
	Retention      int                `json:"retention_seconds"`
	HandlerTimeout int                `json:"handler_timeout_seconds"`
}
type eventFrame struct {
	Type       string          `json:"type"`
	Protocol   string          `json:"protocol"`
	Data       json.RawMessage `json:"data"`
	Code       string          `json:"code"`
	Status     int             `json:"status"`
	RetryAfter *string         `json:"retry_after"`
}
type eventConnection struct {
	api       receiverAPI
	endpoint  string
	options   EventOptions
	socket    atomic.Pointer[websocket.Conn]
	accountID string
	origin    string
	status    EventStatus
	gaps      int
}

func (c *eventConnection) close() {
	if socket := c.socket.Swap(nil); socket != nil {
		_ = socket.CloseNow()
	}
}
func (c *eventConnection) request(ctx context.Context, path string, body interface{}, target interface{}) error {
	var encoded []byte
	var err error
	if body != nil {
		encoded, err = json.Marshal(body)
		if err != nil {
			return err
		}
	}
	requestCtx, cancel := context.WithTimeout(ctx, 45*time.Second)
	defer cancel()
	response, err := c.api.ReceiverRequest(requestCtx, path, encoded)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	var result eventEnvelope
	if err = json.NewDecoder(io.LimitReader(response.Body, 64*1024*1024)).Decode(&result); err != nil {
		return &EventReceiverError{Code: "invalid_response"}
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return &EventReceiverError{Code: result.Error.Code, Status: response.StatusCode, RetryAfter: retryAfterEvent(response.Header.Get("Retry-After"))}
	}
	if !result.Success {
		return &EventReceiverError{Code: "invalid_response"}
	}
	if err = json.Unmarshal(result.Data, target); err != nil {
		return &EventReceiverError{Code: "invalid_response"}
	}
	return nil
}

type eventRoundTripper struct{ api receiverAPI }

func (t eventRoundTripper) RoundTrip(request *http.Request) (*http.Response, error) {
	return t.api.ReceiverDo(request)
}
func (c *eventConnection) open(ctx context.Context) error {
	if c.options.Transport == "poll" || c.socket.Load() != nil {
		return nil
	}
	var account struct {
		ID string `json:"id"`
	}
	if err := c.request(ctx, "account", nil, &account); err != nil {
		return err
	}
	if account.ID == "" || (c.accountID != "" && c.accountID != account.ID) {
		return &EventReceiverError{Code: "identity_changed", Status: 403}
	}
	c.accountID = account.ID
	base, token, err := c.api.ReceiverConnection(ctx)
	if err != nil {
		return err
	}
	if c.origin != "" && c.origin != base {
		return &EventReceiverError{Code: "identity_changed", Status: 403}
	}
	c.origin = base
	address, err := url.Parse(strings.TrimRight(base, "/") + "/endpoints/" + url.PathEscape(c.endpoint) + "/stream")
	if err != nil {
		return &EventReceiverError{Code: "unsupported"}
	}
	if address.Scheme != "https" && !(address.Scheme == "http" && slices.Contains([]string{"localhost", "127.0.0.1", "::1"}, address.Hostname())) {
		return &EventReceiverError{Code: "unsupported"}
	}
	if address.Scheme == "https" {
		address.Scheme = "wss"
	} else {
		address.Scheme = "ws"
	}
	dial := c.options.Dial
	if dial == nil {
		dial = websocket.Dial
	}
	readyCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	socket, response, err := dial(readyCtx, address.String(), &websocket.DialOptions{Subprotocols: []string{"primitive.events.v1"}, HTTPClient: &http.Client{Transport: eventRoundTripper{c.api}, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}})
	if err != nil {
		if response != nil {
			return &EventReceiverError{Code: "handshake_failed", Status: response.StatusCode}
		}
		return err
	}
	c.socket.Store(socket)
	socket.SetReadLimit(64 * 1024 * 1024)
	if response != nil && response.Request != nil && response.Request.URL.Host != address.Host {
		c.close()
		return &EventReceiverError{Code: "unsupported"}
	}
	frame, err := c.exchange(readyCtx, map[string]string{"type": "authenticate", "token": token})
	if err != nil {
		c.close()
		return err
	}
	if frame.Type != "ready" || frame.Protocol != "primitive.events.v1" {
		c.close()
		return &EventReceiverError{Code: "unsupported"}
	}
	return nil
}
func (c *eventConnection) update(data json.RawMessage) (eventOffer, error) {
	var offer eventOffer
	if err := json.Unmarshal(data, &offer); err != nil || offer.Retention != 86400 || offer.HandlerTimeout != 30 || offer.Backlog < 0 || offer.GapCount < 0 {
		return offer, &EventReceiverError{Code: "invalid_response"}
	}
	c.status = EventStatus{Type: "ready", Backlog: offer.Backlog, GapCount: offer.GapCount, LastGapReason: offer.LastGapReason}
	if offer.GapCount > 0 && offer.GapCount != c.gaps {
		c.gaps = offer.GapCount
		status := c.status
		status.Type = "gap"
		if c.options.OnStatus != nil {
			c.options.OnStatus(status)
		}
		if c.options.OnGapError {
			return offer, &EventReceiverError{Code: "event_gap", Status: 409}
		}
	}
	return offer, nil
}
func (c *eventConnection) exchange(ctx context.Context, body interface{}) (eventFrame, error) {
	var frame eventFrame
	socket := c.socket.Load()
	if socket == nil {
		return frame, &EventReceiverError{Code: "disconnected"}
	}
	if err := wsjson.Write(ctx, socket, body); err != nil {
		c.close()
		return frame, err
	}
	for {
		readCtx, cancel := context.WithTimeout(ctx, 60*time.Second)
		err := wsjson.Read(readCtx, socket, &frame)
		cancel()
		if err != nil {
			c.close()
			return frame, err
		}
		switch frame.Type {
		case "ping":
			if err := wsjson.Write(ctx, socket, map[string]string{"type": "pong"}); err != nil {
				c.close()
				return frame, err
			}
		case "status":
			if _, err := c.update(frame.Data); err != nil {
				return frame, err
			}
		case "error":
			c.close()
			retry := time.Duration(0)
			if frame.RetryAfter != nil {
				retry = retryAfterEvent(*frame.RetryAfter)
			}
			return frame, &EventReceiverError{Code: frame.Code, Status: frame.Status, RetryAfter: retry}
		default:
			return frame, nil
		}
	}
}
func (c *eventConnection) receive(ctx context.Context) (eventOffer, error) {
	if err := c.open(ctx); err != nil {
		return eventOffer{}, err
	}
	var data json.RawMessage
	if c.options.Transport == "poll" {
		if err := c.request(ctx, "endpoints/"+c.endpoint+"/pull", map[string]int{"wait_seconds": 25}, &data); err != nil {
			return eventOffer{}, err
		}
	} else {
		frame, err := c.exchange(ctx, map[string]string{"type": "receive"})
		if err != nil {
			return eventOffer{}, err
		}
		if frame.Type != "event" {
			return eventOffer{}, &EventReceiverError{Code: "invalid_response"}
		}
		data = frame.Data
	}
	return c.update(data)
}
func (c *eventConnection) complete(ctx context.Context, body map[string]interface{}) error {
	if err := c.open(ctx); err != nil {
		return err
	}
	var receipt struct {
		Result string `json:"result"`
	}
	if c.options.Transport == "poll" {
		if err := c.request(ctx, "endpoints/"+c.endpoint+"/complete", body, &receipt); err != nil {
			return err
		}
	} else {
		frame, err := c.exchange(ctx, map[string]interface{}{"type": "complete", "body": body})
		if err != nil {
			return err
		}
		if frame.Type != "receipt" || json.Unmarshal(frame.Data, &receipt) != nil {
			return &EventReceiverError{Code: "invalid_response"}
		}
	}
	if receipt.Result != "completed" && receipt.Result != "already_completed" {
		return &EventReceiverError{Code: "invalid_response"}
	}
	return nil
}
func (r *EventsResource) connect(ctx context.Context, options EventOptions) (*eventConnection, error) {
	c := &eventConnection{api: r.api, options: options, gaps: -1, status: EventStatus{Type: "ready"}}
	body := map[string]interface{}{"kind": "pull", "name": options.Subscription}
	if options.Events != nil {
		events := slices.Clone(options.Events)
		slices.Sort(events)
		body["rules"] = map[string]interface{}{"event_types": slices.Compact(events)}
	}
	var endpoint struct {
		ID           string `json:"id"`
		Kind         string `json:"kind"`
		Enabled      *bool  `json:"enabled"`
		Capabilities struct {
			Modes     []string `json:"completion_modes"`
			Protocols []string `json:"stream_protocols"`
		} `json:"receiver_capabilities"`
	}
	_, err := retryEvent(ctx, func() (bool, error) { return true, c.request(ctx, "endpoints", body, &endpoint) }, options.OnStatus)
	if err != nil {
		return nil, err
	}
	if endpoint.Kind != "pull" || endpoint.ID == "" || (endpoint.Enabled != nil && !*endpoint.Enabled) {
		return nil, &EventReceiverError{Code: "subscription_unavailable", Status: 409}
	}
	if !slices.Contains(endpoint.Capabilities.Modes, "sdk") || (options.Transport != "poll" && !slices.Contains(endpoint.Capabilities.Protocols, "primitive.events.v1")) {
		return nil, &EventReceiverError{Code: "unsupported"}
	}
	c.endpoint = endpoint.ID
	if _, err = retryEvent(ctx, func() (bool, error) { return true, c.open(ctx) }, options.OnStatus); err != nil {
		c.close()
		return nil, err
	}
	if options.OnStatus != nil {
		options.OnStatus(c.status)
	}
	return c, nil
}

type PendingEvent struct {
	Event      LocalEvent
	Context    context.Context
	cancel     context.CancelFunc
	timer      *time.Timer
	connection *eventConnection
	raw        eventWireDelivery
	started    time.Time
	release    func()
	mu         sync.Mutex
	chosen     *bool
	done       chan struct{}
	err        error
}

func newPendingEvent(ctx context.Context, raw *eventWireDelivery, connection *eventConnection, release func()) (*PendingEvent, error) {
	if raw == nil || raw.EventID == "" || raw.EventType == "" || raw.LeaseToken == "" || raw.QueueID == "" || raw.DeliveryID == "" || raw.Headers == nil || !json.Valid([]byte(raw.Body)) {
		return nil, &EventReceiverError{Code: "invalid_response"}
	}
	duration := min(30*time.Second, time.Until(raw.LeaseExpiresAt)-5*time.Second)
	if duration <= 0 {
		return nil, ErrDeliveryExpired
	}
	deliveryCtx, cancelCause := context.WithCancelCause(ctx)
	cancel := func() { cancelCause(context.Canceled) }
	var once sync.Once
	d := &PendingEvent{Event: LocalEvent{ID: raw.EventID, Type: raw.EventType, Data: json.RawMessage(raw.Body), Body: raw.Body, Headers: raw.Headers}, Context: deliveryCtx, cancel: cancel, connection: connection, raw: *raw, started: time.Now(), release: func() { once.Do(release) }}
	d.timer = time.AfterFunc(duration, func() { cancelCause(ErrDeliveryExpired) })
	go func() { <-deliveryCtx.Done(); d.release() }()
	return d, nil
}
func (d *PendingEvent) Ack() error   { return d.complete(true) }
func (d *PendingEvent) Retry() error { return d.complete(false) }
func (d *PendingEvent) complete(accepted bool) error {
	d.mu.Lock()
	if d.chosen != nil {
		done := d.done
		same := *d.chosen == accepted
		d.mu.Unlock()
		if !same {
			return &EventReceiverError{Code: "completion_conflict", Status: 409}
		}
		<-done
		return d.err
	}
	if d.Context.Err() != nil {
		d.mu.Unlock()
		return context.Cause(d.Context)
	}
	d.chosen = &accepted
	d.done = make(chan struct{})
	d.timer.Stop()
	d.mu.Unlock()
	body := map[string]interface{}{"mode": "sdk", "accepted": accepted, "duration_ms": min(int64(30000), time.Since(d.started).Milliseconds()), "queue_id": d.raw.QueueID, "delivery_id": d.raw.DeliveryID, "lease_token": d.raw.LeaseToken}
	ctx, cancel := context.WithTimeout(d.Context, min(60*time.Second, time.Until(d.raw.LeaseExpiresAt)))
	defer cancel()
	_, err := retryEvent(ctx, func() (bool, error) { return true, d.connection.complete(ctx, body) }, d.connection.options.OnStatus)
	d.err = err
	close(d.done)
	d.cancel()
	d.release()
	return err
}
func (r *EventsResource) Wait(ctx context.Context, options EventOptions) (*PendingEvent, error) {
	release, err := r.reserve(options)
	if err != nil {
		return nil, err
	}
	c, err := r.connect(ctx, options)
	if err != nil {
		release()
		return nil, err
	}
	handedOff := false
	defer func() {
		if !handedOff {
			c.close()
			release()
		}
	}()
	for {
		offer, err := retryEvent(ctx, func() (eventOffer, error) { return c.receive(ctx) }, options.OnStatus)
		if err != nil {
			return nil, err
		}
		if offer.Delivery == nil {
			if err = pauseEvent(ctx, 250*time.Millisecond); err != nil {
				return nil, err
			}
			continue
		}
		d, err := newPendingEvent(ctx, offer.Delivery, c, func() { c.close(); release() })
		if err != nil {
			return nil, err
		}
		handedOff = true
		return d, nil
	}
}

type EventHandler func(context.Context, LocalEvent) error
type EventListener struct {
	done          chan struct{}
	stop          chan struct{}
	once          sync.Once
	mu            sync.Mutex
	cancelReceive context.CancelFunc
	err           error
}

func (l *EventListener) Wait() error { <-l.done; return l.err }
func (l *EventListener) Close(ctx context.Context) error {
	l.once.Do(func() {
		close(l.stop)
		l.mu.Lock()
		if l.cancelReceive != nil {
			l.cancelReceive()
		}
		l.mu.Unlock()
	})
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-l.done:
		return l.err
	}
}
func (r *EventsResource) Listen(ctx context.Context, handler EventHandler, options EventOptions) (*EventListener, error) {
	if handler == nil {
		return nil, errors.New("handler is required")
	}
	release, err := r.reserve(options)
	if err != nil {
		return nil, err
	}
	c, err := r.connect(ctx, options)
	if err != nil {
		release()
		return nil, err
	}
	l := &EventListener{done: make(chan struct{}), stop: make(chan struct{})}
	go func() {
		defer close(l.done)
		defer release()
		defer c.close()
		defer func() {
			if options.OnStatus != nil {
				options.OnStatus(EventStatus{Type: "closed"})
			}
		}()
		for {
			select {
			case <-l.stop:
				return
			case <-ctx.Done():
				return
			default:
			}
			receiving, cancel := context.WithCancel(ctx)
			l.mu.Lock()
			l.cancelReceive = cancel
			select {
			case <-l.stop:
				cancel()
			default:
			}
			l.mu.Unlock()
			offer, err := retryEvent(receiving, func() (eventOffer, error) { return c.receive(receiving) }, options.OnStatus)
			l.mu.Lock()
			l.cancelReceive = nil
			l.mu.Unlock()
			cancel()
			if err != nil {
				select {
				case <-l.stop:
					return
				case <-ctx.Done():
					return
				default:
					l.err = err
					return
				}
			}
			if offer.Delivery == nil {
				if err = pauseEvent(ctx, 250*time.Millisecond); err != nil {
					return
				}
				continue
			}
			delivery, err := newPendingEvent(ctx, offer.Delivery, c, func() {})
			if err != nil {
				l.err = err
				return
			}
			handled := make(chan error, 1)
			go func() { handled <- handler(delivery.Context, delivery.Event) }()
			select {
			case <-delivery.Context.Done():
				delivery.timer.Stop()
				l.err = context.Cause(delivery.Context)
				return
			case err = <-handled:
				if err != nil {
					if options.OnStatus != nil {
						options.OnStatus(EventStatus{Type: "handler_error", Err: err})
					}
					err = delivery.Retry()
				} else {
					err = delivery.Ack()
				}
				if err != nil {
					l.err = err
					return
				}
			}
		}
	}()
	return l, nil
}
