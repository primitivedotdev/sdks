from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.put_address_note_request import PutAddressNoteRequest
from ...models.put_address_note_response_200 import PutAddressNoteResponse200
from typing import cast



def _get_kwargs(
    address: str,
    name: str,
    *,
    body: PutAddressNoteRequest,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "put",
        "url": "/address-notes/{address}/{name}".format(address=quote(str(address), safe=""),name=quote(str(name), safe=""),),
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | PutAddressNoteResponse200 | None:
    if response.status_code == 200:
        response_200 = PutAddressNoteResponse200.from_dict(response.json())



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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | PutAddressNoteResponse200]:
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
    body: PutAddressNoteRequest,

) -> Response[ErrorResponse | PutAddressNoteResponse200]:
    """ Create or update an address note

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
        body (PutAddressNoteRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | PutAddressNoteResponse200]
     """


    kwargs = _get_kwargs(
        address=address,
name=name,
body=body,

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
    body: PutAddressNoteRequest,

) -> ErrorResponse | PutAddressNoteResponse200 | None:
    """ Create or update an address note

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
        body (PutAddressNoteRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | PutAddressNoteResponse200
     """


    return sync_detailed(
        address=address,
name=name,
client=client,
body=body,

    ).parsed

async def asyncio_detailed(
    address: str,
    name: str,
    *,
    client: AuthenticatedClient | Client,
    body: PutAddressNoteRequest,

) -> Response[ErrorResponse | PutAddressNoteResponse200]:
    """ Create or update an address note

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
        body (PutAddressNoteRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | PutAddressNoteResponse200]
     """


    kwargs = _get_kwargs(
        address=address,
name=name,
body=body,

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
    body: PutAddressNoteRequest,

) -> ErrorResponse | PutAddressNoteResponse200 | None:
    """ Create or update an address note

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
        body (PutAddressNoteRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | PutAddressNoteResponse200
     """


    return (await asyncio_detailed(
        address=address,
name=name,
client=client,
body=body,

    )).parsed
