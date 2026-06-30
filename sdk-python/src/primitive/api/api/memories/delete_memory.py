from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.delete_memory_response_200 import DeleteMemoryResponse200
from ...models.delete_memory_scope_type import DeleteMemoryScopeType
from ...models.error_response import ErrorResponse
from ...types import UNSET, Unset
from typing import cast
from uuid import UUID



def _get_kwargs(
    *,
    key: str,
    scope_type: DeleteMemoryScopeType | Unset = UNSET,
    scope_id: UUID | Unset = UNSET,
    if_version: str | Unset = UNSET,
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

    params["if_version"] = if_version


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "delete",
        "url": "/memories",
        "params": params,
    }


    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> DeleteMemoryResponse200 | ErrorResponse | None:
    if response.status_code == 200:
        response_200 = DeleteMemoryResponse200.from_dict(response.json())



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

    if response.status_code == 409:
        response_409 = ErrorResponse.from_dict(response.json())



        return response_409

    if response.status_code == 429:
        response_429 = ErrorResponse.from_dict(response.json())



        return response_429

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[DeleteMemoryResponse200 | ErrorResponse]:
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
    scope_type: DeleteMemoryScopeType | Unset = UNSET,
    scope_id: UUID | Unset = UNSET,
    if_version: str | Unset = UNSET,
    x_primitive_function_id: UUID | Unset = UNSET,

) -> Response[DeleteMemoryResponse200 | ErrorResponse]:
    """ Delete a memory

     Delete one active memory by key and scope. Deletes are idempotent when
    `if_version` is omitted: deleting a missing key returns `deleted:
    false`. With `if_version`, a missing key still returns `deleted: false`,
    but a stale version returns `memory_conflict`.

    A successful delete records memory write usage.

    Args:
        key (str):
        scope_type (DeleteMemoryScopeType | Unset):
        scope_id (UUID | Unset):
        if_version (str | Unset): Bigint counter serialized as a base-10 string.
        x_primitive_function_id (UUID | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[DeleteMemoryResponse200 | ErrorResponse]
     """


    kwargs = _get_kwargs(
        key=key,
scope_type=scope_type,
scope_id=scope_id,
if_version=if_version,
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
    scope_type: DeleteMemoryScopeType | Unset = UNSET,
    scope_id: UUID | Unset = UNSET,
    if_version: str | Unset = UNSET,
    x_primitive_function_id: UUID | Unset = UNSET,

) -> DeleteMemoryResponse200 | ErrorResponse | None:
    """ Delete a memory

     Delete one active memory by key and scope. Deletes are idempotent when
    `if_version` is omitted: deleting a missing key returns `deleted:
    false`. With `if_version`, a missing key still returns `deleted: false`,
    but a stale version returns `memory_conflict`.

    A successful delete records memory write usage.

    Args:
        key (str):
        scope_type (DeleteMemoryScopeType | Unset):
        scope_id (UUID | Unset):
        if_version (str | Unset): Bigint counter serialized as a base-10 string.
        x_primitive_function_id (UUID | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        DeleteMemoryResponse200 | ErrorResponse
     """


    return sync_detailed(
        client=client,
key=key,
scope_type=scope_type,
scope_id=scope_id,
if_version=if_version,
x_primitive_function_id=x_primitive_function_id,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    key: str,
    scope_type: DeleteMemoryScopeType | Unset = UNSET,
    scope_id: UUID | Unset = UNSET,
    if_version: str | Unset = UNSET,
    x_primitive_function_id: UUID | Unset = UNSET,

) -> Response[DeleteMemoryResponse200 | ErrorResponse]:
    """ Delete a memory

     Delete one active memory by key and scope. Deletes are idempotent when
    `if_version` is omitted: deleting a missing key returns `deleted:
    false`. With `if_version`, a missing key still returns `deleted: false`,
    but a stale version returns `memory_conflict`.

    A successful delete records memory write usage.

    Args:
        key (str):
        scope_type (DeleteMemoryScopeType | Unset):
        scope_id (UUID | Unset):
        if_version (str | Unset): Bigint counter serialized as a base-10 string.
        x_primitive_function_id (UUID | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[DeleteMemoryResponse200 | ErrorResponse]
     """


    kwargs = _get_kwargs(
        key=key,
scope_type=scope_type,
scope_id=scope_id,
if_version=if_version,
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
    scope_type: DeleteMemoryScopeType | Unset = UNSET,
    scope_id: UUID | Unset = UNSET,
    if_version: str | Unset = UNSET,
    x_primitive_function_id: UUID | Unset = UNSET,

) -> DeleteMemoryResponse200 | ErrorResponse | None:
    """ Delete a memory

     Delete one active memory by key and scope. Deletes are idempotent when
    `if_version` is omitted: deleting a missing key returns `deleted:
    false`. With `if_version`, a missing key still returns `deleted: false`,
    but a stale version returns `memory_conflict`.

    A successful delete records memory write usage.

    Args:
        key (str):
        scope_type (DeleteMemoryScopeType | Unset):
        scope_id (UUID | Unset):
        if_version (str | Unset): Bigint counter serialized as a base-10 string.
        x_primitive_function_id (UUID | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        DeleteMemoryResponse200 | ErrorResponse
     """


    return (await asyncio_detailed(
        client=client,
key=key,
scope_type=scope_type,
scope_id=scope_id,
if_version=if_version,
x_primitive_function_id=x_primitive_function_id,

    )).parsed
