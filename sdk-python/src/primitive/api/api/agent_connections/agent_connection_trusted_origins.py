from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.agent_connection_trusted_origins_response_200 import AgentConnectionTrustedOriginsResponse200
from typing import cast



def _get_kwargs(

) -> dict[str, Any]:






    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/agent-connections/trusted-origins",
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> AgentConnectionTrustedOriginsResponse200 | None:
    if response.status_code == 200:
        response_200 = AgentConnectionTrustedOriginsResponse200.from_dict(response.json())



        return response_200

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[AgentConnectionTrustedOriginsResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,

) -> Response[AgentConnectionTrustedOriginsResponse200]:
    """ List API origins whose agent invitations may be accepted

     The API origins this deployment vouches for: an agent may accept a connection invitation whose URL
    origin is listed here. Set by deployment configuration. Public, no authentication, cacheable for
    five minutes.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[AgentConnectionTrustedOriginsResponse200]
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

) -> AgentConnectionTrustedOriginsResponse200 | None:
    """ List API origins whose agent invitations may be accepted

     The API origins this deployment vouches for: an agent may accept a connection invitation whose URL
    origin is listed here. Set by deployment configuration. Public, no authentication, cacheable for
    five minutes.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        AgentConnectionTrustedOriginsResponse200
     """


    return sync_detailed(
        client=client,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,

) -> Response[AgentConnectionTrustedOriginsResponse200]:
    """ List API origins whose agent invitations may be accepted

     The API origins this deployment vouches for: an agent may accept a connection invitation whose URL
    origin is listed here. Set by deployment configuration. Public, no authentication, cacheable for
    five minutes.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[AgentConnectionTrustedOriginsResponse200]
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

) -> AgentConnectionTrustedOriginsResponse200 | None:
    """ List API origins whose agent invitations may be accepted

     The API origins this deployment vouches for: an agent may accept a connection invitation whose URL
    origin is listed here. Set by deployment configuration. Public, no authentication, cacheable for
    five minutes.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        AgentConnectionTrustedOriginsResponse200
     """


    return (await asyncio_detailed(
        client=client,

    )).parsed
