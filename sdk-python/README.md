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

- Python `>=3.10`

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

`send`, `reply`, and `forward` keep the HTTP request open until Primitive's
downstream SMTP transaction completes. In production, configure the client with
a request timeout long enough for SMTP delivery, typically 30-60 seconds:

```python
client = primitive.client(api_key="prim_test", timeout=60.0)
```

### About `wait` mode

When `wait=True`, the call returns the first downstream SMTP outcome (or
`wait_timeout_ms`, default 30000). Possible terminal `delivery_status` values:

- `delivered` accepted by the receiving MTA
- `bounced` rejected by the receiving MTA (the response is still 200 OK)
- `deferred` temporary failure, the receiving MTA may retry
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
client.reply(
    email,
    {
        "text": "Thanks for your email.",
        "html": "<p>Thanks for your email.</p>",
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

## Advanced usage

### Generated API module

Use `primitive.api` when you need the full generated HTTP API surface.

```python
from primitive.api import create_client
from primitive.api.api.account.get_account import sync as get_account

client = create_client("prim_test")
account = get_account(client=client)
```

### Lower-level webhook helpers

You can still use the raw helpers directly:

- `handle_webhook(...)`
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
