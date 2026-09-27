import asyncio
from uuid import UUID

import httpx
import pytest

from primitive.api.api.emails import search_emails
from primitive.api.client import Client
from primitive.api.models.error_response import ErrorResponse


@pytest.mark.parametrize("asynchronous", [False, True])
def test_unavailable_reply_parent_is_a_parsed_error(asynchronous: bool) -> None:
    parent = UUID("11111111-1111-4111-8111-111111111111")
    requests = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal requests
        requests += 1
        assert request.url.path == "/emails/search"
        assert request.url.params["reply_to_sent_email_id"] == str(parent)
        return httpx.Response(
            404,
            json={
                "success": False,
                "error": {"code": "not_found", "message": "Sent email unavailable"},
            },
        )

    def client() -> Client:
        return Client(
            base_url="https://example.test",
            raise_on_unexpected_status=True,
            httpx_args={"transport": httpx.MockTransport(handler)},
        )

    async def run_async() -> ErrorResponse:
        async with client() as connection:
            result = await search_emails.asyncio_detailed(
                client=connection, reply_to_sent_email_id=parent
            )
        assert result.status_code == 404
        assert isinstance(result.parsed, ErrorResponse)
        return result.parsed

    if asynchronous:
        error = asyncio.run(run_async())
    else:
        with client() as connection:
            result = search_emails.sync_detailed(
                client=connection, reply_to_sent_email_id=parent
            )
        assert result.status_code == 404
        assert isinstance(result.parsed, ErrorResponse)
        error = result.parsed
    assert error.error.code == "not_found"
    assert requests == 1
