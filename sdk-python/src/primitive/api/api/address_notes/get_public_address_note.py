from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.get_public_address_note_response_200 import GetPublicAddressNoteResponse200
from typing import cast



def _get_kwargs(
    address: str,
    name: str,

) -> dict[str, Any]:
    

    

    

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/public/address-notes/{address}/{name}".format(address=quote(str(address), safe=""),name=quote(str(name), safe=""),),
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | GetPublicAddressNoteResponse200 | None:
    if response.status_code == 200:
        response_200 = GetPublicAddressNoteResponse200.from_dict(response.json())



        return response_200

    if response.status_code == 400:
        response_400 = ErrorResponse.from_dict(response.json())



        return response_400

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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | GetPublicAddressNoteResponse200]:
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

) -> Response[ErrorResponse | GetPublicAddressNoteResponse200]:
    """ Read a public address note

     Returns only explicitly public notes whose publisher currently owns an active verified domain for
    this address. Private, deleted and no-longer-controlled notes are hidden. Responses are not cached.

    Args:
        address (str): Bare email address, normalized to lowercase. Plus tags are preserved.
        name (str): Case-sensitive note name. AGENT_INFO, AGENT_USES and AGENT_RUNTIME (where the
            agent runs, e.g. its runtime, machine and working directory) are conventions, with no
            required value schema.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | GetPublicAddressNoteResponse200]
     """


    kwargs = _get_kwargs(
        address=address,
name=name,

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

) -> ErrorResponse | GetPublicAddressNoteResponse200 | None:
    """ Read a public address note

     Returns only explicitly public notes whose publisher currently owns an active verified domain for
    this address. Private, deleted and no-longer-controlled notes are hidden. Responses are not cached.

    Args:
        address (str): Bare email address, normalized to lowercase. Plus tags are preserved.
        name (str): Case-sensitive note name. AGENT_INFO, AGENT_USES and AGENT_RUNTIME (where the
            agent runs, e.g. its runtime, machine and working directory) are conventions, with no
            required value schema.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | GetPublicAddressNoteResponse200
     """


    return sync_detailed(
        address=address,
name=name,
client=client,

    ).parsed

async def asyncio_detailed(
    address: str,
    name: str,
    *,
    client: AuthenticatedClient | Client,

) -> Response[ErrorResponse | GetPublicAddressNoteResponse200]:
    """ Read a public address note

     Returns only explicitly public notes whose publisher currently owns an active verified domain for
    this address. Private, deleted and no-longer-controlled notes are hidden. Responses are not cached.

    Args:
        address (str): Bare email address, normalized to lowercase. Plus tags are preserved.
        name (str): Case-sensitive note name. AGENT_INFO, AGENT_USES and AGENT_RUNTIME (where the
            agent runs, e.g. its runtime, machine and working directory) are conventions, with no
            required value schema.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | GetPublicAddressNoteResponse200]
     """


    kwargs = _get_kwargs(
        address=address,
name=name,

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

) -> ErrorResponse | GetPublicAddressNoteResponse200 | None:
    """ Read a public address note

     Returns only explicitly public notes whose publisher currently owns an active verified domain for
    this address. Private, deleted and no-longer-controlled notes are hidden. Responses are not cached.

    Args:
        address (str): Bare email address, normalized to lowercase. Plus tags are preserved.
        name (str): Case-sensitive note name. AGENT_INFO, AGENT_USES and AGENT_RUNTIME (where the
            agent runs, e.g. its runtime, machine and working directory) are conventions, with no
            required value schema.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | GetPublicAddressNoteResponse200
     """


    return (await asyncio_detailed(
        address=address,
name=name,
client=client,

    )).parsed
