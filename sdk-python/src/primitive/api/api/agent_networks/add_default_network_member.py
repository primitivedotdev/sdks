from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.add_default_network_member_response_200 import AddDefaultNetworkMemberResponse200
from ...models.error_response import ErrorResponse
from typing import cast



def _get_kwargs(
    address: str,

) -> dict[str, Any]:
    

    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/agent-networks/default/members/{address}".format(address=quote(str(address), safe=""),),
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> AddDefaultNetworkMemberResponse200 | ErrorResponse | None:
    if response.status_code == 200:
        response_200 = AddDefaultNetworkMemberResponse200.from_dict(response.json())



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

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[AddDefaultNetworkMemberResponse200 | ErrorResponse]:
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

) -> Response[AddDefaultNetworkMemberResponse200 | ErrorResponse]:
    """ Add an agent to the default network

     Owner or admin login required. Restores an explicitly excluded member.

    Args:
        address (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[AddDefaultNetworkMemberResponse200 | ErrorResponse]
     """


    kwargs = _get_kwargs(
        address=address,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    address: str,
    *,
    client: AuthenticatedClient | Client,

) -> AddDefaultNetworkMemberResponse200 | ErrorResponse | None:
    """ Add an agent to the default network

     Owner or admin login required. Restores an explicitly excluded member.

    Args:
        address (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        AddDefaultNetworkMemberResponse200 | ErrorResponse
     """


    return sync_detailed(
        address=address,
client=client,

    ).parsed

async def asyncio_detailed(
    address: str,
    *,
    client: AuthenticatedClient | Client,

) -> Response[AddDefaultNetworkMemberResponse200 | ErrorResponse]:
    """ Add an agent to the default network

     Owner or admin login required. Restores an explicitly excluded member.

    Args:
        address (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[AddDefaultNetworkMemberResponse200 | ErrorResponse]
     """


    kwargs = _get_kwargs(
        address=address,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    address: str,
    *,
    client: AuthenticatedClient | Client,

) -> AddDefaultNetworkMemberResponse200 | ErrorResponse | None:
    """ Add an agent to the default network

     Owner or admin login required. Restores an explicitly excluded member.

    Args:
        address (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        AddDefaultNetworkMemberResponse200 | ErrorResponse
     """


    return (await asyncio_detailed(
        address=address,
client=client,

    )).parsed
