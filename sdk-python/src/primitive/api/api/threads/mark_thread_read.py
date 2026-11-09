from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.mark_thread_read_input import MarkThreadReadInput
from ...models.mark_thread_read_response_200 import MarkThreadReadResponse200
from typing import cast
from uuid import UUID



def _get_kwargs(
    id: UUID,
    *,
    body: MarkThreadReadInput,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "put",
        "url": "/threads/{id}/read".format(id=quote(str(id), safe=""),),
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | MarkThreadReadResponse200 | None:
    if response.status_code == 200:
        response_200 = MarkThreadReadResponse200.from_dict(response.json())



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

    if response.status_code == 404:
        response_404 = ErrorResponse.from_dict(response.json())



        return response_404

    if response.status_code == 429:
        response_429 = ErrorResponse.from_dict(response.json())



        return response_429

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | MarkThreadReadResponse200]:
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
    body: MarkThreadReadInput,

) -> Response[ErrorResponse | MarkThreadReadResponse200]:
    """ Mark a thread read up to a message

     Moves the signed-in member's read cursor for this thread forward to the named message or instant,
    for every device the member uses. Monotonic and idempotent: a position at or behind the stored
    cursor changes nothing (`advanced: false`), so devices reporting reads out of order converge on the
    furthest one. Returns the thread's read state after the write; a retry at the same position returns
    the current state with `advanced: false`. A thread the caller can see no message in answers 404,
    exactly as an unknown thread. Once the write commits the answer is always 200: if the unread count
    cannot be read afterwards, `unread_count` is null and `state_unavailable` is true, and the cursor
    fields still hold. Only a signed-in organization member (a dashboard session or an OAuth member
    grant) can use this. Organization API keys, agent connection keys and Functions are refused with
    403: read state is personal to a member.

    Args:
        id (UUID):
        body (MarkThreadReadInput): Name exactly one of `up_to_email_id` or `up_to`.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | MarkThreadReadResponse200]
     """


    kwargs = _get_kwargs(
        id=id,
body=body,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: MarkThreadReadInput,

) -> ErrorResponse | MarkThreadReadResponse200 | None:
    """ Mark a thread read up to a message

     Moves the signed-in member's read cursor for this thread forward to the named message or instant,
    for every device the member uses. Monotonic and idempotent: a position at or behind the stored
    cursor changes nothing (`advanced: false`), so devices reporting reads out of order converge on the
    furthest one. Returns the thread's read state after the write; a retry at the same position returns
    the current state with `advanced: false`. A thread the caller can see no message in answers 404,
    exactly as an unknown thread. Once the write commits the answer is always 200: if the unread count
    cannot be read afterwards, `unread_count` is null and `state_unavailable` is true, and the cursor
    fields still hold. Only a signed-in organization member (a dashboard session or an OAuth member
    grant) can use this. Organization API keys, agent connection keys and Functions are refused with
    403: read state is personal to a member.

    Args:
        id (UUID):
        body (MarkThreadReadInput): Name exactly one of `up_to_email_id` or `up_to`.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | MarkThreadReadResponse200
     """


    return sync_detailed(
        id=id,
client=client,
body=body,

    ).parsed

async def asyncio_detailed(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: MarkThreadReadInput,

) -> Response[ErrorResponse | MarkThreadReadResponse200]:
    """ Mark a thread read up to a message

     Moves the signed-in member's read cursor for this thread forward to the named message or instant,
    for every device the member uses. Monotonic and idempotent: a position at or behind the stored
    cursor changes nothing (`advanced: false`), so devices reporting reads out of order converge on the
    furthest one. Returns the thread's read state after the write; a retry at the same position returns
    the current state with `advanced: false`. A thread the caller can see no message in answers 404,
    exactly as an unknown thread. Once the write commits the answer is always 200: if the unread count
    cannot be read afterwards, `unread_count` is null and `state_unavailable` is true, and the cursor
    fields still hold. Only a signed-in organization member (a dashboard session or an OAuth member
    grant) can use this. Organization API keys, agent connection keys and Functions are refused with
    403: read state is personal to a member.

    Args:
        id (UUID):
        body (MarkThreadReadInput): Name exactly one of `up_to_email_id` or `up_to`.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | MarkThreadReadResponse200]
     """


    kwargs = _get_kwargs(
        id=id,
body=body,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: MarkThreadReadInput,

) -> ErrorResponse | MarkThreadReadResponse200 | None:
    """ Mark a thread read up to a message

     Moves the signed-in member's read cursor for this thread forward to the named message or instant,
    for every device the member uses. Monotonic and idempotent: a position at or behind the stored
    cursor changes nothing (`advanced: false`), so devices reporting reads out of order converge on the
    furthest one. Returns the thread's read state after the write; a retry at the same position returns
    the current state with `advanced: false`. A thread the caller can see no message in answers 404,
    exactly as an unknown thread. Once the write commits the answer is always 200: if the unread count
    cannot be read afterwards, `unread_count` is null and `state_unavailable` is true, and the cursor
    fields still hold. Only a signed-in organization member (a dashboard session or an OAuth member
    grant) can use this. Organization API keys, agent connection keys and Functions are refused with
    403: read state is personal to a member.

    Args:
        id (UUID):
        body (MarkThreadReadInput): Name exactly one of `up_to_email_id` or `up_to`.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | MarkThreadReadResponse200
     """


    return (await asyncio_detailed(
        id=id,
client=client,
body=body,

    )).parsed
