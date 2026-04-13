# `primitivedotdev`

Official Primitive Python SDK for webhook verification and validation.

This package helps you:

- verify Primitive webhook signatures
- parse webhook request bodies
- validate webhook payloads against the canonical JSON schema
- work with typed `email.received` events in Python

Validated events are returned as generated Pydantic models derived from the canonical JSON schema.

## Requirements

- Python `>=3.10`

## Installation

```bash
pip install primitivedotdev
```

## Basic Usage

```python
from primitive import PrimitiveWebhookError, handle_webhook


def webhook_handler(body: bytes, headers: dict[str, str]) -> dict[str, object]:
    try:
        event = handle_webhook(
            body=body,
            headers=headers,
            secret="whsec_...",
        )

        print("Email from:", event.email.headers.from_)
        print("Subject:", event.email.headers.subject)
        return {"received": True}
    except PrimitiveWebhookError as error:
        return {"error": error.code, "message": str(error)}
```

## Core API

### Main functions

- `handle_webhook(...)`
  - verifies the webhook signature
  - decodes and parses the request body
  - validates the payload
  - returns a typed `EmailReceivedEvent`
- `parse_webhook_event(input)`
  - parses a JSON payload into a known webhook event or `dict`
  - validates known event types against the canonical schema
  - raises `WebhookValidationError` for malformed known events
- `validate_email_received_event(input)`
  - validates an `email.received` payload and returns the typed event
- `safe_validate_email_received_event(input)`
  - returns a `ValidationSuccess` or `ValidationFailure`
- `verify_webhook_signature(...)`
  - verifies `Primitive-Signature`
- `validate_email_auth(auth)`
  - computes a verdict from SPF, DKIM, and DMARC results

### Helpful exports

- `email_received_event_json_schema`
- `WEBHOOK_VERSION`
- `PrimitiveWebhookError`
- `WebhookVerificationError`
- `WebhookPayloadError`
- `WebhookValidationError`
- `RawEmailDecodeError`

### Types and models

The package exports the main webhook models and helper types, including:

- `EmailReceivedEvent`
- `WebhookEvent`
- `UnknownEvent`
- `EmailAuth`
- `EmailAnalysis`
- `ParsedData`
- `RawContent`
- `WebhookAttachment`

## Parsing Events

- `parse_webhook_event(input)` strictly validates known event types such as `email.received`
- malformed known events raise `WebhookValidationError`
- unknown future event types are returned as dictionaries for forward compatibility

## JSON Schema

The webhook payload contract is defined by the canonical JSON schema in the repository and is exported by this package as `email_received_event_json_schema`.

The SDK uses that schema to generate:

- the packaged schema artifact
- Pydantic models
- runtime validation behavior

## Error Handling

All SDK-specific runtime errors extend `PrimitiveWebhookError` and include a stable error `code`.

```python
from primitive import PrimitiveWebhookError

try:
    ...
except PrimitiveWebhookError as error:
    print(error.code, error)
```

## Development

From `sdks/sdk-python`:

```bash
uv sync --dev
uv run python scripts/generate_schema_module.py
uv run python scripts/generate_models.py
uv run pytest
uv run ruff check .
uv run basedpyright
uv run python -m build
```

Or from repo root `sdks/`:

```bash
make python-sync
make python-check
make python-build
```

## Repository Layout

```text
sdks/
  json-schema/
    email-received-event.schema.json
  sdk-python/
    src/primitive/
      models_generated.py
      schema.py
      schemas/email_received_event.schema.json
      validation.py
      webhook.py
    scripts/
      generate_models.py
      generate_schema_module.py
```
