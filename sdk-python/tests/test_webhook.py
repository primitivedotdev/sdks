from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from typing import Any, cast

import pytest

from primitive import (
    Content,
    Delivery,
    DmarcPolicy,
    Download,
    Email,
    Headers,
    PrimitiveWebhookError,
    RawEmailDecodeError,
    Smtp,
    Spamassassin,
    SpfResult,
    UnknownEvent,
    WebhookPayloadError,
    WebhookValidationError,
    WebhookVersion,
    confirmed_headers,
    decode_raw_email,
    get_download_time_remaining,
    handle_webhook,
    is_download_expired,
    is_email_received_event,
    is_raw_included,
    parse_webhook_event,
    sign_webhook_payload,
    validate_email_auth,
    validate_email_received_event,
    verify_raw_email_download,
)
from primitive.webhook import _get_signature_header


def test_parse_webhook_event_handles_known_and_unknown_events() -> None:
    assert is_email_received_event(
        parse_webhook_event(
            {
                "id": "evt_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
                "event": "email.received",
                "version": "2025-12-14",
                "delivery": {
                    "endpoint_id": "ep_xyz789",
                    "attempt": 1,
                    "attempted_at": "2025-12-14T12:00:00Z",
                },
                "email": {
                    "id": "em_def456",
                    "received_at": "2025-12-14T11:59:50Z",
                    "smtp": {
                        "helo": "mail.example.com",
                        "mail_from": "sender@example.com",
                        "rcpt_to": ["recipient@domain.com"],
                    },
                    "headers": {
                        "message_id": "<abc123@example.com>",
                        "subject": "Test Email",
                        "from": "sender@example.com",
                        "to": "recipient@domain.com",
                        "date": "Sat, 14 Dec 2025 11:59:50 +0000",
                    },
                    "content": {
                        "raw": {
                            "included": True,
                            "encoding": "base64",
                            "max_inline_bytes": 262144,
                            "size_bytes": 1234,
                            "sha256": "a" * 64,
                            "data": "SGVsbG8gV29ybGQ=",
                        },
                        "download": {
                            "url": "https://api.primitive.dev/v1/downloads/raw/token123",
                            "expires_at": "2025-12-15T12:00:00Z",
                        },
                    },
                    "parsed": {
                        "status": "complete",
                        "error": None,
                        "body_text": "Hello World",
                        "body_html": "<p>Hello World</p>",
                        "reply_to": None,
                        "cc": None,
                        "bcc": None,
                        "in_reply_to": None,
                        "references": None,
                        "attachments": [],
                        "attachments_download_url": None,
                    },
                    "analysis": {},
                    "auth": {
                        "spf": "pass",
                        "dmarc": "pass",
                        "dmarcPolicy": "reject",
                        "dmarcFromDomain": "example.com",
                        "dmarcSpfAligned": True,
                        "dmarcDkimAligned": True,
                        "dmarcSpfStrict": False,
                        "dmarcDkimStrict": False,
                        "dkimSignatures": [
                            {
                                "domain": "example.com",
                                "selector": "default",
                                "result": "pass",
                                "aligned": True,
                                "keyBits": 2048,
                                "algo": "rsa-sha256",
                            }
                        ],
                    },
                },
            }
        )
    )
    unknown = cast(
        UnknownEvent,
        parse_webhook_event({"event": "email.bounced", "id": "y"}),
    )
    assert unknown["event"] == "email.bounced"


def test_exported_enums_match_validated_runtime_values(
    valid_payload: dict[str, Any],
) -> None:
    event = validate_email_received_event(valid_payload)
    spf_pass = cast(Any, SpfResult).PASS
    dmarc_reject = cast(Any, DmarcPolicy).REJECT

    assert isinstance(event.email.auth.spf, SpfResult)
    assert event.email.auth.spf is spf_pass
    assert isinstance(event.email.auth.dmarc_policy, DmarcPolicy)
    assert event.email.auth.dmarc_policy is dmarc_reject


def test_dmarc_policy_exposes_null_member() -> None:
    assert DmarcPolicy(None) is cast(Any, DmarcPolicy).NULL


def test_public_package_exports_nested_schema_models() -> None:
    assert Delivery.__name__ == "Delivery"
    assert Smtp.__name__ == "Smtp"
    assert Headers.__name__ == "Headers"
    assert Download.__name__ == "Download"
    assert WebhookVersion.__name__ == "WebhookVersion"
    assert Spamassassin.__name__ == "Spamassassin"
    assert Content.__name__ == "Content"
    assert Email.__name__ == "Email"


def test_validated_event_exposes_union_fields_like_schema_payload(
    valid_payload: dict[str, Any],
) -> None:
    event = validate_email_received_event(valid_payload)

    assert event.email.content.raw.included is True
    assert event.email.parsed.status == "complete"


def test_validated_event_model_dump_round_trips_with_schema_aliases(
    valid_payload: dict[str, Any],
) -> None:
    event = validate_email_received_event(valid_payload)
    dumped = event.model_dump()

    assert "from" in dumped["email"]["headers"]
    assert "from_" not in dumped["email"]["headers"]
    assert dumped["email"]["auth"]["dmarcPolicy"] == "reject"
    assert dumped["email"]["auth"]["dkimSignatures"][0]["keyBits"] == 2048
    assert validate_email_received_event(dumped).id == event.id


def test_validated_event_model_dump_json_round_trips_with_schema_aliases(
    valid_payload: dict[str, Any],
) -> None:
    event = validate_email_received_event(valid_payload)
    dumped = json.loads(event.model_dump_json())

    assert "from" in dumped["email"]["headers"]
    assert "from_" not in dumped["email"]["headers"]
    assert dumped["email"]["analysis"] == {}
    assert validate_email_received_event(dumped).id == event.id


def test_parse_webhook_event_rejects_bad_inputs() -> None:
    with pytest.raises(WebhookPayloadError):
        parse_webhook_event(None)
    with pytest.raises(WebhookPayloadError):
        parse_webhook_event()
    with pytest.raises(WebhookPayloadError):
        parse_webhook_event({"id": "test"})
    with pytest.raises(WebhookPayloadError):
        parse_webhook_event({"event": 123})
    with pytest.raises(WebhookPayloadError):
        parse_webhook_event([{"event": "email.received"}])


@pytest.mark.parametrize(
    ("event", "expected"),
    [
        ({"event": "email.received", "id": "test"}, False),
        ({"event": "email.bounced", "id": "test"}, False),
        (None, False),
        ("string", False),
        (123, False),
        ({}, False),
    ],
)
def test_is_email_received_event_handles_mixed_inputs(
    event: object, expected: bool
) -> None:
    assert is_email_received_event(event) is expected


def test_is_email_received_event_accepts_valid_email_received_payload(
    valid_payload: dict[str, Any],
) -> None:
    assert is_email_received_event(valid_payload) is False
    assert is_email_received_event(validate_email_received_event(valid_payload)) is True


def test_parse_webhook_event_rejects_malformed_known_event() -> None:
    with pytest.raises(WebhookValidationError) as error:
        parse_webhook_event({"event": "email.received", "id": "x"})
    assert error.value.code == "SCHEMA_VALIDATION_FAILED"


def test_handle_webhook_round_trip(valid_payload: dict[str, Any]) -> None:
    secret = "test-webhook-secret"
    body = json.dumps(valid_payload)
    header = sign_webhook_payload(body, secret)["header"]
    event = handle_webhook(
        body=body,
        headers={"primitive-signature": str(header)},
        secret=secret,
    )
    assert event.event == "email.received"


def test_handle_webhook_accepts_bytes_body(valid_payload: dict[str, Any]) -> None:
    secret = "test-webhook-secret"
    body = json.dumps(valid_payload).encode()
    header = sign_webhook_payload(body, secret)["header"]

    event = handle_webhook(
        body=body,
        headers={"primitive-signature": str(header)},
        secret=secret,
    )

    assert (
        event.id
        == "evt_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
    )


def test_handle_webhook_accepts_custom_tolerance(valid_payload: dict[str, Any]) -> None:
    secret = "test-webhook-secret"
    body = json.dumps(valid_payload)
    timestamp = int(datetime.now(tz=timezone.utc).timestamp()) - 500
    header = sign_webhook_payload(body, secret, timestamp)["header"]

    event = handle_webhook(
        body=body,
        headers={"primitive-signature": str(header)},
        secret=secret,
        tolerance_seconds=1000,
    )

    assert (
        event.id
        == "evt_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
    )


def test_handle_webhook_finds_signature_with_original_header_casing(
    valid_payload: dict[str, Any],
) -> None:
    secret = "test-webhook-secret"
    body = json.dumps(valid_payload)
    header = sign_webhook_payload(body, secret)["header"]

    event = handle_webhook(
        body=body,
        headers={"Primitive-Signature": str(header)},
        secret=secret,
    )

    assert (
        event.id
        == "evt_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
    )


def test_handle_webhook_finds_signature_with_uppercase_header_name(
    valid_payload: dict[str, Any],
) -> None:
    secret = "test-webhook-secret"
    body = json.dumps(valid_payload)
    header = sign_webhook_payload(body, secret)["header"]

    event = handle_webhook(
        body=body,
        headers={"PRIMITIVE-SIGNATURE": str(header)},
        secret=secret,
    )

    assert (
        event.id
        == "evt_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
    )


def test_handle_webhook_falls_back_to_legacy_mymx_signature(
    valid_payload: dict[str, Any],
) -> None:
    secret = "test-webhook-secret"
    body = json.dumps(valid_payload)
    header = sign_webhook_payload(body, secret)["header"]

    event = handle_webhook(
        body=body,
        headers={"MyMX-Signature": str(header)},
        secret=secret,
    )

    assert (
        event.id
        == "evt_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
    )


def test_handle_webhook_prefers_primitive_signature_over_legacy(
    valid_payload: dict[str, Any],
) -> None:
    secret = "test-webhook-secret"
    body = json.dumps(valid_payload)
    header = sign_webhook_payload(body, secret)["header"]

    event = handle_webhook(
        body=body,
        headers={
            "Primitive-Signature": str(header),
            "MyMX-Signature": "t=0,v1=wrong",
        },
        secret=secret,
    )

    assert (
        event.id
        == "evt_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
    )


def test_handle_webhook_falls_through_empty_primitive_to_legacy(
    valid_payload: dict[str, Any],
) -> None:
    secret = "test-webhook-secret"
    body = json.dumps(valid_payload)
    header = sign_webhook_payload(body, secret)["header"]

    event = handle_webhook(
        body=body,
        headers={
            "Primitive-Signature": "",
            "MyMX-Signature": str(header),
        },
        secret=secret,
    )

    assert (
        event.id
        == "evt_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
    )


def test_handle_webhook_accepts_bytes_signature_header(
    valid_payload: dict[str, Any],
) -> None:
    secret = "test-webhook-secret"
    body = json.dumps(valid_payload)
    header = sign_webhook_payload(body, secret)["header"].encode()

    event = handle_webhook(
        body=body,
        headers={"primitive-signature": header},
        secret=secret,
    )

    assert (
        event.id
        == "evt_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
    )


def test_handle_webhook_uses_first_signature_from_sequence_header(
    valid_payload: dict[str, Any],
) -> None:
    secret = "test-webhook-secret"
    body = json.dumps(valid_payload)
    header = sign_webhook_payload(body, secret)["header"]

    event = handle_webhook(
        body=body,
        headers={"primitive-signature": [str(header), "ignored"]},
        secret=secret,
    )

    assert (
        event.id
        == "evt_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
    )


def test_handle_webhook_coerces_non_string_header_values(
    valid_payload: dict[str, Any],
) -> None:
    secret = "test-webhook-secret"
    body = json.dumps(valid_payload)
    header = sign_webhook_payload(body, secret)["header"]

    event = handle_webhook(
        body=body,
        headers={"primitive-signature": (str(header),)},
        secret=secret,
    )

    assert (
        event.id
        == "evt_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
    )


def test_get_signature_header_skips_non_matching_keys_and_coerces_scalars() -> None:
    assert (
        _get_signature_header(
            {"content-type": "application/json", "primitive-signature": 123}
        )
        == "123"
    )


def test_get_signature_header_decodes_bytes_values() -> None:
    assert (
        _get_signature_header({"primitive-signature": b"t=123,v1=abc"})
        == "t=123,v1=abc"
    )


def test_handle_webhook_rejects_invalid_version_format(
    valid_payload: dict[str, Any],
) -> None:
    secret = "test-webhook-secret"
    body = json.dumps({**valid_payload, "version": "2025-99-99"})
    header = sign_webhook_payload(body, secret)["header"]

    with pytest.raises(WebhookValidationError):
        handle_webhook(
            body=body,
            headers={"primitive-signature": str(header)},
            secret=secret,
        )


def test_handle_webhook_rejects_invalid_json(
    secret: str = "test-webhook-secret",
) -> None:
    body = "{invalid json"
    header = sign_webhook_payload(body, secret)["header"]
    with pytest.raises(WebhookPayloadError):
        handle_webhook(
            body=body,
            headers={"primitive-signature": str(header)},
            secret=secret,
        )


def test_handle_webhook_rejects_invalid_payload_structure(
    secret: str = "test-webhook-secret",
) -> None:
    body = json.dumps({"event": "email.received", "id": "test"})
    header = sign_webhook_payload(body, secret)["header"]
    with pytest.raises(WebhookValidationError):
        handle_webhook(
            body=body,
            headers={"primitive-signature": str(header)},
            secret=secret,
        )


def test_confirmed_headers() -> None:
    assert confirmed_headers() == {"X-Primitive-Confirmed": "true", "X-MyMX-Confirmed": "true"}


def test_download_helpers(valid_payload: dict[str, Any]) -> None:
    event = valid_payload
    future_now = 1734177600000
    assert is_download_expired(event, future_now) is False
    assert get_download_time_remaining(event, future_now) > 0


def test_download_helpers_handle_exact_and_past_expiration() -> None:
    event = {
        "email": {
            "content": {
                "download": {
                    "url": "https://example.com",
                    "expires_at": "2025-01-01T00:00:00.000Z",
                }
            }
        }
    }
    exact_ms = 1735689600000
    past_ms = exact_ms + 1
    assert is_download_expired(event, exact_ms) is True
    assert get_download_time_remaining(event, past_ms) == 0


def test_download_helpers_accept_typed_events(valid_payload: dict[str, Any]) -> None:
    event = validate_email_received_event(valid_payload)
    future_now = 1734177600000

    assert is_download_expired(event, future_now) is False
    assert get_download_time_remaining(event, future_now) > 0


def test_download_helpers_raise_webhook_errors_for_invalid_payloads() -> None:
    with pytest.raises(WebhookPayloadError) as missing_error:
        is_download_expired({})

    assert missing_error.value.code == "PAYLOAD_WRONG_TYPE"

    with pytest.raises(WebhookPayloadError) as invalid_error:
        get_download_time_remaining(
            {"email": {"content": {"download": {"expires_at": "nope"}}}}
        )

    assert invalid_error.value.code == "PAYLOAD_WRONG_TYPE"


def test_raw_email_helpers(valid_payload: dict[str, Any]) -> None:
    event = valid_payload
    assert is_raw_included(event) is True
    assert decode_raw_email(event) == b"Hello World"
    downloaded = b"Hello World"
    assert verify_raw_email_download(downloaded, event) == downloaded


def test_raw_email_helpers_accept_uppercase_hashes(
    valid_payload: dict[str, Any],
) -> None:
    event = valid_payload
    uppercase_hash = hashlib.sha256(b"Hello World").hexdigest().upper()
    event["email"]["content"]["raw"]["sha256"] = uppercase_hash

    assert decode_raw_email(event) == b"Hello World"
    assert verify_raw_email_download(b"Hello World", event) == b"Hello World"


def test_decode_raw_email_skips_verification_when_requested(
    valid_payload: dict[str, Any],
) -> None:
    event = valid_payload
    event["email"]["content"]["raw"]["sha256"] = hashlib.sha256(b"other").hexdigest()
    assert decode_raw_email(event, verify=False) == b"Hello World"


def test_raw_email_hash_mismatch(valid_payload: dict[str, Any]) -> None:
    event = valid_payload
    event["email"]["content"]["raw"]["sha256"] = hashlib.sha256(b"other").hexdigest()
    with pytest.raises(RawEmailDecodeError):
        decode_raw_email(event)


def test_decode_raw_email_rejects_invalid_base64(
    valid_payload: dict[str, Any],
) -> None:
    event = valid_payload
    event["email"]["content"]["raw"]["data"] = "!!!"

    with pytest.raises(RawEmailDecodeError) as error:
        decode_raw_email(event)

    assert error.value.code == "INVALID_BASE64"


def test_decode_raw_email_rejects_download_only_content() -> None:
    event = {
        "email": {
            "content": {
                "raw": {
                    "included": False,
                    "reason_code": "size_exceeded",
                    "size_bytes": 500000,
                    "max_inline_bytes": 262144,
                    "sha256": "abc",
                },
                "download": {
                    "url": "https://example.com",
                    "expires_at": "2025-01-01T00:00:00Z",
                },
            }
        }
    }
    with pytest.raises(RawEmailDecodeError) as error:
        decode_raw_email(event)

    assert "download URL" in error.value.suggestion


def test_raw_email_helpers_raise_webhook_errors_for_invalid_payloads() -> None:
    with pytest.raises(WebhookPayloadError) as included_error:
        is_raw_included({})

    assert included_error.value.code == "PAYLOAD_WRONG_TYPE"

    with pytest.raises(WebhookPayloadError) as decode_error:
        decode_raw_email({})

    assert decode_error.value.code == "PAYLOAD_WRONG_TYPE"

    with pytest.raises(WebhookPayloadError) as verify_error:
        verify_raw_email_download(b"Hello World", {})

    assert verify_error.value.code == "PAYLOAD_WRONG_TYPE"


def test_verify_raw_email_download_accepts_empty_and_binary_content() -> None:
    empty = b""
    empty_sha = hashlib.sha256(empty).hexdigest()
    empty_event = {
        "email": {
            "content": {
                "raw": {
                    "included": False,
                    "reason_code": "size_exceeded",
                    "size_bytes": 0,
                    "max_inline_bytes": 262144,
                    "sha256": empty_sha,
                }
            }
        }
    }
    assert verify_raw_email_download(empty, empty_event) == empty

    binary = bytes([0x00, 0x01, 0x02, 0xFF, 0xFE, 0xFD, 0x89, 0x50, 0x4E, 0x47])
    binary_sha = hashlib.sha256(binary).hexdigest()
    binary_event = {
        "email": {
            "content": {
                "raw": {
                    "included": False,
                    "reason_code": "size_exceeded",
                    "size_bytes": len(binary),
                    "max_inline_bytes": 262144,
                    "sha256": binary_sha,
                }
            }
        }
    }
    assert verify_raw_email_download(memoryview(binary), binary_event) == binary
    assert verify_raw_email_download(bytearray(binary), binary_event) == binary


def test_verify_raw_email_download_hash_mismatch_includes_code_and_message() -> None:
    event = {
        "email": {
            "content": {
                "raw": {
                    "included": False,
                    "reason_code": "size_exceeded",
                    "size_bytes": 4,
                    "max_inline_bytes": 262144,
                    "sha256": "c" * 64,
                }
            }
        }
    }

    with pytest.raises(RawEmailDecodeError) as error:
        verify_raw_email_download(b"test", event)

    assert error.value.code == "HASH_MISMATCH"
    assert "SHA-256" in str(error.value)


def test_validate_email_auth(valid_payload: dict[str, Any]) -> None:
    result = validate_email_auth(valid_payload["email"]["auth"])
    assert result.verdict == "legit"
    assert result.confidence == "high"
    assert any("DKIM alignment" in reason for reason in result.reasons)


def test_validate_email_auth_wraps_invalid_mappings() -> None:
    with pytest.raises(WebhookValidationError) as error:
        validate_email_auth({})

    assert error.value.code == "SCHEMA_VALIDATION_FAILED"


def test_error_hierarchy() -> None:
    error = RawEmailDecodeError("NOT_INCLUDED")
    assert isinstance(error, PrimitiveWebhookError)
    assert not isinstance(Exception("x"), PrimitiveWebhookError)
