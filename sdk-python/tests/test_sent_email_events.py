from __future__ import annotations

import copy
import json
from pathlib import Path
from typing import Any

import pytest

from primitive import (
    SENT_EMAIL_EVENT_TYPES,
    WEBHOOK_EVENT_TYPES,
    PrimitiveWebhookError,
    SentEmailCompletedEvent,
    SentEmailRecipientResultEvent,
    SentEmailRollupResultEvent,
    WebhookValidationError,
    handle_webhook,
    handle_webhook_event,
    is_email_received_event,
    is_known_webhook_event_type,
    is_sent_email_accepted_event,
    is_sent_email_completed_event,
    is_sent_email_delivered_event,
    is_sent_email_event,
    is_sent_email_event_type,
    is_sent_email_failed_event,
    is_sent_email_recipient_result_event,
    parse_webhook_event,
    safe_validate_sent_email_event,
    sent_email_event_json_schema,
    sign_webhook_payload,
    validate_sent_email_event,
)


def _fixtures_root() -> Path:
    current = Path(__file__).resolve()
    for candidate in (
        current.parents[2] / "test-fixtures",
        current.parents[1] / "test-fixtures",
    ):
        if candidate.exists():
            return candidate
    raise FileNotFoundError("Could not locate shared test-fixtures directory")


FIXTURES = _fixtures_root()
CASES = json.loads((FIXTURES / "sent-email-events" / "cases.json").read_text())


def _load_json(*parts: str) -> Any:
    return json.loads(FIXTURES.joinpath(*parts).read_text())


def _load_text(*parts: str) -> str:
    return FIXTURES.joinpath(*parts).read_text()


def _get_path(value: Any, path: str) -> Any:
    current = value
    for segment in path.split("."):
        if isinstance(current, list):
            index = int(segment)
            if index >= len(current):
                return None
            current = current[index]
        elif isinstance(current, dict):
            current = current.get(segment)
        else:
            return None
    return current


def _has_path(value: Any, path: str) -> bool:
    *parents, last = path.split(".")
    parent = _get_path(value, ".".join(parents)) if parents else value
    return isinstance(parent, dict) and last in parent


def _set_path(target: dict[str, Any], path: str, value: Any) -> None:
    *parents, last = path.split(".")
    current = target
    for part in parents:
        current = current[part]
    current[last] = value


def _case_input(case: dict[str, Any]) -> Any:
    if "input_fixture" in case:
        return _load_json(*case["input_fixture"])
    if "input_patch" in case:
        patch = case["input_patch"]
        body = _load_json(*patch["fixture"])
        for path, value in patch.get("set", {}).items():
            _set_path(body, path, copy.deepcopy(value))
        for key in patch.get("delete", []):
            del body[key]
        return body
    return copy.deepcopy(case["input"])


def _as_dict(event: Any) -> Any:
    if isinstance(event, dict):
        return event
    return event.model_dump(mode="json")


@pytest.mark.parametrize("case", CASES["parse_cases"], ids=lambda c: c["name"])
def test_shared_sent_email_parse_cases(case: dict[str, Any]) -> None:
    expected = case["expected"]
    event_input = _case_input(case)

    if expected["kind"] == "error":
        with pytest.raises(PrimitiveWebhookError) as error:
            parse_webhook_event(event_input, case.get("event_type"))
        assert error.value.code == expected["error_code"]
        return

    event = parse_webhook_event(event_input, case.get("event_type"))
    data = _as_dict(event)
    assert data["event"] == expected["event"]
    assert data.get("id") == expected["id"]
    assert is_sent_email_event(event) is (expected["kind"] == "sent_email")
    for path, value in expected.get("fields", {}).items():
        assert _get_path(data, path) == value, path
    for path in expected.get("absent", []):
        assert not _has_path(data, path), path


@pytest.mark.parametrize("case", CASES["handle_cases"], ids=lambda c: c["name"])
def test_shared_sent_email_handle_cases(case: dict[str, Any]) -> None:
    expected = case["expected"]
    body = (
        _load_text(*case["body_fixture"])
        if "body_fixture" in case
        else case.get("body", "")
    )
    signed = sign_webhook_payload(
        body, case.get("sign_secret", case["secret"]), case.get("timestamp")
    )
    headers = {
        key: signed["header"] if value == "{signed}" else value
        for key, value in case["headers"].items()
    }

    if expected["valid"]:
        event = handle_webhook_event(body=body, headers=headers, secret=case["secret"])
        data = _as_dict(event)
        assert data["event"] == expected["event"]
        assert data["id"] == expected["id"]
        assert is_sent_email_event(event)
        return

    with pytest.raises(PrimitiveWebhookError) as error:
        handle_webhook_event(body=body, headers=headers, secret=case["secret"])
    assert error.value.code == expected["error_code"]


def test_catalog_lists_the_sent_email_events() -> None:
    assert SENT_EMAIL_EVENT_TYPES == (
        "sent_email.accepted",
        "sent_email.delivered",
        "sent_email.failed",
        "sent_email.completed",
    )
    for name in SENT_EMAIL_EVENT_TYPES:
        assert name in WEBHOOK_EVENT_TYPES
        assert is_known_webhook_event_type(name)
        assert is_sent_email_event_type(name)
    assert not is_sent_email_event_type("sent_email.opened")
    assert not is_sent_email_event_type(None)


def test_guards_narrow_parsed_events() -> None:
    accepted = validate_sent_email_event(
        _load_json("sent-email-events", "accepted.json")
    )
    delivered = validate_sent_email_event(
        _load_json("sent-email-events", "delivered-recipient.json")
    )
    failed = validate_sent_email_event(
        _load_json("sent-email-events", "failed-recipient.json")
    )
    rollup = validate_sent_email_event(
        _load_json("sent-email-events", "failed-rollup.json")
    )
    completed = validate_sent_email_event(
        _load_json("sent-email-events", "completed.json")
    )

    assert is_sent_email_accepted_event(accepted)
    assert not is_sent_email_accepted_event(failed)
    assert is_sent_email_delivered_event(delivered)
    assert not is_sent_email_delivered_event(failed)
    assert is_sent_email_failed_event(failed)
    assert is_sent_email_failed_event(rollup)
    assert is_sent_email_completed_event(completed)
    assert is_sent_email_recipient_result_event(failed)
    assert not is_sent_email_recipient_result_event(rollup)
    assert not is_email_received_event(failed)
    assert not is_sent_email_event({"event": "sent_email.failed"})

    assert isinstance(failed, SentEmailRecipientResultEvent)
    assert failed.recipient.address == "bob@example.net"
    assert failed.recipient.type == "cc"
    assert failed.outcome.failure_kind == "rejected"
    assert isinstance(rollup, SentEmailRollupResultEvent)
    assert rollup.recipients is not None and len(rollup.recipients) == 2
    assert isinstance(completed, SentEmailCompletedEvent)
    assert completed.summary.delivered == 2


def test_reports_the_field_of_the_selected_shape() -> None:
    malformed = _load_json("sent-email-events", "failed-recipient.json")
    del malformed["outcome"]
    result = safe_validate_sent_email_event(malformed)
    assert result.success is False
    assert result.error.code == "SCHEMA_VALIDATION_FAILED"
    assert result.error.field == "outcome"

    with pytest.raises(WebhookValidationError):
        validate_sent_email_event([])
    assert safe_validate_sent_email_event(
        _load_json("sent-email-events", "completed.json")
    ).success


def test_handle_webhook_stays_typed_to_email_received() -> None:
    body = _load_text("sent-email-events", "completed.json")
    signed = sign_webhook_payload(body, "whsec_test")
    with pytest.raises(WebhookValidationError):
        handle_webhook(
            body=body,
            headers={
                "Primitive-Signature": signed["header"],
                "X-Webhook-Event": "sent_email.completed",
            },
            secret="whsec_test",
        )


def test_exports_the_canonical_schema() -> None:
    assert sent_email_event_json_schema["$ref"] == "#/definitions/SentEmailEvent"
    assert "SentEmailCompletedEvent" in sent_email_event_json_schema["definitions"]
