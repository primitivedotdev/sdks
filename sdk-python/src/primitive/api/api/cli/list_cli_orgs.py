from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.list_cli_orgs_response_200 import ListCliOrgsResponse200
from typing import cast



def _get_kwargs(
    
) -> dict[str, Any]:
    

    

    

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/cli/orgs",
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | ListCliOrgsResponse200 | None:
    if response.status_code == 200:
        response_200 = ListCliOrgsResponse200.from_dict(response.json())



        return response_200

    if response.status_code == 401:
        response_401 = ErrorResponse.from_dict(response.json())



        return response_401

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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | ListCliOrgsResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,

) -> Response[ErrorResponse | ListCliOrgsResponse200]:
    """ List the organizations a CLI login can switch to

     Lists every organization the person behind a CLI user login belongs
    to, with whether the CLI may be used there and, when it may not, the
    reason. Authenticate with the identity access token (`prim_uat_`) from
    a CLI user login; no other credential is accepted. A server without
    CLI user logins answers `404 feature_disabled`.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ListCliOrgsResponse200]
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

) -> ErrorResponse | ListCliOrgsResponse200 | None:
    """ List the organizations a CLI login can switch to

     Lists every organization the person behind a CLI user login belongs
    to, with whether the CLI may be used there and, when it may not, the
    reason. Authenticate with the identity access token (`prim_uat_`) from
    a CLI user login; no other credential is accepted. A server without
    CLI user logins answers `404 feature_disabled`.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ListCliOrgsResponse200
     """


    return sync_detailed(
        client=client,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,

) -> Response[ErrorResponse | ListCliOrgsResponse200]:
    """ List the organizations a CLI login can switch to

     Lists every organization the person behind a CLI user login belongs
    to, with whether the CLI may be used there and, when it may not, the
    reason. Authenticate with the identity access token (`prim_uat_`) from
    a CLI user login; no other credential is accepted. A server without
    CLI user logins answers `404 feature_disabled`.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ListCliOrgsResponse200]
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

) -> ErrorResponse | ListCliOrgsResponse200 | None:
    """ List the organizations a CLI login can switch to

     Lists every organization the person behind a CLI user login belongs
    to, with whether the CLI may be used there and, when it may not, the
    reason. Authenticate with the identity access token (`prim_uat_`) from
    a CLI user login; no other credential is accepted. A server without
    CLI user logins answers `404 feature_disabled`.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ListCliOrgsResponse200
     """


    return (await asyncio_detailed(
        client=client,

    )).parsed
