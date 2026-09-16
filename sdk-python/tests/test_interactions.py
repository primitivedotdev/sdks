import json
from pathlib import Path

import pytest

from primitive.interactions import (
    parse_interaction_envelope,
    validate_interaction_envelope,
)

FIXTURES = json.loads((Path(__file__).parents[2] / "test-fixtures/interaction-envelopes.json").read_text())


@pytest.mark.parametrize("fixture", FIXTURES, ids=lambda fixture: fixture["name"])
def test_shared_interaction_envelopes(fixture):
    text = fixture.get("source", "") + " " * fixture.get("padding", 0)
    data = bytes.fromhex(fixture["hex"]) if "hex" in fixture else text.encode()
    result = parse_interaction_envelope(data)
    assert result.status == fixture["status"]
    if "hex" not in fixture:
        assert parse_interaction_envelope(text).status == fixture["status"]
    if result.status != "invalid":
        assert result.text == text
        assert result.source_bytes == data


def test_decoded_validation():
    value = json.loads(FIXTURES[0]["source"])
    result = validate_interaction_envelope(value)
    assert result.status == "valid"
    assert result.text is None and result.source_bytes is None
    cyclic = {}
    cyclic["self"] = cyclic
    for payload in (float("nan"), float("inf"), 9007199254740992, "\ud800", cyclic, object(), "a" * 65_537):
        assert validate_interaction_envelope({**value, "payload": payload}).status == "invalid"
    for surrogate in ("\ud800", "\udfff"):
        assert parse_interaction_envelope(FIXTURES[0]["source"].replace("Hello", surrogate)).status == "invalid"


DECODED_FIXTURES = json.loads((Path(__file__).parents[2] / "test-fixtures/interaction-decoded.json").read_text())


@pytest.mark.parametrize("fixture", DECODED_FIXTURES, ids=lambda fixture: fixture["name"])
def test_shared_decoded_interactions(fixture):
    value = json.loads(FIXTURES[0]["source"])
    value["payload"] = [0] * fixture["array_length"]
    assert validate_interaction_envelope(value).status == fixture["status"]
