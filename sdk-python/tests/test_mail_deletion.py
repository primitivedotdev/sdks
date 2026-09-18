from __future__ import annotations

from uuid import UUID

import httpx
import pytest
from test_client import RECEIVED_EMAIL

from primitive.api.api.agent_connections import remove_agent_connection
from primitive.api.api.sending import delete_sent_email
from primitive.api.client import Client
from primitive.api.models.delete_sent_email_response_200 import (
    DeleteSentEmailResponse200,
)
from primitive.api.models.error_response import ErrorResponse
from primitive.api.models.remove_agent_connection_response_200 import (
    RemoveAgentConnectionResponse200,
)
from primitive.client import PrimitiveAPIError, PrimitiveClient

MAIL_ID = UUID("11111111-1111-4111-8111-111111111111")


@pytest.mark.parametrize("kind", ["sent", "connection"])
def test_delete_routes(kind: str) -> None:
    calls = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        assert request.method == ("DELETE" if kind == "sent" else "POST")
        assert request.url.path == (
            f"/sent-emails/{MAIL_ID}"
            if kind == "sent"
            else "/agent-connections/agent+demo@example.com/remove"
        )
        assert request.content == b""
        return httpx.Response(200, json={"success": True, "data": {"deleted": True}})

    with Client(
        base_url="https://example.test",
        httpx_args={"transport": httpx.MockTransport(handler)},
    ) as client:
        result = (
            delete_sent_email.sync(MAIL_ID, client=client)
            if kind == "sent"
            else remove_agent_connection.sync("agent+demo@example.com", client=client)
        )
    assert isinstance(
        result, (DeleteSentEmailResponse200, RemoveAgentConnectionResponse200)
    )
    assert result.data.deleted is True
    assert calls == 1


@pytest.mark.parametrize(
    "status,code", [(409, "sent_email_not_settled"), (503, "sent_email_cleanup_failed")]
)
def test_delete_preserves_errors(status: int, code: str) -> None:
    calls = 0

    def handler(_request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return httpx.Response(
            status,
            json={
                "success": False,
                "error": {"code": code, "message": "Cannot delete"},
            },
        )

    with Client(
        base_url="https://example.test",
        httpx_args={"transport": httpx.MockTransport(handler)},
    ) as client:
        result = delete_sent_email.sync_detailed(MAIL_ID, client=client)
    assert result.status_code == status
    assert isinstance(result.parsed, ErrorResponse)
    assert result.parsed.error.code == code
    assert calls == 1


@pytest.mark.parametrize("kind", ["send", "reply"])
def test_deleted_send_is_not_retried(kind: str) -> None:
    calls = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        assert request.headers["Idempotency-Key"] == "existing-key"
        return httpx.Response(
            410,
            json={
                "success": False,
                "error": {
                    "code": "sent_email_deleted",
                    "message": "Prior send deleted",
                    "details": {"idempotent_replay": True},
                },
            },
        )

    client = PrimitiveClient(
        "fixture" + "-credential",
        httpx_args={"transport": httpx.MockTransport(handler)},
    )
    with pytest.raises(PrimitiveAPIError) as caught:
        if kind == "send":
            client.send(
                from_email="sender@example.com",
                to="receiver@example.com",
                subject="Example",
                body_text="Hello",
                idempotency_key="existing-key",
            )
        else:
            client.reply(RECEIVED_EMAIL, "Hello", idempotency_key="existing-key")
    assert caught.value.status_code == 410
    assert caught.value.code == "sent_email_deleted"
    assert caught.value.details == {"idempotent_replay": True}
    assert calls == 1
