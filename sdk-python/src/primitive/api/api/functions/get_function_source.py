from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.get_function_source_response_200 import GetFunctionSourceResponse200
from ...types import UNSET, Unset
from typing import cast
from uuid import UUID



def _get_kwargs(
    id: UUID,
    *,
    deployment_id: UUID | Unset = UNSET,

) -> dict[str, Any]:
    

    

    params: dict[str, Any] = {}

    json_deployment_id: str | Unset = UNSET
    if not isinstance(deployment_id, Unset):
        json_deployment_id = str(deployment_id)
    params["deployment_id"] = json_deployment_id


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/functions/{id}/source".format(id=quote(str(id), safe=""),),
        "params": params,
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | GetFunctionSourceResponse200 | None:
    if response.status_code == 200:
        response_200 = GetFunctionSourceResponse200.from_dict(response.json())



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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | GetFunctionSourceResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    deployment_id: UUID | Unset = UNSET,

) -> Response[ErrorResponse | GetFunctionSourceResponse200]:
    """ Get a function's source files

     The source files of a managed-build deployment: the current one, or the one named by deployment_id.
    A function deployed as a single bundled module returns its deploymentId with an empty files list.
    deploymentId is null only when the function has no deployment.

    Args:
        id (UUID):
        deployment_id (UUID | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | GetFunctionSourceResponse200]
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
    *,
    client: AuthenticatedClient | Client,
    deployment_id: UUID | Unset = UNSET,

) -> ErrorResponse | GetFunctionSourceResponse200 | None:
    """ Get a function's source files

     The source files of a managed-build deployment: the current one, or the one named by deployment_id.
    A function deployed as a single bundled module returns its deploymentId with an empty files list.
    deploymentId is null only when the function has no deployment.

    Args:
        id (UUID):
        deployment_id (UUID | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | GetFunctionSourceResponse200
     """


    return sync_detailed(
        id=id,
client=client,
deployment_id=deployment_id,

    ).parsed

async def asyncio_detailed(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    deployment_id: UUID | Unset = UNSET,

) -> Response[ErrorResponse | GetFunctionSourceResponse200]:
    """ Get a function's source files

     The source files of a managed-build deployment: the current one, or the one named by deployment_id.
    A function deployed as a single bundled module returns its deploymentId with an empty files list.
    deploymentId is null only when the function has no deployment.

    Args:
        id (UUID):
        deployment_id (UUID | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | GetFunctionSourceResponse200]
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
    *,
    client: AuthenticatedClient | Client,
    deployment_id: UUID | Unset = UNSET,

) -> ErrorResponse | GetFunctionSourceResponse200 | None:
    """ Get a function's source files

     The source files of a managed-build deployment: the current one, or the one named by deployment_id.
    A function deployed as a single bundled module returns its deploymentId with an empty files list.
    deploymentId is null only when the function has no deployment.

    Args:
        id (UUID):
        deployment_id (UUID | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | GetFunctionSourceResponse200
     """


    return (await asyncio_detailed(
        id=id,
client=client,
deployment_id=deployment_id,

    )).parsed
