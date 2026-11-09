from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.get_function_invocation_response_200 import GetFunctionInvocationResponse200
from typing import cast
from uuid import UUID



def _get_kwargs(
    id: UUID,
    invocation_id: UUID,

) -> dict[str, Any]:
    

    

    

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/functions/{id}/invocations/{invocation_id}".format(id=quote(str(id), safe=""),invocation_id=quote(str(invocation_id), safe=""),),
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | GetFunctionInvocationResponse200 | None:
    if response.status_code == 200:
        response_200 = GetFunctionInvocationResponse200.from_dict(response.json())



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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | GetFunctionInvocationResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    id: UUID,
    invocation_id: UUID,
    *,
    client: AuthenticatedClient | Client,

) -> Response[ErrorResponse | GetFunctionInvocationResponse200]:
    """ Get one invocation and its logs

     One run of the function with its exception stack and the log lines it wrote, oldest first.
    logs_truncated is true when the run wrote more lines than one response carries.

    Args:
        id (UUID):
        invocation_id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | GetFunctionInvocationResponse200]
     """


    kwargs = _get_kwargs(
        id=id,
invocation_id=invocation_id,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    id: UUID,
    invocation_id: UUID,
    *,
    client: AuthenticatedClient | Client,

) -> ErrorResponse | GetFunctionInvocationResponse200 | None:
    """ Get one invocation and its logs

     One run of the function with its exception stack and the log lines it wrote, oldest first.
    logs_truncated is true when the run wrote more lines than one response carries.

    Args:
        id (UUID):
        invocation_id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | GetFunctionInvocationResponse200
     """


    return sync_detailed(
        id=id,
invocation_id=invocation_id,
client=client,

    ).parsed

async def asyncio_detailed(
    id: UUID,
    invocation_id: UUID,
    *,
    client: AuthenticatedClient | Client,

) -> Response[ErrorResponse | GetFunctionInvocationResponse200]:
    """ Get one invocation and its logs

     One run of the function with its exception stack and the log lines it wrote, oldest first.
    logs_truncated is true when the run wrote more lines than one response carries.

    Args:
        id (UUID):
        invocation_id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | GetFunctionInvocationResponse200]
     """


    kwargs = _get_kwargs(
        id=id,
invocation_id=invocation_id,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    id: UUID,
    invocation_id: UUID,
    *,
    client: AuthenticatedClient | Client,

) -> ErrorResponse | GetFunctionInvocationResponse200 | None:
    """ Get one invocation and its logs

     One run of the function with its exception stack and the log lines it wrote, oldest first.
    logs_truncated is true when the run wrote more lines than one response carries.

    Args:
        id (UUID):
        invocation_id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | GetFunctionInvocationResponse200
     """


    return (await asyncio_detailed(
        id=id,
invocation_id=invocation_id,
client=client,

    )).parsed
