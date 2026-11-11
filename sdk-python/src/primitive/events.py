"""The canonical webhook event-type catalog and typed interaction events.

Primitive posts every webhook with the event name in the ``X-Webhook-Event``
HEADER, not in the body. The stored payload is sent verbatim with no envelope:
an ``email.*`` or ``sent_email.*`` body carries ``event``, and an
``interaction.*`` body is just
``{"interaction": {...}}`` with no event/type field at all. The HEADER is
therefore the only reliable discriminator across all the families, which is
why the parser keys on it.
"""

from __future__ import annotations

from typing import Any, TypedDict

#: The five first-party email events (subject = an email).
EMAIL_EVENT_TYPES: tuple[str, ...] = (
    "email.received",
    "email.bounced",
    "email.tls_report",
    "email.dmarc_report",
    "email.dmarc_failure",
)

#: The four opt-in ``sent_email.*`` events (subject = a send). An endpoint
#: receives them only when its ``rules.event_types`` lists them.
SENT_EMAIL_EVENT_TYPES: tuple[str, ...] = (
    "sent_email.accepted",
    "sent_email.delivered",
    "sent_email.failed",
    "sent_email.completed",
)

#: The four opt-in ``email_rule_request.*`` events (subject = a rule request
#: one member made to another). Each goes to the person who did not act, and
#: an endpoint receives them only when its ``rules.event_types`` lists them.
EMAIL_RULE_REQUEST_EVENT_TYPES: tuple[str, ...] = (
    "email_rule_request.created",
    "email_rule_request.accepted",
    "email_rule_request.declined",
    "email_rule_request.withdrawn",
)

#: The interaction step events (subject = an interaction), named
#: ``interaction.<protocolShort>.<suffix>``.
INTERACTION_EVENT_TYPES: tuple[str, ...] = (
    "interaction.ack.acked",
    "interaction.ack.canceled",
    "interaction.ack.expired",
    "interaction.ack.received",
    "interaction.ack.requested",
)

#: The full enumerated catalog of every current webhook event type.
WEBHOOK_EVENT_TYPES: tuple[str, ...] = (
    *EMAIL_EVENT_TYPES,
    *SENT_EMAIL_EVENT_TYPES,
    *EMAIL_RULE_REQUEST_EVENT_TYPES,
    *INTERACTION_EVENT_TYPES,
)

#: Any current catalog value, surfaced in the ``X-Webhook-Event`` header.
WebhookEventType = str

_WEBHOOK_EVENT_TYPE_SET = frozenset(WEBHOOK_EVENT_TYPES)


def is_known_webhook_event_type(event_type: str | None) -> bool:
    """Return True if ``event_type`` is a known current catalog value."""
    return event_type is not None and event_type in _WEBHOOK_EVENT_TYPE_SET


class InteractionEvent(TypedDict, total=False):
    """An ``interaction.*`` webhook body.

    The stored payload is just ``{"interaction": {...}}`` with no event/type
    field; the parser overlays a canonical ``event`` from the header.
    """

    event: str
    interaction: dict[str, Any]
    id: str
