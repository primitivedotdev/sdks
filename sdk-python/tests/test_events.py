"""Header-keyed webhook event parsing tests (interaction.* and unknown events)."""

from __future__ import annotations

import json

from primitive import (
    EMAIL_EVENT_TYPES,
    INTERACTION_EVENT_TYPES,
    WEBHOOK_EVENT_TYPES,
    handle_webhook_event,
    is_known_webhook_event_type,
    parse_webhook_event,
    sign_webhook_payload,
)

SECRET = "whsec_test_secret_for_events"


def _sign(body: str) -> str:
    return sign_webhook_payload(body, SECRET)["header"]


def _event_name(event: object) -> object:
    assert isinstance(event, dict)
    return event.get("event")


def test_interaction_ack_body_parses_with_header_name() -> None:
    # Interaction bodies have no event/type field at all.
    body = {"interaction": {"protocol": "ack", "step": "ack"}}

    event = parse_webhook_event(body, "interaction.ack.acked")

    assert _event_name(event) == "interaction.ack.acked"
    assert isinstance(event, dict)
    assert event.get("interaction") == {"protocol": "ack", "step": "ack"}


def test_unknown_header_type_returns_unknown_event_without_raising() -> None:
    body = {"type": "payment.settled", "challenge_id": "chl_1"}

    event = parse_webhook_event(body, "payment.settled")

    assert _event_name(event) == "payment.settled"
    assert not is_known_webhook_event_type("payment.settled")
    assert isinstance(event, dict)
    assert event.get("challenge_id") == "chl_1"


def test_falls_back_to_body_event_when_no_header() -> None:
    event = parse_webhook_event({"event": "interaction.ack.requested", "id": "evt_2"})
    assert _event_name(event) == "interaction.ack.requested"


def test_catalog_contains_email_sent_email_and_interaction_events() -> None:
    assert "interaction.ack.acked" in WEBHOOK_EVENT_TYPES
    assert "email.received" in WEBHOOK_EVENT_TYPES
    assert "sent_email.delivered" in WEBHOOK_EVENT_TYPES
    assert "email.bounced" in EMAIL_EVENT_TYPES
    assert "interaction.ack.expired" in INTERACTION_EVENT_TYPES


def test_catalog_no_longer_lists_payment_events() -> None:
    assert "payment.settled" not in WEBHOOK_EVENT_TYPES
    assert "payment.failed" not in WEBHOOK_EVENT_TYPES


def test_is_known_webhook_event_type() -> None:
    assert is_known_webhook_event_type("interaction.ack.acked")
    assert is_known_webhook_event_type("sent_email.failed")
    assert not is_known_webhook_event_type("payment.settled")
    assert not is_known_webhook_event_type(None)


def test_event_header_is_read_case_insensitively() -> None:
    # Exercise header keying through the public verify-then-parse entry point:
    # the X-Webhook-Event header is the discriminator and must be matched
    # regardless of letter case. An interaction body carries no event name, so
    # a correctly read header is what overlays the canonical `event`.
    body = json.dumps({"interaction": {"protocol": "ack"}})
    signature = _sign(body)

    for header_name in ("x-webhook-event", "X-Webhook-Event", "X-WEBHOOK-EVENT"):
        event = handle_webhook_event(
            body=body,
            headers={
                "primitive-signature": signature,
                header_name: "interaction.ack.acked",
            },
            secret=SECRET,
        )
        assert _event_name(event) == "interaction.ack.acked"


def test_missing_event_header_falls_back_to_body_event() -> None:
    # With no X-Webhook-Event header present, the public entry point falls back
    # to the body's own `event` field rather than inventing a name.
    body = json.dumps({"event": "interaction.ack.received", "id": "evt_b"})

    event = handle_webhook_event(
        body=body,
        headers={"primitive-signature": _sign(body)},
        secret=SECRET,
    )

    assert _event_name(event) == "interaction.ack.received"


def test_handle_webhook_event_verifies_interaction_body() -> None:
    body = json.dumps({"interaction": {"protocol": "ack"}})
    headers = {
        "primitive-signature": _sign(body),
        "x-webhook-event": "interaction.ack.acked",
    }

    event = handle_webhook_event(body=body, headers=headers, secret=SECRET)

    assert _event_name(event) == "interaction.ack.acked"
