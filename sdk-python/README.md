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
    from_email="support@example.com",
    to="alice@example.com",
    subject="Hello",
    body_text="Hi there",
)

print(result.queue_id, result.accepted, result.rejected)
```

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
