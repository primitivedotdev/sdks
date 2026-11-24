from __future__ import annotations

from uuid import UUID

import httpx2

from primitive.api.api.domains import download_domain_zone_file
from primitive.api.client import Client
from primitive.api.types import File


def test_download_domain_zone_file_returns_bytes_payload() -> None:
    def handler(request: httpx2.Request) -> httpx2.Response:
        assert request.url.path == "/domains/33333333-3333-4333-8333-333333333333/zone-file"
        return httpx2.Response(
            200,
            content=b"$ORIGIN example.com.\n",
            headers={"content-type": "text/plain; charset=utf-8"},
        )

    client = Client(base_url="https://example.test")
    client.set_httpx_client(
        httpx2.Client(
            base_url="https://example.test",
            transport=httpx2.MockTransport(handler),
        )
    )

    result = download_domain_zone_file.sync(
        UUID("33333333-3333-4333-8333-333333333333"),
        client=client,
    )

    assert isinstance(result, File)
    assert result.payload.read() == b"$ORIGIN example.com.\n"
