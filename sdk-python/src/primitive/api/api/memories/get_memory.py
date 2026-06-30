from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.get_memory_response_200 import GetMemoryResponse200
from ...models.get_memory_scope_type import GetMemoryScopeType
from ...types import UNSET, Unset
from typing import cast
from uuid import UUID



def _get_kwargs(
    *,
    key: str,
    scope_type: GetMemoryScopeType | Unset = UNSET,
    scope_id: UUID | Unset = UNSET,
    x_primitive_function_id: UUID | Unset = UNSET,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}
    if not isinstance(x_primitive_function_id, Unset):
        headers["x-primitive-function-id"] = x_primitive_function_id



    

    params: dict[str, Any] = {}

    params["key"] = key

    json_scope_type: str | Unset = UNSET
    if not isinstance(scope_type, Unset):
        json_scope_type = scope_type.value

    params["scope_type"] = json_scope_type

    json_scope_id: str | Unset = UNSET
    if not isinstance(scope_id, Unset):
        json_scope_id = str(scope_id)
    params["scope_id"] = json_scope_id


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/memories",
        "params": params,
    }


    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | GetMemoryResponse200 | None:
    if response.status_code == 200:
        response_200 = GetMemoryResponse200.from_dict(response.json())



        return response_200

    if response.status_code == 400:
        response_400 = ErrorResponse.from_dict(response.json())



        return response_400

    if response.status_code == 401:
        response_401 = ErrorResponse.from_dict(response.json())



        return response_401

    if response.status_code == 402:
        response_402 = ErrorResponse.from_dict(response.json())



        return response_402

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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | GetMemoryResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    key: str,
    scope_type: GetMemoryScopeType | Unset = UNSET,
    scope_id: UUID | Unset = UNSET,
    x_primitive_function_id: UUID | Unset = UNSET,

) -> Response[ErrorResponse | GetMemoryResponse200]:
    """ Get a memory

     Fetch one active memory by key and scope. Omit scope parameters to use
    the automatic default: function-authenticated context, then the
    `x-primitive-function-id` header, then org scope. Function scope uses a
    function id UUID in `scope_id`.

    A successful read records memory read usage and updates the memory's
    read stats asynchronously.

    Args:
        key (str):
        scope_type (GetMemoryScopeType | Unset):
        scope_id (UUID | Unset):
        x_primitive_function_id (UUID | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | GetMemoryResponse200]
     """


    kwargs = _get_kwargs(
        key=key,
scope_type=scope_type,
scope_id=scope_id,
x_primitive_function_id=x_primitive_function_id,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    *,
    client: AuthenticatedClient | Client,
    key: str,
    scope_type: GetMemoryScopeType | Unset = UNSET,
    scope_id: UUID | Unset = UNSET,
    x_primitive_function_id: UUID | Unset = UNSET,

) -> ErrorResponse | GetMemoryResponse200 | None:
    """ Get a memory

     Fetch one active memory by key and scope. Omit scope parameters to use
    the automatic default: function-authenticated context, then the
    `x-primitive-function-id` header, then org scope. Function scope uses a
    function id UUID in `scope_id`.

    A successful read records memory read usage and updates the memory's
    read stats asynchronously.

    Args:
        key (str):
        scope_type (GetMemoryScopeType | Unset):
        scope_id (UUID | Unset):
        x_primitive_function_id (UUID | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | GetMemoryResponse200
     """


    return sync_detailed(
        client=client,
key=key,
scope_type=scope_type,
scope_id=scope_id,
x_primitive_function_id=x_primitive_function_id,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    key: str,
    scope_type: GetMemoryScopeType | Unset = UNSET,
    scope_id: UUID | Unset = UNSET,
    x_primitive_function_id: UUID | Unset = UNSET,

) -> Response[ErrorResponse | GetMemoryResponse200]:
    """ Get a memory

     Fetch one active memory by key and scope. Omit scope parameters to use
    the automatic default: function-authenticated context, then the
    `x-primitive-function-id` header, then org scope. Function scope uses a
    function id UUID in `scope_id`.

    A successful read records memory read usage and updates the memory's
    read stats asynchronously.

    Args:
        key (str):
        scope_type (GetMemoryScopeType | Unset):
        scope_id (UUID | Unset):
        x_primitive_function_id (UUID | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | GetMemoryResponse200]
     """


    kwargs = _get_kwargs(
        key=key,
scope_type=scope_type,
scope_id=scope_id,
x_primitive_function_id=x_primitive_function_id,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    key: str,
    scope_type: GetMemoryScopeType | Unset = UNSET,
    scope_id: UUID | Unset = UNSET,
    x_primitive_function_id: UUID | Unset = UNSET,

) -> ErrorResponse | GetMemoryResponse200 | None:
    """ Get a memory

     Fetch one active memory by key and scope. Omit scope parameters to use
    the automatic default: function-authenticated context, then the
    `x-primitive-function-id` header, then org scope. Function scope uses a
    function id UUID in `scope_id`.

    A successful read records memory read usage and updates the memory's
    read stats asynchronously.

    Args:
        key (str):
        scope_type (GetMemoryScopeType | Unset):
        scope_id (UUID | Unset):
        x_primitive_function_id (UUID | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | GetMemoryResponse200
     """


    return (await asyncio_detailed(
        client=client,
key=key,
scope_type=scope_type,
scope_id=scope_id,
x_primitive_function_id=x_primitive_function_id,

    )).parsed
