from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.update_agent_connection_settings_body import UpdateAgentConnectionSettingsBody
from ...models.update_agent_connection_settings_response_200 import UpdateAgentConnectionSettingsResponse200
from typing import cast



def _get_kwargs(
    *,
    body: UpdateAgentConnectionSettingsBody,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}






    _kwargs: dict[str, Any] = {
        "method": "patch",
        "url": "/agent-connections/settings",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | UpdateAgentConnectionSettingsResponse200 | None:
    if response.status_code == 200:
        response_200 = UpdateAgentConnectionSettingsResponse200.from_dict(response.json())



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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | UpdateAgentConnectionSettingsResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: UpdateAgentConnectionSettingsBody,

) -> Response[ErrorResponse | UpdateAgentConnectionSettingsResponse200]:
    """ update Agent Connection Settings

     Update the organization agent settings. Set idle_hide_after_days to a whole number of days from 1 to
    365, or null to turn auto-hide off. Turning it off, or raising it, shows again the agents that were
    hidden for idleness and no longer qualify. Manual hides are unchanged. Organization owners and
    admins only.

    Args:
        body (UpdateAgentConnectionSettingsBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | UpdateAgentConnectionSettingsResponse200]
     """


    kwargs = _get_kwargs(
        body=body,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    *,
    client: AuthenticatedClient | Client,
    body: UpdateAgentConnectionSettingsBody,

) -> ErrorResponse | UpdateAgentConnectionSettingsResponse200 | None:
    """ update Agent Connection Settings

     Update the organization agent settings. Set idle_hide_after_days to a whole number of days from 1 to
    365, or null to turn auto-hide off. Turning it off, or raising it, shows again the agents that were
    hidden for idleness and no longer qualify. Manual hides are unchanged. Organization owners and
    admins only.

    Args:
        body (UpdateAgentConnectionSettingsBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | UpdateAgentConnectionSettingsResponse200
     """


    return sync_detailed(
        client=client,
body=body,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: UpdateAgentConnectionSettingsBody,

) -> Response[ErrorResponse | UpdateAgentConnectionSettingsResponse200]:
    """ update Agent Connection Settings

     Update the organization agent settings. Set idle_hide_after_days to a whole number of days from 1 to
    365, or null to turn auto-hide off. Turning it off, or raising it, shows again the agents that were
    hidden for idleness and no longer qualify. Manual hides are unchanged. Organization owners and
    admins only.

    Args:
        body (UpdateAgentConnectionSettingsBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | UpdateAgentConnectionSettingsResponse200]
     """


    kwargs = _get_kwargs(
        body=body,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    body: UpdateAgentConnectionSettingsBody,

) -> ErrorResponse | UpdateAgentConnectionSettingsResponse200 | None:
    """ update Agent Connection Settings

     Update the organization agent settings. Set idle_hide_after_days to a whole number of days from 1 to
    365, or null to turn auto-hide off. Turning it off, or raising it, shows again the agents that were
    hidden for idleness and no longer qualify. Manual hides are unchanged. Organization owners and
    admins only.

    Args:
        body (UpdateAgentConnectionSettingsBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | UpdateAgentConnectionSettingsResponse200
     """


    return (await asyncio_detailed(
        client=client,
body=body,

    )).parsed
