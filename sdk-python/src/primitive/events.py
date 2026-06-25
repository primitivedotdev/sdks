"""The canonical webhook event-type catalog and typed payment/interaction events.

Primitive posts every webhook with the event name in the ``X-Webhook-Event``
HEADER, not in the body. The stored payload is sent verbatim with no envelope:
an ``email.*`` body carries ``event``, a ``payment.*`` body carries the name in
``type``, and an ``interaction.*`` body is just ``{"interaction": {...}}`` with no
event/type field at all. The HEADER is therefore the only reliable discriminator
across all three families, which is why the parser keys on it.
"""

from __future__ import annotations

import sys
from typing import Any, Literal, TypedDict, TypeGuard

if sys.version_info >= (3, 13):
    from typing import ReadOnly
else:
    from typing_extensions import ReadOnly

#: The five first-party email events (subject = an email).
EMAIL_EVENT_TYPES: tuple[str, ...] = (
    "email.received",
    "email.bounced",
    "email.tls_report",
    "email.dmarc_report",
    "email.dmarc_failure",
)

#: The two x402 settlement-notification events (subject = a payment).
PAYMENT_EVENT_TYPES: tuple[str, ...] = (
    "payment.settled",
    "payment.failed",
)

#: The interaction step events (subject = an interaction), named
#: ``interaction.<protocolShort>.<suffix>``.
INTERACTION_EVENT_TYPES: tuple[str, ...] = (
    "interaction.ack.acked",
    "interaction.ack.canceled",
    "interaction.ack.expired",
    "interaction.ack.received",
    "interaction.ack.requested",
    "interaction.x402.challenge",
    "interaction.x402.declined",
    "interaction.x402.expired",
    "interaction.x402.payment",
    "interaction.x402.rejected",
    "interaction.x402.settled",
    "interaction.x402.verify_timeout",
)

#: The full enumerated catalog of every current webhook event type.
WEBHOOK_EVENT_TYPES: tuple[str, ...] = (
    *EMAIL_EVENT_TYPES,
    *PAYMENT_EVENT_TYPES,
    *INTERACTION_EVENT_TYPES,
)

#: Any current catalog value, surfaced in the ``X-Webhook-Event`` header.
WebhookEventType = str

_WEBHOOK_EVENT_TYPE_SET = frozenset(WEBHOOK_EVENT_TYPES)


def is_known_webhook_event_type(event_type: str | None) -> bool:
    """Return True if ``event_type`` is a known current catalog value."""
    return event_type is not None and event_type in _WEBHOOK_EVENT_TYPE_SET


class PaymentEvent(TypedDict, total=False):
    """A ``payment.*`` webhook body.

    The stored payload is FLAT (no envelope, no nested ``payment`` object): it
    carries the event name in ``type``, and the parser overlays a canonical
    ``event`` mirrored from the header so consumers can branch on a single
    field. All amounts are token base units (USDC has 6 decimals, so ``"10000"``
    is 0.01).
    """

    # ReadOnly so subclasses may narrow this Literal (PEP 705); a mutable
    # TypedDict field is invariant and could not be narrowed in a subclass.
    event: ReadOnly[Literal["payment.settled", "payment.failed"]]
    #: The event name as carried in the raw stored body.
    type: ReadOnly[Literal["payment.settled", "payment.failed"]]
    #: The challenge this payment settles or fails.
    challenge_id: str
    #: The settlement network (e.g. ``"base"``, ``"base-sepolia"``).
    network: str
    #: Amount in token base units (USDC has 6 decimals, so ``"10000"`` is 0.01).
    amount: str
    #: The checksummed token contract address.
    asset: str
    #: The paying organization id, or None when not on-net.
    payer_org: str | None


class PaymentSettledEvent(PaymentEvent, total=False):
    """A ``payment.settled`` webhook event.

    Mirrors the TypeScript SDK: a subclass of :class:`PaymentEvent` whose
    ``event`` field is narrowed to ``Literal["payment.settled"]`` so a type
    checker rejects treating it as a failed event after a guard narrows to it.
    """

    event: ReadOnly[Literal["payment.settled"]]
    type: ReadOnly[Literal["payment.settled"]]
    #: The on-chain settlement transaction hash.
    settle_tx: str


class PaymentFailedEvent(PaymentEvent, total=False):
    """A ``payment.failed`` webhook event.

    Mirrors the TypeScript SDK: a subclass of :class:`PaymentEvent` whose
    ``event`` field is narrowed to ``Literal["payment.failed"]`` so a type
    checker rejects treating it as a settled event after a guard narrows to it.
    """

    event: ReadOnly[Literal["payment.failed"]]
    type: ReadOnly[Literal["payment.failed"]]
    #: Human-readable reason the payment failed.
    failure_reason: str


class InteractionEvent(TypedDict, total=False):
    """An ``interaction.*`` webhook body.

    The stored payload is just ``{"interaction": {...}}`` with no event/type
    field; the parser overlays a canonical ``event`` from the header.
    """

    event: str
    interaction: dict[str, Any]
    id: str


#: An ``interaction.x402.*`` event (the x402-over-email lifecycle).
InteractionX402Event = InteractionEvent


def _event_name(event: object) -> str | None:
    if isinstance(event, dict):
        value = event.get("event")
        return value if isinstance(value, str) else None
    value = getattr(event, "event", None)
    return value if isinstance(value, str) else None


def is_payment_event(event: object) -> TypeGuard[PaymentEvent]:
    """Type guard for any ``payment.*`` event."""
    return _event_name(event) in ("payment.settled", "payment.failed")


def is_payment_settled_event(event: object) -> TypeGuard[PaymentSettledEvent]:
    """Type guard for the ``payment.settled`` event."""
    return _event_name(event) == "payment.settled"


def is_payment_failed_event(event: object) -> TypeGuard[PaymentFailedEvent]:
    """Type guard for the ``payment.failed`` event."""
    return _event_name(event) == "payment.failed"


def is_interaction_x402_event(event: object) -> TypeGuard[InteractionEvent]:
    """Type guard for any ``interaction.x402.*`` event."""
    name = _event_name(event)
    return name is not None and name.startswith("interaction.x402.")
