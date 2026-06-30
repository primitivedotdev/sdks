from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.delete_registry_response_200 import DeleteRegistryResponse200
from ...models.error_response import ErrorResponse
from typing import cast



def _get_kwargs(
    slug: str,

) -> dict[str, Any]:
    

    

    

    _kwargs: dict[str, Any] = {
        "method": "delete",
        "url": "/registries/{slug}".format(slug=quote(str(slug), safe=""),),
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> DeleteRegistryResponse200 | ErrorResponse | None:
    if response.status_code == 200:
        response_200 = DeleteRegistryResponse200.from_dict(response.json())



        return response_200

    if response.status_code == 401:
        response_401 = ErrorResponse.from_dict(response.json())



        return response_401

    if response.status_code == 404:
        response_404 = ErrorResponse.from_dict(response.json())



        return response_404

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[DeleteRegistryResponse200 | ErrorResponse]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    slug: str,
    *,
    client: AuthenticatedClient | Client,

) -> Response[DeleteRegistryResponse200 | ErrorResponse]:
    """ Delete a registry you own

     Removes the registry from discovery and frees its slug for re-creation.

    Args:
        slug (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[DeleteRegistryResponse200 | ErrorResponse]
     """


    kwargs = _get_kwargs(
        slug=slug,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    slug: str,
    *,
    client: AuthenticatedClient | Client,

) -> DeleteRegistryResponse200 | ErrorResponse | None:
    """ Delete a registry you own

     Removes the registry from discovery and frees its slug for re-creation.

    Args:
        slug (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        DeleteRegistryResponse200 | ErrorResponse
     """


    return sync_detailed(
        slug=slug,
client=client,

    ).parsed

async def asyncio_detailed(
    slug: str,
    *,
    client: AuthenticatedClient | Client,

) -> Response[DeleteRegistryResponse200 | ErrorResponse]:
    """ Delete a registry you own

     Removes the registry from discovery and frees its slug for re-creation.

    Args:
        slug (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[DeleteRegistryResponse200 | ErrorResponse]
     """


    kwargs = _get_kwargs(
        slug=slug,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    slug: str,
    *,
    client: AuthenticatedClient | Client,

) -> DeleteRegistryResponse200 | ErrorResponse | None:
    """ Delete a registry you own

     Removes the registry from discovery and frees its slug for re-creation.

    Args:
        slug (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        DeleteRegistryResponse200 | ErrorResponse
     """


    return (await asyncio_detailed(
        slug=slug,
client=client,

    )).parsed
