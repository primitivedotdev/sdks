from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.get_thread_response_200 import GetThreadResponse200
from typing import cast
from uuid import UUID



def _get_kwargs(
    id: UUID,

) -> dict[str, Any]:
    

    

    

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/threads/{id}".format(id=quote(str(id), safe=""),),
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | GetThreadResponse200 | None:
    if response.status_code == 200:
        response_200 = GetThreadResponse200.from_dict(response.json())



        return response_200

    if response.status_code == 400:
        response_400 = ErrorResponse.from_dict(response.json())



        return response_400

    if response.status_code == 401:
        response_401 = ErrorResponse.from_dict(response.json())



        return response_401

    if response.status_code == 404:
        response_404 = ErrorResponse.from_dict(response.json())



        return response_404

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | GetThreadResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,

) -> Response[ErrorResponse | GetThreadResponse200]:
    """ Get a conversation thread by id

     Returns a conversation thread: its metadata plus the inbound
    and outbound messages that belong to it, interleaved in time
    order (oldest first). A thread spans both received emails and
    your sends, so an agent can reconstruct an entire back-and-forth
    from one call instead of walking reply headers.

    Each message carries a `direction` (`inbound` | `outbound`) and
    an `id`; fetch the full message via `/emails/{id}` or
    `/sent-emails/{id}` accordingly. Bodies are omitted here to keep
    the thread view lightweight.

    Discover a thread id from the `thread_id` field on any email or
    sent-email (list or detail). The message list is capped; compare
    `message_count` against `messages.length` to detect truncation.

    Args:
        id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | GetThreadResponse200]
     """


    kwargs = _get_kwargs(
        id=id,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,

) -> ErrorResponse | GetThreadResponse200 | None:
    """ Get a conversation thread by id

     Returns a conversation thread: its metadata plus the inbound
    and outbound messages that belong to it, interleaved in time
    order (oldest first). A thread spans both received emails and
    your sends, so an agent can reconstruct an entire back-and-forth
    from one call instead of walking reply headers.

    Each message carries a `direction` (`inbound` | `outbound`) and
    an `id`; fetch the full message via `/emails/{id}` or
    `/sent-emails/{id}` accordingly. Bodies are omitted here to keep
    the thread view lightweight.

    Discover a thread id from the `thread_id` field on any email or
    sent-email (list or detail). The message list is capped; compare
    `message_count` against `messages.length` to detect truncation.

    Args:
        id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | GetThreadResponse200
     """


    return sync_detailed(
        id=id,
client=client,

    ).parsed

async def asyncio_detailed(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,

) -> Response[ErrorResponse | GetThreadResponse200]:
    """ Get a conversation thread by id

     Returns a conversation thread: its metadata plus the inbound
    and outbound messages that belong to it, interleaved in time
    order (oldest first). A thread spans both received emails and
    your sends, so an agent can reconstruct an entire back-and-forth
    from one call instead of walking reply headers.

    Each message carries a `direction` (`inbound` | `outbound`) and
    an `id`; fetch the full message via `/emails/{id}` or
    `/sent-emails/{id}` accordingly. Bodies are omitted here to keep
    the thread view lightweight.

    Discover a thread id from the `thread_id` field on any email or
    sent-email (list or detail). The message list is capped; compare
    `message_count` against `messages.length` to detect truncation.

    Args:
        id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | GetThreadResponse200]
     """


    kwargs = _get_kwargs(
        id=id,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,

) -> ErrorResponse | GetThreadResponse200 | None:
    """ Get a conversation thread by id

     Returns a conversation thread: its metadata plus the inbound
    and outbound messages that belong to it, interleaved in time
    order (oldest first). A thread spans both received emails and
    your sends, so an agent can reconstruct an entire back-and-forth
    from one call instead of walking reply headers.

    Each message carries a `direction` (`inbound` | `outbound`) and
    an `id`; fetch the full message via `/emails/{id}` or
    `/sent-emails/{id}` accordingly. Bodies are omitted here to keep
    the thread view lightweight.

    Discover a thread id from the `thread_id` field on any email or
    sent-email (list or detail). The message list is capped; compare
    `message_count` against `messages.length` to detect truncation.

    Args:
        id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | GetThreadResponse200
     """


    return (await asyncio_detailed(
        id=id,
client=client,

    )).parsed
