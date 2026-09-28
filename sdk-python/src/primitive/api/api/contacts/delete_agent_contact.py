from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.delete_agent_contact_response_200 import DeleteAgentContactResponse200
from ...models.error_response import ErrorResponse
from typing import cast
from uuid import UUID



def _get_kwargs(
    agent_address: str,
    contact_address: str,
    *,
    if_version: UUID,

) -> dict[str, Any]:
    

    

    params: dict[str, Any] = {}

    json_if_version = str(if_version)
    params["if_version"] = json_if_version


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "delete",
        "url": "/agent-contacts/{agent_address}/{contact_address}".format(agent_address=quote(str(agent_address), safe=""),contact_address=quote(str(contact_address), safe=""),),
        "params": params,
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> DeleteAgentContactResponse200 | ErrorResponse | None:
    if response.status_code == 200:
        response_200 = DeleteAgentContactResponse200.from_dict(response.json())



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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[DeleteAgentContactResponse200 | ErrorResponse]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    agent_address: str,
    contact_address: str,
    *,
    client: AuthenticatedClient,
    if_version: UUID,

) -> Response[DeleteAgentContactResponse200 | ErrorResponse]:
    """ delete Agent Contact

     Organization directory and agent preferences; no profiles, message history or runtime presence.
    Existing organization credentials use tenant permissions. Connected keys may read the directory,
    create address-only missing contacts using if_absent:true, and access only their own agent
    memberships; they cannot edit shared labels or delete directory entries. Function credentials are
    not granted access. Memberships require an existing local agent connection (including revoked
    connections) and an existing contact. PUT requires exactly one precondition. if_absent returns an
    existing row unchanged when supplied fields agree; otherwise 409. notify defaults false. Off-to-on
    generates a new server timestamp and generation; on-to-on and purpose-only edits preserve them.
    Disable clears activation metadata. Deletion atomically removes membership eligibility. Receivers
    must recheck generation/preferences before dispatch and pause admission when their policy cache is
    older than 30 seconds; explicit reply waits are independent. DELETE requires if_version, returns
    deleted:false for an absent row, and rejects stale versions of recreated rows. Pages use ascending
    canonical address, with meta.cursor null on the last page. Lists are live pages, not snapshots.

    Args:
        agent_address (str): Bare email address; trim and lowercase, preserving dots and plus
            tags.
        contact_address (str): Bare email address; trim and lowercase, preserving dots and plus
            tags.
        if_version (UUID): Opaque CAS token. Changes on mutations and cannot be reused after
            deletion/recreation.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[DeleteAgentContactResponse200 | ErrorResponse]
     """


    kwargs = _get_kwargs(
        agent_address=agent_address,
contact_address=contact_address,
if_version=if_version,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    agent_address: str,
    contact_address: str,
    *,
    client: AuthenticatedClient,
    if_version: UUID,

) -> DeleteAgentContactResponse200 | ErrorResponse | None:
    """ delete Agent Contact

     Organization directory and agent preferences; no profiles, message history or runtime presence.
    Existing organization credentials use tenant permissions. Connected keys may read the directory,
    create address-only missing contacts using if_absent:true, and access only their own agent
    memberships; they cannot edit shared labels or delete directory entries. Function credentials are
    not granted access. Memberships require an existing local agent connection (including revoked
    connections) and an existing contact. PUT requires exactly one precondition. if_absent returns an
    existing row unchanged when supplied fields agree; otherwise 409. notify defaults false. Off-to-on
    generates a new server timestamp and generation; on-to-on and purpose-only edits preserve them.
    Disable clears activation metadata. Deletion atomically removes membership eligibility. Receivers
    must recheck generation/preferences before dispatch and pause admission when their policy cache is
    older than 30 seconds; explicit reply waits are independent. DELETE requires if_version, returns
    deleted:false for an absent row, and rejects stale versions of recreated rows. Pages use ascending
    canonical address, with meta.cursor null on the last page. Lists are live pages, not snapshots.

    Args:
        agent_address (str): Bare email address; trim and lowercase, preserving dots and plus
            tags.
        contact_address (str): Bare email address; trim and lowercase, preserving dots and plus
            tags.
        if_version (UUID): Opaque CAS token. Changes on mutations and cannot be reused after
            deletion/recreation.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        DeleteAgentContactResponse200 | ErrorResponse
     """


    return sync_detailed(
        agent_address=agent_address,
contact_address=contact_address,
client=client,
if_version=if_version,

    ).parsed

async def asyncio_detailed(
    agent_address: str,
    contact_address: str,
    *,
    client: AuthenticatedClient,
    if_version: UUID,

) -> Response[DeleteAgentContactResponse200 | ErrorResponse]:
    """ delete Agent Contact

     Organization directory and agent preferences; no profiles, message history or runtime presence.
    Existing organization credentials use tenant permissions. Connected keys may read the directory,
    create address-only missing contacts using if_absent:true, and access only their own agent
    memberships; they cannot edit shared labels or delete directory entries. Function credentials are
    not granted access. Memberships require an existing local agent connection (including revoked
    connections) and an existing contact. PUT requires exactly one precondition. if_absent returns an
    existing row unchanged when supplied fields agree; otherwise 409. notify defaults false. Off-to-on
    generates a new server timestamp and generation; on-to-on and purpose-only edits preserve them.
    Disable clears activation metadata. Deletion atomically removes membership eligibility. Receivers
    must recheck generation/preferences before dispatch and pause admission when their policy cache is
    older than 30 seconds; explicit reply waits are independent. DELETE requires if_version, returns
    deleted:false for an absent row, and rejects stale versions of recreated rows. Pages use ascending
    canonical address, with meta.cursor null on the last page. Lists are live pages, not snapshots.

    Args:
        agent_address (str): Bare email address; trim and lowercase, preserving dots and plus
            tags.
        contact_address (str): Bare email address; trim and lowercase, preserving dots and plus
            tags.
        if_version (UUID): Opaque CAS token. Changes on mutations and cannot be reused after
            deletion/recreation.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[DeleteAgentContactResponse200 | ErrorResponse]
     """


    kwargs = _get_kwargs(
        agent_address=agent_address,
contact_address=contact_address,
if_version=if_version,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    agent_address: str,
    contact_address: str,
    *,
    client: AuthenticatedClient,
    if_version: UUID,

) -> DeleteAgentContactResponse200 | ErrorResponse | None:
    """ delete Agent Contact

     Organization directory and agent preferences; no profiles, message history or runtime presence.
    Existing organization credentials use tenant permissions. Connected keys may read the directory,
    create address-only missing contacts using if_absent:true, and access only their own agent
    memberships; they cannot edit shared labels or delete directory entries. Function credentials are
    not granted access. Memberships require an existing local agent connection (including revoked
    connections) and an existing contact. PUT requires exactly one precondition. if_absent returns an
    existing row unchanged when supplied fields agree; otherwise 409. notify defaults false. Off-to-on
    generates a new server timestamp and generation; on-to-on and purpose-only edits preserve them.
    Disable clears activation metadata. Deletion atomically removes membership eligibility. Receivers
    must recheck generation/preferences before dispatch and pause admission when their policy cache is
    older than 30 seconds; explicit reply waits are independent. DELETE requires if_version, returns
    deleted:false for an absent row, and rejects stale versions of recreated rows. Pages use ascending
    canonical address, with meta.cursor null on the last page. Lists are live pages, not snapshots.

    Args:
        agent_address (str): Bare email address; trim and lowercase, preserving dots and plus
            tags.
        contact_address (str): Bare email address; trim and lowercase, preserving dots and plus
            tags.
        if_version (UUID): Opaque CAS token. Changes on mutations and cannot be reused after
            deletion/recreation.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        DeleteAgentContactResponse200 | ErrorResponse
     """


    return (await asyncio_detailed(
        agent_address=agent_address,
contact_address=contact_address,
client=client,
if_version=if_version,

    )).parsed
