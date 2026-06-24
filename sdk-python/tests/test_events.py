"""Header-keyed webhook event parsing tests (payment.* and interaction.x402.*)."""

from __future__ import annotations

import json

from primitive import (
    EMAIL_EVENT_TYPES,
    INTERACTION_EVENT_TYPES,
    PAYMENT_EVENT_TYPES,
    WEBHOOK_EVENT_TYPES,
    handle_webhook_event,
    is_interaction_x402_event,
    is_known_webhook_event_type,
    is_payment_event,
    is_payment_failed_event,
    is_payment_settled_event,
    parse_webhook_event,
    sign_webhook_payload,
)

SECRET = "whsec_test_secret_for_events"


def _sign(body: str) -> str:
    return sign_webhook_payload(body, SECRET)["header"]


def _event_name(event: object) -> object:
    assert isinstance(event, dict)
    return event.get("event")


def test_payment_settled_body_parses_to_typed_event() -> None:
    # The stored payment body carries the name in `type`, not `event`.
    body = {"type": "payment.settled", "id": "pay_1", "payment": {"amount": "100"}}

    event = parse_webhook_event(body, "payment.settled")

    assert _event_name(event) == "payment.settled"
    assert is_payment_settled_event(event)
    assert not is_payment_failed_event(event)
    assert isinstance(event, dict)
    assert event.get("id") == "pay_1"


def test_interaction_x402_settled_body_parses_to_typed_event() -> None:
    # Interaction bodies have no event/type field at all.
    body = {"interaction": {"protocol": "x402", "step": "receipt"}}

    event = parse_webhook_event(body, "interaction.x402.settled")

    assert _event_name(event) == "interaction.x402.settled"
    assert is_interaction_x402_event(event)


def test_unknown_header_type_returns_unknown_event_without_raising() -> None:
    event = parse_webhook_event({"foo": "bar"}, "payment.refunded")

    assert _event_name(event) == "payment.refunded"
    assert not is_payment_settled_event(event)
    assert not is_interaction_x402_event(event)


def test_falls_back_to_body_event_when_no_header() -> None:
    event = parse_webhook_event({"event": "payment.failed", "id": "pay_2"})

    assert _event_name(event) == "payment.failed"
    assert is_payment_failed_event(event)


def test_catalog_contains_payment_and_interaction_events() -> None:
    assert "payment.settled" in WEBHOOK_EVENT_TYPES
    assert "payment.failed" in WEBHOOK_EVENT_TYPES
    assert "interaction.x402.settled" in WEBHOOK_EVENT_TYPES
    assert "interaction.x402.verify_timeout" in WEBHOOK_EVENT_TYPES
    assert "interaction.ack.acked" in WEBHOOK_EVENT_TYPES
    assert "email.received" in WEBHOOK_EVENT_TYPES
    assert "email.bounced" in EMAIL_EVENT_TYPES
    assert "payment.failed" in PAYMENT_EVENT_TYPES
    assert "interaction.x402.challenge" in INTERACTION_EVENT_TYPES


def test_is_payment_event_matches_both() -> None:
    assert is_payment_event({"event": "payment.settled"})
    assert is_payment_event({"event": "payment.failed"})
    assert not is_payment_event({"event": "email.received"})
    assert not is_payment_event(None)


def test_is_known_webhook_event_type() -> None:
    assert is_known_webhook_event_type("payment.settled")
    assert is_known_webhook_event_type("interaction.x402.settled")
    assert not is_known_webhook_event_type("payment.refunded")
    assert not is_known_webhook_event_type(None)


def test_event_header_is_read_case_insensitively() -> None:
    # Exercise header keying through the public verify-then-parse entry point:
    # the X-Webhook-Event header is the discriminator and must be matched
    # regardless of letter case. A payment body carries its name in `type`, so a
    # correctly read header is what overlays the canonical `event`.
    body = json.dumps(
        {"type": "payment.settled", "id": "pay_h", "payment": {"amount": "5"}}
    )
    signature = _sign(body)

    for header_name in ("x-webhook-event", "X-Webhook-Event", "X-WEBHOOK-EVENT"):
        event = handle_webhook_event(
            body=body,
            headers={"primitive-signature": signature, header_name: "payment.settled"},
            secret=SECRET,
        )
        assert _event_name(event) == "payment.settled"
        assert is_payment_settled_event(event)


def test_missing_event_header_falls_back_to_body_event() -> None:
    # With no X-Webhook-Event header present, the public entry point falls back
    # to the body's own `event` field rather than inventing a name.
    body = json.dumps({"event": "payment.failed", "id": "pay_b"})

    event = handle_webhook_event(
        body=body,
        headers={"primitive-signature": _sign(body)},
        secret=SECRET,
    )

    assert _event_name(event) == "payment.failed"
    assert is_payment_failed_event(event)


def test_handle_webhook_event_verifies_payment_body() -> None:
    body = json.dumps(
        {"type": "payment.settled", "id": "pay_3", "payment": {"amount": "250"}}
    )
    headers = {
        "primitive-signature": _sign(body),
        "x-webhook-event": "payment.settled",
    }

    event = handle_webhook_event(body=body, headers=headers, secret=SECRET)

    assert is_payment_settled_event(event)
    assert _event_name(event) == "payment.settled"


def test_handle_webhook_event_verifies_interaction_body() -> None:
    body = json.dumps({"interaction": {"protocol": "x402"}})
    headers = {
        "primitive-signature": _sign(body),
        "x-webhook-event": "interaction.x402.settled",
    }

    event = handle_webhook_event(body=body, headers=headers, secret=SECRET)

    assert is_interaction_x402_event(event)
