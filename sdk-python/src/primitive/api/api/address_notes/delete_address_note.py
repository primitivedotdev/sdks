from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.delete_address_note_response_200 import DeleteAddressNoteResponse200
from ...models.error_response import ErrorResponse
from ...types import UNSET, Unset
from typing import cast



def _get_kwargs(
    address: str,
    name: str,
    *,
    if_version: str | Unset = UNSET,

) -> dict[str, Any]:
    

    

    params: dict[str, Any] = {}

    params["if_version"] = if_version


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "delete",
        "url": "/address-notes/{address}/{name}".format(address=quote(str(address), safe=""),name=quote(str(name), safe=""),),
        "params": params,
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> DeleteAddressNoteResponse200 | ErrorResponse | None:
    if response.status_code == 200:
        response_200 = DeleteAddressNoteResponse200.from_dict(response.json())



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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[DeleteAddressNoteResponse200 | ErrorResponse]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    address: str,
    name: str,
    *,
    client: AuthenticatedClient | Client,
    if_version: str | Unset = UNSET,

) -> Response[DeleteAddressNoteResponse200 | ErrorResponse]:
    """ Delete an organization address note

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
        name (str): Case-sensitive note name. AGENT_INFO, AGENT_USES and AGENT_RUNTIME (where the
            agent runs, e.g. its runtime, machine and working directory) are conventions, with no
            required value schema.
        if_version (str | Unset): Monotonic version for this org, address and name, including
            deletion and recreation.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[DeleteAddressNoteResponse200 | ErrorResponse]
     """


    kwargs = _get_kwargs(
        address=address,
name=name,
if_version=if_version,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    address: str,
    name: str,
    *,
    client: AuthenticatedClient | Client,
    if_version: str | Unset = UNSET,

) -> DeleteAddressNoteResponse200 | ErrorResponse | None:
    """ Delete an organization address note

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
        name (str): Case-sensitive note name. AGENT_INFO, AGENT_USES and AGENT_RUNTIME (where the
            agent runs, e.g. its runtime, machine and working directory) are conventions, with no
            required value schema.
        if_version (str | Unset): Monotonic version for this org, address and name, including
            deletion and recreation.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        DeleteAddressNoteResponse200 | ErrorResponse
     """


    return sync_detailed(
        address=address,
name=name,
client=client,
if_version=if_version,

    ).parsed

async def asyncio_detailed(
    address: str,
    name: str,
    *,
    client: AuthenticatedClient | Client,
    if_version: str | Unset = UNSET,

) -> Response[DeleteAddressNoteResponse200 | ErrorResponse]:
    """ Delete an organization address note

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
        name (str): Case-sensitive note name. AGENT_INFO, AGENT_USES and AGENT_RUNTIME (where the
            agent runs, e.g. its runtime, machine and working directory) are conventions, with no
            required value schema.
        if_version (str | Unset): Monotonic version for this org, address and name, including
            deletion and recreation.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[DeleteAddressNoteResponse200 | ErrorResponse]
     """


    kwargs = _get_kwargs(
        address=address,
name=name,
if_version=if_version,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    address: str,
    name: str,
    *,
    client: AuthenticatedClient | Client,
    if_version: str | Unset = UNSET,

) -> DeleteAddressNoteResponse200 | ErrorResponse | None:
    """ Delete an organization address note

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
        name (str): Case-sensitive note name. AGENT_INFO, AGENT_USES and AGENT_RUNTIME (where the
            agent runs, e.g. its runtime, machine and working directory) are conventions, with no
            required value schema.
        if_version (str | Unset): Monotonic version for this org, address and name, including
            deletion and recreation.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        DeleteAddressNoteResponse200 | ErrorResponse
     """


    return (await asyncio_detailed(
        address=address,
name=name,
client=client,
if_version=if_version,

    )).parsed
