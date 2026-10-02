import json
from dataclasses import asdict
from pathlib import Path
from typing import Any

import pytest

from primitive.interactions import parse_interaction_envelope
from primitive.repeats import (
    REPEAT_STOP_KIND,
    REPEAT_TICK_KIND,
    build_repeat_stop_body,
    interaction_kind,
    parse_repeat_stop,
    parse_repeat_tick,
    read_repeat_stop,
    repeat_stop_command,
)

FIXTURES: dict[str, list[dict[str, Any]]] = json.loads(
    (Path(__file__).parents[2] / "test-fixtures/repeat-interactions.json").read_text()
)


@pytest.mark.parametrize("f", FIXTURES["ticks"], ids=lambda f: f["name"])
def test_shared_repeat_ticks(f: dict[str, Any]) -> None:
    for source in (f["raw"], f["raw"].encode("utf-8")):
        result = parse_repeat_tick(source)
        assert result.status == f["status"]
        if result.status == "valid":
            assert result.tick is not None
            assert asdict(result.tick) == f["tick"]
        if result.status == "invalid":
            assert result.reason == f["reason"]


@pytest.mark.parametrize("f", FIXTURES["stop_envelopes"], ids=lambda f: f["name"])
def test_shared_repeat_stop_envelopes(f: dict[str, Any]) -> None:
    result = parse_repeat_stop(f["raw"])
    assert result.status == f["status"]
    if result.status == "valid":
        assert result.stop is not None
        assert asdict(result.stop) == f["stop"]
    if result.status == "invalid":
        assert result.reason == f["reason"]


@pytest.mark.parametrize("f", FIXTURES["stop_bodies"], ids=lambda f: f["name"])
def test_shared_repeat_stop_bodies(f: dict[str, Any]) -> None:
    if f["status"] == "invalid":
        with pytest.raises(ValueError):
            build_repeat_stop_body(f["reason"])
        return
    assert build_repeat_stop_body(f["reason"]) == f["body"]


def test_kinds_and_command() -> None:
    parsed = parse_interaction_envelope(FIXTURES["ticks"][0]["raw"])
    assert parsed.envelope is not None
    assert interaction_kind(parsed.envelope) == REPEAT_TICK_KIND
    assert read_repeat_stop(parsed.envelope).status == "other"
    assert interaction_kind({"protocol": "repeat.stop", "protocol_version": 1}) == REPEAT_STOP_KIND
    assert (
        repeat_stop_command("9A8B7C6D-5E4F-4A3B-8C2D-1E0F9A8B7C6D")
        == "primitive repeat stop --id 9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d"
    )
    with pytest.raises(ValueError):
        repeat_stop_command("--id; rm")
    not_text: Any = 42
    with pytest.raises(TypeError):
        build_repeat_stop_body(not_text)
