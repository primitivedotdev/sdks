from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.unpublish_agent_response_200 import UnpublishAgentResponse200
from typing import cast



def _get_kwargs(
    slug: str,
    handle: str,

) -> dict[str, Any]:
    

    

    

    _kwargs: dict[str, Any] = {
        "method": "delete",
        "url": "/registries/{slug}/agents/{handle}".format(slug=quote(str(slug), safe=""),handle=quote(str(handle), safe=""),),
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | UnpublishAgentResponse200 | None:
    if response.status_code == 200:
        response_200 = UnpublishAgentResponse200.from_dict(response.json())



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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | UnpublishAgentResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    slug: str,
    handle: str,
    *,
    client: AuthenticatedClient | Client,

) -> Response[ErrorResponse | UnpublishAgentResponse200]:
    """ Unpublish an agent from a registry

    Args:
        slug (str):
        handle (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | UnpublishAgentResponse200]
     """


    kwargs = _get_kwargs(
        slug=slug,
handle=handle,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    slug: str,
    handle: str,
    *,
    client: AuthenticatedClient | Client,

) -> ErrorResponse | UnpublishAgentResponse200 | None:
    """ Unpublish an agent from a registry

    Args:
        slug (str):
        handle (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | UnpublishAgentResponse200
     """


    return sync_detailed(
        slug=slug,
handle=handle,
client=client,

    ).parsed

async def asyncio_detailed(
    slug: str,
    handle: str,
    *,
    client: AuthenticatedClient | Client,

) -> Response[ErrorResponse | UnpublishAgentResponse200]:
    """ Unpublish an agent from a registry

    Args:
        slug (str):
        handle (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | UnpublishAgentResponse200]
     """


    kwargs = _get_kwargs(
        slug=slug,
handle=handle,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    slug: str,
    handle: str,
    *,
    client: AuthenticatedClient | Client,

) -> ErrorResponse | UnpublishAgentResponse200 | None:
    """ Unpublish an agent from a registry

    Args:
        slug (str):
        handle (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | UnpublishAgentResponse200
     """


    return (await asyncio_detailed(
        slug=slug,
handle=handle,
client=client,

    )).parsed
