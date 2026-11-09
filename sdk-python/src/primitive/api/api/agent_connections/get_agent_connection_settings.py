from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.get_agent_connection_settings_response_200 import GetAgentConnectionSettingsResponse200
from typing import cast



def _get_kwargs(

) -> dict[str, Any]:






    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/agent-connections/settings",
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | GetAgentConnectionSettingsResponse200 | None:
    if response.status_code == 200:
        response_200 = GetAgentConnectionSettingsResponse200.from_dict(response.json())



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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | GetAgentConnectionSettingsResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,

) -> Response[ErrorResponse | GetAgentConnectionSettingsResponse200]:
    """ get Agent Connection Settings

     Read the organization agent settings. idle_hide_after_days is how many days a connected agent may go
    without activity (an authenticated call by its credential, a mail read, or its creation or
    verification) before it is hidden. Default 14; null means auto-hide is off. Any current organization
    member may read it.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | GetAgentConnectionSettingsResponse200]
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

) -> ErrorResponse | GetAgentConnectionSettingsResponse200 | None:
    """ get Agent Connection Settings

     Read the organization agent settings. idle_hide_after_days is how many days a connected agent may go
    without activity (an authenticated call by its credential, a mail read, or its creation or
    verification) before it is hidden. Default 14; null means auto-hide is off. Any current organization
    member may read it.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | GetAgentConnectionSettingsResponse200
     """


    return sync_detailed(
        client=client,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,

) -> Response[ErrorResponse | GetAgentConnectionSettingsResponse200]:
    """ get Agent Connection Settings

     Read the organization agent settings. idle_hide_after_days is how many days a connected agent may go
    without activity (an authenticated call by its credential, a mail read, or its creation or
    verification) before it is hidden. Default 14; null means auto-hide is off. Any current organization
    member may read it.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | GetAgentConnectionSettingsResponse200]
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

) -> ErrorResponse | GetAgentConnectionSettingsResponse200 | None:
    """ get Agent Connection Settings

     Read the organization agent settings. idle_hide_after_days is how many days a connected agent may go
    without activity (an authenticated call by its credential, a mail read, or its creation or
    verification) before it is hidden. Default 14; null means auto-hide is off. Any current organization
    member may read it.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | GetAgentConnectionSettingsResponse200
     """


    return (await asyncio_detailed(
        client=client,

    )).parsed
