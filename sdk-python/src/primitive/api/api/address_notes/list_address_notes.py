from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.list_address_notes_response_200 import ListAddressNotesResponse200
from ...types import UNSET, Unset
from typing import cast



def _get_kwargs(
    *,
    address: str,
    prefix: str | Unset = UNSET,
    cursor: str | Unset = UNSET,
    limit: int | Unset = 50,

) -> dict[str, Any]:
    

    

    params: dict[str, Any] = {}

    params["address"] = address

    params["prefix"] = prefix

    params["cursor"] = cursor

    params["limit"] = limit


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/address-notes",
        "params": params,
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | ListAddressNotesResponse200 | None:
    if response.status_code == 200:
        response_200 = ListAddressNotesResponse200.from_dict(response.json())



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

    if response.status_code == 409:
        response_409 = ErrorResponse.from_dict(response.json())



        return response_409

    if response.status_code == 429:
        response_429 = ErrorResponse.from_dict(response.json())



        return response_429

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | ListAddressNotesResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    address: str,
    prefix: str | Unset = UNSET,
    cursor: str | Unset = UNSET,
    limit: int | Unset = 50,

) -> Response[ErrorResponse | ListAddressNotesResponse200]:
    """ List organization notes for an address

     Organization-scoped address annotations, independent of agents, routes and endpoints. Any bare
    address can have private notes. Function credentials may read org notes but cannot write or delete.
    A connected agent credential writes only its own address's notes and reads all of them; of another
    live agent's address in its organization it reads only the AGENT_WORKING, AGENT_RUNTIME and
    AGENT_INFO notes, and nothing of any other address. List and batch reads return only those notes;
    reading any other note name on another address returns 403, and one of those three names on an
    address that is not a live agent reads as not found. Use if_absent or if_version to avoid
    overwriting another writer.

    Args:
        address (str): Bare email address, normalized to lowercase. Plus tags are preserved.
        prefix (str | Unset):
        cursor (str | Unset): The name of the last note on the previous page, as meta.cursor gave
            it. Omit for the first page.
        limit (int | Unset):  Default: 50.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ListAddressNotesResponse200]
     """


    kwargs = _get_kwargs(
        address=address,
prefix=prefix,
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
    address: str,
    prefix: str | Unset = UNSET,
    cursor: str | Unset = UNSET,
    limit: int | Unset = 50,

) -> ErrorResponse | ListAddressNotesResponse200 | None:
    """ List organization notes for an address

     Organization-scoped address annotations, independent of agents, routes and endpoints. Any bare
    address can have private notes. Function credentials may read org notes but cannot write or delete.
    A connected agent credential writes only its own address's notes and reads all of them; of another
    live agent's address in its organization it reads only the AGENT_WORKING, AGENT_RUNTIME and
    AGENT_INFO notes, and nothing of any other address. List and batch reads return only those notes;
    reading any other note name on another address returns 403, and one of those three names on an
    address that is not a live agent reads as not found. Use if_absent or if_version to avoid
    overwriting another writer.

    Args:
        address (str): Bare email address, normalized to lowercase. Plus tags are preserved.
        prefix (str | Unset):
        cursor (str | Unset): The name of the last note on the previous page, as meta.cursor gave
            it. Omit for the first page.
        limit (int | Unset):  Default: 50.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ListAddressNotesResponse200
     """


    return sync_detailed(
        client=client,
address=address,
prefix=prefix,
cursor=cursor,
limit=limit,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    address: str,
    prefix: str | Unset = UNSET,
    cursor: str | Unset = UNSET,
    limit: int | Unset = 50,

) -> Response[ErrorResponse | ListAddressNotesResponse200]:
    """ List organization notes for an address

     Organization-scoped address annotations, independent of agents, routes and endpoints. Any bare
    address can have private notes. Function credentials may read org notes but cannot write or delete.
    A connected agent credential writes only its own address's notes and reads all of them; of another
    live agent's address in its organization it reads only the AGENT_WORKING, AGENT_RUNTIME and
    AGENT_INFO notes, and nothing of any other address. List and batch reads return only those notes;
    reading any other note name on another address returns 403, and one of those three names on an
    address that is not a live agent reads as not found. Use if_absent or if_version to avoid
    overwriting another writer.

    Args:
        address (str): Bare email address, normalized to lowercase. Plus tags are preserved.
        prefix (str | Unset):
        cursor (str | Unset): The name of the last note on the previous page, as meta.cursor gave
            it. Omit for the first page.
        limit (int | Unset):  Default: 50.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ListAddressNotesResponse200]
     """


    kwargs = _get_kwargs(
        address=address,
prefix=prefix,
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
    address: str,
    prefix: str | Unset = UNSET,
    cursor: str | Unset = UNSET,
    limit: int | Unset = 50,

) -> ErrorResponse | ListAddressNotesResponse200 | None:
    """ List organization notes for an address

     Organization-scoped address annotations, independent of agents, routes and endpoints. Any bare
    address can have private notes. Function credentials may read org notes but cannot write or delete.
    A connected agent credential writes only its own address's notes and reads all of them; of another
    live agent's address in its organization it reads only the AGENT_WORKING, AGENT_RUNTIME and
    AGENT_INFO notes, and nothing of any other address. List and batch reads return only those notes;
    reading any other note name on another address returns 403, and one of those three names on an
    address that is not a live agent reads as not found. Use if_absent or if_version to avoid
    overwriting another writer.

    Args:
        address (str): Bare email address, normalized to lowercase. Plus tags are preserved.
        prefix (str | Unset):
        cursor (str | Unset): The name of the last note on the previous page, as meta.cursor gave
            it. Omit for the first page.
        limit (int | Unset):  Default: 50.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ListAddressNotesResponse200
     """


    return (await asyncio_detailed(
        client=client,
address=address,
prefix=prefix,
cursor=cursor,
limit=limit,

    )).parsed
