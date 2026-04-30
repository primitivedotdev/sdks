from __future__ import annotations

import importlib
from http import HTTPStatus
from types import SimpleNamespace
from typing import Any, cast

import pytest

from primitive.api.models.error_response import ErrorResponse
from primitive.api.models.send_email_response_200 import SendEmailResponse200
from primitive.client import PrimitiveAPIError, PrimitiveClient, SendThread
from primitive.received_email import (
    ReceivedEmail,
    ReceivedEmailAddress,
    ReceivedEmailThread,
)

client_module = importlib.import_module("primitive.client")

RECEIVED_EMAIL = ReceivedEmail(
    id="email-1",
    event_id="evt-1",
    received_at="2026-01-01T00:00:00.000Z",
    sender=ReceivedEmailAddress(address="alice@example.com", name="Alice"),
    reply_target=ReceivedEmailAddress(address="alice@example.com", name="Alice"),
    received_by="support@example.com",
    received_by_all=["support@example.com"],
    subject="Hello",
    reply_subject="Re: Hello",
    forward_subject="Fwd: Hello",
    text="Hi there",
    thread=ReceivedEmailThread(
        message_id="<parent@example.com>",
        in_reply_to=[],
        references=["<root@example.com>"],
    ),
    attachments=[],
    auth=cast(Any, SimpleNamespace()),
    analysis=cast(Any, SimpleNamespace()),
    raw=cast(
        Any,
        SimpleNamespace(
            email=SimpleNamespace(
                headers=SimpleNamespace(
                    to="support@example.com",
                    date="Tue, 01 Jan 2026 00:00:00 +0000",
                )
            )
        ),
    ),
)

SEND_RESULT = {
    "id": "sent-123",
    "status": "submitted_to_agent",
    "queue_id": "qid-123",
    "accepted": ["alice@example.com"],
    "rejected": [],
    "client_idempotency_key": "idem-123",
    "request_id": "req-123",
    "content_hash": "hash-123",
}


def test_send_validates_recipient_before_request(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    called = False

    def fake_send_email_sync_detailed(*, client, body):
        del client, body
        nonlocal called
        called = True
        raise AssertionError("send_email_sync_detailed should not be called")

    monkeypatch.setattr(
        client_module, "send_email_sync_detailed", fake_send_email_sync_detailed
    )

    client = PrimitiveClient("prim_test")

    with pytest.raises(TypeError, match="to must be a valid email address"):
        client.send(
            from_email="support@example.com",
            to="not-an-email",
            subject="Hello",
            body_text="Hi",
        )

    assert called is False


def test_send_posts_payload_and_returns_send_result(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, object] = {}

    def fake_send_email_sync_detailed(*, client, body):
        captured["token"] = client.token
        captured["body"] = body.to_dict()
        return SimpleNamespace(
            status_code=HTTPStatus.OK,
            parsed=SendEmailResponse200.from_dict(
                {
                    "success": True,
                    "data": SEND_RESULT,
                }
            ),
            content=b"",
        )

    monkeypatch.setattr(
        client_module, "send_email_sync_detailed", fake_send_email_sync_detailed
    )

    client = PrimitiveClient("prim_test", base_url="https://example.test/api/v1")
    result = client.send(
        from_email="support@example.com",
        to="alice@example.com",
        subject="Hello",
        body_text="Hi there",
    )

    assert captured == {
        "token": "prim_test",
        "body": {
            "from": "support@example.com",
            "to": "alice@example.com",
            "subject": "Hello",
            "body_text": "Hi there",
        },
    }
    assert result.queue_id == "qid-123"
    assert result.id == "sent-123"
    assert result.status == "submitted_to_agent"
    assert result.accepted == ["alice@example.com"]
    assert result.rejected == []
    assert result.client_idempotency_key == "idem-123"
    assert result.request_id == "req-123"
    assert result.content_hash == "hash-123"


def test_send_accepts_display_name_from(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, object] = {}

    def fake_send_email_sync_detailed(*, client, body):
        del client
        captured["body"] = body.to_dict()
        return SimpleNamespace(
            status_code=HTTPStatus.OK,
            parsed=SendEmailResponse200.from_dict(
                {"success": True, "data": SEND_RESULT}
            ),
            content=b"",
        )

    monkeypatch.setattr(
        client_module, "send_email_sync_detailed", fake_send_email_sync_detailed
    )

    client = PrimitiveClient("prim_test")
    client.send(
        from_email="Support Team <support@example.com>",
        to="alice@example.com",
        subject="Hello",
        body_text="Hi there",
    )

    assert (
        cast(dict[str, Any], captured["body"])["from"]
        == "Support Team <support@example.com>"
    )


def test_send_passes_wait_options_and_idempotency_key(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, object] = {}

    def fake_send_email_sync_detailed(*, client, body, idempotency_key):
        del client
        captured["body"] = body.to_dict()
        captured["idempotency_key"] = idempotency_key
        return SimpleNamespace(
            status_code=HTTPStatus.OK,
            parsed=SendEmailResponse200.from_dict(
                {
                    "success": True,
                    "data": {
                        **SEND_RESULT,
                        "status": "delivered",
                        "delivery_status": "delivered",
                        "smtp_response_code": 250,
                        "smtp_response_text": "250 OK",
                    },
                }
            ),
            content=b"",
        )

    monkeypatch.setattr(
        client_module, "send_email_sync_detailed", fake_send_email_sync_detailed
    )

    client = PrimitiveClient("prim_test")
    result = client.send(
        from_email="support@example.com",
        to="alice@example.com",
        subject="Hello",
        body_text="Hi there",
        wait=True,
        wait_timeout_ms=5000,
        idempotency_key="customer-key",
    )

    assert captured["idempotency_key"] == "customer-key"
    assert cast(dict[str, Any], captured["body"])["wait"] is True
    assert cast(dict[str, Any], captured["body"])["wait_timeout_ms"] == 5000
    assert result.delivery_status == "delivered"
    assert result.smtp_response_code == 250
    assert result.smtp_response_text == "250 OK"


def test_reply_builds_threaded_send(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, object] = {}

    def fake_send_email_sync_detailed(*, client, body):
        del client
        captured["body"] = body.to_dict()
        return SimpleNamespace(
            status_code=HTTPStatus.OK,
            parsed=SendEmailResponse200.from_dict(
                {
                    "success": True,
                    "data": {
                        **SEND_RESULT,
                        "queue_id": "reply-1",
                    },
                }
            ),
            content=b"",
        )

    monkeypatch.setattr(
        client_module, "send_email_sync_detailed", fake_send_email_sync_detailed
    )

    client = PrimitiveClient("prim_test")
    client.reply(RECEIVED_EMAIL, "Thank you for your email.")

    assert captured["body"] == {
        "from": "support@example.com",
        "to": "alice@example.com",
        "subject": "Re: Hello",
        "body_text": "Thank you for your email.",
        "in_reply_to": "<parent@example.com>",
        "references": ["<root@example.com>", "<parent@example.com>"],
    }


def test_forward_builds_send(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, object] = {}

    def fake_send_email_sync_detailed(*, client, body):
        del client
        captured["body"] = body.to_dict()
        return SimpleNamespace(
            status_code=HTTPStatus.OK,
            parsed=SendEmailResponse200.from_dict(
                {
                    "success": True,
                    "data": {
                        **SEND_RESULT,
                        "queue_id": "forward-1",
                        "accepted": ["ops@example.com"],
                    },
                }
            ),
            content=b"",
        )

    monkeypatch.setattr(
        client_module, "send_email_sync_detailed", fake_send_email_sync_detailed
    )

    client = PrimitiveClient("prim_test")
    client.forward(
        RECEIVED_EMAIL, to="ops@example.com", body_text="Can you take this one?"
    )

    body = cast(dict[str, Any], captured["body"])
    assert body["from"] == "support@example.com"
    assert body["to"] == "ops@example.com"
    assert body["subject"] == "Fwd: Hello"
    assert "Can you take this one?" in body["body_text"]
    assert "---------- Forwarded message ----------" in body["body_text"]


def test_send_accepts_thread_metadata(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, object] = {}

    def fake_send_email_sync_detailed(*, client, body):
        del client
        captured["body"] = body.to_dict()
        return SimpleNamespace(
            status_code=HTTPStatus.OK,
            parsed=SendEmailResponse200.from_dict(
                {
                    "success": True,
                    "data": {
                        **SEND_RESULT,
                        "queue_id": "send-1",
                    },
                }
            ),
            content=b"",
        )

    monkeypatch.setattr(
        client_module, "send_email_sync_detailed", fake_send_email_sync_detailed
    )

    client = PrimitiveClient("prim_test")
    client.send(
        from_email="support@example.com",
        to="alice@example.com",
        subject="Hello",
        body_text="Hi there",
        thread=SendThread(
            in_reply_to="<parent@example.com>",
            references=["<root@example.com>", "<parent@example.com>"],
        ),
    )

    assert captured["body"] == {
        "from": "support@example.com",
        "to": "alice@example.com",
        "subject": "Hello",
        "body_text": "Hi there",
        "in_reply_to": "<parent@example.com>",
        "references": ["<root@example.com>", "<parent@example.com>"],
    }


def test_send_wraps_api_errors(monkeypatch: pytest.MonkeyPatch) -> None:
    def fake_send_email_sync_detailed(*, client, body):
        del client, body
        return SimpleNamespace(
            status_code=HTTPStatus.BAD_REQUEST,
            parsed=ErrorResponse.from_dict(
                {
                    "success": False,
                    "error": {
                        "code": "validation_error",
                        "message": "We haven't received an authenticated email from this address yet",
                    },
                }
            ),
            content=b"",
        )

    monkeypatch.setattr(
        client_module, "send_email_sync_detailed", fake_send_email_sync_detailed
    )

    client = PrimitiveClient("prim_test")

    with pytest.raises(PrimitiveAPIError) as exc_info:
        client.send(
            from_email="support@example.com",
            to="alice@example.com",
            subject="Hello",
            body_text="Hi there",
        )

    assert exc_info.value.status_code == 400
    assert exc_info.value.code == "validation_error"
    assert str(exc_info.value) == (
        "We haven't received an authenticated email from this address yet"
    )
