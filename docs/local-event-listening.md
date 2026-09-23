# Local event listening

The local receiver builds on named pull destinations and their durable queue.
The CLI and Node, Python, and Go SDKs use WebSocket by default. HTTP polling is
an explicit alternative, with the same subscription and completion semantics.

## Developer interface

- CLI: `primitive listen --forward-to localhost:3000`. Port-only targets also
  work. Bare `primitive listen` emits raw JSONL. `--exec` invokes a short hook.
  `--once` and `--timeout 60` bound a wait; timeout exits 2 and interruption 130.
- Node: `await client.events.listen(handler, { subscription: "my-agent" })`.
  Await `listener.closed` or supervise it alongside existing work. Close with
  `await listener.close()`.
- Python: `await client.events.listen(handler, subscription="my-agent")`.
  Await `listener.wait_closed()`; use `close()` or its async context manager.
- Go: `client.Events.Listen(ctx, handler, EventOptions{Subscription: "my-agent"})`.
  Use `Wait()` to supervise, `Close(ctx)` to finish the current handler, or cancel
  the listener context to stop immediately.

Each SDK also provides `wait` / `Wait`, returning a delivery with an explicit
acknowledgment or retry operation. Returning a delivery never acknowledges it.
No local server, tunnel installation, subprocess, or CLI login is required by
an SDK. The SDK neither prints nor installs process-wide signal handlers.

## Identity and readiness

One stable subscription name is required by SDKs. It uses the existing name
format: 1-64 ASCII letters/digits/underscores/hyphens, beginning with a letter
or digit. CLI users retain their saved account/environment-scoped default.

Registration uses `createEndpoint`, `POST /v1/endpoints`, with `kind: "pull"`
and `name`. Same account and name shares work. Different names receive independent
copies. Omitted event filters preserve the existing selection; conflicting
filters fail without changing the queue. New subscriptions receive new events,
without historical backfill. Close never deletes a subscription.

`listen` returns after registration and transport readiness. Start it before
sending an event you must receive. A handler may run before the caller assigns
the returned listener variable; use its event and context arguments directly.

## Acceptance and lifecycle

Events expose canonical ID/type, parsed data (raw JSON in Go with Decode), exact
body, and headers. Identity comes from delivery metadata, including unknown
future event types. Parsing is not signature verification.

A callback has 30 seconds to accept or enqueue the event. Returning successfully
means acceptance, not completion of longer background work. Handler errors report
failure under the server retry policy. A deadline aborts the callback's signal or
context and stops the listener; arbitrary user code cannot be forcibly stopped.
The receiver never starts another callback while timed-out code could still run.

Continuous handlers are serial. Success is confirmed before another receive.
Receipt retries retain identical evidence and never rerun the callback. Delivery
is at least once; deduplicate side effects by canonical event ID when required.

A returned wait handle blocks another receiver on the same client/subscription
until settled or expired. Ack/retry is an idempotent choice; changing it fails.
The acceptance deadline releases an abandoned handle. Waiting timeout covers
setup, reconnects, and waiting: Node uses milliseconds, Python seconds, and Go
context deadlines. Node/Python return null/None on a no-event timeout. Caller
cancellation is separate. Graceful listener close finishes the current handler;
cancellation interrupts work through the supplied signal/context.

Optional status callbacks report readiness, reconnects, handler errors, closed
state, and persistent gap counts. Applications may elect to stop on gaps.
Authentication, unsupported capability, conflicting filters, deleted/disabled
subscriptions, and capacity errors fail clearly. Reconnect never recreates a
deleted subscription. Retryable failures respect Retry-After and cancellation.

## Existing API, additive completion

`pullWebhookEvent`, `POST /v1/endpoints/{id}/pull`, offers exact signed body and
headers plus queue/attempt/lease identity, backlog, gap counts, and limits.
`completeWebhookEvent`, `POST /v1/endpoints/{id}/complete`, records evidence.

SDK handlers use additive `mode: "sdk"`, `accepted`, and bounded `duration_ms`.
Optional `transport_error` is timeout or io. SDK completion cannot request content
discard. Existing http, exec, and stdout completion modes retain their behavior.
Endpoint responses advertise typed `receiver_capabilities` containing supported
completion modes and stream protocols. SDKs check support before receiving.

## WebSocket protocol

`/v1/endpoints/{id}/stream` uses subprotocol `primitive.events.v1` over WSS
(loopback HTTP is allowed for development). Bearer credentials travel in the
first bounded authenticate frame, never a URL or a new session/ticket resource.
The server authenticates using existing account/scope rules before ready.

Client frames: authenticate with token, receive, complete with the existing
completion body, and pong. Server frames: ready with protocol, event with the
existing pull response data, receipt, status, ping, and error with HTTP status,
code, and optional Retry-After. A receive grants one delivery. Another receive
requires completing the current offer. Reconnecting may repeat completion before
asking for another event. Lease and receipt validation remain server-authoritative.

The transport adapter invokes the existing authorized delivery routes internally.
This intentionally retains their bounded database reconciliation, content
preparation, and fresh authorization checks. It requires no additional publisher
or notification infrastructure and holds no idle transaction. Client-side long
polling is eliminated; shared publisher wakeups can optimize server reconciliation
independently without changing this protocol or developer interface.

Connections have bounded input frames, bounded outstanding operations, heartbeat
checks, and host-shutdown cancellation. A dropped offer is redelivered after its
lease expires. Lost receipts are retried identically. An unsupported handshake
does not silently downgrade to HTTP polling.

## Verification

Shared fixtures cover subscription validation, unknown events, and exact payload
preservation. Per-language tests exercise explicit acceptance, pending handles,
context/cancellation, timeout, and stable evidence after lost receipts. Real socket
tests cover authentication, receive credit, shutdown, and reconnect. CLI package
smokes exercise actual command shapes, forwarding, offline init, and one-shot
waiting. Release gates include generated-file parity, lint/type checks, all SDKs,
CLI checks, cross-language checks, review resolution, and production-path smoke.
