from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.unmute_thread_response_200 import UnmuteThreadResponse200
from ...types import UNSET, Unset
from typing import cast
from uuid import UUID



def _get_kwargs(
    id: UUID,
    *,
    address: str | Unset = UNSET,

) -> dict[str, Any]:
    

    

    params: dict[str, Any] = {}

    params["address"] = address


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "delete",
        "url": "/threads/{id}/mute".format(id=quote(str(id), safe=""),),
        "params": params,
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | UnmuteThreadResponse200 | None:
    if response.status_code == 200:
        response_200 = UnmuteThreadResponse200.from_dict(response.json())



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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | UnmuteThreadResponse200]:
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
    address: str | Unset = UNSET,

) -> Response[ErrorResponse | UnmuteThreadResponse200]:
    """ Unmute a thread for an address

     Removes the mute for the address. Idempotent: unmuting a thread that is not muted succeeds.

    Args:
        id (UUID):
        address (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | UnmuteThreadResponse200]
     """


    kwargs = _get_kwargs(
        id=id,
address=address,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    address: str | Unset = UNSET,

) -> ErrorResponse | UnmuteThreadResponse200 | None:
    """ Unmute a thread for an address

     Removes the mute for the address. Idempotent: unmuting a thread that is not muted succeeds.

    Args:
        id (UUID):
        address (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | UnmuteThreadResponse200
     """


    return sync_detailed(
        id=id,
client=client,
address=address,

    ).parsed

async def asyncio_detailed(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    address: str | Unset = UNSET,

) -> Response[ErrorResponse | UnmuteThreadResponse200]:
    """ Unmute a thread for an address

     Removes the mute for the address. Idempotent: unmuting a thread that is not muted succeeds.

    Args:
        id (UUID):
        address (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | UnmuteThreadResponse200]
     """


    kwargs = _get_kwargs(
        id=id,
address=address,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    address: str | Unset = UNSET,

) -> ErrorResponse | UnmuteThreadResponse200 | None:
    """ Unmute a thread for an address

     Removes the mute for the address. Idempotent: unmuting a thread that is not muted succeeds.

    Args:
        id (UUID):
        address (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | UnmuteThreadResponse200
     """


    return (await asyncio_detailed(
        id=id,
client=client,
address=address,

    )).parsed
