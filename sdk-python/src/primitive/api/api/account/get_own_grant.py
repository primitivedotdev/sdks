from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.get_own_grant_response_200 import GetOwnGrantResponse200
from typing import cast



def _get_kwargs(
    
) -> dict[str, Any]:
    

    

    

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/whoami/grant",
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | GetOwnGrantResponse200 | None:
    if response.status_code == 200:
        response_200 = GetOwnGrantResponse200.from_dict(response.json())



        return response_200

    if response.status_code == 401:
        response_401 = ErrorResponse.from_dict(response.json())



        return response_401

    if response.status_code == 403:
        response_403 = ErrorResponse.from_dict(response.json())



        return response_403

    if response.status_code == 429:
        response_429 = ErrorResponse.from_dict(response.json())



        return response_429

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | GetOwnGrantResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,

) -> Response[ErrorResponse | GetOwnGrantResponse200]:
    """ Check what this credential can do

     The grant of the credential that calls it: its permissions, mail scope, resources, template,
    credential kind and expiry. A credential may call it about itself without any permission, including
    a narrowed key without org:read, so a key can see its own permissions and mail scope. It answers
    nothing about any other credential. grant is null when the credential carries no grant.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | GetOwnGrantResponse200]
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

) -> ErrorResponse | GetOwnGrantResponse200 | None:
    """ Check what this credential can do

     The grant of the credential that calls it: its permissions, mail scope, resources, template,
    credential kind and expiry. A credential may call it about itself without any permission, including
    a narrowed key without org:read, so a key can see its own permissions and mail scope. It answers
    nothing about any other credential. grant is null when the credential carries no grant.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | GetOwnGrantResponse200
     """


    return sync_detailed(
        client=client,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,

) -> Response[ErrorResponse | GetOwnGrantResponse200]:
    """ Check what this credential can do

     The grant of the credential that calls it: its permissions, mail scope, resources, template,
    credential kind and expiry. A credential may call it about itself without any permission, including
    a narrowed key without org:read, so a key can see its own permissions and mail scope. It answers
    nothing about any other credential. grant is null when the credential carries no grant.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | GetOwnGrantResponse200]
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

) -> ErrorResponse | GetOwnGrantResponse200 | None:
    """ Check what this credential can do

     The grant of the credential that calls it: its permissions, mail scope, resources, template,
    credential kind and expiry. A credential may call it about itself without any permission, including
    a narrowed key without org:read, so a key can see its own permissions and mail scope. It answers
    nothing about any other credential. grant is null when the credential carries no grant.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | GetOwnGrantResponse200
     """


    return (await asyncio_detailed(
        client=client,

    )).parsed
