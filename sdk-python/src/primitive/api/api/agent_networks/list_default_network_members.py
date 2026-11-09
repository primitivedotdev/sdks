from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.list_default_network_members_response_200 import ListDefaultNetworkMembersResponse200
from ...types import UNSET, Unset
from typing import cast



def _get_kwargs(
    *,
    limit: int | Unset = 50,
    cursor: str | Unset = UNSET,
    owner: str | Unset = UNSET,

) -> dict[str, Any]:




    params: dict[str, Any] = {}

    params["limit"] = limit

    params["cursor"] = cursor

    params["owner"] = owner


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/agent-networks/default/members",
        "params": params,
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | ListDefaultNetworkMembersResponse200 | None:
    if response.status_code == 200:
        response_200 = ListDefaultNetworkMembersResponse200.from_dict(response.json())



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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | ListDefaultNetworkMembersResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    limit: int | Unset = 50,
    cursor: str | Unset = UNSET,
    owner: str | Unset = UNSET,

) -> Response[ErrorResponse | ListDefaultNetworkMembersResponse200]:
    """ list Default Network Members

     Current owner or admin sees all connected addresses. A human member sees only personal addresses
    owned by their current membership, filtered before pagination. Rows include can_manage, current
    human owner identity, independent can_view and is_listed controls, durable exclusions, and last
    recorded API activity. Excluded rows are retained. Optional owner search matches user ID, display
    name or email before pagination within the authorized scope.

    Args:
        limit (int | Unset):  Default: 50.
        cursor (str | Unset):
        owner (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ListDefaultNetworkMembersResponse200]
     """


    kwargs = _get_kwargs(
        limit=limit,
cursor=cursor,
owner=owner,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    *,
    client: AuthenticatedClient | Client,
    limit: int | Unset = 50,
    cursor: str | Unset = UNSET,
    owner: str | Unset = UNSET,

) -> ErrorResponse | ListDefaultNetworkMembersResponse200 | None:
    """ list Default Network Members

     Current owner or admin sees all connected addresses. A human member sees only personal addresses
    owned by their current membership, filtered before pagination. Rows include can_manage, current
    human owner identity, independent can_view and is_listed controls, durable exclusions, and last
    recorded API activity. Excluded rows are retained. Optional owner search matches user ID, display
    name or email before pagination within the authorized scope.

    Args:
        limit (int | Unset):  Default: 50.
        cursor (str | Unset):
        owner (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ListDefaultNetworkMembersResponse200
     """


    return sync_detailed(
        client=client,
limit=limit,
cursor=cursor,
owner=owner,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    limit: int | Unset = 50,
    cursor: str | Unset = UNSET,
    owner: str | Unset = UNSET,

) -> Response[ErrorResponse | ListDefaultNetworkMembersResponse200]:
    """ list Default Network Members

     Current owner or admin sees all connected addresses. A human member sees only personal addresses
    owned by their current membership, filtered before pagination. Rows include can_manage, current
    human owner identity, independent can_view and is_listed controls, durable exclusions, and last
    recorded API activity. Excluded rows are retained. Optional owner search matches user ID, display
    name or email before pagination within the authorized scope.

    Args:
        limit (int | Unset):  Default: 50.
        cursor (str | Unset):
        owner (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ListDefaultNetworkMembersResponse200]
     """


    kwargs = _get_kwargs(
        limit=limit,
cursor=cursor,
owner=owner,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    limit: int | Unset = 50,
    cursor: str | Unset = UNSET,
    owner: str | Unset = UNSET,

) -> ErrorResponse | ListDefaultNetworkMembersResponse200 | None:
    """ list Default Network Members

     Current owner or admin sees all connected addresses. A human member sees only personal addresses
    owned by their current membership, filtered before pagination. Rows include can_manage, current
    human owner identity, independent can_view and is_listed controls, durable exclusions, and last
    recorded API activity. Excluded rows are retained. Optional owner search matches user ID, display
    name or email before pagination within the authorized scope.

    Args:
        limit (int | Unset):  Default: 50.
        cursor (str | Unset):
        owner (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ListDefaultNetworkMembersResponse200
     """


    return (await asyncio_detailed(
        client=client,
limit=limit,
cursor=cursor,
owner=owner,

    )).parsed
