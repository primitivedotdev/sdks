from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.decide_registry_request_input import DecideRegistryRequestInput
from ...models.decide_registry_request_response_200 import DecideRegistryRequestResponse200
from ...models.error_response import ErrorResponse
from typing import cast
from uuid import UUID



def _get_kwargs(
    slug: str,
    id: UUID,
    *,
    body: DecideRegistryRequestInput,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/registries/{slug}/requests/{id}".format(slug=quote(str(slug), safe=""),id=quote(str(id), safe=""),),
    }

    _kwargs["json"] = body.to_dict()


    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> DecideRegistryRequestResponse200 | ErrorResponse | None:
    if response.status_code == 200:
        response_200 = DecideRegistryRequestResponse200.from_dict(response.json())



        return response_200

    if response.status_code == 401:
        response_401 = ErrorResponse.from_dict(response.json())



        return response_401

    if response.status_code == 403:
        response_403 = ErrorResponse.from_dict(response.json())



        return response_403

    if response.status_code == 404:
        response_404 = ErrorResponse.from_dict(response.json())



        return response_404

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[DecideRegistryRequestResponse200 | ErrorResponse]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    slug: str,
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: DecideRegistryRequestInput,

) -> Response[DecideRegistryRequestResponse200 | ErrorResponse]:
    """ Approve or reject a publication request

    Args:
        slug (str):
        id (UUID):
        body (DecideRegistryRequestInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[DecideRegistryRequestResponse200 | ErrorResponse]
     """


    kwargs = _get_kwargs(
        slug=slug,
id=id,
body=body,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    slug: str,
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: DecideRegistryRequestInput,

) -> DecideRegistryRequestResponse200 | ErrorResponse | None:
    """ Approve or reject a publication request

    Args:
        slug (str):
        id (UUID):
        body (DecideRegistryRequestInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        DecideRegistryRequestResponse200 | ErrorResponse
     """


    return sync_detailed(
        slug=slug,
id=id,
client=client,
body=body,

    ).parsed

async def asyncio_detailed(
    slug: str,
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: DecideRegistryRequestInput,

) -> Response[DecideRegistryRequestResponse200 | ErrorResponse]:
    """ Approve or reject a publication request

    Args:
        slug (str):
        id (UUID):
        body (DecideRegistryRequestInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[DecideRegistryRequestResponse200 | ErrorResponse]
     """


    kwargs = _get_kwargs(
        slug=slug,
id=id,
body=body,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    slug: str,
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: DecideRegistryRequestInput,

) -> DecideRegistryRequestResponse200 | ErrorResponse | None:
    """ Approve or reject a publication request

    Args:
        slug (str):
        id (UUID):
        body (DecideRegistryRequestInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        DecideRegistryRequestResponse200 | ErrorResponse
     """


    return (await asyncio_detailed(
        slug=slug,
id=id,
client=client,
body=body,

    )).parsed
