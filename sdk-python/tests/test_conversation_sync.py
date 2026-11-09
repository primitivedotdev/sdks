from __future__ import annotations

import copy
import json
from pathlib import Path
from typing import Any
from uuid import UUID

import httpx
import pytest

from primitive import (
    ConversationSync,
    PrimitiveAPIError,
    PrimitiveClient,
    merge_conversation_messages,
    sync_conversation,
)
from primitive.api.models.conversation import Conversation
from primitive.api.models.conversation_message import ConversationMessage
from primitive.api.types import Unset
from primitive.conversation_sync import (
    MAX_CONVERSATION_SYNC_PAGES,
    _normalize_timestamp,
    run_conversation_sync,
)

FIXTURES = Path(__file__).parents[2] / "test-fixtures"
FIXTURE: dict[str, Any] = json.loads((FIXTURES / "conversation-sync.json").read_text())
CASES: list[dict[str, Any]] = FIXTURE["cases"]
TIMESTAMPS: list[dict[str, Any]] = FIXTURE["timestamps"]
EMAIL_ID = "a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1"


def summarize(
    messages: list[ConversationMessage], expected: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for index, message in enumerate(messages):
        copies = [] if isinstance(message.copies, Unset) else message.copies
        item: dict[str, Any] = {
            "id": str(message.id),
            "copy_ids": [str(c.id) for c in copies],
        }
        # A fixture names a status only where it pins one.
        if index < len(expected) and "status" in expected[index]:
            item["status"] = (
                None if isinstance(message.status, Unset) else message.status.value
            )
        out.append(item)
    return out


def state_from(case: dict[str, Any]) -> ConversationSync | None:
    state = case["state"]
    if state is None:
        return None
    return ConversationSync(
        cursor=state["cursor"],
        messages=[ConversationMessage.from_dict(m) for m in state["messages"]],
    )


def client_for(case: dict[str, Any], requests: list[httpx.Request]) -> PrimitiveClient:
    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        if len(requests) > len(case["pages"]):
            raise AssertionError("read past the last fixture page")
        return httpx.Response(200, json=case["pages"][len(requests) - 1]["response"])

    return PrimitiveClient(
        "fixture-credential",
        httpx_args={"transport": httpx.MockTransport(handler)},
    )


@pytest.mark.parametrize("case", CASES, ids=[c["name"] for c in CASES])
def test_shared_conversation_sync_fixture(case: dict[str, Any]) -> None:
    requests: list[httpx.Request] = []
    client = client_for(case, requests)
    expected = case["expected"]

    if expected.get("error"):
        with pytest.raises(PrimitiveAPIError):
            sync_conversation(client, EMAIL_ID, state_from(case))
    else:
        result = sync_conversation(client, EMAIL_ID, state_from(case))
        assert result.cursor == expected["cursor"]
        assert summarize(result.messages, expected["messages"]) == expected["messages"]

    assert [r.url.params.get("since") for r in requests] == [
        p["since"] for p in case["pages"]
    ]
    for request in requests:
        assert request.url.path.endswith(f"/emails/{EMAIL_ID}/conversation")
        assert "limit" not in request.url.params


def test_merge_does_not_modify_its_inputs() -> None:
    case = CASES[1]
    held = [ConversationMessage.from_dict(m) for m in case["state"]["messages"]]
    delta = [
        ConversationMessage.from_dict(m)
        for m in case["pages"][0]["response"]["data"]["messages"]
    ]
    held_before = copy.deepcopy([m.to_dict() for m in held])
    delta_before = copy.deepcopy([m.to_dict() for m in delta])
    merged = merge_conversation_messages(held, delta)
    assert [m.id for m in merged] != [m.id for m in held]
    assert [m.to_dict() for m in held] == held_before
    assert [m.to_dict() for m in delta] == delta_before


def test_result_carries_conversation_fields_and_is_the_next_state() -> None:
    case = CASES[3]
    requests: list[httpx.Request] = []
    result = sync_conversation(client_for(case, requests), UUID(EMAIL_ID))
    assert result.thread_id == UUID("0c0c0c0c-0c0c-4c0c-8c0c-0c0c0c0c0c0c")
    assert result.subject == "Invoice"
    assert result.message_count == 3
    assert result.truncated is False
    assert result.cursor == "page-3"


@pytest.mark.parametrize("entry", TIMESTAMPS, ids=[t["input"] for t in TIMESTAMPS])
def test_timestamp_normalization_matches_the_fixture(entry: dict[str, Any]) -> None:
    assert _normalize_timestamp(entry["input"]) == entry["normalized"]


def test_merge_sorts_by_the_fixture_milliseconds() -> None:
    valid = [t for t in TIMESTAMPS if t["ms"] is not None]
    messages = [
        ConversationMessage.from_dict(
            {
                "role": "user",
                "direction": "inbound",
                "id": f"00000000-0000-4000-8000-{index:012d}",
                "text": "x",
                "timestamp": entry["normalized"],
            }
        )
        for index, entry in enumerate(valid)
    ]
    arrivals = list(reversed(list(zip(messages, valid, strict=True))))
    merged = merge_conversation_messages([], [message for message, _ in arrivals])
    expected = [
        message.id
        for _, (message, _) in sorted(
            enumerate(arrivals), key=lambda item: (item[1][1]["ms"], item[0])
        )
    ]
    assert [message.id for message in merged] == expected


def test_sync_stops_after_the_page_limit() -> None:
    reads: list[str] = []

    def read(since: str) -> Conversation:
        reads.append(since)
        return Conversation.from_dict(
            {
                "thread_id": None,
                "messages": [],
                "cursor": f"cursor-{len(reads)}",
                "has_more": True,
            }
        )

    with pytest.raises(PrimitiveAPIError):
        run_conversation_sync(read)
    assert len(reads) == MAX_CONVERSATION_SYNC_PAGES
