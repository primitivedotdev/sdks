import json
from pathlib import Path
from uuid import UUID

import httpx

from primitive.api.api.emails import search_emails
from primitive.api.client import Client
from primitive.api.models.email_search_result_direction import (
    EmailSearchResultDirection,
)
from primitive.api.models.search_emails_count import SearchEmailsCount
from primitive.api.models.search_emails_prefix import SearchEmailsPrefix
from primitive.api.models.search_emails_response_200 import SearchEmailsResponse200

FIXTURES = Path(__file__).parents[2] / "test-fixtures"
PAGES = json.loads((FIXTURES / "email-search-pages.json").read_text())
THREAD = UUID("5c1e9a7d-3b2f-4e8a-b6d4-9f0c2a1e7b35")


def _client(page: str, seen: list[httpx.Request]) -> Client:
    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(200, json=PAGES[page])

    return Client(
        base_url="https://example.test",
        raise_on_unexpected_status=True,
        httpx_args={"transport": httpx.MockTransport(handler)},
    )


def test_sends_thread_id_prefix_and_count() -> None:
    seen: list[httpx.Request] = []
    with _client("uncounted", seen) as connection:
        search_emails.sync_detailed(
            client=connection,
            q="quarterly invoi",
            thread_id=THREAD,
            prefix=SearchEmailsPrefix.TRUE,
            count=SearchEmailsCount.FALSE,
        )
    params = seen[0].url.params
    assert seen[0].url.path == "/emails/search"
    assert params["q"] == "quarterly invoi"
    assert params["thread_id"] == str(THREAD)
    assert params["prefix"] == "true"
    assert params["count"] == "false"


def test_omits_thread_id_when_not_asked_for() -> None:
    seen: list[httpx.Request] = []
    with _client("counted", seen) as connection:
        search_emails.sync_detailed(client=connection, q="invoice")
    params = seen[0].url.params
    assert "thread_id" not in params
    # The generated client sends the documented defaults explicitly.
    assert params["prefix"] == "false"
    assert params["count"] == "true"


def test_decodes_thread_id_direction_and_counted_total() -> None:
    seen: list[httpx.Request] = []
    with _client("counted", seen) as connection:
        page = search_emails.sync(client=connection, q="invoice")
    assert isinstance(page, SearchEmailsResponse200)
    assert page.meta.total == 1
    assert page.data[0].thread_id == THREAD
    assert page.data[0].direction is EmailSearchResultDirection.INBOUND


def test_decodes_null_total_and_null_thread_id() -> None:
    seen: list[httpx.Request] = []
    with _client("uncounted", seen) as connection:
        page = search_emails.sync(
            client=connection, q="invoi", count=SearchEmailsCount.FALSE
        )
    assert isinstance(page, SearchEmailsResponse200)
    assert page.meta.total is None
    assert page.meta.total_capped is False
    assert page.meta.cursor == "next-page-cursor"
    assert page.data[0].thread_id is None
    assert page.to_dict()["meta"]["total"] is None
