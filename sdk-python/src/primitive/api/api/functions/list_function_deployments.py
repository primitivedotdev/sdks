from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.list_function_deployments_response_200 import ListFunctionDeploymentsResponse200
from ...types import UNSET, Unset
from typing import cast
from uuid import UUID



def _get_kwargs(
    id: UUID,
    *,
    limit: int | Unset = UNSET,

) -> dict[str, Any]:
    

    

    params: dict[str, Any] = {}

    params["limit"] = limit


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/functions/{id}/deployments".format(id=quote(str(id), safe=""),),
        "params": params,
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | ListFunctionDeploymentsResponse200 | None:
    if response.status_code == 200:
        response_200 = ListFunctionDeploymentsResponse200.from_dict(response.json())



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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | ListFunctionDeploymentsResponse200]:
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
    limit: int | Unset = UNSET,

) -> Response[ErrorResponse | ListFunctionDeploymentsResponse200]:
    """ List a function's recent deployments

     The function's most recent deployments, newest first, with build and bundle details: limit of them
    (default 50, at most 200). This list is not paged; read an older deployment by id with
    getFunctionDeployment. is_current marks the one serving traffic.

    Args:
        id (UUID):
        limit (int | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ListFunctionDeploymentsResponse200]
     """


    kwargs = _get_kwargs(
        id=id,
limit=limit,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    limit: int | Unset = UNSET,

) -> ErrorResponse | ListFunctionDeploymentsResponse200 | None:
    """ List a function's recent deployments

     The function's most recent deployments, newest first, with build and bundle details: limit of them
    (default 50, at most 200). This list is not paged; read an older deployment by id with
    getFunctionDeployment. is_current marks the one serving traffic.

    Args:
        id (UUID):
        limit (int | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ListFunctionDeploymentsResponse200
     """


    return sync_detailed(
        id=id,
client=client,
limit=limit,

    ).parsed

async def asyncio_detailed(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    limit: int | Unset = UNSET,

) -> Response[ErrorResponse | ListFunctionDeploymentsResponse200]:
    """ List a function's recent deployments

     The function's most recent deployments, newest first, with build and bundle details: limit of them
    (default 50, at most 200). This list is not paged; read an older deployment by id with
    getFunctionDeployment. is_current marks the one serving traffic.

    Args:
        id (UUID):
        limit (int | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ListFunctionDeploymentsResponse200]
     """


    kwargs = _get_kwargs(
        id=id,
limit=limit,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    limit: int | Unset = UNSET,

) -> ErrorResponse | ListFunctionDeploymentsResponse200 | None:
    """ List a function's recent deployments

     The function's most recent deployments, newest first, with build and bundle details: limit of them
    (default 50, at most 200). This list is not paged; read an older deployment by id with
    getFunctionDeployment. is_current marks the one serving traffic.

    Args:
        id (UUID):
        limit (int | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ListFunctionDeploymentsResponse200
     """


    return (await asyncio_detailed(
        id=id,
client=client,
limit=limit,

    )).parsed
