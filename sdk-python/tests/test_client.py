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
    normalize_received_email,
)

client_module = importlib.import_module("primitive.client")


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


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


def test_normalize_received_email_rejects_empty_smtp_recipients() -> None:
    event = cast(
        Any,
        SimpleNamespace(
            id="evt-1",
            email=SimpleNamespace(
                id="email-1",
                received_at="2026-01-01T00:00:00.000Z",
                smtp=SimpleNamespace(mail_from="bounce@example.com", rcpt_to=[]),
                headers=SimpleNamespace(
                    from_="Alice <alice@example.com>",
                    subject="Hello",
                    message_id="<parent@example.com>",
                ),
                parsed=SimpleNamespace(
                    reply_to=[],
                    references=[],
                    body_text="Hi there",
                    in_reply_to=[],
                    attachments=[],
                ),
                auth=cast(Any, SimpleNamespace()),
                analysis=cast(Any, SimpleNamespace()),
            ),
        ),
    )

    with pytest.raises(
        ValueError, match="email.smtp.rcpt_to must contain at least one recipient"
    ):
        normalize_received_email(event)


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

    with pytest.raises(ValueError, match="to must be a valid email address"):
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


@pytest.mark.anyio
async def test_asend_posts_payload_and_returns_send_result(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, object] = {}

    async def fake_send_email_async_detailed(*, client, body):
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
        client_module, "send_email_async_detailed", fake_send_email_async_detailed
    )

    client = PrimitiveClient("prim_test", base_url="https://example.test/api/v1")
    result = await client.asend(
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
    assert result.id == "sent-123"
    assert result.queue_id == "qid-123"
    assert result.status == "submitted_to_agent"


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


def test_reply_requires_text_for_dict_input() -> None:
    client = PrimitiveClient("prim_test")

    with pytest.raises(ValueError, match="reply text must be a non-empty string"):
        client.reply(RECEIVED_EMAIL, {"subject": "Custom subject"})


@pytest.mark.anyio
async def test_areply_builds_threaded_send(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, object] = {}

    async def fake_send_email_async_detailed(*, client, body):
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
        client_module, "send_email_async_detailed", fake_send_email_async_detailed
    )

    client = PrimitiveClient("prim_test")
    await client.areply(RECEIVED_EMAIL, {"text": "Thank you.", "subject": "Custom"})

    assert captured["body"] == {
        "from": "support@example.com",
        "to": "alice@example.com",
        "subject": "Custom",
        "body_text": "Thank you.",
        "in_reply_to": "<parent@example.com>",
        "references": ["<root@example.com>", "<parent@example.com>"],
    }


@pytest.mark.anyio
async def test_areply_requires_text_for_dict_input() -> None:
    client = PrimitiveClient("prim_test")

    with pytest.raises(ValueError, match="reply text must be a non-empty string"):
        await client.areply(RECEIVED_EMAIL, {"subject": "Custom subject"})


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


def test_send_surfaces_gates_request_id_and_details(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    error_body = {
        "success": False,
        "error": {
            "code": "recipient_not_allowed",
            "message": "cannot send to alice@example.com",
            "request_id": "req_test_123",
            "details": {
                "sent_email_id": "se_abc",
                "required_entitlements": ["send_to_confirmed_domains"],
            },
            "gates": [
                {
                    "name": "send_to_known_addresses",
                    "reason": "recipient_not_known",
                    "subject": "alice@example.com",
                    "message": "alice@example.com has not previously sent mail",
                    "fix": {
                        "action": "wait_for_inbound",
                        "subject": "alice@example.com",
                    },
                }
            ],
        },
    }

    def fake_send_email_sync_detailed(*, client, body):
        del client, body
        return SimpleNamespace(
            status_code=HTTPStatus.FORBIDDEN,
            parsed=ErrorResponse.from_dict(error_body),
            content=b"",
            headers={},
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
            body_text="Hi",
        )

    err = exc_info.value
    assert err.status_code == 403
    assert err.code == "recipient_not_allowed"
    assert err.request_id == "req_test_123"
    assert err.gates is not None and len(err.gates) == 1
    assert err.gates[0]["reason"] == "recipient_not_known"
    assert err.details is not None
    assert err.details.get("sent_email_id") == "se_abc"


def test_send_surfaces_retry_after(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fake_send_email_sync_detailed(*, client, body):
        del client, body
        return SimpleNamespace(
            status_code=HTTPStatus.TOO_MANY_REQUESTS,
            parsed=ErrorResponse.from_dict(
                {
                    "success": False,
                    "error": {
                        "code": "rate_limit_exceeded",
                        "message": "Rate limit exceeded",
                    },
                }
            ),
            content=b"",
            headers={"Retry-After": "12"},
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
            body_text="Hi",
        )

    assert exc_info.value.status_code == 429
    assert exc_info.value.code == "rate_limit_exceeded"
    assert exc_info.value.retry_after == 12


def test_reply_honors_from_override(monkeypatch: pytest.MonkeyPatch) -> None:
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
    client.reply(
        RECEIVED_EMAIL,
        "Thanks!",
        from_email="notifications@example.com",
    )

    assert (
        cast(dict[str, Any], captured["body"])["from"]
        == "notifications@example.com"
    )


def test_reply_dict_from_overrides_default(monkeypatch: pytest.MonkeyPatch) -> None:
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
    client.reply(RECEIVED_EMAIL, {"text": "Thanks!", "from": "ops@example.com"})

    assert cast(dict[str, Any], captured["body"])["from"] == "ops@example.com"
