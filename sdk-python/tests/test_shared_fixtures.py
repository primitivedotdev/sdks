from __future__ import annotations

import json
from pathlib import Path
from typing import Any, cast

import pytest

from primitive import (
    EmailReceivedEvent,
    PrimitiveWebhookError,
    RawEmailDecodeError,
    UnknownEvent,
    WebhookValidationError,
    WebhookVerificationError,
    build_forward_subject,
    build_reply_subject,
    decode_raw_email,
    handle_webhook,
    is_raw_included,
    parse_header_address,
    parse_webhook_event,
    safe_validate_email_received_event,
    sign_standard_webhooks_payload,
    sign_webhook_payload,
    validate_email_auth,
    validate_email_received_event,
    verify_raw_email_download,
    verify_standard_webhooks_signature,
    verify_webhook_signature,
)


def _fixtures_root() -> Path:
    current = Path(__file__).resolve()
    candidates = (
        current.parents[2] / "test-fixtures",
        current.parents[1] / "test-fixtures",
    )
    for candidate in candidates:
        if candidate.exists():
            return candidate
    raise FileNotFoundError("Could not locate shared test-fixtures directory")


FIXTURES = _fixtures_root()


def _load_json(*parts: str) -> Any:
    return json.loads((FIXTURES.joinpath(*parts)).read_text())


def _load_text(*parts: str) -> str:
    return FIXTURES.joinpath(*parts).read_text()


def test_shared_webhook_validation_cases() -> None:
    fixtures = _load_json("webhook", "validation-cases.json")["cases"]
    for case in fixtures:
        if case["expected"]["valid"]:
            event = validate_email_received_event(case["payload"])
            assert event.id == case["expected"]["id"]
            safe_result = safe_validate_email_received_event(case["payload"])
            assert safe_result.success is True
        else:
            with pytest.raises(WebhookValidationError) as error:
                validate_email_received_event(case["payload"])
            assert error.value.code == case["expected"]["error_code"]
            safe_result = safe_validate_email_received_event(case["payload"])
            assert safe_result.success is False
            assert safe_result.error.code == case["expected"]["error_code"]


def test_shared_signing_vectors() -> None:
    fixtures = _load_json("signing", "vectors.json")["cases"]
    for case in fixtures:
        signed = sign_webhook_payload(
            case["raw_body"], case["secret"], case["timestamp"]
        )
        assert signed["v1"] == case["expected_v1"]
        verify_secret = case.get("verify_secret", case["secret"])
        now_seconds = case.get("now_seconds", case["timestamp"])
        signature_header = case.get("signature_header", signed["header"])
        if case["expected_valid"]:
            assert (
                verify_webhook_signature(
                    raw_body=case["raw_body"],
                    signature_header=signature_header,
                    secret=verify_secret,
                    now_seconds=now_seconds,
                )
                is True
            )
        else:
            with pytest.raises(WebhookVerificationError) as error:
                verify_webhook_signature(
                    raw_body=case["raw_body"],
                    signature_header=signature_header,
                    secret=verify_secret,
                    now_seconds=now_seconds,
                )
            assert error.value.code == case["expected_error_code"]


def test_shared_auth_cases() -> None:
    fixtures = _load_json("auth", "cases.json")["cases"]
    for case in fixtures:
        result = validate_email_auth(case["input"])
        assert result.verdict == case["expected"]["verdict"]
        assert result.confidence == case["expected"]["confidence"]


def test_shared_raw_cases() -> None:
    fixtures = _load_json("raw", "cases.json")["cases"]
    for case in fixtures:
        event = case["event"]
        assert is_raw_included(event) is case["expected"]["included"]
        if "decoded_utf8" in case["expected"]:
            assert decode_raw_email(event).decode("utf-8") == case["expected"]["decoded_utf8"]
        if "decode_error_code" in case["expected"]:
            with pytest.raises(RawEmailDecodeError) as error:
                decode_raw_email(event)
            assert error.value.code == case["expected"]["decode_error_code"]
        if case["expected"].get("verify_download"):
            downloaded = case["download_bytes_utf8"].encode("utf-8")
            assert verify_raw_email_download(downloaded, event) == downloaded
        if "verify_download_error_code" in case["expected"]:
            with pytest.raises(RawEmailDecodeError) as error:
                verify_raw_email_download(case["download_bytes_utf8"].encode("utf-8"), event)
            assert error.value.code == case["expected"]["verify_download_error_code"]


def test_shared_parse_webhook_event_cases() -> None:
    fixtures = _load_json("parse-webhook-event", "cases.json")["cases"]
    for case in fixtures:
        payload = (
            _load_json(*case["input_fixture"])
            if "input_fixture" in case
            else case.get("input")
        )
        expected = case["expected"]
        if expected["kind"] == "error":
            with pytest.raises(PrimitiveWebhookError) as error:
                parse_webhook_event(payload)
            assert error.value.code == expected["error_code"]
            continue

        event = parse_webhook_event(payload)
        if expected["kind"] == "email.received":
            known_event = event
            assert isinstance(known_event, EmailReceivedEvent)
            assert known_event.event == expected.get("event", expected["kind"])
            assert known_event.id == expected["id"]
        else:
            unknown_event = cast(UnknownEvent, event)
            assert unknown_event["event"] == expected.get("event", expected["kind"])
            assert unknown_event.get("id") == expected["id"]
            assert unknown_event.get("version") == expected["version"]


def test_shared_handle_webhook_cases() -> None:
    fixtures = _load_json("handle-webhook", "cases.json")["cases"]
    for case in fixtures:
        body = _load_text(*case["body_fixture"]) if "body_fixture" in case else case["body"]
        sign_secret = case.get("sign_secret", case["secret"])
        signed = (
            sign_webhook_payload(body, sign_secret, case["timestamp"])
            if "timestamp" in case
            else sign_webhook_payload(body, sign_secret)
        )
        headers = {
            key: (signed["header"] if value == "{signed}" else value)
            for key, value in case["headers"].items()
        }
        expected = case["expected"]

        if expected["valid"]:
            event = handle_webhook(
                body=body,
                headers=headers,
                secret=case["secret"],
                tolerance_seconds=case.get("tolerance_seconds"),
            )
            assert event.id == expected["id"]
            continue

        with pytest.raises(PrimitiveWebhookError) as error:
            handle_webhook(
                body=body,
                headers=headers,
                secret=case["secret"],
                tolerance_seconds=case.get("tolerance_seconds"),
            )
        assert error.value.code == expected["error_code"]


def test_shared_standard_webhooks_signing_vectors() -> None:
    fixtures = _load_json("signing", "standard-webhooks-vectors.json")["cases"]
    for case in fixtures:
        signed = sign_standard_webhooks_payload(
            case["raw_body"], case["secret"], case["msg_id"], case["timestamp"]
        )
        assert signed["signature"] == f"v1,{case['expected_signature']}"

        verify_secret = case.get("verify_secret", case["secret"])
        now_seconds = case.get("now_seconds", case["timestamp"])
        signature_header = case.get("webhook_signature_header", signed["signature"])

        if case["expected_valid"]:
            assert (
                verify_standard_webhooks_signature(
                    raw_body=case["raw_body"],
                    msg_id=case["msg_id"],
                    timestamp=str(case["timestamp"]),
                    signature_header=signature_header,
                    secret=verify_secret,
                    now_seconds=now_seconds,
                )
                is True
            )
        else:
            with pytest.raises(WebhookVerificationError) as error:
                verify_standard_webhooks_signature(
                    raw_body=case["raw_body"],
                    msg_id=case["msg_id"],
                    timestamp=str(case["timestamp"]),
                    signature_header=signature_header,
                    secret=verify_secret,
                    now_seconds=now_seconds,
                )
            assert error.value.code == case["expected_error_code"]


def test_shared_standard_webhooks_handle_webhook_cases() -> None:
    fixtures = _load_json("handle-webhook", "standard-webhooks-cases.json")["cases"]
    for case in fixtures:
        body = _load_text(*case["body_fixture"]) if "body_fixture" in case else case["body"]
        sign_secret = case.get("sign_secret", case["secret"])
        msg_id = case.get("msg_id", "msg_default")
        needs_sign = "{signed_standard}" in case["headers"].values()
        signed = (
            sign_standard_webhooks_payload(
                body, sign_secret, msg_id, case.get("timestamp")
            )
            if needs_sign
            else None
        )

        headers = {}
        for key, value in case["headers"].items():
            if value == "{signed_standard}":
                headers[key] = signed["signature"] if signed else ""
            elif value == "{timestamp}":
                headers[key] = str(
                    signed["timestamp"] if signed else case.get("timestamp", "")
                )
            else:
                headers[key] = value

        expected = case["expected"]

        if expected["valid"]:
            event = handle_webhook(
                body=body,
                headers=headers,
                secret=case["secret"],
                tolerance_seconds=case.get("tolerance_seconds"),
            )
            assert event.id == expected["id"]
            continue

        with pytest.raises(PrimitiveWebhookError) as error:
            handle_webhook(
                body=body,
                headers=headers,
                secret=case["secret"],
                tolerance_seconds=case.get("tolerance_seconds"),
            )
        assert error.value.code == expected["error_code"]


def test_shared_subject_builder_cases() -> None:
    cases = _load_json("subject-builders", "cases.json")
    for case in cases["reply"]:
        assert build_reply_subject(case["input"]) == case["expected"], (
            f"reply input={case['input']!r}"
        )
    for case in cases["forward"]:
        assert build_forward_subject(case["input"]) == case["expected"], (
            f"forward input={case['input']!r}"
        )


def test_shared_header_address_parser_cases() -> None:
    fixture = _load_json("header-address-parser", "cases.json")
    for case in fixture["cases"]:
        result = parse_header_address(case["input"])
        expected = case["expected"]
        if expected is None:
            assert result is None, f"{case['name']}: expected None, got {result!r}"
            continue
        assert result is not None, f"{case['name']}: expected address, got None"
        assert result.address == expected["address"], case["name"]
        assert result.name == expected["name"], case["name"]
