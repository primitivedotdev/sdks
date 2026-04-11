from __future__ import annotations

import pytest

from primitive_sdk import WebhookPayloadError, parse_json_body


def test_parse_json_body_rejects_empty_body() -> None:
    with pytest.raises(WebhookPayloadError) as error:
        parse_json_body("")
    assert error.value.code == "PAYLOAD_EMPTY_BODY"


def test_parse_json_body_rejects_whitespace_body() -> None:
    with pytest.raises(WebhookPayloadError) as error:
        parse_json_body("   \n\t  ")
    assert error.value.code == "PAYLOAD_EMPTY_BODY"


def test_parse_json_body_strips_utf8_bom() -> None:
    parsed = parse_json_body("\ufeff{}")
    assert parsed == {}


def test_parse_json_body_reports_json_error_position() -> None:
    with pytest.raises(WebhookPayloadError) as error:
        parse_json_body("{invalid json")
    assert error.value.code == "JSON_PARSE_FAILED"
    assert "position" in error.value.suggestion.lower()


def test_parse_json_body_rejects_invalid_utf8_bytes() -> None:
    with pytest.raises(WebhookPayloadError) as error:
        parse_json_body(bytes([0xFF, 0xFE, 0x00, 0x01]))
    assert error.value.code == "INVALID_ENCODING"
    assert "UTF-8" in error.value.suggestion


def test_parse_json_body_rejects_truncated_utf8_sequence() -> None:
    with pytest.raises(WebhookPayloadError) as error:
        parse_json_body(bytes([0xE2, 0x82]))
    assert error.value.code == "INVALID_ENCODING"
