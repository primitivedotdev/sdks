from __future__ import annotations

import hashlib
from typing import Any, cast

import pytest

from primitive_sdk import (
    PrimitiveWebhookError,
    RawEmailDecodeError,
    UnknownEvent,
    confirmed_headers,
    decode_raw_email,
    get_download_time_remaining,
    is_download_expired,
    is_email_received_event,
    is_raw_included,
    parse_webhook_event,
    verify_raw_email_download,
)


@pytest.mark.parametrize(
    ("event", "expected"),
    [
        ({"event": "email.received", "id": "test"}, True),
        ({"event": "email.bounced", "id": "test"}, False),
        (None, False),
        ("string", False),
        (123, False),
        ({}, False),
    ],
)
def test_is_email_received_event_matrix(event: object, expected: bool) -> None:
    assert is_email_received_event(event) is expected


@pytest.mark.parametrize(
    "payload",
    [
        {"event": "email.bounced", "id": "evt-456", "bounce_reason": "mailbox_full"},
        {"event": "email.opened", "id": "evt-789", "opened_at": "2025-01-01T00:00:00Z"},
        {"event": "email.clicked", "id": "evt-abc", "version": "2025-12-14", "link_url": "https://example.com"},
    ],
)
def test_parse_webhook_event_unknown_event_matrix(payload: dict[str, Any]) -> None:
    result = cast(UnknownEvent, parse_webhook_event(payload))
    assert result["event"] == payload["event"]
    if "id" in payload:
        assert result.get("id") == payload["id"]
    if "version" in payload:
        assert result.get("version") == payload["version"]


@pytest.mark.parametrize(
    ("expires_at", "now_ms", "expired"),
    [
        ("2025-01-01T01:00:00.000Z", 1735689600000, False),
        ("2025-01-01T00:00:00.000Z", 1735689600000, True),
        ("2024-12-31T23:00:00.000Z", 1735689600000, True),
    ],
)
def test_download_expiry_matrix(expires_at: str, now_ms: int, expired: bool) -> None:
    event = {"email": {"content": {"download": {"url": "https://example.com", "expires_at": expires_at}}}}
    assert is_download_expired(event, now_ms) is expired


@pytest.mark.parametrize(
    ("expires_at", "now_ms", "minimum_expected"),
    [
        ("2025-01-01T01:00:00.000Z", 1735689600000, 3600000),
        ("2025-01-01T00:00:00.000Z", 1735689600000, 0),
        ("2024-12-31T23:59:59.000Z", 1735689600000, 0),
    ],
)
def test_download_remaining_matrix(expires_at: str, now_ms: int, minimum_expected: int) -> None:
    event = {"email": {"content": {"download": {"url": "https://example.com", "expires_at": expires_at}}}}
    remaining = get_download_time_remaining(event, now_ms)
    assert remaining >= minimum_expected
    if minimum_expected == 0:
        assert remaining == 0


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ({"included": True, "data": "abc", "sha256": "xyz", "size_bytes": 100, "max_inline_bytes": 262144, "encoding": "base64"}, True),
        ({"included": False, "reason_code": "size_exceeded", "size_bytes": 500000, "max_inline_bytes": 262144, "sha256": "abc"}, False),
    ],
)
def test_is_raw_included_matrix(raw: dict[str, Any], expected: bool) -> None:
    event = {"email": {"content": {"raw": raw, "download": {"url": "https://example.com", "expires_at": "2025-01-01T00:00:00Z"}}}}
    assert is_raw_included(event) is expected


@pytest.mark.parametrize("content", [b"Hello, World!", b"", bytes([0x00, 0x01, 0x02, 0xFF])])
def test_verify_raw_email_download_matrix(content: bytes) -> None:
    sha = hashlib.sha256(content).hexdigest()
    event = {"email": {"content": {"raw": {"included": False, "reason_code": "size_exceeded", "size_bytes": len(content), "max_inline_bytes": 262144, "sha256": sha}}}}
    assert verify_raw_email_download(bytearray(content), event) == content


def test_verify_raw_email_download_hash_mismatch_code_and_message() -> None:
    event = {"email": {"content": {"raw": {"included": False, "reason_code": "size_exceeded", "size_bytes": 4, "max_inline_bytes": 262144, "sha256": "c" * 64}}}}
    with pytest.raises(RawEmailDecodeError) as error:
        verify_raw_email_download(b"test", event)
    assert error.value.code == "HASH_MISMATCH"
    assert "SHA-256" in str(error.value)


def test_decode_raw_email_download_only_has_suggestion() -> None:
    event = {"email": {"content": {"raw": {"included": False, "reason_code": "size_exceeded", "size_bytes": 500000, "max_inline_bytes": 262144, "sha256": "abc"}, "download": {"url": "https://example.com", "expires_at": "2025-01-01T00:00:00Z"}}}}
    with pytest.raises(RawEmailDecodeError) as error:
        decode_raw_email(event)
    assert "download URL" in error.value.suggestion


def test_confirmed_headers_value_is_string_true() -> None:
    headers = confirmed_headers()
    assert headers["X-Primitive-Confirmed"] == "true"
    assert isinstance(headers["X-Primitive-Confirmed"], str)


def test_regular_exception_is_not_primitive_webhook_error() -> None:
    assert not isinstance(Exception("x"), PrimitiveWebhookError)
