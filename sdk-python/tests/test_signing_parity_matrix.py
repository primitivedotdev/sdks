from __future__ import annotations

import json
from typing import Any

import pytest

from primitive_sdk import (
    WebhookVerificationError,
    sign_webhook_payload,
    verify_webhook_signature,
)


@pytest.mark.parametrize(
    ("body", "secret"),
    [
        ("{}", "secret"),
        ('{"a":1}', "secret"),
        ('{"nested":{"a":[1,2,3]}}', "secret"),
        (json.dumps({"text": "Hello 世界 🌍"}, ensure_ascii=False, separators=(",", ":")), "secret"),
        (json.dumps({"text": "Line1\nLine2\tTabbed"}, separators=(",", ":")), "secret"),
        (json.dumps({"html": '<script>alert("xss")</script>'}, separators=(",", ":")), "secret"),
        (json.dumps({"long": "x" * 1000}, separators=(",", ":")), "secret"),
        (json.dumps({"long": "x" * 100000}, separators=(",", ":")), "secret"),
        (json.dumps({"emoji": "👋"}, ensure_ascii=False, separators=(",", ":")), "whsec_special!@#$%^&*()"),
        (json.dumps({"null": None, "bools": [True, False]}, separators=(",", ":")), "secret"),
        (json.dumps({"subject": 'Test with "quotes" and \n newlines'}, separators=(",", ":")), "secret"),
        (json.dumps({"array": list(range(20))}, separators=(",", ":")), "secret"),
    ],
)
def test_signing_round_trip_matrix(body: str, secret: str) -> None:
    timestamp = 1734567890
    header = sign_webhook_payload(body, secret, timestamp)["header"]
    assert (
        verify_webhook_signature(
            raw_body=body,
            signature_header=header,
            secret=secret,
            now_seconds=timestamp,
        )
        is True
    )


@pytest.mark.parametrize(
    ("timestamp", "now_seconds", "should_pass"),
    [
        (1734567890, 1734567890, True),
        (1734567890 - 1, 1734567890, True),
        (1734567890 - 240, 1734567890, True),
        (1734567890 - 300, 1734567890, True),
        (1734567890 - 301, 1734567890, False),
        (1734567890 - 360, 1734567890, False),
        (1734567890 + 1, 1734567890, True),
        (1734567890 + 30, 1734567890, True),
        (1734567890 + 60, 1734567890, True),
        (1734567890 + 61, 1734567890, False),
        (1734567890 + 120, 1734567890, False),
        (1734567890 - 900, 1734567890, False),
    ],
)
def test_signing_timestamp_matrix(
    timestamp: int,
    now_seconds: int,
    should_pass: bool,
) -> None:
    body = '{"event":"email.received"}'
    header = sign_webhook_payload(body, "secret", timestamp)["header"]
    if should_pass:
        assert (
            verify_webhook_signature(
                raw_body=body,
                signature_header=header,
                secret="secret",
                now_seconds=now_seconds,
            )
            is True
        )
    else:
        with pytest.raises(WebhookVerificationError) as error:
            verify_webhook_signature(
                raw_body=body,
                signature_header=header,
                secret="secret",
                now_seconds=now_seconds,
            )
        assert error.value.code == "TIMESTAMP_OUT_OF_RANGE"


@pytest.mark.parametrize(
    "signature_header",
    [
        "",
        "invalid",
        "t=1734567890",
        "v1=abcd",
        "t=,v1=abcd",
        "t=abc,v1=abcd",
        "t=1734567890,v1=",
        "t=1734567890,v1=short",
        "t=1734567890,v1=not-valid-hex!!!",
        "t=1734567890,other=value",
    ],
)
def test_signing_invalid_header_matrix(signature_header: str) -> None:
    body = '{"event":"email.received"}'
    with pytest.raises(WebhookVerificationError):
        verify_webhook_signature(
            raw_body=body,
            signature_header=signature_header,
            secret="secret",
            now_seconds=1734567890,
        )


@pytest.mark.parametrize(
    "header_builder",
    [
        lambda valid: f"t=1734567890,v1={valid}",
        lambda valid: f"t=1734567890,v1={'0' * 64},v1={valid}",
        lambda valid: f" t=1734567890 , v1={valid} ",
        lambda valid: f"t=1734567890,v1=not-valid-hex!!!,v1={valid}",
        lambda valid: f"ignore=this,t=1734567890,v1={valid}",
        lambda valid: f"t=1734567890,v0=legacy,v1={valid}",
    ],
)
def test_signing_valid_header_matrix(header_builder: Any) -> None:
    body = '{"event":"email.received"}'
    valid = sign_webhook_payload(body, "secret", 1734567890)["v1"]
    header = header_builder(valid)
    assert (
        verify_webhook_signature(
            raw_body=body,
            signature_header=header,
            secret="secret",
            now_seconds=1734567890,
        )
        is True
    )


@pytest.mark.parametrize(
    ("raw_body", "signature_body", "timestamp_delta", "should_pass"),
    [
        ('{"test":"data"}', '{"test":"data"}', 0, True),
        ('{"test":"data"}', '{"test":"modified"}', 0, False),
        ('{"test":"data"}', '{ "test": "data" }', 0, False),
        ('{"test":"data"}', '{"test":"data"}', 100, False),
        ('{"event":"email.received","body":"line1\\nline2"}', '{"event":"email.received","body":"line1\\nline2"}', 0, True),
    ],
)
def test_signing_mutation_matrix(
    raw_body: str,
    signature_body: str,
    timestamp_delta: int,
    should_pass: bool,
) -> None:
    signed = sign_webhook_payload(signature_body, "secret", 1734567890)
    header = f"t={1734567890 + timestamp_delta},v1={signed['v1']}"
    if should_pass:
        assert (
            verify_webhook_signature(
                raw_body=raw_body,
                signature_header=header,
                secret="secret",
                now_seconds=1734567890,
            )
            is True
        )
    else:
        with pytest.raises(WebhookVerificationError):
            verify_webhook_signature(
                raw_body=raw_body,
                signature_header=header,
                secret="secret",
                now_seconds=1734567890,
            )
