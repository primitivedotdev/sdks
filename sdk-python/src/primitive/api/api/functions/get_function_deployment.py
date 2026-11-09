from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.get_function_deployment_response_200 import GetFunctionDeploymentResponse200
from typing import cast
from uuid import UUID



def _get_kwargs(
    id: UUID,
    deployment_id: UUID,

) -> dict[str, Any]:
    

    

    

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/functions/{id}/deployments/{deployment_id}".format(id=quote(str(id), safe=""),deployment_id=quote(str(deployment_id), safe=""),),
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | GetFunctionDeploymentResponse200 | None:
    if response.status_code == 200:
        response_200 = GetFunctionDeploymentResponse200.from_dict(response.json())



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

    if response.status_code == 429:
        response_429 = ErrorResponse.from_dict(response.json())



        return response_429

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | GetFunctionDeploymentResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    id: UUID,
    deployment_id: UUID,
    *,
    client: AuthenticatedClient | Client,

) -> Response[ErrorResponse | GetFunctionDeploymentResponse200]:
    """ Get one deployment

     One deployment of the function, with its status, error, timings and bundle fingerprints.

    Args:
        id (UUID):
        deployment_id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | GetFunctionDeploymentResponse200]
     """


    kwargs = _get_kwargs(
        id=id,
deployment_id=deployment_id,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    id: UUID,
    deployment_id: UUID,
    *,
    client: AuthenticatedClient | Client,

) -> ErrorResponse | GetFunctionDeploymentResponse200 | None:
    """ Get one deployment

     One deployment of the function, with its status, error, timings and bundle fingerprints.

    Args:
        id (UUID):
        deployment_id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | GetFunctionDeploymentResponse200
     """


    return sync_detailed(
        id=id,
deployment_id=deployment_id,
client=client,

    ).parsed

async def asyncio_detailed(
    id: UUID,
    deployment_id: UUID,
    *,
    client: AuthenticatedClient | Client,

) -> Response[ErrorResponse | GetFunctionDeploymentResponse200]:
    """ Get one deployment

     One deployment of the function, with its status, error, timings and bundle fingerprints.

    Args:
        id (UUID):
        deployment_id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | GetFunctionDeploymentResponse200]
     """


    kwargs = _get_kwargs(
        id=id,
deployment_id=deployment_id,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    id: UUID,
    deployment_id: UUID,
    *,
    client: AuthenticatedClient | Client,

) -> ErrorResponse | GetFunctionDeploymentResponse200 | None:
    """ Get one deployment

     One deployment of the function, with its status, error, timings and bundle fingerprints.

    Args:
        id (UUID):
        deployment_id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | GetFunctionDeploymentResponse200
     """


    return (await asyncio_detailed(
        id=id,
deployment_id=deployment_id,
client=client,

    )).parsed
