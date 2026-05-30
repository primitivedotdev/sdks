from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.get_org_routing_topology_response_200 import GetOrgRoutingTopologyResponse200
from typing import cast



def _get_kwargs(
    
) -> dict[str, Any]:
    

    

    

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/functions/routing-topology",
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | GetOrgRoutingTopologyResponse200 | None:
    if response.status_code == 200:
        response_200 = GetOrgRoutingTopologyResponse200.from_dict(response.json())



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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | GetOrgRoutingTopologyResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,

) -> Response[ErrorResponse | GetOrgRoutingTopologyResponse200]:
    r""" Get the org's function routing topology

     Returns a single snapshot of how inbound mail is routed across
    this org's active domains and functions: which active domain has
    which function bound, the org's fallback function (if any), and
    every deployed function with no route bound. Use this to answer
    \"which of my functions actually receive mail?\" diagnostically.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | GetOrgRoutingTopologyResponse200]
     """


    kwargs = _get_kwargs(
        
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    *,
    client: AuthenticatedClient | Client,

) -> ErrorResponse | GetOrgRoutingTopologyResponse200 | None:
    r""" Get the org's function routing topology

     Returns a single snapshot of how inbound mail is routed across
    this org's active domains and functions: which active domain has
    which function bound, the org's fallback function (if any), and
    every deployed function with no route bound. Use this to answer
    \"which of my functions actually receive mail?\" diagnostically.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | GetOrgRoutingTopologyResponse200
     """


    return sync_detailed(
        client=client,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,

) -> Response[ErrorResponse | GetOrgRoutingTopologyResponse200]:
    r""" Get the org's function routing topology

     Returns a single snapshot of how inbound mail is routed across
    this org's active domains and functions: which active domain has
    which function bound, the org's fallback function (if any), and
    every deployed function with no route bound. Use this to answer
    \"which of my functions actually receive mail?\" diagnostically.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | GetOrgRoutingTopologyResponse200]
     """


    kwargs = _get_kwargs(
        
    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    *,
    client: AuthenticatedClient | Client,

) -> ErrorResponse | GetOrgRoutingTopologyResponse200 | None:
    r""" Get the org's function routing topology

     Returns a single snapshot of how inbound mail is routed across
    this org's active domains and functions: which active domain has
    which function bound, the org's fallback function (if any), and
    every deployed function with no route bound. Use this to answer
    \"which of my functions actually receive mail?\" diagnostically.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | GetOrgRoutingTopologyResponse200
     """


    return (await asyncio_detailed(
        client=client,

    )).parsed
