from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.list_o_auth_grants_response_200 import ListOAuthGrantsResponse200
from ...types import UNSET, Unset
from typing import cast



def _get_kwargs(
    *,
    cursor: str | Unset = UNSET,
    limit: int | Unset = UNSET,

) -> dict[str, Any]:
    

    

    params: dict[str, Any] = {}

    params["cursor"] = cursor

    params["limit"] = limit


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/oauth-grants",
        "params": params,
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | ListOAuthGrantsResponse200 | None:
    if response.status_code == 200:
        response_200 = ListOAuthGrantsResponse200.from_dict(response.json())



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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | ListOAuthGrantsResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    cursor: str | Unset = UNSET,
    limit: int | Unset = UNSET,

) -> Response[ErrorResponse | ListOAuthGrantsResponse200]:
    """ List the organization's connected apps

     Every app a person connected to this organization through OAuth, with who connected it.

    Person only: a dashboard session. The person's role must hold oauth_grants:manage. API keys, agent
    connection keys and agents are refused.

    Args:
        cursor (str | Unset):
        limit (int | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ListOAuthGrantsResponse200]
     """


    kwargs = _get_kwargs(
        cursor=cursor,
limit=limit,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    *,
    client: AuthenticatedClient | Client,
    cursor: str | Unset = UNSET,
    limit: int | Unset = UNSET,

) -> ErrorResponse | ListOAuthGrantsResponse200 | None:
    """ List the organization's connected apps

     Every app a person connected to this organization through OAuth, with who connected it.

    Person only: a dashboard session. The person's role must hold oauth_grants:manage. API keys, agent
    connection keys and agents are refused.

    Args:
        cursor (str | Unset):
        limit (int | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ListOAuthGrantsResponse200
     """


    return sync_detailed(
        client=client,
cursor=cursor,
limit=limit,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    cursor: str | Unset = UNSET,
    limit: int | Unset = UNSET,

) -> Response[ErrorResponse | ListOAuthGrantsResponse200]:
    """ List the organization's connected apps

     Every app a person connected to this organization through OAuth, with who connected it.

    Person only: a dashboard session. The person's role must hold oauth_grants:manage. API keys, agent
    connection keys and agents are refused.

    Args:
        cursor (str | Unset):
        limit (int | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ListOAuthGrantsResponse200]
     """


    kwargs = _get_kwargs(
        cursor=cursor,
limit=limit,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    cursor: str | Unset = UNSET,
    limit: int | Unset = UNSET,

) -> ErrorResponse | ListOAuthGrantsResponse200 | None:
    """ List the organization's connected apps

     Every app a person connected to this organization through OAuth, with who connected it.

    Person only: a dashboard session. The person's role must hold oauth_grants:manage. API keys, agent
    connection keys and agents are refused.

    Args:
        cursor (str | Unset):
        limit (int | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ListOAuthGrantsResponse200
     """


    return (await asyncio_detailed(
        client=client,
cursor=cursor,
limit=limit,

    )).parsed
