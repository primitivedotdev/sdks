import base64
import json
from dataclasses import FrozenInstanceError
from pathlib import Path
from typing import Any

import pytest

from primitive.interactions import (
    PresenceAliveInput,
    PresenceProbeInput,
    parse_presence_envelope,
    prepare_presence_alive_email,
    prepare_presence_probe_email,
)

FIXTURES = json.loads(
    (Path(__file__).parents[2] / "test-fixtures/presence-emails.json").read_text()
)


def prepare(f: dict[str, Any]):
    source = f["input"]
    ids = iter(f["uuids"])
    if f["kind"] == "probe":
        return prepare_presence_probe_email(
            PresenceProbeInput(source["accountScope"], source["from"], source["to"]),
            uuid=lambda: next(ids),
            nonce=lambda: f["nonce"],
            now=lambda: f["now"],
        )
    return prepare_presence_alive_email(
        PresenceAliveInput(
            source["accountScope"],
            source["from"],
            source["to"],
            source["probe"],
            source["messageId"],
            tuple(source["references"]),
        ),
        uuid=lambda: next(ids),
        now=lambda: f["now"],
    )


@pytest.mark.parametrize("f", FIXTURES["preparation"], ids=lambda f: f["name"])
def test_shared_presence_emails(f: dict[str, Any]) -> None:
    if f["status"] == "invalid":
        with pytest.raises(ValueError):
            prepare(f)
        return
    result = prepare(f)
    assert result.status == f["status"]
    if result.prepared is not None:
        p = result.prepared
        assert {
            "accountScope": p.account_scope,
            "preparedAtMs": p.prepared_at_ms,
            "expiresAtMs": p.expires_at_ms,
            "idempotencyKey": p.idempotency_key,
            "requestJson": p.request_json,
        } == f["prepared"]
        part = base64.b64decode(
            json.loads(p.request_json)["attachments"][0]["content_base64"]
        )
        assert parse_presence_envelope(part).status == "valid"
        with pytest.raises(FrozenInstanceError):
            p.__setattr__("request_json", "changed")


@pytest.mark.parametrize("f", FIXTURES["parse"], ids=lambda f: f["name"])
def test_shared_presence_parse(f: dict[str, Any]) -> None:
    result = parse_presence_envelope(f["raw"].encode("utf-8"))
    assert result.status == f["status"]
    if result.status == "valid":
        assert result.text == f["raw"]
        assert result.source_bytes == f["raw"].encode("utf-8")


def test_presence_source_and_preparation_are_independent() -> None:
    fixture = next(f for f in FIXTURES["preparation"] if f["name"] == "alive")
    value = json.loads(json.dumps(fixture))
    result = prepare(value)
    assert result.prepared is not None
    saved = result.prepared.request_json
    value["input"]["probe"]["payload"]["nonce"] = "b" * 32
    assert result.prepared.request_json == saved
    assert parse_presence_envelope(b"\xff").status == "invalid"


def test_presence_parsed_probe_preserves_preparation_byte_parity() -> None:
    fixture = next(f for f in FIXTURES["preparation"] if f["name"] == "alive")
    value = json.loads(json.dumps(fixture))
    parsed = parse_presence_envelope(json.dumps(value["input"]["probe"]))
    assert parsed.envelope is not None
    value["input"]["probe"] = parsed.envelope
    result = prepare(value)
    assert result.prepared is not None
    assert result.prepared.request_json == fixture["prepared"]["requestJson"]
