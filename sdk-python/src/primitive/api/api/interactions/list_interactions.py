from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.list_interactions_response_200 import ListInteractionsResponse200
from ...models.list_interactions_state import ListInteractionsState
from ...types import UNSET, Unset
from typing import cast
from uuid import UUID



def _get_kwargs(
    *,
    state: ListInteractionsState | Unset = UNSET,
    protocol: str | Unset = UNSET,
    wire_id: str | Unset = UNSET,
    email_id: UUID | Unset = UNSET,
    limit: int | Unset = UNSET,
    cursor: str | Unset = UNSET,

) -> dict[str, Any]:
    

    

    params: dict[str, Any] = {}

    json_state: str | Unset = UNSET
    if not isinstance(state, Unset):
        json_state = state.value

    params["state"] = json_state

    params["protocol"] = protocol

    params["wire_id"] = wire_id

    json_email_id: str | Unset = UNSET
    if not isinstance(email_id, Unset):
        json_email_id = str(email_id)
    params["email_id"] = json_email_id

    params["limit"] = limit

    params["cursor"] = cursor


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/interactions",
        "params": params,
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | ListInteractionsResponse200 | None:
    if response.status_code == 200:
        response_200 = ListInteractionsResponse200.from_dict(response.json())



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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | ListInteractionsResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    state: ListInteractionsState | Unset = UNSET,
    protocol: str | Unset = UNSET,
    wire_id: str | Unset = UNSET,
    email_id: UUID | Unset = UNSET,
    limit: int | Unset = UNSET,
    cursor: str | Unset = UNSET,

) -> Response[ErrorResponse | ListInteractionsResponse200]:
    """ List interactions

     The organization's interactions, newest first by creation, with their state, whose turn it is and
    when the last step happened. Reading needs interactions:read and organization-wide mail scope; a
    credential narrowed to some mailboxes is refused.

    Args:
        state (ListInteractionsState | Unset):
        protocol (str | Unset):
        wire_id (str | Unset):
        email_id (UUID | Unset):
        limit (int | Unset):
        cursor (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ListInteractionsResponse200]
     """


    kwargs = _get_kwargs(
        state=state,
protocol=protocol,
wire_id=wire_id,
email_id=email_id,
limit=limit,
cursor=cursor,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    *,
    client: AuthenticatedClient | Client,
    state: ListInteractionsState | Unset = UNSET,
    protocol: str | Unset = UNSET,
    wire_id: str | Unset = UNSET,
    email_id: UUID | Unset = UNSET,
    limit: int | Unset = UNSET,
    cursor: str | Unset = UNSET,

) -> ErrorResponse | ListInteractionsResponse200 | None:
    """ List interactions

     The organization's interactions, newest first by creation, with their state, whose turn it is and
    when the last step happened. Reading needs interactions:read and organization-wide mail scope; a
    credential narrowed to some mailboxes is refused.

    Args:
        state (ListInteractionsState | Unset):
        protocol (str | Unset):
        wire_id (str | Unset):
        email_id (UUID | Unset):
        limit (int | Unset):
        cursor (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ListInteractionsResponse200
     """


    return sync_detailed(
        client=client,
state=state,
protocol=protocol,
wire_id=wire_id,
email_id=email_id,
limit=limit,
cursor=cursor,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    state: ListInteractionsState | Unset = UNSET,
    protocol: str | Unset = UNSET,
    wire_id: str | Unset = UNSET,
    email_id: UUID | Unset = UNSET,
    limit: int | Unset = UNSET,
    cursor: str | Unset = UNSET,

) -> Response[ErrorResponse | ListInteractionsResponse200]:
    """ List interactions

     The organization's interactions, newest first by creation, with their state, whose turn it is and
    when the last step happened. Reading needs interactions:read and organization-wide mail scope; a
    credential narrowed to some mailboxes is refused.

    Args:
        state (ListInteractionsState | Unset):
        protocol (str | Unset):
        wire_id (str | Unset):
        email_id (UUID | Unset):
        limit (int | Unset):
        cursor (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ListInteractionsResponse200]
     """


    kwargs = _get_kwargs(
        state=state,
protocol=protocol,
wire_id=wire_id,
email_id=email_id,
limit=limit,
cursor=cursor,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    state: ListInteractionsState | Unset = UNSET,
    protocol: str | Unset = UNSET,
    wire_id: str | Unset = UNSET,
    email_id: UUID | Unset = UNSET,
    limit: int | Unset = UNSET,
    cursor: str | Unset = UNSET,

) -> ErrorResponse | ListInteractionsResponse200 | None:
    """ List interactions

     The organization's interactions, newest first by creation, with their state, whose turn it is and
    when the last step happened. Reading needs interactions:read and organization-wide mail scope; a
    credential narrowed to some mailboxes is refused.

    Args:
        state (ListInteractionsState | Unset):
        protocol (str | Unset):
        wire_id (str | Unset):
        email_id (UUID | Unset):
        limit (int | Unset):
        cursor (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ListInteractionsResponse200
     """


    return (await asyncio_detailed(
        client=client,
state=state,
protocol=protocol,
wire_id=wire_id,
email_id=email_id,
limit=limit,
cursor=cursor,

    )).parsed
