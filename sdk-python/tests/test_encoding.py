from __future__ import annotations

import pytest

from primitive.errors import WebhookPayloadError
from primitive.webhook import buffer_to_string


def test_buffer_to_string_converts_valid_utf8() -> None:
    assert buffer_to_string(b"Hello, World!", "test input") == "Hello, World!"


def test_buffer_to_string_handles_multibyte_characters() -> None:
    value = "Hello, 世界"
    assert buffer_to_string(value.encode("utf-8"), "test input") == value


def test_buffer_to_string_handles_empty_buffer() -> None:
    assert buffer_to_string(b"", "test input") == ""


def test_buffer_to_string_invalid_utf8_has_code_and_label() -> None:
    with pytest.raises(WebhookPayloadError) as error:
        buffer_to_string(bytes([0xFF, 0xFE, 0x00, 0x01]), "request body")
    assert error.value.code == "INVALID_ENCODING"
    assert "request body" in str(error.value)


def test_buffer_to_string_truncated_multibyte_sequence() -> None:
    with pytest.raises(WebhookPayloadError) as error:
        buffer_to_string(bytes([0xE2, 0x82]), "payload")
    assert error.value.code == "INVALID_ENCODING"


def test_buffer_to_string_suggestion_mentions_base64() -> None:
    with pytest.raises(WebhookPayloadError) as error:
        buffer_to_string(bytes([0xFF]), "test")
    assert "base64" in error.value.suggestion
