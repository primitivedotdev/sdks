# `primitivedotdev`

Official Primitive Python SDK.

The default root module is intentionally small and centered on inbound/outbound
email automations:

- `primitive.receive(...)`
- `primitive.client(...)`
- `client.send(...)`
- `client.reply(...)`
- `client.forward(...)`

The generated HTTP API, raw webhook helpers, and lower-level types still remain
available for advanced use cases.

## Requirements

- Python `>=3.11`

## Installation

```bash
pip install primitivedotdev
```

The 3.0.0 preview is a prerelease, so `pip install primitivedotdev` stays on the latest stable version. To try it:

```bash
pip install primitivedotdev==3.0.0rc10
```

## Upgrading to 3.0

3.0 removes the payment client package and the payment webhook event
types, renames some generated models, makes some response fields
required or nullable, and adds `sync_conversation`. The full list is in the
[changelog](https://github.com/primitivedotdev/sdks/blob/main/CHANGELOG.md).

Enum values the API adds after your SDK version was generated no longer fail the response. An unlisted value, such as a new `error.code`, is kept as a member of its enum type and compares equal to its string.

## Basic usage

### Receive and reply

```python
import primitive

client = primitive.client(api_key="prim_test")


def webhook_handler(body: bytes, headers: dict[str, str]) -> dict[str, object]:
    email = primitive.receive(
        body=body,
        headers=headers,
        secret="whsec_...",
    )

    client.reply(email, "Thank you for your email.")
    return {"ok": True}
```

### Send a new email

```python
import primitive

client = primitive.client(api_key="prim_test")

result = client.send(
    from_email="Support <support@example.com>",
    to="alice@example.com",
    subject="Hello",
    body_text="Hi there",
    # Use a unique key per logical send. Reusing a key returns the original
    # response from the first send, which is how retries are deduplicated.
    idempotency_key="customer-key-abc123",
    wait=True,
    wait_timeout_ms=5000,
)

print(result.id, result.status, result.queue_id, result.delivery_status)
```

By default `send`, `reply`, and `forward` return as soon as Primitive accepts
the message for delivery. On `send` and `reply`, pass `wait=True` to keep the
HTTP request open until the first downstream SMTP delivery outcome; in that
mode, configure the client with a request timeout long enough for SMTP
delivery, typically 30-60 seconds:

```python
client = primitive.client(api_key="prim_test", timeout=60.0)
```

### About `wait` mode

When `wait=True`, the call returns the first downstream SMTP outcome (or
`wait_timeout_ms`, default 30000). Possible terminal `delivery_status` values:

- `delivered` accepted by the receiving MTA
- `bounced` rejected by the receiving MTA (the response is still 200 OK)
- `deferred` temporary failure (receiver said 4xx); Primitive retries the delivery later
- `wait_timeout` no outcome was observed in time. Treat as "outcome unknown."
  The send may still complete after the response returns.

### Reply from a different address

`reply()` defaults the From address to the inbound recipient (the address that
received the email). When your verified outbound domain differs from your
inbound domain, pass `from_email` explicitly:

```python
client.reply(
    email,
    "Thanks for your email.",
    from_email="notifications@outbound.example.com",
)
```

### HTML replies and waiting on the delivery outcome

`reply()` accepts a dict with `html` as a sibling of `text`, plus the same
`wait` flag the top-level `send()` takes:

```python
attachment: primitive.SendAttachment = {
    "filename": "report.txt",
    "content_base64": "aGVsbG8=",
}

client.reply(
    email,
    {
        "text": "Thanks for your email.",
        "html": "<p>Thanks for your email.</p>",
        "attachments": [attachment],
        "wait": True,
    },
)
```

`subject` is intentionally not accepted on `reply()`. Gmail's Conversation View
needs both a References match and a normalized-subject match to thread, so a
custom subject silently breaks the thread for half the recipient population.
Use `client.send(...)` if you need full subject control.

If the inbound row is not in a state we can reply to (no `Message-Id` recorded,
or content was discarded), the API returns `inbound_not_repliable` (HTTP 422)
and the SDK raises.

### Forward an inbound email

```python
client.forward(
    email,
    to="ops@example.com",
    body_text="Can you take this one?",
)
```

### Errors and rate limits

A failed call raises `primitive.PrimitiveAPIError`. It carries `status_code`,
`code`, `request_id`, `details`, and `retry_after` (the `Retry-After` header in
seconds, when the server sent one). On a 429 it also carries `rate_limit`, a
`primitive.RateLimit` with `limit`, `remaining`, `reset` (Unix seconds) and
`policy` from the `ratelimit-*` headers. These describe the limiter that
rejected the request, with its own window, which may be a send cap
(`1000;w=3600`) rather than the API request budget. `rate_limit` is `None` when
a 429 carried only `Retry-After`; wait for `retry_after` either way.

```python
from primitive import PrimitiveAPIError

try:
    client.send(from_email=sender, to=to, subject="Hi", body_text="Hello")
except PrimitiveAPIError as err:
    if err.status_code == 429:
        print(err.retry_after, err.rate_limit and err.rate_limit.policy)
```

### Per-call request options

`send`, `reply`, `forward` (and their `a*` async variants) accept the same
three per-call kwargs:

- `timeout` (seconds, float). Overrides the client-level timeout.
- `extra_headers` (dict). Merged on top of client headers.
- `idempotency_key` (str). Sent as the `Idempotency-Key` header.

```python
# Per-call timeout
client.send(
    from_email="support@example.com",
    to="alice@example.com",
    subject="Hello",
    body_text="Hi there",
    timeout=15.0,
)

# Per-call idempotency key
client.send(
    from_email="support@example.com",
    to="alice@example.com",
    subject="Hello",
    body_text="Hi there",
    idempotency_key="my-key",
)
```

A send with no idempotency key gets an automatic one: a hash of the request
content (recipients included) and a fixed 5-minute window. An identical send
inside one window is not sent again. The result says so: `idempotent_replay`
is true and `idempotency` names why.

```python
result = client.send(
    from_email="support@example.com",
    to="alice@example.com",
    subject="Hello",
    body_text="Hi there",
)
if result.idempotency is not None:
    # Nothing was sent for this call.
    result.idempotency.key_source  # "auto_content", "explicit" or "function_trigger"
    result.idempotency.original_sent_email_id  # the send that answered it
    result.idempotency.original_created_at  # ISO 8601, or None
    result.idempotency.window_seconds  # 300 for an automatic content key, else None
```

`key_source` is `explicit` when you passed a key, `auto_content` when the key
was derived from content, and `function_trigger` for a keyless send made by a
Function. A keyless reply to an email that already has a reply is also
answered with that reply; it reports `dedup_reason == "parent_already_replied"`
and no window. To send the same message again on purpose, pass an
`idempotency_key` of your own. `idempotency` is `None` on a send that went
out.

Use `client.with_options(...)` to clone the client with new defaults applied
to every subsequent call. Per-call kwargs still win over these defaults.

```python
fast = client.with_options(timeout=5.0)
fast.send(
    from_email="support@example.com",
    to="alice@example.com",
    subject="Hello",
    body_text="Hi there",
)
```

`with_options` accepts `timeout` and `extra_headers` only. `idempotency_key`
is a per-call concern and is rejected as a client default.

## The normalized email object

`primitive.receive(...)` returns a normalized inbound email object:

```python
email.sender.address
email.sender.name

email.received_by
email.received_by_all

email.reply_target.address
email.reply_subject
email.forward_subject

email.subject
email.text

email.thread.message_id
email.thread.references

email.raw
```

## Deciding whether to trust an inbound email

Every `email.received` event carries the server's SPF, DKIM, and DMARC results
on `event.email.auth`. `validate_email_auth(event.email.auth)` computes an
overall verdict (`legit`, `suspicious`, or `unknown`) with a confidence level
and reasons. The verdict alone does not say which domain authenticated: a
fully authenticated email from any domain returns `legit`.

`is_trusted_sender` anchors the verdict to an expected From domain, for
handlers that gate an action on "this really came from our domain":

```python
from primitive import is_trusted_sender

trust = is_trusted_sender(email.raw, domain="example.com")

if trust.trusted:
    ...  # authenticated mail whose From address is @example.com
elif trust.retryable:
    # Transient DNS failure during DMARC evaluation. Respond with a 5xx
    # so webhook redelivery retries this email later.
    ...
else:
    print("untrusted:", trust.reason, trust.auth.reasons)
```

`trusted` requires a `legit` verdict and a strict-parsed single From address
in the exact expected `domain` (and exact `sender=` when given).
Do not authorize based on
`email.reply_target` or `email.smtp.mail_from` (both sender-controlled), and
note that `email.sender` is parsed leniently for display and falls back to the
SMTP envelope sender, so it is not a safe authorization anchor.

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

Use `parse_interaction_envelope(str | bytes)` from `primitive.interactions` to read an
`interaction.json` attachment for display. The bounded parser returns valid,
unsupported, or invalid and preserves unknown protocols. It performs no
authentication, network requests, or sends. See the
[parser contract and limits](../docs/interaction-envelopes.md).

## Advanced usage

### Generated API module

Use `primitive.api` when you need the full generated HTTP API surface.

```python
from primitive.api import create_client
from primitive.api.api.account.get_account import sync as get_account
from primitive.api.api.memories.get_memory import sync as get_memory
from primitive.api.api.memories.set_memory import sync as set_memory
from primitive.api.models.set_memory_input import SetMemoryInput

client = create_client("prim_test")
account = get_account(client=client)

saved = set_memory(
    client=client,
    body=SetMemoryInput(key="greeting", value="hello"),
)
memory = get_memory(client=client, key="greeting")
```

Primitive Memories store durable JSON values by key. Calls default to org scope.
Function scope is available on the generated memory operations with
`scope_type="function"` and `scope_id=<function-id>`; the id is the function
UUID, not the function name.

### Searching received mail

`search_emails` calls `GET /emails/search`. Each result carries `thread_id`
(`None` until the email has been threaded) and `direction`. Pass `thread_id`
to search one conversation, `prefix=SearchEmailsPrefix.TRUE` to match the last
word of `q` as a prefix while someone is still typing, and
`count=SearchEmailsCount.FALSE` to skip the total count when you only need the
page.

```python
from primitive.api import create_client
from primitive.api.api.emails.search_emails import sync as search_emails
from primitive.api.models.search_emails_count import SearchEmailsCount
from primitive.api.models.search_emails_include_facets import (
    SearchEmailsIncludeFacets,
)
from primitive.api.models.search_emails_prefix import SearchEmailsPrefix

client = create_client("prim_test")
page = search_emails(
    client=client,
    q="quarterly invoi",
    prefix=SearchEmailsPrefix.TRUE,
    count=SearchEmailsCount.FALSE,
    include_facets=SearchEmailsIncludeFacets.FALSE,
)
```

`page.meta.total` is `None` when the request sets `count` to false and an
`int` otherwise; use `page.meta.cursor` to tell whether another page exists.
Turning `include_facets` off skips the facet aggregation entirely. Search text
containing a NUL character is rejected with a 400 validation error.

`q` takes words, `"quoted phrases"` and `field:value` filters, and every
term must match. An upper-case `OR` between two text terms (words, phrases,
`subject:` and `body:` terms) accepts either and binds tighter than the
implicit AND, so `acme invoice OR receipt` means `acme` and either `invoice` or
`receipt`. `OR` cannot join filters such as `from:`, and there is no `NOT`;
either is a 400 validation error, as is a leading or trailing `OR`. To search
for the word `OR` or `NOT` itself, write it in lower case or in double quotes.
Facet values are ordered by count descending, ties by value in byte order, and
`by_sender` and `by_domain` keep the first 20.

Date filters such as `date_from` and `date_to` take an ISO 8601 timestamp with
`Z` or a numeric UTC offset (`2026-10-02T00:00:00-04:00`); a time with no zone,
or a bare date, is rejected.

Upgrading to 2.0: `EmailSearchMeta.total` is now typed `int | None`. It is
`None` only when the request sets `count=SearchEmailsCount.FALSE`; type-checked
code that treats it as an `int` needs a `None` check. Search results also gain
the required `thread_id` and `direction` fields.

### Sent email webhook events

Endpoints can also receive events about mail you send: `sent_email.accepted`, `sent_email.delivered`, `sent_email.failed` and `sent_email.completed`. They are opt-in: an endpoint receives them only when its `rules.event_types` lists them (with the CLI, `primitive endpoints create --url <url> --event-types 'sent_email.*'`). An endpoint that lists them and also handles inbound mail must keep `email.received` in the list.

Each body carries `event`, and is validated against the `sent_email.*` JSON schema when parsed. Each recipient (To, Cc and Bcc) of a send gets exactly one `sent_email.delivered` or `sent_email.failed` with `scope` `"recipient"`, for up to 100 recipients. Mail relay sends with more recipients report the rest in roll-ups (`scope` `"message"`, `reason` `"rollup"`), sends recorded before per-recipient results can report one legacy message-level result (`reason` `"legacy_message_result"`), and relay recipients delivered inside the sender's own mail system get no event and are listed in `summary.not_relayed_recipients`. So do not wait for a per-recipient event per address: use `sent_email.completed`, which carries the totals once every recipient is final. Deduplicate on the event `id` (equal to the `X-Webhook-Id` header), and check that `delivery.endpoint_id` is the endpoint that received the request.

```python
from primitive import (
    handle_webhook_event,
    is_sent_email_completed_event,
    is_sent_email_recipient_result_event,
)

event = handle_webhook_event(body=raw_body, headers=request.headers, secret=secret)

if is_sent_email_recipient_result_event(event) and event.event == "sent_email.failed":
    # event.recipient.type is "to", "cc" or "bcc"
    print(event.recipient.address, event.outcome.smtp_enhanced_status_code)
elif is_sent_email_completed_event(event):
    print(event.summary.recipient_count, event.summary.delivered, event.summary.failed)
```

Parsed events are Pydantic models (`SentEmailAcceptedEvent`, `SentEmailRecipientResultEvent`, `SentEmailRollupResultEvent`, `SentEmailLegacyMessageResultEvent`, `SentEmailCompletedEvent`). `validate_sent_email_event` / `safe_validate_sent_email_event` validate an already parsed body, and the schema is exported as `sent_email_event_json_schema`. An `email.bounced` event's `email.analysis.bounce` carries `sent_email_id` (the send the bounce belongs to, or None when it could not be linked) and `failed_recipients` (every failed address, up to 100).

### Email understanding and email rules

These types and helpers are in 3.0.0 and later, not in 2.x; until 3.0.0 is the latest release, install the preview (see Installation).

For organizations with email rules enabled, `email.received` events carry `email.analysis.understanding` (`EmailUnderstanding`): a `version`, a `status`, and when `ready`, `facts` keyed by name, each with a `value` and `confidence`. Rule-granted deliveries also list the matching `rules`. Treat an unfamiliar `status`, fact name or value as one added after your SDK was built. `email.analysis.sender` (`SenderAnalysis`) is the sender authentication verdict.

`matched_rules(email, rule_id=None)` returns the `UnderstandingRule` entries of a rule-granted delivery. It takes the email `receive(...)` returns or the event `handle_webhook(...)` returns, returns an empty list when no rule granted the delivery, and skips entries without a rule id. With `rule_id` it keeps only that rule's entries.

```python
import primitive
from primitive import matched_rules

email = primitive.receive(body=body, headers=headers, secret="whsec_...")

for rule in matched_rules(email):
    print(rule.id, rule.name, rule.explanation)
```

The Email Rules operations in `primitive.api.api.email_rules` need a member's own OAuth token that is not narrowed, such as the one `primitive login` stores. API keys and connected agent credentials are refused.

### Interaction webhook events

Webhooks are not email-only. The same endpoint also receives `interaction.*` events. The event name is carried in the **`X-Webhook-Event` header** for every family. The body is sent verbatim with no envelope, so it is the header (not a body field) that names the event: an `email.*` body carries `event`, and an `interaction.*` body is just `{"interaction": {...}}` with no event/type field at all.

`handle_webhook_event(...)` verifies the signature over the raw body first, then keys on the header to return a typed event for known types and an `UnknownEvent` (it does not raise) for the rest:

```python
from primitive import handle_webhook_event

event = handle_webhook_event(
    body=raw_body,
    headers=request.headers,
    secret=os.environ["PRIMITIVE_WEBHOOK_SECRET"],
)

if isinstance(event, dict) and event.get("event") == "interaction.ack.acked":
    print(event.get("interaction"))
```

The full catalog of header values is exported as the `WEBHOOK_EVENT_TYPES` tuple:

- `email.received`, `email.bounced`, `email.tls_report`, `email.dmarc_report`, `email.dmarc_failure`
- `sent_email.accepted`, `sent_email.delivered`, `sent_email.failed`, `sent_email.completed` (opt-in)
- `interaction.ack.received`, `interaction.ack.requested`, `interaction.ack.acked`, `interaction.ack.canceled`, `interaction.ack.expired`

Signature verification runs on the raw body and is independent of the event type, so it works identically for `sent_email.*` and `interaction.*` bodies. Each delivery is signed once; the same `t=...,v1=...` value is sent on the primary `Primitive-Signature` header plus `X-Primitive-Signature` and `X-Webhook-Signature` for non-SDK consumers. The SDK verifies `Primitive-Signature`, and still accepts the retired `MyMX-Signature` header name when verifying older captured deliveries. `handle_webhook(...)` remains hard-typed to `email.received` for backward compatibility; reach for `handle_webhook_event(...)` when you need the full event union.

### Lower-level webhook helpers

You can still use the raw helpers directly:

- `handle_webhook(...)`
- `handle_webhook_event(...)`
- `parse_webhook_event(...)`
- `verify_webhook_signature(...)`
- `validate_email_received_event(...)`

## Development

From `sdks/sdk-python`:

```bash
uv sync --dev
uv run python scripts/generate_schema_module.py
uv run python scripts/generate_models.py
uv run python scripts/generate_api_client.py
uv run pytest
uv run ruff check .
uv run basedpyright
```

Or from repo root `sdks/`:

```bash
make python-generate
make python-check
make python-build
```

## Keep a conversation in sync

`sync_conversation` reads `GET /emails/{id}/conversation?since=` and pages
through `has_more`. Without a state it starts from `since=start`; pass the
previous result back to read only what changed.

```python
from primitive import PrimitiveClient, sync_conversation

client = PrimitiveClient(api_key)
sync = sync_conversation(client, email_id)
# later
sync = sync_conversation(client, email_id, sync)
print(len(sync.messages), sync.cursor)
```

A message can come back in a later read with more `copies`, or under a new
id when a better copy of it becomes visible. The helper upserts messages by
`id`, treats two entries as the same message when either one's id is in the
other's `copies` or `sent_email_id` (the newer one wins), and keeps the list
ordered by timestamp. A timestamp without an offset is read as UTC; one that
is not a valid RFC 3339 date-time becomes null and sorts last. A sync stops
with an error after 1000 pages. A `since` read does not report deleted
messages, so sync from scratch (no state) now and then to reconcile. The merge on its own is
`merge_conversation_messages(held, delta)`.

## Delete mailbox history

Use `delete_sent_email` from `primitive.api.api.sending` and
`remove_agent_connection` from `primitive.api.api.agent_connections`.
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

```python
from primitive import PrimitiveClient, LocalEvent, EventContext

client = PrimitiveClient(api_key="pconn_...")

async def receive(event: LocalEvent, context: EventContext) -> None:
    await app.receive(event)  # Accept or enqueue within 30 seconds.

listener = await client.events.listen(receive, subscription="my-agent",
                                      events=["email.received"])
await listener.wait_closed()  # Or supervise alongside your existing application.
# During application shutdown: await listener.close()
```

The SDK automatically registers a named durable subscription and reconnects over
WebSocket. `listen` returns once ready. Its async context manager closes on exit.
A handler may use `context.signal` to observe its acceptance deadline. Returning
accepts responsibility; run longer work after enqueuing it. Delivery is at least
once, so deduplicate side effects by `event.id` when needed.

```python
delivery = await client.events.wait(subscription="my-agent", timeout=60)
if delivery is not None:
    await app.receive(delivery.event)
    await delivery.ack()  # Or await delivery.retry().
```

Timeout is in seconds and returns `None`. Cancel the waiting task to stop it.
Waiting does not acknowledge on return. A pending handle expires after the
30-second acceptance deadline. Same subscription shares work across consumers;
different names receive independent copies. Restart with the same name; close
preserves pending work. New subscriptions do not backfill history.
`on_status` reports reconnects, handler errors, and gaps; `on_gap="error"` stops
on a gap. Use `transport="poll"` explicitly when WebSocket access is unavailable.

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
