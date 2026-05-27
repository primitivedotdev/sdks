from __future__ import annotations

import importlib
import json
from http import HTTPStatus
from types import SimpleNamespace
from typing import Any, cast

import httpx
import pytest

from primitive.api.models.error_response import ErrorResponse
from primitive.api.models.reply_to_email_response_200 import ReplyToEmailResponse200
from primitive.api.models.send_email_response_200 import SendEmailResponse200
from primitive.client import (
    PrimitiveAPIError,
    PrimitiveClient,
    SendThread,
)
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
    id="00000000-0000-0000-0000-000000000001",
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
    "from": "sender@example.com",
    "queue_id": "qid-123",
    "accepted": ["alice@example.com"],
    "rejected": [],
    "client_idempotency_key": "idem-123",
    "request_id": "req-123",
    "content_hash": "hash-123",
    "idempotent_replay": False,
}

BASE_URL = "https://example.test/api/v1"


def _send_response_body(extra: dict[str, Any] | None = None) -> bytes:
    """Return the canonical send-success JSON body for a MockTransport handler."""
    data: dict[str, Any] = dict(SEND_RESULT)
    if extra:
        data.update(extra)
    return json.dumps({"success": True, "data": data}).encode("utf-8")


def _install_capturing_transport(
    client: PrimitiveClient,
    captured: list[httpx.Request],
    *,
    body: bytes | None = None,
    is_reply: bool = False,
) -> None:
    """Install a MockTransport that records the request and returns a 200 response.

    Used in lieu of monkeypatching generated client functions so tests can
    assert on the actual httpx.Request (post-hook), where per-call options
    now live.
    """
    response_body = body if body is not None else _send_response_body()

    def handler(request: httpx.Request) -> httpx.Response:
        captured.append(request)
        return httpx.Response(
            HTTPStatus.OK,
            content=response_body,
            headers={"content-type": "application/json"},
        )

    transport = httpx.MockTransport(handler)
    # Install the mock transport on BOTH underlying clients so /send-mail
    # (which PrimitiveClient routes to api_send_client / host 2) and
    # every other endpoint (api_client / host 1) both hit the mock.
    client.api_client.set_httpx_client(
        httpx.Client(base_url=BASE_URL, transport=transport)
    )
    client.api_send_client.set_httpx_client(
        httpx.Client(base_url=BASE_URL, transport=transport)
    )
    del is_reply  # signature symmetry; both endpoints use the same envelope


async def _install_async_capturing_transport(
    client: PrimitiveClient,
    captured: list[httpx.Request],
    *,
    body: bytes | None = None,
) -> None:
    response_body = body if body is not None else _send_response_body()

    def handler(request: httpx.Request) -> httpx.Response:
        captured.append(request)
        return httpx.Response(
            HTTPStatus.OK,
            content=response_body,
            headers={"content-type": "application/json"},
        )

    transport = httpx.MockTransport(handler)
    client.api_client.set_async_httpx_client(
        httpx.AsyncClient(base_url=BASE_URL, transport=transport)
    )
    client.api_send_client.set_async_httpx_client(
        httpx.AsyncClient(base_url=BASE_URL, transport=transport)
    )


def test_normalize_received_email_rejects_empty_smtp_recipients() -> None:
    event = cast(
        Any,
        SimpleNamespace(
            id="evt-1",
            email=SimpleNamespace(
                id="00000000-0000-0000-0000-000000000001",
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

    client = PrimitiveClient("prim_test", api_base_url_1="https://example.test/api/v1", api_base_url_2="https://example.test/api/v1")
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

    client = PrimitiveClient("prim_test", api_base_url_1="https://example.test/api/v1", api_base_url_2="https://example.test/api/v1")
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


def test_send_passes_wait_options_and_idempotency_key() -> None:
    """Per-call options now ride on the httpx.Request headers, set by hook.

    The wait/wait_timeout_ms travel in the body; the idempotency key
    travels in the request headers.
    """
    captured: list[httpx.Request] = []
    client = PrimitiveClient("prim_test", api_base_url_1=BASE_URL, api_base_url_2=BASE_URL)
    _install_capturing_transport(
        client,
        captured,
        body=_send_response_body(
            {
                "status": "delivered",
                "delivery_status": "delivered",
                "smtp_response_code": 250,
                "smtp_response_text": "250 OK",
            }
        ),
    )

    result = client.send(
        from_email="support@example.com",
        to="alice@example.com",
        subject="Hello",
        body_text="Hi there",
        wait=True,
        wait_timeout_ms=5000,
        idempotency_key="customer-key",
    )

    assert len(captured) == 1
    request = captured[0]
    assert request.headers.get("Idempotency-Key") == "customer-key"
    body = json.loads(request.content)
    assert body["wait"] is True
    assert body["wait_timeout_ms"] == 5000
    assert result.delivery_status == "delivered"
    assert result.smtp_response_code == 250
    assert result.smtp_response_text == "250 OK"


def test_reply_posts_to_reply_endpoint_with_minimal_body(monkeypatch: pytest.MonkeyPatch) -> None:
    """The high-level reply() forwards to /emails/{id}/reply with the
    small ReplyInput shape; threading and recipients are server-derived."""
    captured: dict[str, object] = {}

    def fake_reply_to_email_sync_detailed(*, id, client, body):
        del client
        captured["id"] = str(id)
        captured["body"] = body.to_dict()
        return SimpleNamespace(
            status_code=HTTPStatus.OK,
            parsed=ReplyToEmailResponse200.from_dict(
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
        client_module,
        "reply_to_email_sync_detailed",
        fake_reply_to_email_sync_detailed,
    )

    client = PrimitiveClient("prim_test")
    client.reply(RECEIVED_EMAIL, "Thank you for your email.")

    assert captured["id"] == RECEIVED_EMAIL.id
    assert captured["body"] == {"body_text": "Thank you for your email."}


def test_reply_posts_attachments_to_send_host(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, object] = {}

    def fake_reply_to_email_sync_detailed(*, id, client, body):
        captured["id"] = str(id)
        captured["base_url"] = cast(Any, client)._base_url
        captured["body"] = body.to_dict()
        return SimpleNamespace(
            status_code=HTTPStatus.OK,
            parsed=ReplyToEmailResponse200.from_dict(
                {
                    "success": True,
                    "data": {
                        **SEND_RESULT,
                        "queue_id": "reply-attachment-1",
                    },
                }
            ),
            content=b"",
        )

    monkeypatch.setattr(
        client_module,
        "reply_to_email_sync_detailed",
        fake_reply_to_email_sync_detailed,
    )

    client = PrimitiveClient(
        "prim_test",
        api_base_url_1="https://primary.example.test/api/v1",
        api_base_url_2="https://send.example.test/api/v1",
    )
    client.reply(
        RECEIVED_EMAIL,
        "See attached.",
        attachments=[
            {
                "content_base64": "aGVsbG8=",
                "filename": "report.txt",
            },
        ],
    )

    assert captured["id"] == RECEIVED_EMAIL.id
    assert captured["base_url"] == "https://send.example.test/api/v1"
    assert captured["body"] == {
        "attachments": [
            {
                "content_base64": "aGVsbG8=",
                "filename": "report.txt",
            },
        ],
        "body_text": "See attached.",
    }


def test_reply_rejects_subject_override() -> None:
    """Custom subject would silently break Gmail threading; rejected
    at the SDK layer rather than letting the request hit the server."""
    client = PrimitiveClient("prim_test")

    with pytest.raises(ValueError, match="subject overrides are not supported"):
        client.reply(RECEIVED_EMAIL, {"text": "Thanks", "subject": "Custom subject"})


def test_reply_requires_text_or_html() -> None:
    client = PrimitiveClient("prim_test")

    with pytest.raises(ValueError, match="reply requires text or html"):
        client.reply(RECEIVED_EMAIL, {})


@pytest.mark.anyio
async def test_areply_posts_to_reply_endpoint_with_minimal_body(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, object] = {}

    async def fake_reply_to_email_async_detailed(*, id, client, body):
        del client
        captured["id"] = str(id)
        captured["body"] = body.to_dict()
        return SimpleNamespace(
            status_code=HTTPStatus.OK,
            parsed=ReplyToEmailResponse200.from_dict(
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
        client_module,
        "reply_to_email_async_detailed",
        fake_reply_to_email_async_detailed,
    )

    client = PrimitiveClient("prim_test")
    await client.areply(RECEIVED_EMAIL, {"text": "Thank you.", "wait": True})

    assert captured["id"] == RECEIVED_EMAIL.id
    assert captured["body"] == {"body_text": "Thank you.", "wait": True}


@pytest.mark.anyio
async def test_areply_requires_text_or_html() -> None:
    client = PrimitiveClient("prim_test")

    with pytest.raises(ValueError, match="reply requires text or html"):
        await client.areply(RECEIVED_EMAIL, {})


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
    """Customer-supplied from is forwarded to the server. Server-side
    canSendFrom validates the domain regardless, so the override
    carries no extra privilege."""
    captured: dict[str, object] = {}

    def fake_reply_to_email_sync_detailed(*, id, client, body):
        del id, client
        captured["body"] = body.to_dict()
        return SimpleNamespace(
            status_code=HTTPStatus.OK,
            parsed=ReplyToEmailResponse200.from_dict(
                {"success": True, "data": SEND_RESULT}
            ),
            content=b"",
        )

    monkeypatch.setattr(
        client_module,
        "reply_to_email_sync_detailed",
        fake_reply_to_email_sync_detailed,
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

    def fake_reply_to_email_sync_detailed(*, id, client, body):
        del id, client
        captured["body"] = body.to_dict()
        return SimpleNamespace(
            status_code=HTTPStatus.OK,
            parsed=ReplyToEmailResponse200.from_dict(
                {"success": True, "data": SEND_RESULT}
            ),
            content=b"",
        )

    monkeypatch.setattr(
        client_module,
        "reply_to_email_sync_detailed",
        fake_reply_to_email_sync_detailed,
    )

    client = PrimitiveClient("prim_test")
    client.reply(RECEIVED_EMAIL, {"text": "Thanks!", "from": "ops@example.com"})

    assert cast(dict[str, Any], captured["body"])["from"] == "ops@example.com"


def test_send_extra_headers_appear_on_request() -> None:
    captured: list[httpx.Request] = []
    client = PrimitiveClient("prim_test", api_base_url_1=BASE_URL, api_base_url_2=BASE_URL)
    _install_capturing_transport(client, captured)

    client.send(
        from_email="support@example.com",
        to="alice@example.com",
        subject="Hello",
        body_text="Hi",
        extra_headers={"X-Custom": "v1"},
    )

    assert len(captured) == 1
    assert captured[0].headers.get("X-Custom") == "v1"


def test_send_per_call_timeout_appears_on_request_extension() -> None:
    captured: list[httpx.Request] = []
    client = PrimitiveClient("prim_test", api_base_url_1=BASE_URL, api_base_url_2=BASE_URL)
    _install_capturing_transport(client, captured)

    client.send(
        from_email="support@example.com",
        to="alice@example.com",
        subject="Hello",
        body_text="Hi",
        timeout=0.5,
    )

    assert len(captured) == 1
    timeout_ext = captured[0].extensions.get("timeout")
    assert isinstance(timeout_ext, dict)
    assert timeout_ext.get("read") == 0.5


def test_send_per_call_options_do_not_leak_into_next_call() -> None:
    """Per-call kwargs must not leak into the next call on the same client."""
    captured: list[httpx.Request] = []
    client = PrimitiveClient("prim_test", api_base_url_1=BASE_URL, api_base_url_2=BASE_URL)
    _install_capturing_transport(client, captured)

    client.send(
        from_email="support@example.com",
        to="alice@example.com",
        subject="Hello",
        body_text="Hi",
        idempotency_key="first",
        extra_headers={"X-First": "1"},
    )
    client.send(
        from_email="support@example.com",
        to="alice@example.com",
        subject="Hello",
        body_text="Hi",
    )

    assert len(captured) == 2
    assert captured[0].headers.get("Idempotency-Key") == "first"
    assert captured[0].headers.get("X-First") == "1"
    assert "Idempotency-Key" not in captured[1].headers
    assert "X-First" not in captured[1].headers


def test_send_propagates_httpx_timeout_exception() -> None:
    """End-to-end: a transport that raises ReadTimeout surfaces unchanged."""

    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("simulated", request=request)

    transport = httpx.MockTransport(handler)
    client = PrimitiveClient("prim_test", api_base_url_1="https://example.test/api/v1", api_base_url_2="https://example.test/api/v1")
    # send() routes to api_send_client (host 2), so the transport has to
    # live on that client for the timeout to bubble back to the caller.
    client.api_send_client.set_httpx_client(
        httpx.Client(base_url="https://example.test/api/v1", transport=transport)
    )

    with pytest.raises(httpx.ReadTimeout):
        client.send(
            from_email="support@example.com",
            to="alice@example.com",
            subject="Hello",
            body_text="Hi",
        )


def test_custom_httpx_client_is_not_replaced_by_per_call_options() -> None:
    """Setting a custom httpx client and then passing per-call options must
    not drop the user's client. Counter the previously-broken behavior where
    attrs.evolve() reset _client / _async_client to None."""

    request_count = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal request_count
        request_count += 1
        return httpx.Response(
            HTTPStatus.OK,
            content=_send_response_body(),
            headers={"content-type": "application/json"},
        )

    transport = httpx.MockTransport(handler)
    custom_client = httpx.Client(base_url=BASE_URL, transport=transport)
    # Mark the client so we can detect identity preservation.
    cast(Any, custom_client)._primitive_marker = "this-one"

    client = PrimitiveClient("prim_test", api_base_url_1=BASE_URL, api_base_url_2=BASE_URL)
    # send() routes to api_send_client; install the custom client there.
    client.api_send_client.set_httpx_client(custom_client)

    client.send(
        from_email="support@example.com",
        to="alice@example.com",
        subject="Hello",
        body_text="Hi",
        timeout=5.0,
        idempotency_key="key-1",
        extra_headers={"X-Tenant": "acme"},
    )

    assert request_count == 1
    # The same custom client must still be installed after the per-call
    # call (on api_send_client, since send() routes there).
    assert client.api_send_client.get_httpx_client() is custom_client
    assert (
        cast(Any, client.api_send_client.get_httpx_client())._primitive_marker
        == "this-one"
    )


def test_reply_threads_idempotency_key_through_to_request() -> None:
    captured: list[httpx.Request] = []
    client = PrimitiveClient("prim_test", api_base_url_1=BASE_URL, api_base_url_2=BASE_URL)
    _install_capturing_transport(client, captured)

    client.reply(RECEIVED_EMAIL, "Thanks!", idempotency_key="reply-key")

    assert len(captured) == 1
    assert captured[0].headers.get("Idempotency-Key") == "reply-key"


def test_forward_threads_idempotency_key_through_to_request() -> None:
    captured: list[httpx.Request] = []
    client = PrimitiveClient("prim_test", api_base_url_1=BASE_URL, api_base_url_2=BASE_URL)
    _install_capturing_transport(client, captured)

    client.forward(
        RECEIVED_EMAIL,
        to="ops@example.com",
        body_text="FYI",
        idempotency_key="fwd-key",
    )

    assert len(captured) == 1
    assert captured[0].headers.get("Idempotency-Key") == "fwd-key"


def test_reply_per_call_extra_headers_and_timeout() -> None:
    captured: list[httpx.Request] = []
    client = PrimitiveClient("prim_test", api_base_url_1=BASE_URL, api_base_url_2=BASE_URL)
    _install_capturing_transport(client, captured)

    client.reply(
        RECEIVED_EMAIL,
        "Thanks!",
        extra_headers={"X-Reply": "yes"},
        timeout=2.5,
    )

    assert len(captured) == 1
    assert captured[0].headers.get("X-Reply") == "yes"
    timeout_ext = captured[0].extensions.get("timeout")
    assert isinstance(timeout_ext, dict)
    assert timeout_ext.get("read") == 2.5


def test_with_options_sets_default_timeout_for_subsequent_calls() -> None:
    captured: list[httpx.Request] = []
    base = PrimitiveClient("prim_test", api_base_url_1=BASE_URL, api_base_url_2=BASE_URL)
    _install_capturing_transport(base, captured)

    fast = base.with_options(timeout=10.0, extra_headers={"X-Tenant": "acme"})
    fast.send(
        from_email="support@example.com",
        to="alice@example.com",
        subject="Hello",
        body_text="Hi",
    )

    assert len(captured) == 1
    assert captured[0].headers.get("X-Tenant") == "acme"
    timeout_ext = captured[0].extensions.get("timeout")
    assert isinstance(timeout_ext, dict)
    assert timeout_ext.get("read") == 10.0


def test_with_options_per_call_timeout_overrides_default() -> None:
    captured: list[httpx.Request] = []
    base = PrimitiveClient("prim_test", api_base_url_1=BASE_URL, api_base_url_2=BASE_URL)
    _install_capturing_transport(base, captured)

    fast = base.with_options(timeout=10.0)
    fast.send(
        from_email="support@example.com",
        to="alice@example.com",
        subject="Hello",
        body_text="Hi",
        timeout=2.0,
    )

    assert len(captured) == 1
    timeout_ext = captured[0].extensions.get("timeout")
    assert isinstance(timeout_ext, dict)
    assert timeout_ext.get("read") == 2.0


def test_with_options_does_not_mutate_base_client() -> None:
    captured: list[httpx.Request] = []
    base = PrimitiveClient("prim_test", api_base_url_1=BASE_URL, api_base_url_2=BASE_URL)
    _install_capturing_transport(base, captured)

    base.with_options(timeout=10.0, extra_headers={"X-Tenant": "acme"})
    base.send(
        from_email="support@example.com",
        to="alice@example.com",
        subject="Hello",
        body_text="Hi",
    )

    assert len(captured) == 1
    assert "X-Tenant" not in captured[0].headers
    # The base client never set its own timeout, so the request should not
    # carry the with_options(timeout=10.0) override.
    timeout_ext = captured[0].extensions.get("timeout")
    if isinstance(timeout_ext, dict):
        assert timeout_ext.get("read") != 10.0


def test_with_options_no_args_returns_a_clone() -> None:
    captured: list[httpx.Request] = []
    base = PrimitiveClient("prim_test", api_base_url_1=BASE_URL, api_base_url_2=BASE_URL)
    _install_capturing_transport(base, captured)

    cloned = base.with_options()
    assert cloned is not base
    cloned.send(
        from_email="support@example.com",
        to="alice@example.com",
        subject="Hello",
        body_text="Hi",
    )

    # The clone has no defaults of its own; the request must look the same as
    # one issued through the base client (no per-call hook mutation).
    assert len(captured) == 1
    assert "Idempotency-Key" not in captured[0].headers


def test_with_options_timeout_none_clears_previously_set_timeout() -> None:
    captured: list[httpx.Request] = []
    base = PrimitiveClient("prim_test", api_base_url_1=BASE_URL, api_base_url_2=BASE_URL)
    _install_capturing_transport(base, captured)

    fast = base.with_options(timeout=10.0)
    cleared = fast.with_options(timeout=None)
    cleared.send(
        from_email="support@example.com",
        to="alice@example.com",
        subject="Hello",
        body_text="Hi",
    )

    assert len(captured) == 1
    # The cleared client must NOT carry the previously-set 10s read timeout.
    timeout_ext = captured[0].extensions.get("timeout")
    if isinstance(timeout_ext, dict):
        assert timeout_ext.get("read") != 10.0


@pytest.mark.anyio
async def test_asend_per_call_timeout_and_extra_headers() -> None:
    captured: list[httpx.Request] = []
    client = PrimitiveClient("prim_test", api_base_url_1=BASE_URL, api_base_url_2=BASE_URL)
    await _install_async_capturing_transport(client, captured)

    await client.asend(
        from_email="support@example.com",
        to="alice@example.com",
        subject="Hello",
        body_text="Hi",
        idempotency_key="async-key",
        extra_headers={"X-Async": "1"},
        timeout=3.0,
    )

    assert len(captured) == 1
    assert captured[0].headers.get("Idempotency-Key") == "async-key"
    assert captured[0].headers.get("X-Async") == "1"
    timeout_ext = captured[0].extensions.get("timeout")
    assert isinstance(timeout_ext, dict)
    assert timeout_ext.get("read") == 3.0


@pytest.mark.anyio
async def test_areply_threads_idempotency_key_through_to_request() -> None:
    captured: list[httpx.Request] = []
    client = PrimitiveClient("prim_test", api_base_url_1=BASE_URL, api_base_url_2=BASE_URL)
    await _install_async_capturing_transport(client, captured)

    await client.areply(RECEIVED_EMAIL, "Thanks!", idempotency_key="areply-key")

    assert len(captured) == 1
    assert captured[0].headers.get("Idempotency-Key") == "areply-key"


@pytest.mark.anyio
async def test_aforward_threads_idempotency_key_through_to_request() -> None:
    captured: list[httpx.Request] = []
    client = PrimitiveClient("prim_test", api_base_url_1=BASE_URL, api_base_url_2=BASE_URL)
    await _install_async_capturing_transport(client, captured)

    await client.aforward(
        RECEIVED_EMAIL,
        to="ops@example.com",
        body_text="FYI",
        idempotency_key="afwd-key",
    )

    assert len(captured) == 1
    assert captured[0].headers.get("Idempotency-Key") == "afwd-key"


def test_primitive_client_rejects_legacy_base_url_kwarg() -> None:
    """Pre-dual-host callers passing `base_url=...` should hit a clear
    TypeError naming the rename, not the confusing 'multiple values for
    keyword argument' traceback through internal SDK code that would
    happen if **client_kwargs swallowed the value."""
    with pytest.raises(TypeError, match=r"api_base_url_1"):
        PrimitiveClient("prim_test", base_url="https://example.test/api/v1")  # pyright: ignore[reportCallIssue]


def test_create_client_rejects_legacy_base_url_kwarg() -> None:
    """The module-level factory inherits the guard via PrimitiveClient."""
    from primitive.client import create_client

    with pytest.raises(TypeError, match=r"api_base_url_1"):
        create_client("prim_test", base_url="https://example.test/api/v1")  # pyright: ignore[reportCallIssue]
