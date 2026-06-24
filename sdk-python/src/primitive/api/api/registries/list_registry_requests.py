from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.list_registry_requests_response_200 import ListRegistryRequestsResponse200
from ...types import UNSET, Unset
from typing import cast



def _get_kwargs(
    slug: str,
    *,
    limit: int | Unset = UNSET,

) -> dict[str, Any]:
    

    

    params: dict[str, Any] = {}

    params["limit"] = limit


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/registries/{slug}/requests".format(slug=quote(str(slug), safe=""),),
        "params": params,
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | ListRegistryRequestsResponse200 | None:
    if response.status_code == 200:
        response_200 = ListRegistryRequestsResponse200.from_dict(response.json())



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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | ListRegistryRequestsResponse200]:
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
    limit: int | Unset = UNSET,

) -> Response[ErrorResponse | ListRegistryRequestsResponse200]:
    """ List pending publication requests

    Args:
        slug (str):
        limit (int | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ListRegistryRequestsResponse200]
     """


    kwargs = _get_kwargs(
        slug=slug,
limit=limit,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    slug: str,
    *,
    client: AuthenticatedClient | Client,
    limit: int | Unset = UNSET,

) -> ErrorResponse | ListRegistryRequestsResponse200 | None:
    """ List pending publication requests

    Args:
        slug (str):
        limit (int | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ListRegistryRequestsResponse200
     """


    return sync_detailed(
        slug=slug,
client=client,
limit=limit,

    ).parsed

async def asyncio_detailed(
    slug: str,
    *,
    client: AuthenticatedClient | Client,
    limit: int | Unset = UNSET,

) -> Response[ErrorResponse | ListRegistryRequestsResponse200]:
    """ List pending publication requests

    Args:
        slug (str):
        limit (int | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ListRegistryRequestsResponse200]
     """


    kwargs = _get_kwargs(
        slug=slug,
limit=limit,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    slug: str,
    *,
    client: AuthenticatedClient | Client,
    limit: int | Unset = UNSET,

) -> ErrorResponse | ListRegistryRequestsResponse200 | None:
    """ List pending publication requests

    Args:
        slug (str):
        limit (int | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ListRegistryRequestsResponse200
     """


    return (await asyncio_detailed(
        slug=slug,
client=client,
limit=limit,

    )).parsed
