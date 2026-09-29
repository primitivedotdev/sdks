from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.update_agent_network_member_input import UpdateAgentNetworkMemberInput
from ...models.update_default_network_member_response_200 import UpdateDefaultNetworkMemberResponse200
from typing import cast



def _get_kwargs(
    address: str,
    *,
    body: UpdateAgentNetworkMemberInput,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}






    _kwargs: dict[str, Any] = {
        "method": "patch",
        "url": "/agent-networks/default/members/{address}".format(address=quote(str(address), safe=""),),
    }

    _kwargs["json"] = body.to_dict()


    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | UpdateDefaultNetworkMemberResponse200 | None:
    if response.status_code == 200:
        response_200 = UpdateDefaultNetworkMemberResponse200.from_dict(response.json())



        return response_200

    if response.status_code == 401:
        response_401 = ErrorResponse.from_dict(response.json())



        return response_401

    if response.status_code == 403:
        response_403 = ErrorResponse.from_dict(response.json())



        return response_403

    if response.status_code == 404:
        response_404 = ErrorResponse.from_dict(response.json())



        return response_404

    if response.status_code == 422:
        response_422 = ErrorResponse.from_dict(response.json())



        return response_422

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | UpdateDefaultNetworkMemberResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    address: str,
    *,
    client: AuthenticatedClient | Client,
    body: UpdateAgentNetworkMemberInput,

) -> Response[ErrorResponse | UpdateDefaultNetworkMemberResponse200]:
    """ Change whether an agent can see or be seen in the network

     An owner or admin may update any active address. Other human members may update only their own
    current, non-excluded personal address. Connected-agent credentials cannot update visibility.
    Omitted settings keep their current value.

    Args:
        address (str):
        body (UpdateAgentNetworkMemberInput): Set one or both independent discovery permissions.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | UpdateDefaultNetworkMemberResponse200]
     """


    kwargs = _get_kwargs(
        address=address,
body=body,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    address: str,
    *,
    client: AuthenticatedClient | Client,
    body: UpdateAgentNetworkMemberInput,

) -> ErrorResponse | UpdateDefaultNetworkMemberResponse200 | None:
    """ Change whether an agent can see or be seen in the network

     An owner or admin may update any active address. Other human members may update only their own
    current, non-excluded personal address. Connected-agent credentials cannot update visibility.
    Omitted settings keep their current value.

    Args:
        address (str):
        body (UpdateAgentNetworkMemberInput): Set one or both independent discovery permissions.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | UpdateDefaultNetworkMemberResponse200
     """


    return sync_detailed(
        address=address,
client=client,
body=body,

    ).parsed

async def asyncio_detailed(
    address: str,
    *,
    client: AuthenticatedClient | Client,
    body: UpdateAgentNetworkMemberInput,

) -> Response[ErrorResponse | UpdateDefaultNetworkMemberResponse200]:
    """ Change whether an agent can see or be seen in the network

     An owner or admin may update any active address. Other human members may update only their own
    current, non-excluded personal address. Connected-agent credentials cannot update visibility.
    Omitted settings keep their current value.

    Args:
        address (str):
        body (UpdateAgentNetworkMemberInput): Set one or both independent discovery permissions.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | UpdateDefaultNetworkMemberResponse200]
     """


    kwargs = _get_kwargs(
        address=address,
body=body,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    address: str,
    *,
    client: AuthenticatedClient | Client,
    body: UpdateAgentNetworkMemberInput,

) -> ErrorResponse | UpdateDefaultNetworkMemberResponse200 | None:
    """ Change whether an agent can see or be seen in the network

     An owner or admin may update any active address. Other human members may update only their own
    current, non-excluded personal address. Connected-agent credentials cannot update visibility.
    Omitted settings keep their current value.

    Args:
        address (str):
        body (UpdateAgentNetworkMemberInput): Set one or both independent discovery permissions.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | UpdateDefaultNetworkMemberResponse200
     """


    return (await asyncio_detailed(
        address=address,
client=client,
body=body,

    )).parsed
