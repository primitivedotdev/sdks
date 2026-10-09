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
authentication, network requests, payments, or sends. See the
[parser contract and limits](../docs/interaction-envelopes.md).

## x402 payments

The x402 client lets one agent request a USDC payment and another pay it. It is
non-custodial: the payer signs an EIP-3009 ``transferWithAuthorization`` locally
with their own key, and the key never leaves the caller. The platform resolves
the real payee address, verifies every signed field against its own records,
enforces the org's spend policy, and settles on chain.

The model in four steps:

1. The payee registers a payout address once (proving control of it with a local
   signature).
2. The payee creates a challenge with ``charge()``, which the platform fills in
   with the registered payout address.
3. The payer signs the challenge locally and submits it with ``pay()``.
4. The platform verifies and settles.

Amounts can be given as a human USDC string (``amount_usdc="0.01"``) or as token
base units (``amount="10000"``, since USDC has 6 decimals). Networks are ``base``
(mainnet) and ``base-sepolia`` (testnet). A ``PrivateKeySigner`` holds the wallet
key in process and signs both the EIP-712 payment authorization (for ``pay``) and
the ownership message (for ``register_payout_address``); the key is never sent to
Primitive.

The public names are exported from both ``primitive`` and ``primitive.x402``:
``create_x402_client``, ``X402Client``, ``PrivateKeySigner``, ``X402Error``,
``X402Challenge``, ``X402Receipt``, ``X402PayoutAddress``, and
``X402SpendPolicy``.

### Register a payout address (payee, one time)

The signer proves control of its own address with an ownership message; the
recovered address becomes your default payout destination for that network.
``charge()`` resolves its ``pay_to`` from this directory, so register before
requesting payments. The org is resolved automatically from your API key, so you
do not pass it (supply ``org`` only to override the default).

```python
import os
import primitive

x402 = primitive.create_x402_client(api_key=os.environ["PRIMITIVE_API_KEY"])
payee = primitive.PrivateKeySigner(os.environ["PAYEE_KEY"])

x402.register_payout_address(
    signer=payee,
    network="base-sepolia",
    label="treasury",
)
```

### Create a challenge (payee)

```python
challenge = x402.charge(
    amount_usdc="0.01",  # human USDC amount
    network="base-sepolia",
    payer_org=os.environ.get("PAYER_ORG_ID"),  # org allowed to pay
    description="API call",
)
```

Pass exactly one of ``amount_usdc`` (a human USDC string like ``"0.01"``) or
``amount`` (token base units, e.g. ``"10000"``). ``amount_usdc`` is the easy
path; ``amount`` remains available when you already have a base-unit value.

Hand the returned ``challenge`` to the payer over any out-of-band channel.
``x402.get_challenge(id)`` re-hydrates a challenge by id, for example to retry
``pay()`` after a restart.

### Pay a challenge (payer)

The payer signs the interaction-bound authorization locally and submits it. The
key never leaves the caller.

```python
payer = primitive.PrivateKeySigner(os.environ["PAYER_KEY"])
receipt = x402.pay(challenge, signer=payer)

print(receipt.status, receipt.settle_tx)  # settled, on-chain tx hash
```

### Email-native payments

The challenge can also ride a real email thread instead of a synthetic id. The
payee issues it as an email; the payer signs it into an ``interaction.json``
payment step and sends it back attached to the reply.

The payee issues the challenge with ``create_email_challenge``. The ``pay_to``
payout wallet and the token asset are resolved server-side; you only supply the
addresses, amount, and network:

```python
issued = x402.create_email_challenge(
    from_="payee@your-domain.example",  # your sending address (funds receiver)
    to="payer@their-domain.example",    # the payer's address
    amount_usdc="0.01",
    network="base-sepolia",
)
# issued.interaction_id is the email thread the payment is bound to;
# issued.challenge carries the payment_requirements + nonce_binding to sign.
```

The payer receives the challenge as an ``interaction.json`` MIME part on an
inbound email. Rather than hand-parsing it, pass the part bytes to
``extract_email_challenge``, which validates the envelope and returns the typed
``X402EmailChallenge``:

```python
from primitive import extract_email_challenge

# `interaction_part` is the body of the inbound email's `interaction.json`
# attachment (str, bytes, or an already-parsed dict).
issued = extract_email_challenge(interaction_part)
```

The payer then signs the challenge locally with ``pay_email_challenge`` and
replies with the resulting envelope attached. ``pay_email_challenge`` does not
send anything; it returns the signed payment-step envelope and its canonical
JSON bytes. The validity window is computed and clamped into the accepted band
for you, so you never hand-set ``valid_before``:

```python
import base64

payer = primitive.PrivateKeySigner(os.environ["PAYER_KEY"])
built = x402.pay_email_challenge(issued, signer=payer)

# `built.json` is the interaction.json body. The payer received the challenge as
# an inbound email; reply to it with the envelope attached as `interaction.json`
# using the email client's `reply` method (see above). The platform reads the
# envelope, re-derives the interaction-bound nonce, and settles on chain.
attachment: primitive.SendAttachment = {
    "filename": "interaction.json",
    "content_type": "application/json",
    "content_base64": base64.b64encode(built.json.encode("utf-8")).decode(),
}
client.reply(
    challenge_email,
    {"text": "Payment attached.", "attachments": [attachment]},
)
```

### Signing primitives (lower level)

``pay()`` builds and signs the payment for you. When you need to drive the
signing yourself, for example to sign a challenge carried in an email reply and
submit the payment separately, the same building blocks are exported directly:

- ``derive_eip3009_nonce(binding)`` derives the interaction-bound EIP-3009
  nonce, locked to a normative vector the platform recomputes.
- ``extract_email_challenge(part)`` validates an inbound ``interaction.json``
  challenge part (str, bytes, or a parsed dict) and returns the typed
  ``X402EmailChallenge`` ready for ``pay_email_challenge``, so you never
  hand-parse the envelope.
- ``compute_payment_validity_window(challenge_expires_at_sec=..., now_sec=...)``
  returns the ``(valid_after, valid_before)`` window, landed inside the band the
  platform accepts by default: ``valid_before`` keeps at least a minimum
  settlement headroom (60s) so a near-expired challenge is not signed into a
  guaranteed rejection, and the total window is clamped to the 24h cap so a
  far-future expiry never produces an "authorization window too wide" rejection.
  Pass an explicit ``valid_before_sec``/``valid_after_sec`` to pin a bound; with
  ``clamp=False`` an out-of-band pinned value raises a specific error naming
  which bound was violated instead of silently signing a doomed authorization.
- ``sign_interaction_payment(sign=..., payer=..., domain=..., pay_to=...,
  amount=..., nonce_binding=..., valid_after=..., valid_before=...)`` derives the
  bound nonce, assembles the authorization, and signs it. The key never leaves
  the caller.
- ``build_exact_evm_payment_payload(network=..., authorization=...,
  signature=...)`` assembles the exact-EVM x402 wire payload.

```python
import math
import time
from dateutil.parser import isoparse
from primitive import (
    PrivateKeySigner,
    TokenDomain,
    NonceBinding,
    compute_payment_validity_window,
    sign_interaction_payment,
    build_exact_evm_payment_payload,
)

payer = PrivateKeySigner(os.environ["PAYER_KEY"])
pr = challenge.payment_requirements
now_sec = math.floor(time.time())

valid_after, valid_before = compute_payment_validity_window(
    challenge_expires_at_sec=math.floor(isoparse(challenge.expires_at).timestamp()),
    now_sec=now_sec,
)

authorization, signature = sign_interaction_payment(
    sign=payer.sign_typed_data,
    payer=payer.address,
    domain=TokenDomain(
        name=pr.extra["name"],
        version=pr.extra["version"],
        chain_id=84532,  # base-sepolia
        verifying_contract=pr.asset,
    ),
    pay_to=pr.pay_to,
    amount=int(pr.max_amount_required),
    nonce_binding=NonceBinding(
        interaction_id=challenge.nonce_binding["interaction_id"],
        challenge_step_id=challenge.nonce_binding["challenge_step_id"],
        challenge_nonce=challenge.nonce_binding["challenge_nonce"],
    ),
    valid_after=valid_after,
    valid_before=valid_before,
)

payment = build_exact_evm_payment_payload(
    network="base-sepolia",
    authorization=authorization,
    signature=signature,
).to_dict()
# submit `payment` to /v1/x402/challenges/{id}/pay
```

### Read and set the spend policy

The spend policy guards outbound payments: a ``paused`` kill-switch, per-payment
and daily caps (token base units, or ``None`` for no cap), and a payee
``allowlist`` (``None`` means any on-net payee, ``[]`` denies all).
``set_spend_policy`` merges: only the fields you pass change, and omitted fields
keep their current value. Pass ``None`` to clear a cap.

```python
x402.set_spend_policy({"paused": False, "max_per_payment": "5000000"})
policy = x402.get_spend_policy()

x402.list_payout_addresses()
```

### Errors

Every method raises ``primitive.X402Error`` on a client-side, transport, or
non-2xx server error. It carries ``status`` (the HTTP status, or ``0`` for a
request that never reached the server), ``body`` (the parsed error envelope when
present), and ``retry_after`` (the ``Retry-After`` header, when the server sent
one). On ``pay()``, a ``status == 0`` error means the request may not have been
sent, so the payment outcome is indeterminate.

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

Endpoints can also receive events about mail you send: `sent_email.accepted`, `sent_email.delivered`, `sent_email.failed` and `sent_email.completed`. They are opt-in: an endpoint receives them only when its `rules.event_types` lists them (with the CLI, `primitive endpoints create --url <url> --event-types sent_email.*`). An endpoint that lists them and also handles inbound mail must keep `email.received` in the list.

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

### Payment and interaction webhook events

Webhooks are not email-only. The same endpoint also receives `payment.*` settlement notifications and `interaction.x402.*` events from the x402-over-email flow. The event name is carried in the **`X-Webhook-Event` header** for every family. The body is sent verbatim with no envelope, so it is the header (not a body field) that names the event: an `email.*` body carries `event`, a `payment.*` body carries the name in `type`, and an `interaction.*` body is just `{"interaction": {...}}` with no event/type field at all.

`handle_webhook_event(...)` verifies the signature over the raw body first, then keys on the header to return a typed event for known types and an `UnknownEvent` (it does not raise) for the rest:

```python
from primitive import (
    handle_webhook_event,
    is_payment_settled_event,
    is_interaction_x402_event,
)

event = handle_webhook_event(
    body=raw_body,
    headers=request.headers,
    secret=os.environ["PRIMITIVE_WEBHOOK_SECRET"],
)

if is_payment_settled_event(event):
    # flat fields; amount is in token base units
    print(event["challenge_id"], event["amount"], event["settle_tx"])
elif is_interaction_x402_event(event):
    # interaction.x402.* event (challenge/payment/settled/...)
    ...
```

The full catalog of header values is exported as the `WEBHOOK_EVENT_TYPES` tuple:

- `email.received`, `email.bounced`, `email.tls_report`, `email.dmarc_report`, `email.dmarc_failure`
- `sent_email.accepted`, `sent_email.delivered`, `sent_email.failed`, `sent_email.completed` (opt-in)
- `payment.settled`, `payment.failed`
- `interaction.x402.challenge`, `interaction.x402.payment`, `interaction.x402.settled`, `interaction.x402.rejected`, `interaction.x402.declined`, `interaction.x402.expired`, `interaction.x402.verify_timeout`
- `interaction.ack.received`, `interaction.ack.requested`, `interaction.ack.acked`, `interaction.ack.canceled`, `interaction.ack.expired`

Signature verification runs on the raw body and is independent of the event type, so it works identically for `payment.*` and `interaction.*` bodies. Each delivery is signed once; the same `t=...,v1=...` value is sent on the primary `Primitive-Signature` header plus `X-Primitive-Signature` and `X-Webhook-Signature` for non-SDK consumers. The SDK verifies `Primitive-Signature`, and still accepts the retired `MyMX-Signature` header name when verifying older captured deliveries. `handle_webhook(...)` remains hard-typed to `email.received` for backward compatibility; reach for `handle_webhook_event(...)` when you need the full event union.

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
