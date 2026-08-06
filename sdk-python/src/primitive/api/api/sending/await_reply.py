from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.await_reply_response_200 import AwaitReplyResponse200
from ...models.error_response import ErrorResponse
from ...types import UNSET, Unset
from typing import cast
from uuid import UUID



def _get_kwargs(
    id: UUID,
    *,
    wait: bool | Unset = UNSET,
    wait_timeout_ms: int | Unset = UNSET,

) -> dict[str, Any]:
    

    

    params: dict[str, Any] = {}

    params["wait"] = wait

    params["wait_timeout_ms"] = wait_timeout_ms


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/sent-emails/{id}/reply".format(id=quote(str(id), safe=""),),
        "params": params,
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> AwaitReplyResponse200 | ErrorResponse | None:
    if response.status_code == 200:
        response_200 = AwaitReplyResponse200.from_dict(response.json())



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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[AwaitReplyResponse200 | ErrorResponse]:
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
    wait: bool | Unset = UNSET,
    wait_timeout_ms: int | Unset = UNSET,

) -> Response[AwaitReplyResponse200 | ErrorResponse]:
    r""" Get (or wait for) the reply to a sent email

     Returns the first threaded inbound reply to a send, keyed by
    the inbound email's `reply_to_sent_email_id`. This is the
    canonical \"did a reply arrive for this send?\" call: after
    /send-mail, poll (or long-poll) here instead of hand-rolling
    an /emails/search loop.

    By default the call returns immediately with `reply: null`
    when nothing has arrived yet. Set `wait=true` to long-poll:
    the server holds the request up to `wait_timeout_ms`
    (default 10000, max 30000), returning as soon as the first
    reply lands. On a wait that elapses with no reply, the
    response has `reply: null` and `timed_out: true`.

    The reply object is compact (headers plus bodies); fetch
    `/emails/{id}` with `reply.id` for the fully parsed record,
    or `/threads/{thread_id}` for the whole back-and-forth.

    Args:
        id (UUID):
        wait (bool | Unset):
        wait_timeout_ms (int | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[AwaitReplyResponse200 | ErrorResponse]
     """


    kwargs = _get_kwargs(
        id=id,
wait=wait,
wait_timeout_ms=wait_timeout_ms,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    wait: bool | Unset = UNSET,
    wait_timeout_ms: int | Unset = UNSET,

) -> AwaitReplyResponse200 | ErrorResponse | None:
    r""" Get (or wait for) the reply to a sent email

     Returns the first threaded inbound reply to a send, keyed by
    the inbound email's `reply_to_sent_email_id`. This is the
    canonical \"did a reply arrive for this send?\" call: after
    /send-mail, poll (or long-poll) here instead of hand-rolling
    an /emails/search loop.

    By default the call returns immediately with `reply: null`
    when nothing has arrived yet. Set `wait=true` to long-poll:
    the server holds the request up to `wait_timeout_ms`
    (default 10000, max 30000), returning as soon as the first
    reply lands. On a wait that elapses with no reply, the
    response has `reply: null` and `timed_out: true`.

    The reply object is compact (headers plus bodies); fetch
    `/emails/{id}` with `reply.id` for the fully parsed record,
    or `/threads/{thread_id}` for the whole back-and-forth.

    Args:
        id (UUID):
        wait (bool | Unset):
        wait_timeout_ms (int | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        AwaitReplyResponse200 | ErrorResponse
     """


    return sync_detailed(
        id=id,
client=client,
wait=wait,
wait_timeout_ms=wait_timeout_ms,

    ).parsed

async def asyncio_detailed(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    wait: bool | Unset = UNSET,
    wait_timeout_ms: int | Unset = UNSET,

) -> Response[AwaitReplyResponse200 | ErrorResponse]:
    r""" Get (or wait for) the reply to a sent email

     Returns the first threaded inbound reply to a send, keyed by
    the inbound email's `reply_to_sent_email_id`. This is the
    canonical \"did a reply arrive for this send?\" call: after
    /send-mail, poll (or long-poll) here instead of hand-rolling
    an /emails/search loop.

    By default the call returns immediately with `reply: null`
    when nothing has arrived yet. Set `wait=true` to long-poll:
    the server holds the request up to `wait_timeout_ms`
    (default 10000, max 30000), returning as soon as the first
    reply lands. On a wait that elapses with no reply, the
    response has `reply: null` and `timed_out: true`.

    The reply object is compact (headers plus bodies); fetch
    `/emails/{id}` with `reply.id` for the fully parsed record,
    or `/threads/{thread_id}` for the whole back-and-forth.

    Args:
        id (UUID):
        wait (bool | Unset):
        wait_timeout_ms (int | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[AwaitReplyResponse200 | ErrorResponse]
     """


    kwargs = _get_kwargs(
        id=id,
wait=wait,
wait_timeout_ms=wait_timeout_ms,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    wait: bool | Unset = UNSET,
    wait_timeout_ms: int | Unset = UNSET,

) -> AwaitReplyResponse200 | ErrorResponse | None:
    r""" Get (or wait for) the reply to a sent email

     Returns the first threaded inbound reply to a send, keyed by
    the inbound email's `reply_to_sent_email_id`. This is the
    canonical \"did a reply arrive for this send?\" call: after
    /send-mail, poll (or long-poll) here instead of hand-rolling
    an /emails/search loop.

    By default the call returns immediately with `reply: null`
    when nothing has arrived yet. Set `wait=true` to long-poll:
    the server holds the request up to `wait_timeout_ms`
    (default 10000, max 30000), returning as soon as the first
    reply lands. On a wait that elapses with no reply, the
    response has `reply: null` and `timed_out: true`.

    The reply object is compact (headers plus bodies); fetch
    `/emails/{id}` with `reply.id` for the fully parsed record,
    or `/threads/{thread_id}` for the whole back-and-forth.

    Args:
        id (UUID):
        wait (bool | Unset):
        wait_timeout_ms (int | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        AwaitReplyResponse200 | ErrorResponse
     """


    return (await asyncio_detailed(
        id=id,
client=client,
wait=wait,
wait_timeout_ms=wait_timeout_ms,

    )).parsed
