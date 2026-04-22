from __future__ import annotations

from http import HTTPStatus
from types import SimpleNamespace

import pytest

from primitive.api.models.error_response import ErrorResponse
from primitive.api.models.send_email_response_200 import SendEmailResponse200
from primitive.client import PrimitiveAPIError, PrimitiveClient


def test_send_validates_recipient_before_request(monkeypatch: pytest.MonkeyPatch) -> None:
    called = False

    def fake_send_email_sync_detailed(*, client, body):
        del client, body
        nonlocal called
        called = True
        raise AssertionError("send_email_sync_detailed should not be called")

    monkeypatch.setattr(
        "primitive.client.send_email_sync_detailed",
        fake_send_email_sync_detailed,
    )

    client = PrimitiveClient("prim_test")

    with pytest.raises(TypeError, match="to must be a valid email address"):
        client.send(
            from_email="support@example.com",
            to="not-an-email",
            subject="Hello",
            body="Hi",
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
                    "data": {
                        "id": "00000000-0000-0000-0000-000000000001",
                        "status": "accepted",
                        "smtp_code": 250,
                        "smtp_message": "queued",
                        "remote_host": "mx.example.net",
                        "service_message_id": "svc-123",
                    },
                }
            ),
            content=b"",
        )

    monkeypatch.setattr(
        "primitive.client.send_email_sync_detailed",
        fake_send_email_sync_detailed,
    )

    client = PrimitiveClient("prim_test", base_url="https://example.test/api/v1")
    result = client.send(
        from_email="support@example.com",
        to="alice@example.com",
        subject="Hello",
        body="Hi there",
    )

    assert captured == {
        "token": "prim_test",
        "body": {
            "from": "support@example.com",
            "to": "alice@example.com",
            "subject": "Hello",
            "body": "Hi there",
        },
    }
    assert str(result.id) == "00000000-0000-0000-0000-000000000001"
    assert result.status.value == "accepted"
    assert result.smtp_code == 250
    assert result.smtp_message == "queued"


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
        "primitive.client.send_email_sync_detailed",
        fake_send_email_sync_detailed,
    )

    client = PrimitiveClient("prim_test")

    with pytest.raises(PrimitiveAPIError) as exc_info:
        client.send(
            from_email="support@example.com",
            to="alice@example.com",
            subject="Hello",
            body="Hi there",
        )

    assert exc_info.value.status_code == 400
    assert exc_info.value.code == "validation_error"
    assert str(exc_info.value) == (
        "We haven't received an authenticated email from this address yet"
    )
