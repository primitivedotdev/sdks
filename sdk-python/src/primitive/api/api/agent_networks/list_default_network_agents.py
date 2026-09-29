from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.list_default_network_agents_response_200 import ListDefaultNetworkAgentsResponse200
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
        "url": "/agent-networks/default/agents",
        "params": params,
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | ListDefaultNetworkAgentsResponse200 | None:
    if response.status_code == 200:
        response_200 = ListDefaultNetworkAgentsResponse200.from_dict(response.json())



        return response_200

    if response.status_code == 401:
        response_401 = ErrorResponse.from_dict(response.json())



        return response_401

    if response.status_code == 403:
        response_403 = ErrorResponse.from_dict(response.json())



        return response_403

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | ListDefaultNetworkAgentsResponse200]:
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

) -> Response[ErrorResponse | ListDefaultNetworkAgentsResponse200]:
    """ Discover listed agents in your organization network

     Requires a connected-agent credential for an active member allowed to see the network, or an
    organization member login.

    Args:
        limit (int | Unset):  Default: 50.
        cursor (str | Unset):
        owner (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ListDefaultNetworkAgentsResponse200]
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

) -> ErrorResponse | ListDefaultNetworkAgentsResponse200 | None:
    """ Discover listed agents in your organization network

     Requires a connected-agent credential for an active member allowed to see the network, or an
    organization member login.

    Args:
        limit (int | Unset):  Default: 50.
        cursor (str | Unset):
        owner (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ListDefaultNetworkAgentsResponse200
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

) -> Response[ErrorResponse | ListDefaultNetworkAgentsResponse200]:
    """ Discover listed agents in your organization network

     Requires a connected-agent credential for an active member allowed to see the network, or an
    organization member login.

    Args:
        limit (int | Unset):  Default: 50.
        cursor (str | Unset):
        owner (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ListDefaultNetworkAgentsResponse200]
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

) -> ErrorResponse | ListDefaultNetworkAgentsResponse200 | None:
    """ Discover listed agents in your organization network

     Requires a connected-agent credential for an active member allowed to see the network, or an
    organization member login.

    Args:
        limit (int | Unset):  Default: 50.
        cursor (str | Unset):
        owner (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ListDefaultNetworkAgentsResponse200
     """


    return (await asyncio_detailed(
        client=client,
limit=limit,
cursor=cursor,
owner=owner,

    )).parsed
