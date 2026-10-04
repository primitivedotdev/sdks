from __future__ import annotations

import json
from pathlib import Path
from uuid import UUID

import httpx
import pytest

from primitive.api.api.sending import get_sent_email
from primitive.api.client import AuthenticatedClient
from primitive.api.models.get_sent_email_response_200 import GetSentEmailResponse200
from primitive.api.models.sent_email_detail import SentEmailDetail
from primitive.api.models.sent_email_detail_tags_type_0_item import (
    SentEmailDetailTagsType0Item,
)
from primitive.api.types import UNSET

FIXTURES = Path(__file__).parents[2] / "test-fixtures"
SENT_FIXTURE = json.loads((FIXTURES / "sent-email-attachment.json").read_text())
CASES = json.loads((FIXTURES / "sent-email-recipients.json").read_text())
LIST_FIELDS = ("to_addresses", "cc", "bcc", "reply_to")
KEY = "-".join(["fixture", "credential"])


def fetch_detail(data: dict[str, object]) -> SentEmailDetail:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == f"/sent-emails/{SENT_FIXTURE['data']['id']}"
        return httpx.Response(200, json={"success": True, "data": data})

    client = AuthenticatedClient(base_url="https://example.test", token=KEY)
    with httpx.Client(
        base_url="https://example.test", transport=httpx.MockTransport(handler)
    ) as http:
        client.set_httpx_client(http)
        result = get_sent_email.sync(UUID(SENT_FIXTURE["data"]["id"]), client=client)
    assert isinstance(result, GetSentEmailResponse200)
    assert isinstance(result.data, SentEmailDetail)
    return result.data


@pytest.mark.parametrize("item", CASES, ids=[item["name"] for item in CASES])
def test_sent_email_recipient_lists_round_trip(item: dict[str, object]) -> None:
    fields = item["fields"]
    assert isinstance(fields, dict)
    data = {**SENT_FIXTURE["data"], **fields}
    detail = fetch_detail(data)

    for name in LIST_FIELDS:
        value = getattr(detail, name)
        if name in fields:
            assert value == fields[name]
        else:
            assert value is UNSET
    if "tags" not in fields:
        assert detail.tags is UNSET
    elif fields["tags"] is None:
        assert detail.tags is None
    else:
        assert isinstance(detail.tags, list)
        assert all(isinstance(tag, SentEmailDetailTagsType0Item) for tag in detail.tags)
        assert [(tag.name, tag.value) for tag in detail.tags] == [
            (tag["name"], tag["value"]) for tag in fields["tags"]
        ]

    serialized = detail.to_dict()
    for name in (*LIST_FIELDS, "tags"):
        assert (name in serialized) == (name in fields)
        if name in fields:
            assert serialized[name] == fields[name]
    assert SentEmailDetail.from_dict(serialized).to_dict() == serialized
