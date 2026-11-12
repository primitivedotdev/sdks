# `github.com/primitivedotdev/sdks/sdk-go/v3`

Official Primitive Go SDK.

The package is intentionally centered on a small inbound/outbound email
automation flow:

- `primitive.Receive(...)`
- `primitive.NewClient(...)`
- `client.Send(...)`
- `client.Reply(...)`
- `client.Forward(...)`

The generated HTTP API and lower-level webhook helpers remain available for
advanced use.

## Requirements

- Go `>=1.26`

## Installation

```bash
go get github.com/primitivedotdev/sdks/sdk-go/v3@latest
```

To try the 3.0.0 preview, pin it:

```bash
go get github.com/primitivedotdev/sdks/sdk-go/v3@v3.0.0-preview.9
```

## Upgrading to v3

The module path now ends in `/v3`. Update your imports and dependency:

```bash
go get github.com/primitivedotdev/sdks/sdk-go/v3@latest
```

```go
import (
	primitive "github.com/primitivedotdev/sdks/sdk-go/v3"
	primitiveapi "github.com/primitivedotdev/sdks/sdk-go/v3/api"
)
```

Then remove the old `github.com/primitivedotdev/sdks/sdk-go/v2` requirement
with `go mod tidy`. Package names are unchanged. The other breaking changes in
v3 are listed in the [changelog](https://github.com/primitivedotdev/sdks/blob/main/CHANGELOG.md).

### Upgrading from v1 to v2

v2 changes two types on email search results from `SearchEmails`:

- `EmailSearchMeta.Total` is now a `NilInt` instead of an `int`. It is null
  only when the request sets `Count` to `SearchEmailsCountFalse`; otherwise it
  holds a number. Read it with `Meta.Total.Get()` or `Meta.Total.Or(0)`.
- `EmailSearchResult.ThreadID` is now a `NilUUID` instead of an `OptNilUUID`,
  because search results always include the field. Read it with
  `ThreadID.Get()`.

Search results also gain a `Direction` field, and `SearchEmailsParams` gains
the `ThreadID`, `Prefix` and `Count` options. See
[Searching received mail](#searching-received-mail).

Enum values the API adds after your SDK version was generated no longer fail the response. An unlisted value, such as a new `error.code`, is kept in the typed string.

## Basic usage

### Receive and reply

```go
package main

import (
	"context"
	"log"
	"time"

	primitive "github.com/primitivedotdev/sdks/sdk-go/v3"
)

func handle(ctx context.Context, body []byte, headers map[string]string) {
	email, err := primitive.Receive(primitive.HandleWebhookOptions{
		Body:    body,
		Headers: headers,
		Secret:  "whsec_...",
	})
	if err != nil {
		log.Printf("invalid webhook: %v", err)
		return
	}

	client, err := primitive.NewClient("prim_test")
	if err != nil {
		log.Fatal(err)
	}

	_, err = client.Reply(ctx, email, primitive.ReplyParams{BodyText: "Thank you for your email."})
	if err != nil {
		log.Printf("reply failed: %v", err)
	}
}
```

### Send a new email

```go
ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
defer cancel()
wait := true

result, err := client.Send(ctx, primitive.SendParams{
	From:    "Support <support@example.com>",
	To:      "alice@example.com",
	Subject: "Hello",
	BodyText: "Hi there",
	// Use a unique key per logical send. Reusing a key returns the original
	// response from the first send, which is how retries are deduplicated.
	IdempotencyKey: "customer-key-abc123",
	Wait:           &wait,
	WaitTimeoutMs:  5000,
})
```

With `Wait` set to true, `Send` and `Reply` keep the HTTP request open until
Primitive's downstream SMTP transaction completes; when `Wait` is unset the
call returns as soon as the API accepts the message. `Forward` has no `Wait`
option and always returns on acceptance. When waiting, use a context deadline
long enough for SMTP delivery, typically 30-60 seconds.

### Per-call timeout and cancellation

Every client method that performs a network request takes `ctx context.Context`
as its first argument, so per-call deadlines, cancellation, and request-scoped
values use the standard library directly. There is no separate `RequestOptions`
struct.

```go
// Per-call timeout: cancel after 15 seconds.
ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
defer cancel()
_, err := client.Send(ctx, primitive.SendParams{
    From:    "Support <support@example.com>",
    To:      "alice@example.com",
    Subject: "Hello",
    BodyText: "Hi there",
})

// Per-call cancellation: bail out from another goroutine.
ctx, cancel := context.WithCancel(context.Background())
go func() { <-userBailoutSignal; cancel() }()
_, err := client.Send(ctx, primitive.SendParams{ /* params */ })
```

A canceled `ctx` surfaces as `context.Canceled`; a deadline exceeded surfaces
as `context.DeadlineExceeded`. Both are distinct from API errors returned as
`*primitive.APIError`, so callers can tell a client-side abort apart from a
server response.

For idempotent retries, set `IdempotencyKey` on `SendParams` or
`ForwardParams` (see the `Send` example above). The same key replays the
original response.

A send with no idempotency key gets an automatic one: a hash of the request
content (recipients included) and a fixed 5-minute window. An identical send
inside one window is not sent again. The result says so: `IdempotentReplay`
is true and `Idempotency` names why.

```go
result, err := client.Send(ctx, params)
if err != nil {
	return err
}
if result.Idempotency != nil {
	// Nothing was sent for this call.
	_ = result.Idempotency.KeySource           // explicit, auto_content or function_trigger
	_ = result.Idempotency.OriginalSentEmailID // the send that answered it
	_ = result.Idempotency.OriginalCreatedAt   // *time.Time, nil when not reported
	_ = result.Idempotency.WindowSeconds       // *int: 300 for an automatic content key, else nil
}
```

`KeySource` is `primitive.SendIdempotencyKeySourceExplicit` when you passed a
key, `SendIdempotencyKeySourceAutoContent` when the key was derived from
content, and `SendIdempotencyKeySourceFunctionTrigger` for a keyless send made
by a Function. A keyless reply to an email that already has a reply is also
answered with that reply; it reports
`DedupReason == primitive.DedupReasonParentAlreadyReplied` and no window. To
send the same message again on purpose, set an `IdempotencyKey` of your own.
`Idempotency` is nil on a send that went out.

Code that calls the generated `api` package directly: `SendEmail` and
`ReplyToEmail` now return `*api.SendEmailOKHeaders` and
`*api.ReplyToEmailOKHeaders` on a 200. The body is under `.Response`, beside
the `Idempotent-Replayed` response header.

### About `Wait` mode

When `Wait` is true, the call returns the first downstream SMTP outcome (or
`WaitTimeoutMs`, default 30000). Possible terminal `DeliveryStatus` values:

- `delivered` accepted by the receiving MTA
- `bounced` rejected by the receiving MTA (the response is still 200 OK)
- `deferred` temporary failure, the receiving MTA may retry
- `wait_timeout` no outcome was observed in time. Treat as "outcome unknown."
  The send may still complete after the response returns.

### Reply from a different address

`Reply` defaults the From address to the inbound recipient (the address that
received the email). When your verified outbound domain differs from your
inbound domain, pass `From` explicitly:

```go
_, err = client.Reply(ctx, email, primitive.ReplyParams{
	BodyText: "Thanks for your email.",
	From:     "notifications@outbound.example.com",
})
```

### HTML replies and waiting on the delivery outcome

`Reply` accepts `BodyHTML` as a sibling of `BodyText`, plus the same `Wait`
flag the top-level `Send` takes:

```go
wait := true
_, err = client.Reply(ctx, email, primitive.ReplyParams{
	BodyText: "Thanks for your email.",
	BodyHTML: "<p>Thanks for your email.</p>",
	Attachments: []primitive.SendAttachment{
		{
			Filename:      "report.txt",
			ContentBase64: "aGVsbG8=",
		},
	},
	Wait:     &wait,
})
```

A subject override is intentionally not exposed on `ReplyParams`. Gmail's
Conversation View needs both a References match and a normalized-subject match
to thread, so a custom subject silently breaks the thread for half the
recipient population. Use `client.Send(...)` if you need full subject control.

If the inbound row is not in a state we can reply to (the email was rejected,
its content was discarded, or no recipient was recorded), the API returns
`inbound_not_repliable` (HTTP 422) and the SDK returns an error. A missing
`Message-Id` does not block the reply; it only omits the threading headers.

### Forward an inbound email

```go
_, err = client.Forward(context.Background(), email, primitive.ForwardParams{
	To:       "ops@example.com",
	BodyText: "Can you take this one?",
})
```

### Errors and rate limits

A failed call returns a `*primitive.APIError` (use `errors.As`). It carries
`StatusCode`, `Code`, `Message`, `RequestID`, `Details`, and `RetryAfter` (the
`Retry-After` header in seconds, when the server sent one). On a 429 it also
carries `RateLimit`, with `Limit`, `Remaining`, `Reset` (Unix seconds) and
`Policy` from the `ratelimit-*` headers. These describe the limiter that
rejected the request, with its own window, which may be a send cap
(`1000;w=3600`) rather than the API request budget. `RateLimit` is nil when a
429 carried only `Retry-After`; wait for `RetryAfter` either way.

```go
var apiErr *primitive.APIError
if errors.As(err, &apiErr) && apiErr.StatusCode == 429 {
	if apiErr.RateLimit != nil && apiErr.RateLimit.Policy != nil {
		fmt.Println("limited by", *apiErr.RateLimit.Policy)
	}
}
```

## The normalized email object

`primitive.Receive(...)` returns a normalized inbound email object with fields
such as:

```go
email.Sender.Address
email.ReceivedBy
email.ReplyTarget.Address
email.ReplySubject
email.ForwardSubject
email.Subject
email.Text
email.Thread.MessageID
email.Thread.References
email.Raw
```

## Deciding whether to trust an inbound email

Every `email.received` event carries the server's SPF, DKIM, and DMARC results
on `event.Email.Auth`. `ValidateEmailAuth` computes an overall verdict
(`legit`, `suspicious`, or `unknown`) with a confidence level and reasons. The
verdict alone does not say which domain authenticated: a fully authenticated
email from any domain returns `legit`.

`IsTrustedSender` anchors the verdict to an expected From domain, for handlers
that gate an action on "this really came from our domain":

```go
trust, err := primitive.IsTrustedSender(email.Raw, primitive.TrustedSenderOptions{
    Domain: "example.com",
})
if err != nil {
    // invalid options
}
switch {
case trust.Trusted:
    // authenticated mail whose From address is @example.com
case trust.Retryable:
    // transient DNS failure during DMARC evaluation; respond 5xx so
    // webhook redelivery retries this email later
default:
    log.Printf("untrusted: %s %v", trust.Reason, trust.Auth.Reasons)
}
```

`Trusted` requires a `legit` verdict and a strict-parsed single From address
in the exact expected `Domain` (and exact `Sender` when given).
Do not authorize based on
`email.ReplyTarget` or `email.Raw.Email.SMTP.MailFrom` (both
sender-controlled), and note that the normalized `email.Sender` is parsed
leniently for display and falls back to the SMTP envelope sender, so it is not
a safe authorization anchor.

The reported DMARC domain can be an organizational domain such as `example.com`
for mail from `player@mail.example.com`. When it differs from the expected
From domain, the helper requires DMARC pass and a passing, aligned DKIM signature
from that exact expected domain. For a managed inbox such as
`player@test-inbox.primitive.email`, it also accepts `primitive.email` as the
signer, relying on Primitive to authorize the sending identity. A sibling
signer, an arbitrary parent signer, or SPF alone cannot satisfy this exception.
The qualifying signature must use RSA-SHA256 with a reported key size of at
least 1024 bits, or Ed25519-SHA256. Missing RSA key size or an unknown algorithm
fails closed on this path. Continue passing the full subdomain as the expected domain.

Use this helper only with a verified Primitive webhook or an event obtained
through the authenticated API. It consumes the server's authentication results;
it does not verify DKIM or the webhook signature itself.

## Interaction envelopes

Use `ParseInteractionEnvelope([]byte)` or `ParseInteractionEnvelopeString(string)` to read an
`interaction.json` attachment for display. The bounded parser returns valid,
unsupported, or invalid and preserves unknown protocols. It performs no
authentication, network requests, or sends. See the
[parser contract and limits](../docs/interaction-envelopes.md).

## Advanced usage

### Generated API package

Use the sibling `api` package when you want the full generated HTTP API surface.

```go
import primitiveapi "github.com/primitivedotdev/sdks/sdk-go/v3/api"

client, err := primitiveapi.NewAPIClient("prim_test")
if err != nil {
	log.Fatal(err)
}

res, err := client.SetMemory(ctx, &primitiveapi.SetMemoryInput{
	Key:   "greeting",
	Value: primitiveapi.NewStringMemoryJsonValue("hello"),
}, primitiveapi.SetMemoryParams{})
if err != nil {
	log.Fatal(err)
}
_ = res
```

Primitive Memories store durable JSON values by key. Calls default to org scope.
Function-scoped memories use the function id UUID, not the function name. The
generated memory methods are `SetMemory`, `GetMemory`, `DeleteMemory`, and
`SearchMemories`.

#### Fields the client does not know yet

The generated types hold the fields the API declared when this module was
generated. When a response carries a field the types do not have, for example
one the API added after this release, the decoder skips it: decoding still
succeeds, but the value is not available on the Go struct and is not kept
anywhere else. The Node and Python SDKs pass such fields through; this module
does not. To read a new field, upgrade to a release generated from a spec that
declares it. If you need the raw JSON before then, make the request with your
own `http.Client` and decode the body yourself.

### Searching received mail

`SearchEmails` calls `GET /emails/search`. Each `EmailSearchResult` carries
`ThreadID` (a `NilUUID`, null until the email has been threaded) and
`Direction`. Set `ThreadID` to search one conversation, `Prefix` to match the
last word of `Q` as a prefix while someone is still typing, and `Count` to
`SearchEmailsCountFalse` to skip the total count when you only need the page.

```go
res, err := client.SearchEmails(ctx, primitiveapi.SearchEmailsParams{
	Q:      primitiveapi.NewOptString("quarterly invoi"),
	Prefix: primitiveapi.NewOptSearchEmailsPrefix(primitiveapi.SearchEmailsPrefixTrue),
	Count:  primitiveapi.NewOptSearchEmailsCount(primitiveapi.SearchEmailsCountFalse),
})
if err != nil {
	log.Fatal(err)
}
if page, ok := res.(*primitiveapi.SearchEmailsOK); ok {
	if total, ok := page.Meta.Total.Get(); ok {
		fmt.Println("matches:", total)
	}
}
```

`Meta.Total` is a `NilInt`: null when the request sets `Count` to false, a
number otherwise. Use `Meta.Cursor` to tell whether another page exists. Search
text containing a NUL character is rejected with a 400 validation error.

`q` takes words, `"quoted phrases"` and `field:value` filters, and every
term must match. An upper-case `OR` between two text terms (words, phrases,
`subject:` and `body:` terms) accepts either and binds tighter than the
implicit AND, so `acme invoice OR receipt` means `acme` and either `invoice` or
`receipt`. `OR` cannot join filters such as `from:`, and there is no `NOT`;
either is a 400 validation error, as is a leading or trailing `OR`. To search
for the word `OR` or `NOT` itself, write it in lower case or in double quotes.
Facet values are ordered by count descending, ties by value in byte order, and
`by_sender` and `by_domain` keep the first 20.

Date filters such as `DateFrom` and `DateTo` take an ISO 8601 timestamp with
`Z` or a numeric UTC offset (`2026-10-02T00:00:00-04:00`); a time with no zone,
or a bare date, is rejected.
A `time.Time` in any location is sent with its offset.

### Sent email webhook events

Endpoints can also receive events about mail you send: `sent_email.accepted`, `sent_email.delivered`, `sent_email.failed` and `sent_email.completed`. They are opt-in: an endpoint receives them only when its `rules.event_types` lists them (with the CLI, `primitive endpoints create --url <url> --event-types 'sent_email.*'`). An endpoint that lists them and also handles inbound mail must keep `email.received` in the list.

Each body carries `event`, and is validated against the `sent_email.*` JSON schema when parsed. Each recipient (To, Cc and Bcc) of a send gets exactly one `sent_email.delivered` or `sent_email.failed` with `scope` `"recipient"`, for up to 100 recipients. Mail relay sends with more recipients report the rest in roll-ups (`scope` `"message"`, `reason` `"rollup"`), sends recorded before per-recipient results can report one legacy message-level result (`reason` `"legacy_message_result"`), and relay recipients delivered inside the sender's own mail system get no event and are listed in `summary.not_relayed_recipients`. So do not wait for a per-recipient event per address: use `sent_email.completed`, which carries the totals once every recipient is final. Deduplicate on the event `id` (equal to the `X-Webhook-Id` header), and check that `delivery.endpoint_id` is the endpoint that received the request.

```go
event, err := primitive.HandleWebhookEvent(primitive.HandleWebhookOptions{
	Body:    rawBody,
	Headers: r.Header,
	Secret:  secret,
})
if err != nil {
	return err
}
if sent, ok := event.(primitive.SentEmailEvent); ok {
	switch {
	case sent.Event == primitive.SentEmailEventFailed && sent.IsRecipientResult():
		// sent.Recipient.Type is "to", "cc" or "bcc"
		status := "(none)"
		if code := sent.Outcome.SMTPEnhancedStatusCode; code != nil {
			status = *code
		}
		log.Println(sent.Recipient.Address, status)
	case sent.Event == primitive.SentEmailEventCompleted:
		log.Println(sent.Summary.RecipientCount, sent.Summary.Delivered, sent.Summary.Failed)
	}
}
```

`ValidateSentEmailEvent` / `SafeValidateSentEmailEvent` validate an already parsed body, and the schema is exported as `SentEmailEventJSONSchema`. An `email.bounced` event's `Email.Analysis.Bounce` carries `SentEmailID` (the send the bounce belongs to, or nil when it could not be linked) and `FailedRecipients` (every failed address, up to 100).

### Email understanding and email rules

For organizations with email rules enabled, `email.received` events carry `Email.Analysis.Understanding` (`*EmailUnderstanding`): a `Version`, a `Status`, and when `"ready"`, `Facts` keyed by name, each with a `Value` (read with `AsBool`, `AsString`, `AsStrings` or `AsNumber`) and `Confidence`. Rule-granted deliveries also list the matching `Rules`. Treat an unfamiliar `Status`, fact name or value as one added after your SDK was built. `Email.Analysis.Sender` (`*SenderAnalysis`) is the sender authentication verdict.

`EmailAnalysis.MatchedRules()` returns the `UnderstandingRule` entries of a rule-granted delivery, so it reads the same from the `ReceivedEmail` that `Receive` returns (`email.Analysis`) and the event `HandleWebhook` returns (`event.Email.Analysis`). It returns nil when no rule granted the delivery and skips entries without a rule ID. `MatchedRulesFor(ruleID)` keeps only that rule's entries.

```go
email, err := primitive.Receive(primitive.HandleWebhookOptions{
	Body:    body,
	Headers: headers,
	Secret:  "whsec_...",
})
if err != nil {
	return err
}

for _, rule := range email.Analysis.MatchedRules() {
	fmt.Println(rule.ID, rule.Name, rule.Explanation)
}
```

The Email Rules operations on the generated `api` client need a member's own OAuth token that is not narrowed, such as the one `primitive login` stores. API keys and connected agent credentials are refused.

### Interaction webhook events

Webhooks are not email-only. The same endpoint also receives `interaction.*` events. The event name is carried in the **`X-Webhook-Event` header** for every family. The body is sent verbatim with no envelope, so it is the header (not a body field) that names the event: an `email.*` body carries `event`, and an `interaction.*` body is just `{"interaction": {...}}` with no event/type field at all.

`HandleWebhookEvent(...)` verifies the signature over the raw body first, then keys on the header to return a typed event for known types and an `UnknownEvent` (it does not error) for the rest:

```go
event, err := primitive.HandleWebhookEvent(primitive.HandleWebhookOptions{
	Body:    rawBody,
	Headers: req.Header,
	Secret:  os.Getenv("PRIMITIVE_WEBHOOK_SECRET"),
})
if err != nil {
	// signature/verification failure
}

if interaction, ok := event.(primitive.InteractionEvent); ok {
	log.Println(interaction.Event, interaction.Payload["interaction"])
}
```

The full catalog of header values is exported as the `WebhookEventTypes` slice:

- `email.received`, `email.bounced`, `email.tls_report`, `email.dmarc_report`, `email.dmarc_failure`
- `sent_email.accepted`, `sent_email.delivered`, `sent_email.failed`, `sent_email.completed` (opt-in)
- `interaction.ack.received`, `interaction.ack.requested`, `interaction.ack.acked`, `interaction.ack.canceled`, `interaction.ack.expired`

Signature verification runs on the raw body and is independent of the event type, so it works identically for `sent_email.*` and `interaction.*` bodies. Each delivery is signed once; the same `t=...,v1=...` value is sent on the primary `Primitive-Signature` header plus `X-Primitive-Signature` and `X-Webhook-Signature` for non-SDK consumers. The SDK verifies `Primitive-Signature`, and still accepts the retired `MyMX-Signature` header name when verifying older captured deliveries. `HandleWebhook(...)` and `Receive(...)` decide by the event type in the `X-Webhook-Event` header, or the body's `event` without it. For an `email.*` type they validate the signed body against the email event schema and return it, so bounces and reports come back as well as received mail: check `event.Event`, or `email.Raw.Event` from `Receive`. The Node and Python SDKs validate the body against the email event schema whatever the header says. Reach for `HandleWebhookEvent(...)` when you need the full event union.

### Lower-level webhook helpers

Advanced users can still work directly with:

- `HandleWebhook(...)`
- `HandleWebhookEvent(...)`
- `ParseWebhookEvent(...)` (pass the `X-Webhook-Event` value as the optional second argument)
- `VerifyWebhookSignature(...)`

## Development

From `sdks/sdk-go`:

```bash
go test ./...
go test -run TestSharedCompatibilityFixtures ./...
gofmt -w .
```

Or from repo root `sdks/`:

```bash
make go-generate
make go-check
make go-build
```

## Keep a conversation in sync

`SyncConversation` reads `GET /emails/{id}/conversation?since=` and pages
through `has_more`. With a nil state it starts from `since=start`; pass the
previous result back to read only what changed.

```go
sync, err := client.SyncConversation(ctx, emailID, nil)
if err != nil {
	log.Fatal(err)
}
// later
sync, err = client.SyncConversation(ctx, emailID, sync)
```

The package-level `primitive.SyncConversation(ctx, reader, emailID, state)`
takes any `ConversationReader`, such as the generated `*primitiveapi.Client`.

A message can come back in a later read with more `Copies`, or under a new
id when a better copy of it becomes visible. The helper upserts messages by
`ID`, treats two entries as the same message when either one's ID is in the
other's `Copies` or `SentEmailID` (the newer one wins), and keeps the list
ordered by timestamp. A timestamp without an offset is read as UTC; one that
is not a valid RFC 3339 date-time becomes null and sorts last. A sync stops
with an error after 1000 pages. A `since` read does not report deleted
messages, so sync from scratch (no state) now and then to reconcile. The merge on its own is
`MergeConversationMessages(held, delta)`.

## Delete mailbox history

Use `DeleteSentEmail` and `RemoveAgentConnection` on the generated `api.Client`.
Sent-mail deletion removes sender history and owned attachments, not recipient
copies or delivery already admitted. Cancel scheduled sends first; ineligible
states return 409. Retrying a completed DELETE succeeds. After 500 or 503, files
may already be removed; retry the same DELETE.

Connection removal requires an owner or admin session or OAuth token and a
previously revoked connection. It preserves mail, notes and the external runtime.
Active connections return 409; missing records return 404.

Send and reply preserve HTTP 410 `sent_email_deleted` and its
`details.idempotent_replay` value. This is a refusal to resend deleted history;
do not replace the idempotency key or retry as a fresh message to bypass it.

## Receive events in your process

Event subscriptions require a connected agent credential (an API key starting
with `pconn_`), and each one receives that agent's own address. An account API
key is refused with `pull_subscription_requires_agent_connection` before any
request is made; receive mail with `GET /emails?since=<cursor>&wait=30` or an
HTTP webhook endpoint instead.

```go
client, err := primitive.NewClient(apiKey) // a connected agent key, pconn_...
if err != nil { return err }
listener, err := client.Events.Listen(ctx, func(ctx context.Context, event primitive.LocalEvent) error {
    return app.Receive(ctx, event) // Accept or enqueue within 30 seconds.
}, primitive.EventOptions{Subscription: "my-agent", Events: []string{"email.received"}})
if err != nil { return err }
return listener.Wait()
// During application shutdown: listener.Close(shutdownContext)
```

The SDK registers the named subscription and reconnects over WebSocket. Listen
returns once ready and then runs alongside the application. Returning nil from
the handler accepts responsibility. The handler context is canceled on its
30-second acceptance deadline. Longer work should run after enqueueing.

```go
delivery, err := client.Events.Wait(ctx, primitive.EventOptions{Subscription: "my-agent"})
if err != nil { return err }
if err := app.Receive(delivery.Context, delivery.Event); err != nil {
    return delivery.Retry()
}
return delivery.Ack()
```

Use a context deadline to bound waiting; timeout returns context.DeadlineExceeded.
Wait does not acknowledge before the application runs. LocalEvent preserves the
exact Body and Headers, canonical ID and Type, and raw JSON Data. Decode parses
Data into an application or SDK event type. Delivery is at least once; deduplicate
side effects by ID when needed. Same name shares work; different names receive
independent copies. Closing preserves the queue. New names do not backfill.
OnStatus reports reconnects, handler failures, and gaps; OnGapError stops on a gap.
Set Transport to "poll" explicitly when WebSocket access is unavailable.

### Connected-agent listeners

Use the agent's existing connected-address credential with the same listener API.
The server automatically restricts its private subscription to inbound email for
that address. No owner credential, recipient filter, or relay is required. Names
are isolated per credential. Revoking or replacing the credential removes its
subscriptions and queued deliveries; reconnect with the new credential to start
receiving new events.

Address-scoped events contain parsed message content in `email.parsed`.
`email.content.raw` and `email.content.download` are null. Signed download links,
account routing metadata, and other SMTP envelope recipients are not exposed.
Attachments can be fetched through the authenticated email attachment API.

For typed email events, `event.Email.Content.Restricted` reports unavailable raw
content and downloads. The existing `Raw` and `Download` value fields remain
compatible with struct literals; JSON round trips preserve restricted fields as null.
