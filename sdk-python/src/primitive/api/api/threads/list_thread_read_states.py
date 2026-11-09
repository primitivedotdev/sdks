from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.list_thread_read_states_response_200 import ListThreadReadStatesResponse200
from ...types import UNSET, Unset
from typing import cast
import datetime



def _get_kwargs(
    *,
    thread_ids: str | Unset = UNSET,
    updated_since: datetime.datetime | Unset = UNSET,
    cursor: str | Unset = UNSET,
    limit: int | Unset = 100,

) -> dict[str, Any]:
    

    

    params: dict[str, Any] = {}

    params["thread_ids"] = thread_ids

    json_updated_since: str | Unset = UNSET
    if not isinstance(updated_since, Unset):
        json_updated_since = updated_since.isoformat()
    params["updated_since"] = json_updated_since

    params["cursor"] = cursor

    params["limit"] = limit


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/threads/read-state",
        "params": params,
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | ListThreadReadStatesResponse200 | None:
    if response.status_code == 200:
        response_200 = ListThreadReadStatesResponse200.from_dict(response.json())



        return response_200

    if response.status_code == 400:
        response_400 = ErrorResponse.from_dict(response.json())



        return response_400

    if response.status_code == 401:
        response_401 = ErrorResponse.from_dict(response.json())



        return response_401

    if response.status_code == 403:
        response_403 = ErrorResponse.from_dict(response.json())



        return response_403

    if response.status_code == 429:
        response_429 = ErrorResponse.from_dict(response.json())



        return response_429

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | ListThreadReadStatesResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    thread_ids: str | Unset = UNSET,
    updated_since: datetime.datetime | Unset = UNSET,
    cursor: str | Unset = UNSET,
    limit: int | Unset = 100,

) -> Response[ErrorResponse | ListThreadReadStatesResponse200]:
    """ Read the member's read state for threads

     The signed-in member's read cursor and `unread_count` per thread, computed together in one query.
    Two modes, exactly one per request. With `thread_ids`, answers those threads (ids that are not
    threads of the organization are left out). With `updated_since`, returns the cursors that moved
    after that instant, oldest change first, paged by `meta.cursor`: poll it from each device to learn
    what was read elsewhere. In both modes a thread the caller can see no message in is left out,
    exactly as an unknown thread. The feed lags real time by about 5 seconds: a cursor appears once it
    moved at least that long ago, so a write still committing is never skipped. When `meta.cursor` is
    null, poll again later from the newest `updated_at` you have seen, overlapping by a few seconds;
    repeated rows are harmless. Only a signed-in organization member (a dashboard session or an OAuth
    member grant) can use this. Organization API keys, agent connection keys and Functions are refused
    with 403: read state is personal to a member.

    Args:
        thread_ids (str | Unset):
        updated_since (datetime.datetime | Unset):
        cursor (str | Unset):
        limit (int | Unset):  Default: 100.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ListThreadReadStatesResponse200]
     """


    kwargs = _get_kwargs(
        thread_ids=thread_ids,
updated_since=updated_since,
cursor=cursor,
limit=limit,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    *,
    client: AuthenticatedClient | Client,
    thread_ids: str | Unset = UNSET,
    updated_since: datetime.datetime | Unset = UNSET,
    cursor: str | Unset = UNSET,
    limit: int | Unset = 100,

) -> ErrorResponse | ListThreadReadStatesResponse200 | None:
    """ Read the member's read state for threads

     The signed-in member's read cursor and `unread_count` per thread, computed together in one query.
    Two modes, exactly one per request. With `thread_ids`, answers those threads (ids that are not
    threads of the organization are left out). With `updated_since`, returns the cursors that moved
    after that instant, oldest change first, paged by `meta.cursor`: poll it from each device to learn
    what was read elsewhere. In both modes a thread the caller can see no message in is left out,
    exactly as an unknown thread. The feed lags real time by about 5 seconds: a cursor appears once it
    moved at least that long ago, so a write still committing is never skipped. When `meta.cursor` is
    null, poll again later from the newest `updated_at` you have seen, overlapping by a few seconds;
    repeated rows are harmless. Only a signed-in organization member (a dashboard session or an OAuth
    member grant) can use this. Organization API keys, agent connection keys and Functions are refused
    with 403: read state is personal to a member.

    Args:
        thread_ids (str | Unset):
        updated_since (datetime.datetime | Unset):
        cursor (str | Unset):
        limit (int | Unset):  Default: 100.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ListThreadReadStatesResponse200
     """


    return sync_detailed(
        client=client,
thread_ids=thread_ids,
updated_since=updated_since,
cursor=cursor,
limit=limit,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    thread_ids: str | Unset = UNSET,
    updated_since: datetime.datetime | Unset = UNSET,
    cursor: str | Unset = UNSET,
    limit: int | Unset = 100,

) -> Response[ErrorResponse | ListThreadReadStatesResponse200]:
    """ Read the member's read state for threads

     The signed-in member's read cursor and `unread_count` per thread, computed together in one query.
    Two modes, exactly one per request. With `thread_ids`, answers those threads (ids that are not
    threads of the organization are left out). With `updated_since`, returns the cursors that moved
    after that instant, oldest change first, paged by `meta.cursor`: poll it from each device to learn
    what was read elsewhere. In both modes a thread the caller can see no message in is left out,
    exactly as an unknown thread. The feed lags real time by about 5 seconds: a cursor appears once it
    moved at least that long ago, so a write still committing is never skipped. When `meta.cursor` is
    null, poll again later from the newest `updated_at` you have seen, overlapping by a few seconds;
    repeated rows are harmless. Only a signed-in organization member (a dashboard session or an OAuth
    member grant) can use this. Organization API keys, agent connection keys and Functions are refused
    with 403: read state is personal to a member.

    Args:
        thread_ids (str | Unset):
        updated_since (datetime.datetime | Unset):
        cursor (str | Unset):
        limit (int | Unset):  Default: 100.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ListThreadReadStatesResponse200]
     """


    kwargs = _get_kwargs(
        thread_ids=thread_ids,
updated_since=updated_since,
cursor=cursor,
limit=limit,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    thread_ids: str | Unset = UNSET,
    updated_since: datetime.datetime | Unset = UNSET,
    cursor: str | Unset = UNSET,
    limit: int | Unset = 100,

) -> ErrorResponse | ListThreadReadStatesResponse200 | None:
    """ Read the member's read state for threads

     The signed-in member's read cursor and `unread_count` per thread, computed together in one query.
    Two modes, exactly one per request. With `thread_ids`, answers those threads (ids that are not
    threads of the organization are left out). With `updated_since`, returns the cursors that moved
    after that instant, oldest change first, paged by `meta.cursor`: poll it from each device to learn
    what was read elsewhere. In both modes a thread the caller can see no message in is left out,
    exactly as an unknown thread. The feed lags real time by about 5 seconds: a cursor appears once it
    moved at least that long ago, so a write still committing is never skipped. When `meta.cursor` is
    null, poll again later from the newest `updated_at` you have seen, overlapping by a few seconds;
    repeated rows are harmless. Only a signed-in organization member (a dashboard session or an OAuth
    member grant) can use this. Organization API keys, agent connection keys and Functions are refused
    with 403: read state is personal to a member.

    Args:
        thread_ids (str | Unset):
        updated_since (datetime.datetime | Unset):
        cursor (str | Unset):
        limit (int | Unset):  Default: 100.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ListThreadReadStatesResponse200
     """


    return (await asyncio_detailed(
        client=client,
thread_ids=thread_ids,
updated_since=updated_since,
cursor=cursor,
limit=limit,

    )).parsed
