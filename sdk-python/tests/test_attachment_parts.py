from __future__ import annotations

import asyncio
import json
from pathlib import Path
from uuid import UUID

import httpx
import pytest

from primitive.api.api.emails import download_email_attachment_part
from primitive.api.api.sending import download_sent_attachment_part
from primitive.api.client import AuthenticatedClient
from primitive.api.models.error_response import ErrorResponse
from primitive.api.types import File

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
