from __future__ import annotations

import hashlib
import hmac
import json

import pytest

from primitive_sdk import (
    PRIMITIVE_CONFIRMED_HEADER,
    PRIMITIVE_SIGNATURE_HEADER,
    WebhookVerificationError,
    sign_webhook_payload,
    verify_webhook_signature,
)

TEST_VECTORS = {
    "simple": {
        "secret": "whsec_test_secret_key_123",
        "timestamp": 1734567890,
        "raw_body": '{"event":"email.received","email_id":"msg_123"}',
    },
    "minimal": {
        "secret": "secret",
        "timestamp": 1000000000,
        "raw_body": "{}",
    },
    "special_chars": {
        "secret": "whsec_another_secret!@#$%",
        "timestamp": 1700000000,
        "raw_body": '{"subject":"Test with \\\"quotes\\\" and \\n newlines","from":"test@example.com"}',
    },
    "realistic": {
        "secret": "whsec_production_key_abc123xyz",
        "timestamp": 1734567890,
        "raw_body": json.dumps(
            {
                "id": "evt_abc123xyz789",
                "event": "email.received",
                "version": "2025-12-14",
                "delivery": {
                    "endpoint_id": "ep_abc123",
                    "attempt": 1,
                    "attempted_at": "2025-12-14T12:00:00.000Z",
                },
                "email": {
                    "id": "em_xyz789",
                    "received_at": "2025-12-14T11:59:50.000Z",
                    "headers": {
                        "from": "sender@example.com",
                        "to": "recipient@mydomain.com",
                        "subject": "Important Business Email",
                    },
                },
            },
            separators=(",", ":"),
        ),
    },
}


def test_signature_header_constants() -> None:
    assert PRIMITIVE_SIGNATURE_HEADER == "Primitive-Signature"
    assert PRIMITIVE_CONFIRMED_HEADER == "X-Primitive-Confirmed"


def test_sign_webhook_payload_uses_stripe_style_format() -> None:
    result = sign_webhook_payload("{}", "secret", 1734567890)
    assert result["header"].startswith("t=1734567890,v1=")
    assert len(str(result["v1"])) == 64


def test_sign_webhook_payload_returns_current_timestamp_by_default() -> None:
    result = sign_webhook_payload("{}", "secret")
    assert isinstance(result["timestamp"], int)


def test_sign_webhook_payload_is_consistent_for_same_inputs() -> None:
    timestamp = 1734567890
    one = sign_webhook_payload('{"a":1}', "secret", timestamp)
    two = sign_webhook_payload('{"a":1}', "secret", timestamp)
    assert one == two


def test_sign_webhook_payload_changes_for_different_timestamps_bodies_and_secrets() -> None:
    body = '{"a":1}'
    one = sign_webhook_payload(body, "secret", 1000000000)
    two = sign_webhook_payload(body, "secret", 1000000001)
    three = sign_webhook_payload('{"a":2}', "secret", 1000000000)
    four = sign_webhook_payload(body, "secret-2", 1000000000)
    assert one["header"] != two["header"]
    assert one["header"] != three["header"]
    assert one["header"] != four["header"]


def test_sign_webhook_payload_matches_manual_hmac() -> None:
    body = '{"message_id":"msg_123"}'
    secret = "test-secret-key"
    timestamp = 1734567890
    expected = hmac.new(
        secret.encode(),
        f"{timestamp}.{body}".encode(),
        hashlib.sha256,
    ).hexdigest()
    assert sign_webhook_payload(body, secret, timestamp)["header"] == f"t={timestamp},v1={expected}"


def test_verify_webhook_signature_accepts_valid_signature() -> None:
    body = '{"event":"email.received"}'
    result = sign_webhook_payload(body, "secret", 1734567890)
    assert (
        verify_webhook_signature(
            raw_body=body,
            signature_header=str(result["header"]),
            secret="secret",
            now_seconds=1734567890,
        )
        is True
    )


def test_verify_webhook_signature_accepts_uppercase_hex_signature() -> None:
    body = '{"event":"email.received"}'
    result = sign_webhook_payload(body, "secret", 1734567890)
    uppercase_header = str(result["header"]).upper().replace("T=", "t=").replace(",V1=", ",v1=")

    assert (
        verify_webhook_signature(
            raw_body=body,
            signature_header=uppercase_header,
            secret="secret",
            now_seconds=1734567890,
        )
        is True
    )


def test_verify_webhook_signature_rejects_invalid_header() -> None:
    with pytest.raises(WebhookVerificationError) as error:
        verify_webhook_signature(raw_body="{}", signature_header="", secret="secret")
    assert error.value.code == "INVALID_SIGNATURE_HEADER"


def test_verify_webhook_signature_rejects_missing_secret() -> None:
    with pytest.raises(WebhookVerificationError) as error:
        verify_webhook_signature(raw_body="{}", signature_header="t=1,v1=abc", secret="")
    assert error.value.code == "MISSING_SECRET"


def test_sign_webhook_payload_accepts_bytes_inputs() -> None:
    body = b'{"event":"email.received"}'
    secret = b"secret"
    timestamp = 1734567890

    from_string = sign_webhook_payload(body.decode(), secret.decode(), timestamp)
    from_bytes = sign_webhook_payload(body, secret, timestamp)

    assert from_string["header"] == from_bytes["header"]


def test_verify_webhook_signature_rejects_missing_timestamp_part() -> None:
    with pytest.raises(WebhookVerificationError) as error:
        verify_webhook_signature(
            raw_body="{}",
            signature_header="v1=abc123",
            secret="secret",
        )
    assert error.value.code == "INVALID_SIGNATURE_HEADER"


def test_verify_webhook_signature_rejects_missing_v1_part() -> None:
    with pytest.raises(WebhookVerificationError) as error:
        verify_webhook_signature(
            raw_body="{}",
            signature_header="t=1734567890",
            secret="secret",
        )
    assert error.value.code == "INVALID_SIGNATURE_HEADER"


def test_verify_webhook_signature_rejects_future_timestamp() -> None:
    body = '{"event":"email.received"}'
    header = sign_webhook_payload(body, "secret", 1734568015)["header"]

    with pytest.raises(WebhookVerificationError) as error:
        verify_webhook_signature(
            raw_body=body,
            signature_header=header,
            secret="secret",
            now_seconds=1734567890,
        )
    assert error.value.code == "TIMESTAMP_OUT_OF_RANGE"


def test_verify_webhook_signature_rejects_old_timestamp() -> None:
    body = '{"event":"email.received"}'
    header = sign_webhook_payload(body, "secret", 1734567000)["header"]

    with pytest.raises(WebhookVerificationError) as error:
        verify_webhook_signature(
            raw_body=body,
            signature_header=header,
            secret="secret",
            now_seconds=1734567890,
        )
    assert error.value.code == "TIMESTAMP_OUT_OF_RANGE"


def test_verify_webhook_signature_rejects_wrong_secret() -> None:
    body = '{"event":"email.received"}'
    header = sign_webhook_payload(body, "secret-1", 1734567890)["header"]

    with pytest.raises(WebhookVerificationError) as error:
        verify_webhook_signature(
            raw_body=body,
            signature_header=header,
            secret="secret-2",
            now_seconds=1734567890,
        )
    assert error.value.code == "SIGNATURE_MISMATCH"


def test_verify_webhook_signature_accepts_custom_tolerance_and_now_seconds() -> None:
    body = '{"event":"email.received"}'
    header = sign_webhook_payload(body, "secret", 1000)["header"]
    assert (
        verify_webhook_signature(
            raw_body=body,
            signature_header=header,
            secret="secret",
            tolerance_seconds=10,
            now_seconds=1010,
        )
        is True
    )


def test_verify_webhook_signature_accepts_boundary_but_rejects_one_second_past() -> None:
    body = '{"event":"email.received"}'
    header = sign_webhook_payload(body, "secret", 1000)["header"]
    assert (
        verify_webhook_signature(
            raw_body=body,
            signature_header=header,
            secret="secret",
            now_seconds=1300,
        )
        is True
    )
    with pytest.raises(WebhookVerificationError):
        verify_webhook_signature(
            raw_body=body,
            signature_header=header,
            secret="secret",
            now_seconds=1301,
        )


@pytest.mark.parametrize("timestamp", [0, -1, 2**53 - 1, 4102444800])
def test_verify_webhook_signature_rejects_extreme_timestamps(timestamp: int) -> None:
    body = '{"event":"email.received"}'
    header = sign_webhook_payload(body, "secret", timestamp)["header"]
    with pytest.raises(WebhookVerificationError) as error:
        verify_webhook_signature(
            raw_body=body,
            signature_header=header,
            secret="secret",
            now_seconds=1734567890,
        )
    assert error.value.code == "TIMESTAMP_OUT_OF_RANGE"


def test_verify_webhook_signature_skips_non_hex_and_wrong_length_signatures() -> None:
    body = '{"event":"email.received"}'
    valid = sign_webhook_payload(body, "secret", 1734567890)
    header = f"t=1734567890,v1=short,v1=xyz!,v1={valid['v1']}"
    assert (
        verify_webhook_signature(
            raw_body=body,
            signature_header=header,
            secret="secret",
            now_seconds=1734567890,
        )
        is True
    )


def test_verify_webhook_signature_rejects_modified_body_and_whitespace_changes() -> None:
    compact = '{"event":"email.received","id":"abc"}'
    header = sign_webhook_payload(compact, "secret", 1734567890)["header"]
    with pytest.raises(WebhookVerificationError):
        verify_webhook_signature(
            raw_body='{"event":"email.received","id":"xyz"}',
            signature_header=header,
            secret="secret",
            now_seconds=1734567890,
        )
    with pytest.raises(WebhookVerificationError):
        verify_webhook_signature(
            raw_body='{"event": "email.received", "id":"abc"}',
            signature_header=header,
            secret="secret",
            now_seconds=1734567890,
        )


def test_verify_webhook_signature_detects_pretty_printed_json_hint() -> None:
    compact = '{"event":"email.received","id":"abc"}'
    pretty = json.dumps(json.loads(compact), indent=2)
    header = sign_webhook_payload(compact, "secret", 1734567890)["header"]
    with pytest.raises(WebhookVerificationError) as error:
        verify_webhook_signature(
            raw_body=pretty,
            signature_header=header,
            secret="secret",
            now_seconds=1734567890,
        )
    assert "pretty-printed" in str(error.value)
    assert "json.loads()" in str(error.value)
    assert "json.dumps()" in str(error.value)


def test_verify_webhook_signature_works_with_unicode_special_characters_and_long_body() -> None:
    body = json.dumps(
        {
            "event": "email.received",
            "subject": 'Test with "quotes" and \n newlines',
            "emoji": "hello 👋",
            "long": "x" * 10000,
        },
        ensure_ascii=False,
        separators=(",", ":"),
    )
    secret = "whsec_special!@#$%^&*()"
    header = sign_webhook_payload(body, secret, 1734567890)["header"]
    assert (
        verify_webhook_signature(
            raw_body=body,
            signature_header=header,
            secret=secret,
            now_seconds=1734567890,
        )
        is True
    )


@pytest.mark.parametrize("vector_name", ["simple", "minimal", "special_chars", "realistic"])
def test_signing_test_vectors_round_trip(vector_name: str) -> None:
    vector = TEST_VECTORS[vector_name]
    signed = sign_webhook_payload(
        vector["raw_body"],
        vector["secret"],
        vector["timestamp"],
    )
    expected = hmac.new(
        vector["secret"].encode(),
        f"{vector['timestamp']}.{vector['raw_body']}".encode(),
        hashlib.sha256,
    ).hexdigest()
    assert signed["v1"] == expected
    assert (
        verify_webhook_signature(
            raw_body=vector["raw_body"],
            signature_header=signed["header"],
            secret=vector["secret"],
            now_seconds=vector["timestamp"],
        )
        is True
    )


def test_verification_error_to_json_and_string_include_suggestion() -> None:
    with pytest.raises(WebhookVerificationError) as error:
        verify_webhook_signature(raw_body="{}", signature_header="", secret="secret")
    payload = error.value.to_json()
    assert payload["code"] == "INVALID_SIGNATURE_HEADER"
    assert "suggestion" in payload
    assert "Suggestion:" in str(error.value)


def test_verification_error_message_is_helpful_for_invalid_header() -> None:
    with pytest.raises(WebhookVerificationError) as error:
        verify_webhook_signature(raw_body='{"test":"data"}', signature_header="", secret="secret")
    assert "Invalid Primitive-Signature" in str(error.value)


def test_verification_error_suggestions_vary_by_code() -> None:
    with pytest.raises(WebhookVerificationError) as invalid_header:
        verify_webhook_signature(raw_body='{"test":"data"}', signature_header="invalid", secret="secret")
    assert "Primitive-Signature" in invalid_header.value.suggestion

    old_header = sign_webhook_payload('{"test":"data"}', "secret", 1000)["header"]
    with pytest.raises(WebhookVerificationError) as old_error:
        verify_webhook_signature(
            raw_body='{"test":"data"}',
            signature_header=old_header,
            secret="secret",
            now_seconds=2000,
        )
    assert "clock" in old_error.value.suggestion

    mismatch_header = sign_webhook_payload('{"test":"data"}', "secret", 1734567890)["header"]
    with pytest.raises(WebhookVerificationError) as mismatch_error:
        verify_webhook_signature(
            raw_body='{"test":"data"}',
            signature_header=mismatch_header,
            secret="wrong-secret",
            now_seconds=1734567890,
        )
    assert "secret" in mismatch_error.value.suggestion


def test_verify_webhook_signature_accepts_recent_and_minor_future_skew() -> None:
    body = '{"message_id":"msg_123","from":"test@example.com"}'
    assert (
        verify_webhook_signature(
            raw_body=body,
            signature_header=sign_webhook_payload(body, "secret", 1734567890 - 240)["header"],
            secret="secret",
            now_seconds=1734567890,
        )
        is True
    )
    assert (
        verify_webhook_signature(
            raw_body=body,
            signature_header=sign_webhook_payload(body, "secret", 1734567890 + 30)["header"],
            secret="secret",
            now_seconds=1734567890,
        )
        is True
    )


def test_verify_webhook_signature_rejects_modified_timestamp_header() -> None:
    body = '{"test":"data"}'
    signed = sign_webhook_payload(body, "secret", 1734567890)
    tampered_header = f"t=1734567990,v1={signed['v1']}"
    with pytest.raises(WebhookVerificationError):
        verify_webhook_signature(
            raw_body=body,
            signature_header=tampered_header,
            secret="secret",
            now_seconds=1734567890,
        )


def test_customer_can_verify_signature_manually_with_stripe_style_format() -> None:
    payload = {
        "message_id": "msg_789",
        "from": "sender@example.com",
        "to": "recipient@domain.com",
        "subject": "Test Email",
    }
    secret = "my-webhook-secret"
    raw_body = json.dumps(payload, separators=(",", ":"))
    signed = sign_webhook_payload(raw_body, secret, 1734567890)
    expected = hmac.new(
        secret.encode(),
        f"{signed['timestamp']}.{raw_body}".encode(),
        hashlib.sha256,
    ).hexdigest()
    assert expected == signed["v1"]
    assert signed["header"] == f"t={signed['timestamp']},v1={expected}"


def test_customer_sdk_flow_round_trip_and_wrong_secret() -> None:
    secret = "whsec_customer_secret"
    raw_body = json.dumps(
        {
            "message_id": "msg_123",
            "from": "test@example.com",
            "to": "user@domain.com",
            "subject": "Integration Test",
        },
        separators=(",", ":"),
    )
    header = sign_webhook_payload(raw_body, secret, 1734567890)["header"]
    assert (
        verify_webhook_signature(
            raw_body=raw_body,
            signature_header=header,
            secret=secret,
            now_seconds=1734567890,
        )
        is True
    )
    with pytest.raises(WebhookVerificationError) as error:
        verify_webhook_signature(
            raw_body=raw_body,
            signature_header=header,
            secret="wrong-secret",
            now_seconds=1734567890,
        )
    assert error.value.code == "SIGNATURE_MISMATCH"


def test_verify_webhook_signature_accepts_multiple_v1_values_when_one_matches() -> None:
    body = '{"event":"email.received"}'
    valid = sign_webhook_payload(body, "secret", 1734567890)
    header = f"t=1734567890,v1={'0' * 64},v1={valid['v1']}"

    assert (
        verify_webhook_signature(
            raw_body=body,
            signature_header=header,
            secret="secret",
            now_seconds=1734567890,
        )
        is True
    )
