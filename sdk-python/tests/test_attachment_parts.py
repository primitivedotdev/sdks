from __future__ import annotations

import asyncio
import json
from pathlib import Path
from uuid import UUID

import httpx
import pytest

from primitive.api.api.emails import download_email_attachment_part
from primitive.api.api.sending import download_sent_attachment_part, get_sent_email
from primitive.api.client import AuthenticatedClient
from primitive.api.models.error_response import ErrorResponse
from primitive.api.models.get_sent_email_response_200 import GetSentEmailResponse200
from primitive.api.models.sent_email_detail import SentEmailDetail
from primitive.api.types import UNSET, File, Unset

FIXTURE = json.loads(
    (Path(__file__).parents[2] / "test-fixtures/attachment-part.json").read_text()
)
KEY = "-".join(["fixture", "credential"])


@pytest.mark.parametrize("outbound", [False, True])
def test_original_attachment_bytes_sync_and_async(outbound: bool) -> None:
    operation = (
        download_sent_attachment_part if outbound else download_email_attachment_part
    )
    path = "sent-emails" if outbound else "emails"

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == f"/{path}/{FIXTURE['id']}/attachments/7"
        assert request.headers["authorization"] == f"Bearer {KEY}"
        return httpx.Response(
            200,
            content=bytes(FIXTURE["bytes"]),
            headers={
                "content-type": "application/octet-stream",
                "x-content-sha256": FIXTURE["sha256"],
                "content-disposition": FIXTURE["content_disposition"],
                "cache-control": "private, no-store",
            },
        )

    client = AuthenticatedClient(base_url="https://example.test", token=KEY)
    with httpx.Client(
        base_url="https://example.test",
        headers={"Authorization": f"Bearer {KEY}"},
        transport=httpx.MockTransport(handler),
    ) as http:
        client.set_httpx_client(http)
        result = operation.sync_detailed(
            UUID(FIXTURE["id"]), FIXTURE["part_index"], client=client
        )
        assert isinstance(result.parsed, File)
        assert result.parsed.payload.read() == bytes(FIXTURE["bytes"])
        assert result.content == bytes(FIXTURE["bytes"])
        assert result.headers["x-content-sha256"] == FIXTURE["sha256"]
        assert result.headers["content-disposition"] == FIXTURE["content_disposition"]
        assert result.headers["cache-control"] == "private, no-store"

    async def check_async() -> None:
        async with httpx.AsyncClient(
            base_url="https://example.test",
            headers={"Authorization": f"Bearer {KEY}"},
            transport=httpx.MockTransport(handler),
        ) as http:
            client.set_async_httpx_client(http)
            result = await operation.asyncio(
                UUID(FIXTURE["id"]), FIXTURE["part_index"], client=client
            )
            assert isinstance(result, File)
            assert result.payload.read() == bytes(FIXTURE["bytes"])

    asyncio.run(check_async())


@pytest.mark.parametrize(
    ("status", "code"),
    [
        (400, "validation_error"),
        (401, "unauthorized"),
        (403, "forbidden"),
        (404, "not_found"),
        (409, "attachment_changed"),
        (410, "content_discarded"),
        (413, "attachment_limit_exceeded"),
        (502, "attachment_integrity_failed"),
        (503, "attachment_not_ready"),
        (503, "attachment_storage_unavailable"),
    ],
)
def test_download_errors_preserve_code_status_and_retry_after(
    status: int, code: str
) -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(
            status,
            json={"success": False, "error": {"code": code, "message": "Unavailable"}},
            headers={"retry-after": "3"},
        )

    client = AuthenticatedClient(base_url="https://example.test", token=KEY)
    with httpx.Client(
        base_url="https://example.test", transport=httpx.MockTransport(handler)
    ) as http:
        client.set_httpx_client(http)
        for operation in (
            download_email_attachment_part,
            download_sent_attachment_part,
        ):
            result = operation.sync_detailed(UUID(FIXTURE["id"]), 7, client=client)
            assert result.status_code == status
            assert isinstance(result.parsed, ErrorResponse)
            assert result.parsed.error.code == code
            assert result.headers["retry-after"] == "3"


SENT_FIXTURE = json.loads((Path(__file__).parents[2] / "test-fixtures/sent-email-attachment.json").read_text())


@pytest.mark.parametrize("available", [True, False])
def test_discover_sent_attachment_then_download(available: bool) -> None:
    paths: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        paths.append(request.url.path)
        if request.url.path == f"/sent-emails/{FIXTURE['id']}":
            return httpx.Response(200, json={**SENT_FIXTURE, "data": {**SENT_FIXTURE["data"], "attachments_download_available": available}})
        assert request.url.path == f"/sent-emails/{FIXTURE['id']}/attachments/7"
        return httpx.Response(200, content=bytes(FIXTURE["bytes"]), headers={"content-type": "application/octet-stream"})

    client = AuthenticatedClient(base_url="https://example.test", token=KEY)
    with httpx.Client(base_url="https://example.test", transport=httpx.MockTransport(handler)) as http:
        client.set_httpx_client(http)
        result = get_sent_email.sync(UUID(FIXTURE["id"]), client=client)
        assert isinstance(result, GetSentEmailResponse200)
        assert isinstance(result.data, SentEmailDetail)
        detail = result.data
        assert detail.attachments_download_available is available
        assert detail.attachments_size_bytes == 1024
        assert isinstance(detail.attachments, list)
        metadata = detail.attachments[0]
        assert metadata.part_index == 7
        assert metadata.to_dict() == SENT_FIXTURE["data"]["attachments"][0]
        downloaded = download_sent_attachment_part.sync(detail.id, metadata.part_index, client=client)
        assert isinstance(downloaded, File)
        assert downloaded.payload.read() == bytes(FIXTURE["bytes"])
    assert paths == [f"/sent-emails/{FIXTURE['id']}", f"/sent-emails/{FIXTURE['id']}/attachments/7"]


def test_optional_sent_inventory_preserves_unknown_and_empty() -> None:
    legacy = {key: value for key, value in SENT_FIXTURE["data"].items() if not key.startswith("attachments")}
    detail = SentEmailDetail.from_dict(legacy)
    assert detail.attachments is UNSET
    assert detail.attachments_size_bytes is UNSET
    assert detail.attachments_download_available is UNSET
    assert "attachments" not in detail.to_dict()
    empty = SentEmailDetail.from_dict({**legacy, "attachments": [], "attachments_size_bytes": 0, "attachments_download_available": False})
    assert empty.attachments == []
    assert empty.attachments_size_bytes == 0
    assert empty.attachments_download_available is False
    assert empty.to_dict()["attachments"] == []
    null_name = SentEmailDetail.from_dict({**SENT_FIXTURE["data"], "attachments": [{**SENT_FIXTURE["data"]["attachments"][0], "filename": None}]})
    assert isinstance(null_name.attachments, list)
    assert null_name.attachments[0].filename is None


def test_sent_attachment_total_keeps_safe_integer_precision() -> None:
    detail = SentEmailDetail.from_dict({**SENT_FIXTURE["data"], "attachments_size_bytes": 9007199254740991})
    assert not isinstance(detail.attachments_size_bytes, Unset)
    total: int = detail.attachments_size_bytes
    assert total == 9007199254740991
    assert detail.to_dict()["attachments_size_bytes"] == total


COMPLETENESS_CASES = json.loads(
    (Path(__file__).parents[2] / "test-fixtures/sent-attachment-completeness.json").read_text()
)


@pytest.mark.parametrize("item", COMPLETENESS_CASES, ids=[item["name"] for item in COMPLETENESS_CASES])
def test_sent_attachment_completeness(item: dict[str, object]) -> None:
    fields = item["fields"]
    assert isinstance(fields, dict)
    data = {**SENT_FIXTURE["data"], **fields}

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == f"/sent-emails/{FIXTURE['id']}"
        return httpx.Response(200, json={"success": True, "data": data})

    client = AuthenticatedClient(base_url="https://example.test", token=KEY)
    with httpx.Client(base_url="https://example.test", transport=httpx.MockTransport(handler)) as http:
        client.set_httpx_client(http)
        result = get_sent_email.sync(UUID(FIXTURE["id"]), client=client)
    assert isinstance(result, GetSentEmailResponse200)
    detail = result.data
    assert isinstance(detail, SentEmailDetail)
    complete: bool | Unset = detail.attachments_complete
    if "attachments_complete" in fields:
        assert complete is fields["attachments_complete"]
    else:
        assert complete is UNSET
    serialized = detail.to_dict()
    assert ("attachments_complete" in serialized) == ("attachments_complete" in fields)
    for key in data:
        if key.startswith("attachments"):
            assert serialized[key] == data[key]
