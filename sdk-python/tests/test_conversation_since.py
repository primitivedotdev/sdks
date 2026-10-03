from __future__ import annotations

from typing import Any
from uuid import UUID

import httpx

from primitive.api.api.emails import get_conversation
from primitive.api.client import AuthenticatedClient
from primitive.api.models.conversation import Conversation
from primitive.api.models.get_conversation_response_200 import (
    GetConversationResponse200,
)
from primitive.api.models.sent_email_status import SentEmailStatus
from primitive.api.types import UNSET

EMAIL_ID = UUID("11111111-1111-4111-8111-111111111111")
SENT_ID = "22222222-2222-4222-8222-222222222222"
FIRST_CURSOR = "2026-10-03T12:00:00.000000Z|12345"
NEXT_CURSOR = "2026-10-03T12:05:00.000000Z|12391"

INBOUND: dict[str, Any] = {
    "role": "user",
    "direction": "inbound",
    "id": str(EMAIL_ID),
    "message_id": "<in@example.test>",
    "from": "alice@example.test",
    "to": "agent@example.test",
    "subject": "Plan",
    "text": "hello",
    "timestamp": "2026-10-03T11:59:00Z",
}


def outbound(status: str) -> dict[str, Any]:
    return {
        "role": "assistant",
        "direction": "outbound",
        "id": SENT_ID,
        "message_id": "<out@example.test>",
        "from": "agent@example.test",
        "to": "alice@example.test",
        "subject": "Re: Plan",
        "text": "on it",
        "timestamp": "2026-10-03T11:59:30Z",
        "status": status,
    }


def conversation(
    messages: list[dict[str, Any]], cursor: str | None = None
) -> dict[str, Any]:
    data: dict[str, Any] = {
        "thread_id": "33333333-3333-4333-8333-333333333333",
        "subject": "Plan",
        "message_count": 2,
        "truncated": False,
        "messages": messages,
    }
    if cursor is not None:
        data["cursor"] = cursor
    return {"success": True, "data": data}


def read_data(result: object) -> Conversation:
    assert isinstance(result, GetConversationResponse200)
    assert isinstance(result.data, Conversation)
    return result.data


def test_since_reads_send_the_cursor_back_verbatim() -> None:
    requests: list[httpx.Request] = []
    bodies = [
        conversation([INBOUND, outbound("queued")], FIRST_CURSOR),
        conversation([outbound("delivered")], NEXT_CURSOR),
    ]

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(200, json=bodies[len(requests) - 1])

    with AuthenticatedClient(
        base_url="https://example.test",
        token="test",
        httpx_args={"transport": httpx.MockTransport(handler)},
    ) as client:
        first = read_data(get_conversation.sync(EMAIL_ID, client=client, since="start"))
        assert requests[0].url.path == f"/emails/{EMAIL_ID}/conversation"
        assert requests[0].url.params["since"] == "start"
        cursor = first.cursor
        assert cursor == FIRST_CURSOR
        assert [m.status for m in first.messages] == [
            UNSET,
            SentEmailStatus.QUEUED,
        ]

        assert isinstance(cursor, str)
        nxt = read_data(get_conversation.sync(EMAIL_ID, client=client, since=cursor))

    assert len(requests) == 2
    assert requests[1].url.params["since"] == FIRST_CURSOR
    assert nxt.cursor == NEXT_CURSOR
    # Thread fields describe the whole conversation, not the delta.
    assert nxt.message_count == 2
    assert len(nxt.messages) == 1
    message = nxt.messages[0]
    assert str(message.id) == SENT_ID
    assert message.direction.value == "outbound"
    assert message.status == SentEmailStatus.DELIVERED


def test_read_without_since_sends_no_parameter() -> None:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(200, json=conversation([INBOUND]))

    with AuthenticatedClient(
        base_url="https://example.test",
        token="test",
        httpx_args={"transport": httpx.MockTransport(handler)},
    ) as client:
        result = read_data(get_conversation.sync(EMAIL_ID, client=client))

    assert "since" not in requests[0].url.params
    assert result.cursor is UNSET
