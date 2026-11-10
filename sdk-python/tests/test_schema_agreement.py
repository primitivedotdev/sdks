"""The exported schema must describe exactly what the SDK accepts.

A payload that passes ``email_received_event_json_schema`` must pass
``validate_email_received_event`` and ``receive``, and a payload the schema
refuses must be refused by both.
"""

from __future__ import annotations

import json
from collections.abc import Callable
from pathlib import Path
from typing import Any

import pytest
from jsonschema import Draft7Validator, FormatChecker

from primitive import (
    PRIMITIVE_SIGNATURE_HEADER,
    ReceivedEmail,
    WebhookValidationError,
    email_received_event_json_schema,
    receive,
    sign_webhook_payload,
    validate_email_received_event,
)

SECRET = "whsec_schema_agreement"
PAYLOAD_FILES = ("valid-email-received.json", "address-scoped-email.json")


def _webhook_fixtures() -> Path:
    current = Path(__file__).resolve()
    for candidate in (
        current.parents[2] / "test-fixtures" / "webhook",
        current.parents[1] / "test-fixtures" / "webhook",
    ):
        if candidate.exists():
            return candidate
    raise FileNotFoundError("Could not locate shared test-fixtures directory")


WEBHOOK_FIXTURES = _webhook_fixtures()


def _load_text(name: str) -> str:
    return (WEBHOOK_FIXTURES / name).read_text()


def _payloads() -> list[tuple[str, Any]]:
    cases = json.loads(_load_text("validation-cases.json"))["cases"]
    payloads = [
        (f"validation-cases.json {case['name']}", case["payload"]) for case in cases
    ]
    payloads.extend((name, json.loads(_load_text(name))) for name in PAYLOAD_FILES)
    return payloads


PAYLOADS = _payloads()
SCHEMA = Draft7Validator(
    email_received_event_json_schema, format_checker=FormatChecker()
)


def _refuses_with_validation_error(run: Callable[[], object]) -> bool:
    try:
        run()
    except WebhookValidationError:
        return True
    return False


def _receive_body(body: str) -> ReceivedEmail:
    signed = sign_webhook_payload(body, SECRET)
    return receive(
        body=body,
        headers={PRIMITIVE_SIGNATURE_HEADER: signed["header"]},
        secret=SECRET,
    )


@pytest.mark.parametrize(
    ("name", "payload"), PAYLOADS, ids=[name for name, _ in PAYLOADS]
)
def test_exported_schema_and_validator_give_the_same_verdict(
    name: str, payload: Any
) -> None:
    accepted = SCHEMA.is_valid(payload)

    assert _refuses_with_validation_error(
        lambda: validate_email_received_event(payload)
    ) is (not accepted), name
    assert _refuses_with_validation_error(
        lambda: _receive_body(json.dumps(payload))
    ) is (not accepted), name


def test_agreement_payloads_cover_both_verdicts() -> None:
    assert {SCHEMA.is_valid(payload) for _, payload in PAYLOADS} == {True, False}


@pytest.mark.parametrize("name", PAYLOAD_FILES)
def test_round_trips_through_the_sdk_signer_and_receive(name: str) -> None:
    body = _load_text(name)
    event = json.loads(body)
    assert SCHEMA.is_valid(event)

    email = _receive_body(body)

    assert email.id == event["email"]["id"]
    assert email.event_id == event["id"]
    assert email.raw == validate_email_received_event(event)
