from __future__ import annotations

import importlib
import json
from http import HTTPStatus
from pathlib import Path
from types import SimpleNamespace
from typing import Any, cast

import pytest

from primitive.api.models.send_email_response_200 import SendEmailResponse200
from primitive.client import PrimitiveClient, SendThread
from primitive.received_email import (
    ReceivedEmail,
    ReceivedEmailAddress,
    ReceivedEmailThread,
)

client_module = importlib.import_module("primitive.client")


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


FIXTURE = json.loads((_fixtures_root() / "send-payloads" / "cases.json").read_text())


SUCCESS_RESPONSE = {
    "success": True,
    "data": {
        "id": "sent-x",
        "status": "submitted_to_agent",
        "queue_id": None,
        "accepted": [],
        "rejected": [],
        "client_idempotency_key": "auto",
        "request_id": "req",
        "content_hash": "h",
    },
}


def _build_received_email(c: dict[str, Any]) -> ReceivedEmail:
    return ReceivedEmail(
        id=c["id"],
        event_id=c["event_id"],
        received_at=c["received_at"],
        sender=ReceivedEmailAddress(
            address=c["sender"]["address"], name=c["sender"]["name"]
        ),
        reply_target=ReceivedEmailAddress(
            address=c["reply_target"]["address"], name=c["reply_target"]["name"]
        ),
        received_by=c["received_by"],
        received_by_all=list(c["received_by_all"]),
        subject=c["subject"],
        reply_subject=c["reply_subject"],
        forward_subject=c["forward_subject"],
        text=c["text"],
        thread=ReceivedEmailThread(
            message_id=c["thread"]["message_id"],
            in_reply_to=list(c["thread"]["in_reply_to"]),
            references=list(c["thread"]["references"]),
        ),
        attachments=[],
        auth=cast(Any, SimpleNamespace()),
        analysis=cast(Any, SimpleNamespace()),
        raw=cast(
            Any,
            SimpleNamespace(
                email=SimpleNamespace(
                    headers=SimpleNamespace(
                        to=c["raw_to_header"], date=c["raw_date_header"]
                    )
                )
            ),
        ),
    )


def _make_capturing_sync_send(captured: dict[str, Any]) -> Any:
    def fake(**kwargs: Any) -> Any:
        captured["body"] = kwargs["body"].to_dict()
        captured["idempotency_key"] = kwargs.get("idempotency_key")
        return SimpleNamespace(
            status_code=HTTPStatus.OK,
            parsed=SendEmailResponse200.from_dict(SUCCESS_RESPONSE),
            content=b"",
        )

    return fake


@pytest.mark.parametrize("case", FIXTURE["send"], ids=lambda c: c["name"])
def test_send_payloads_match_fixture(
    case: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    captured: dict[str, Any] = {}
    monkeypatch.setattr(
        client_module,
        "send_email_sync_detailed",
        _make_capturing_sync_send(captured),
    )

    client = PrimitiveClient("prim_test")
    inp = case["input"]
    thread = (
        SendThread(
            in_reply_to=inp.get("in_reply_to"),
            references=inp.get("references"),
        )
        if "in_reply_to" in inp or "references" in inp
        else None
    )

    client.send(
        from_email=inp["from"],
        to=inp["to"],
        subject=inp["subject"],
        body_text=inp.get("body_text"),
        body_html=inp.get("body_html"),
        thread=thread,
        wait=inp.get("wait"),
        wait_timeout_ms=inp.get("wait_timeout_ms"),
        idempotency_key=inp.get("idempotency_key"),
    )

    assert captured["body"] == case["expected_body"]
    assert captured.get("idempotency_key") == case["expected_idempotency_key"]


@pytest.mark.parametrize("case", FIXTURE["reply"], ids=lambda c: c["name"])
def test_reply_payloads_match_fixture(
    case: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    captured: dict[str, Any] = {}
    monkeypatch.setattr(
        client_module,
        "send_email_sync_detailed",
        _make_capturing_sync_send(captured),
    )

    client = PrimitiveClient("prim_test")
    email = _build_received_email(FIXTURE["canonical_inbound"])

    reply_input = {"text": case["input"]["text"]}
    if "subject" in case["input"]:
        reply_input["subject"] = case["input"]["subject"]
    if "from" in case["input"]:
        reply_input["from"] = case["input"]["from"]

    client.reply(email, reply_input)

    assert captured["body"] == case["expected_body"]
    assert captured.get("idempotency_key") == case["expected_idempotency_key"]


@pytest.mark.parametrize("case", FIXTURE["forward"], ids=lambda c: c["name"])
def test_forward_payloads_match_fixture(
    case: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    captured: dict[str, Any] = {}
    monkeypatch.setattr(
        client_module,
        "send_email_sync_detailed",
        _make_capturing_sync_send(captured),
    )

    client = PrimitiveClient("prim_test")
    email = _build_received_email(FIXTURE["canonical_inbound"])

    client.forward(
        email,
        to=case["input"]["to"],
        body_text=case["input"].get("body_text"),
        subject=case["input"].get("subject"),
        from_email=case["input"].get("from"),
    )

    body = captured["body"]
    for key, value in case["expected_body_match"].items():
        assert body.get(key) == value, (case["name"], key)

    body_text = body.get("body_text", "")
    for fragment in case["expected_body_text_contains"]:
        assert fragment in body_text, (case["name"], fragment)

    assert captured.get("idempotency_key") == case["expected_idempotency_key"]
