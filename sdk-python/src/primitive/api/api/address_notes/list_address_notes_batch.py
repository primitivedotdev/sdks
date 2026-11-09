from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.list_address_notes_batch_network import ListAddressNotesBatchNetwork
from ...models.list_address_notes_batch_response_200 import ListAddressNotesBatchResponse200
from ...types import UNSET, Unset
from typing import cast



def _get_kwargs(
    *,
    addresses: str | Unset = UNSET,
    network: ListAddressNotesBatchNetwork | Unset = UNSET,
    names: str | Unset = UNSET,
    cursor: str | Unset = UNSET,
    limit: int | Unset = 100,

) -> dict[str, Any]:
    

    

    params: dict[str, Any] = {}

    params["addresses"] = addresses

    json_network: str | Unset = UNSET
    if not isinstance(network, Unset):
        json_network = network.value

    params["network"] = json_network

    params["names"] = names

    params["cursor"] = cursor

    params["limit"] = limit


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/address-notes/batch",
        "params": params,
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | ListAddressNotesBatchResponse200 | None:
    if response.status_code == 200:
        response_200 = ListAddressNotesBatchResponse200.from_dict(response.json())



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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | ListAddressNotesBatchResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    addresses: str | Unset = UNSET,
    network: ListAddressNotesBatchNetwork | Unset = UNSET,
    names: str | Unset = UNSET,
    cursor: str | Unset = UNSET,
    limit: int | Unset = 100,

) -> Response[ErrorResponse | ListAddressNotesBatchResponse200]:
    """ List organization notes for many addresses

     One read of this organization's live notes for many addresses, with the same scope as
    listAddressNotes: private and public notes the organization wrote, never another organization's.
    Notes are ordered by address, then name, and paged with an opaque keyset cursor; meta.cursor is null
    on the last page. Addresses with no notes are absent. Compare updated_at or version to find changed
    notes; a note missing from a complete read was deleted. Function credentials may use addresses but
    not network.

    Args:
        addresses (str | Unset): Comma-separated bare addresses, at most 100, each normalized like
            address. Duplicates are ignored. Exactly one of addresses or network is required.
        network (ListAddressNotesBatchNetwork | Unset): Read notes for every agent in the default
            network directory, as GET /agent-networks/default/agents shows it to this caller: a
            signed-in organization member sees every listed agent, and a connected agent needs
            can_view, does not see itself and gets only AGENT_WORKING, AGENT_RUNTIME and AGENT_INFO
            notes. Other credentials receive 403. Exactly one of addresses or network is required.
        names (str | Unset): Comma-separated note names to return, at most 20, for example
            AGENT_INFO,AGENT_RUNTIME. Omit for every note.
        cursor (str | Unset): Opaque value from meta.cursor of the previous page.
        limit (int | Unset): Notes per page. Default: 100.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ListAddressNotesBatchResponse200]
     """


    kwargs = _get_kwargs(
        addresses=addresses,
network=network,
names=names,
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
    addresses: str | Unset = UNSET,
    network: ListAddressNotesBatchNetwork | Unset = UNSET,
    names: str | Unset = UNSET,
    cursor: str | Unset = UNSET,
    limit: int | Unset = 100,

) -> ErrorResponse | ListAddressNotesBatchResponse200 | None:
    """ List organization notes for many addresses

     One read of this organization's live notes for many addresses, with the same scope as
    listAddressNotes: private and public notes the organization wrote, never another organization's.
    Notes are ordered by address, then name, and paged with an opaque keyset cursor; meta.cursor is null
    on the last page. Addresses with no notes are absent. Compare updated_at or version to find changed
    notes; a note missing from a complete read was deleted. Function credentials may use addresses but
    not network.

    Args:
        addresses (str | Unset): Comma-separated bare addresses, at most 100, each normalized like
            address. Duplicates are ignored. Exactly one of addresses or network is required.
        network (ListAddressNotesBatchNetwork | Unset): Read notes for every agent in the default
            network directory, as GET /agent-networks/default/agents shows it to this caller: a
            signed-in organization member sees every listed agent, and a connected agent needs
            can_view, does not see itself and gets only AGENT_WORKING, AGENT_RUNTIME and AGENT_INFO
            notes. Other credentials receive 403. Exactly one of addresses or network is required.
        names (str | Unset): Comma-separated note names to return, at most 20, for example
            AGENT_INFO,AGENT_RUNTIME. Omit for every note.
        cursor (str | Unset): Opaque value from meta.cursor of the previous page.
        limit (int | Unset): Notes per page. Default: 100.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ListAddressNotesBatchResponse200
     """


    return sync_detailed(
        client=client,
addresses=addresses,
network=network,
names=names,
cursor=cursor,
limit=limit,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    addresses: str | Unset = UNSET,
    network: ListAddressNotesBatchNetwork | Unset = UNSET,
    names: str | Unset = UNSET,
    cursor: str | Unset = UNSET,
    limit: int | Unset = 100,

) -> Response[ErrorResponse | ListAddressNotesBatchResponse200]:
    """ List organization notes for many addresses

     One read of this organization's live notes for many addresses, with the same scope as
    listAddressNotes: private and public notes the organization wrote, never another organization's.
    Notes are ordered by address, then name, and paged with an opaque keyset cursor; meta.cursor is null
    on the last page. Addresses with no notes are absent. Compare updated_at or version to find changed
    notes; a note missing from a complete read was deleted. Function credentials may use addresses but
    not network.

    Args:
        addresses (str | Unset): Comma-separated bare addresses, at most 100, each normalized like
            address. Duplicates are ignored. Exactly one of addresses or network is required.
        network (ListAddressNotesBatchNetwork | Unset): Read notes for every agent in the default
            network directory, as GET /agent-networks/default/agents shows it to this caller: a
            signed-in organization member sees every listed agent, and a connected agent needs
            can_view, does not see itself and gets only AGENT_WORKING, AGENT_RUNTIME and AGENT_INFO
            notes. Other credentials receive 403. Exactly one of addresses or network is required.
        names (str | Unset): Comma-separated note names to return, at most 20, for example
            AGENT_INFO,AGENT_RUNTIME. Omit for every note.
        cursor (str | Unset): Opaque value from meta.cursor of the previous page.
        limit (int | Unset): Notes per page. Default: 100.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ListAddressNotesBatchResponse200]
     """


    kwargs = _get_kwargs(
        addresses=addresses,
network=network,
names=names,
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
    addresses: str | Unset = UNSET,
    network: ListAddressNotesBatchNetwork | Unset = UNSET,
    names: str | Unset = UNSET,
    cursor: str | Unset = UNSET,
    limit: int | Unset = 100,

) -> ErrorResponse | ListAddressNotesBatchResponse200 | None:
    """ List organization notes for many addresses

     One read of this organization's live notes for many addresses, with the same scope as
    listAddressNotes: private and public notes the organization wrote, never another organization's.
    Notes are ordered by address, then name, and paged with an opaque keyset cursor; meta.cursor is null
    on the last page. Addresses with no notes are absent. Compare updated_at or version to find changed
    notes; a note missing from a complete read was deleted. Function credentials may use addresses but
    not network.

    Args:
        addresses (str | Unset): Comma-separated bare addresses, at most 100, each normalized like
            address. Duplicates are ignored. Exactly one of addresses or network is required.
        network (ListAddressNotesBatchNetwork | Unset): Read notes for every agent in the default
            network directory, as GET /agent-networks/default/agents shows it to this caller: a
            signed-in organization member sees every listed agent, and a connected agent needs
            can_view, does not see itself and gets only AGENT_WORKING, AGENT_RUNTIME and AGENT_INFO
            notes. Other credentials receive 403. Exactly one of addresses or network is required.
        names (str | Unset): Comma-separated note names to return, at most 20, for example
            AGENT_INFO,AGENT_RUNTIME. Omit for every note.
        cursor (str | Unset): Opaque value from meta.cursor of the previous page.
        limit (int | Unset): Notes per page. Default: 100.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ListAddressNotesBatchResponse200
     """


    return (await asyncio_detailed(
        client=client,
addresses=addresses,
network=network,
names=names,
cursor=cursor,
limit=limit,

    )).parsed
