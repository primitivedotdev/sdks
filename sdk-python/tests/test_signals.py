import asyncio
import base64
import json
from dataclasses import asdict
from email.message import EmailMessage
from email.parser import BytesParser
from email.policy import default
from pathlib import Path
from typing import Any

import httpx
import pytest

from primitive.api.api.sending.send_email import asyncio_detailed
from primitive.api.client import AuthenticatedClient
from primitive.api.models.send_mail_input import SendMailInput
from primitive.signals import (
    ExpiredSignal,
    PreparedSignal,
    SignalInput,
    SignalParent,
    SignalResponse,
    prepare_signal_email,
    send_prepared_signal,
)

FIXTURES = json.loads(
    (Path(__file__).parents[2] / "test-fixtures/signal-emails.json").read_text()
)


def _input(item: dict[str, Any]) -> SignalInput:
    source = item["input"]
    p = source["parent"]
    parent = SignalParent(
        p["accountScope"],
        p["from"],
        p["to"],
        p["messageId"],
        p["subject"],
        tuple(p["references"]),
    )
    return SignalInput(
        parent,
        source["kind"],
        source.get("status"),
        source.get("note"),
        source.get("expiresAtMs"),
    )


def _fixture(name: str) -> dict[str, Any]:
    return next(item for item in FIXTURES if item["name"] == name)


def _prepared(name: str) -> PreparedSignal:
    item = _fixture(name)
    ids = iter(item["uuids"])
    result = prepare_signal_email(
        _input(item), uuid=lambda: next(ids), now=lambda: item["now"]
    )
    assert result.prepared is not None
    return result.prepared


@pytest.mark.parametrize("item", FIXTURES, ids=lambda item: item["name"])
def test_shared_signal_emails(item: dict[str, Any]) -> None:
    ids = iter(item["uuids"])
    calls = []

    def uuid() -> str:
        calls.append(True)
        return next(ids)

    if item["status"] == "invalid":
        with pytest.raises(ValueError):
            prepare_signal_email(_input(item), uuid=uuid, now=lambda: item["now"])
        return
    result = prepare_signal_email(_input(item), uuid=uuid, now=lambda: item["now"])
    assert result.status == item["status"]
    if result.status == "waiting_on_parent":
        assert not calls
    else:
        assert result.prepared is not None
        actual = result.prepared
        assert (
            dict(
                accountScope=actual.account_scope,
                preparedAtMs=actual.prepared_at_ms,
                expiresAtMs=actual.expires_at_ms,
                idempotencyKey=actual.idempotency_key,
                requestJson=actual.request_json,
            )
            == item["prepared"]
        )


def test_retry_scope_and_expiry() -> None:
    prepared = PreparedSignal(**json.loads(json.dumps(asdict(_prepared("read")))))
    calls = []

    async def send(body: dict[str, object], key: str) -> str:
        calls.append(json.dumps([body, key]))
        body["to"] = "changed@example.com"
        if len(calls) == 1:
            raise TimeoutError("unknown outcome")
        return "ordinary response"

    with pytest.raises(TimeoutError):
        asyncio.run(
            send_prepared_signal(
                send, prepared, account_scope="account-one", now=lambda: 1800000000123
            )
        )
    result = asyncio.run(
        send_prepared_signal(
            send, prepared, account_scope="account-one", now=lambda: 1800000000123
        )
    )
    assert isinstance(result, SignalResponse) and result.result == "ordinary response"
    assert calls[0] == calls[1]
    with pytest.raises(ValueError, match="scope"):
        asyncio.run(
            send_prepared_signal(
                send, prepared, account_scope="other", now=lambda: 1800000000123
            )
        )
    working = _prepared("working")
    assert working.expires_at_ms is not None
    result = asyncio.run(
        send_prepared_signal(
            send, working, account_scope="account-one", now=lambda: 1800000060123
        )
    )
    assert (
        isinstance(result, ExpiredSignal)
        and result.idempotency_key == working.idempotency_key
    )
    assert len(calls) == 2


def test_generated_ordinary_send_adapter() -> None:
    prepared = _prepared("read")
    requests: list[httpx.Request] = []

    def transport(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        # A real non-success response must remain visible to the caller.
        return httpx.Response(
            400,
            json={
                "success": False,
                "error": {"code": "validation_error", "message": "fixture"},
            },
        )

    client = AuthenticatedClient(
        base_url="https://api.example.test/v1", token="fixture" + "-only"
    )
    client.set_async_httpx_client(
        httpx.AsyncClient(
            base_url="https://api.example.test/v1",
            transport=httpx.MockTransport(transport),
        )
    )

    async def adapter(body: dict[str, object], key: str):
        return await asyncio_detailed(
            client=client, body=SendMailInput.from_dict(body), idempotency_key=key
        )

    result = asyncio.run(
        send_prepared_signal(
            adapter, prepared, account_scope="account-one", now=lambda: 1800000000123
        )
    )
    assert isinstance(result, SignalResponse) and result.result.status_code == 400
    assert requests[0].url.path == "/v1/send-mail"
    assert requests[0].headers["Idempotency-Key"] == prepared.idempotency_key
    assert json.loads(requests[0].content) == json.loads(prepared.request_json)


def test_async_expiry_checked_when_awaited() -> None:
    prepared = _prepared("working")
    current = 1800000000123
    calls = []

    async def send(body: dict[str, object], key: str) -> str:
        calls.append(key)
        return "unused"

    attempt = send_prepared_signal(
        send, prepared, account_scope="account-one", now=lambda: current
    )
    current += 60000
    result = asyncio.run(attempt)
    assert isinstance(result, ExpiredSignal)
    assert not calls


def test_standard_mime_round_trip_preserves_signal_attachment() -> None:
    body = json.loads(_prepared("working").request_json)
    message = EmailMessage()
    for header, field in (
        ("From", "from"),
        ("To", "to"),
        ("Subject", "subject"),
        ("In-Reply-To", "in_reply_to"),
    ):
        message[header] = body[field]
    message["References"] = " ".join(body["references"])
    message.set_content(body["body_text"])
    attachment = body["attachments"][0]
    raw = base64.b64decode(attachment["content_base64"])
    message.add_attachment(
        raw, maintype="application", subtype="json", filename="interaction.json"
    )
    received = BytesParser(policy=default).parsebytes(message.as_bytes())
    parts = list(received.iter_attachments())
    assert len(parts) == 1
    assert parts[0].get_filename() == "interaction.json"
    assert parts[0].get_content_type() == "application/json"
    assert parts[0].get_payload(decode=True) == raw
    assert received["In-Reply-To"] == body["in_reply_to"]
