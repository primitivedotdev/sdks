from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.publish_agent_input import PublishAgentInput
from ...models.publish_agent_response_200 import PublishAgentResponse200
from ...models.publish_agent_response_201 import PublishAgentResponse201
from typing import cast



def _get_kwargs(
    slug: str,
    *,
    body: PublishAgentInput,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/registries/{slug}/agents".format(slug=quote(str(slug), safe=""),),
    }

    _kwargs["json"] = body.to_dict()


    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | PublishAgentResponse200 | PublishAgentResponse201 | None:
    if response.status_code == 200:
        response_200 = PublishAgentResponse200.from_dict(response.json())



        return response_200

    if response.status_code == 201:
        response_201 = PublishAgentResponse201.from_dict(response.json())



        return response_201

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

    if response.status_code == 422:
        response_422 = ErrorResponse.from_dict(response.json())



        return response_422

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | PublishAgentResponse200 | PublishAgentResponse201]:
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
    body: PublishAgentInput,

) -> Response[ErrorResponse | PublishAgentResponse200 | PublishAgentResponse201]:
    """ Publish an agent into a registry

    Args:
        slug (str):
        body (PublishAgentInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | PublishAgentResponse200 | PublishAgentResponse201]
     """


    kwargs = _get_kwargs(
        slug=slug,
body=body,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    slug: str,
    *,
    client: AuthenticatedClient | Client,
    body: PublishAgentInput,

) -> ErrorResponse | PublishAgentResponse200 | PublishAgentResponse201 | None:
    """ Publish an agent into a registry

    Args:
        slug (str):
        body (PublishAgentInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | PublishAgentResponse200 | PublishAgentResponse201
     """


    return sync_detailed(
        slug=slug,
client=client,
body=body,

    ).parsed

async def asyncio_detailed(
    slug: str,
    *,
    client: AuthenticatedClient | Client,
    body: PublishAgentInput,

) -> Response[ErrorResponse | PublishAgentResponse200 | PublishAgentResponse201]:
    """ Publish an agent into a registry

    Args:
        slug (str):
        body (PublishAgentInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | PublishAgentResponse200 | PublishAgentResponse201]
     """


    kwargs = _get_kwargs(
        slug=slug,
body=body,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    slug: str,
    *,
    client: AuthenticatedClient | Client,
    body: PublishAgentInput,

) -> ErrorResponse | PublishAgentResponse200 | PublishAgentResponse201 | None:
    """ Publish an agent into a registry

    Args:
        slug (str):
        body (PublishAgentInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | PublishAgentResponse200 | PublishAgentResponse201
     """


    return (await asyncio_detailed(
        slug=slug,
client=client,
body=body,

    )).parsed
