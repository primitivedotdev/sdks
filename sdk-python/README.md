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

### Signing primitives (lower level)

``pay()`` builds and signs the payment for you. When you need to drive the
signing yourself, for example to sign a challenge carried in an email reply and
submit the payment separately, the same building blocks are exported directly:

- ``derive_eip3009_nonce(binding)`` derives the interaction-bound EIP-3009
  nonce, locked to a normative vector the platform recomputes.
- ``compute_payment_validity_window(challenge_expires_at_sec=..., now_sec=...)``
  returns the ``(valid_after, valid_before)`` window, hard-capped at 24h.
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
