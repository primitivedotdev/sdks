from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.get_search_settings_response_200 import GetSearchSettingsResponse200
from typing import cast



def _get_kwargs(
    
) -> dict[str, Any]:
    

    

    

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/search-settings",
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | GetSearchSettingsResponse200 | None:
    if response.status_code == 200:
        response_200 = GetSearchSettingsResponse200.from_dict(response.json())



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

    if response.status_code == 429:
        response_429 = ErrorResponse.from_dict(response.json())



        return response_429

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | GetSearchSettingsResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,

) -> Response[ErrorResponse | GetSearchSettingsResponse200]:
    """ Get the semantic search setting

     Whether the organization consents to semantic search, and whether it is active: it also needs a paid
    plan, the feature to be available to the organization, and HIPAA mode off.

    Person only: a dashboard session or the person's own OAuth token (the CLI or an app they connected).
    API keys, agent connection keys and agents are refused.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | GetSearchSettingsResponse200]
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

) -> ErrorResponse | GetSearchSettingsResponse200 | None:
    """ Get the semantic search setting

     Whether the organization consents to semantic search, and whether it is active: it also needs a paid
    plan, the feature to be available to the organization, and HIPAA mode off.

    Person only: a dashboard session or the person's own OAuth token (the CLI or an app they connected).
    API keys, agent connection keys and agents are refused.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | GetSearchSettingsResponse200
     """


    return sync_detailed(
        client=client,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,

) -> Response[ErrorResponse | GetSearchSettingsResponse200]:
    """ Get the semantic search setting

     Whether the organization consents to semantic search, and whether it is active: it also needs a paid
    plan, the feature to be available to the organization, and HIPAA mode off.

    Person only: a dashboard session or the person's own OAuth token (the CLI or an app they connected).
    API keys, agent connection keys and agents are refused.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | GetSearchSettingsResponse200]
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

) -> ErrorResponse | GetSearchSettingsResponse200 | None:
    """ Get the semantic search setting

     Whether the organization consents to semantic search, and whether it is active: it also needs a paid
    plan, the feature to be available to the organization, and HIPAA mode off.

    Person only: a dashboard session or the person's own OAuth token (the CLI or an app they connected).
    API keys, agent connection keys and agents are refused.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | GetSearchSettingsResponse200
     """


    return (await asyncio_detailed(
        client=client,

    )).parsed
