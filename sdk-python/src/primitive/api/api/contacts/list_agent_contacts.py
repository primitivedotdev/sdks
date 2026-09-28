from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.list_agent_contacts_response_200 import ListAgentContactsResponse200
from ...types import UNSET, Unset
from typing import cast



def _get_kwargs(
    agent_address: str,
    *,
    cursor: str | Unset = UNSET,
    limit: int | Unset = 50,

) -> dict[str, Any]:
    

    

    params: dict[str, Any] = {}

    params["cursor"] = cursor

    params["limit"] = limit


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/agent-contacts/{agent_address}".format(agent_address=quote(str(agent_address), safe=""),),
        "params": params,
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | ListAgentContactsResponse200 | None:
    if response.status_code == 200:
        response_200 = ListAgentContactsResponse200.from_dict(response.json())



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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | ListAgentContactsResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    agent_address: str,
    *,
    client: AuthenticatedClient,
    cursor: str | Unset = UNSET,
    limit: int | Unset = 50,

) -> Response[ErrorResponse | ListAgentContactsResponse200]:
    """ list Agent Contacts

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
        cursor (str | Unset): Bare email address; trim and lowercase, preserving dots and plus
            tags.
        limit (int | Unset):  Default: 50.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ListAgentContactsResponse200]
     """


    kwargs = _get_kwargs(
        agent_address=agent_address,
cursor=cursor,
limit=limit,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    agent_address: str,
    *,
    client: AuthenticatedClient,
    cursor: str | Unset = UNSET,
    limit: int | Unset = 50,

) -> ErrorResponse | ListAgentContactsResponse200 | None:
    """ list Agent Contacts

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
        cursor (str | Unset): Bare email address; trim and lowercase, preserving dots and plus
            tags.
        limit (int | Unset):  Default: 50.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ListAgentContactsResponse200
     """


    return sync_detailed(
        agent_address=agent_address,
client=client,
cursor=cursor,
limit=limit,

    ).parsed

async def asyncio_detailed(
    agent_address: str,
    *,
    client: AuthenticatedClient,
    cursor: str | Unset = UNSET,
    limit: int | Unset = 50,

) -> Response[ErrorResponse | ListAgentContactsResponse200]:
    """ list Agent Contacts

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
        cursor (str | Unset): Bare email address; trim and lowercase, preserving dots and plus
            tags.
        limit (int | Unset):  Default: 50.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ListAgentContactsResponse200]
     """


    kwargs = _get_kwargs(
        agent_address=agent_address,
cursor=cursor,
limit=limit,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    agent_address: str,
    *,
    client: AuthenticatedClient,
    cursor: str | Unset = UNSET,
    limit: int | Unset = 50,

) -> ErrorResponse | ListAgentContactsResponse200 | None:
    """ list Agent Contacts

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
        cursor (str | Unset): Bare email address; trim and lowercase, preserving dots and plus
            tags.
        limit (int | Unset):  Default: 50.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ListAgentContactsResponse200
     """


    return (await asyncio_detailed(
        agent_address=agent_address,
client=client,
cursor=cursor,
limit=limit,

    )).parsed
