from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.set_memory_input import SetMemoryInput
from ...models.set_memory_response_200 import SetMemoryResponse200
from ...models.set_memory_response_201 import SetMemoryResponse201
from ...types import UNSET, Unset
from typing import cast
from uuid import UUID



def _get_kwargs(
    *,
    body: SetMemoryInput,
    x_primitive_function_id: UUID | Unset = UNSET,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}
    if not isinstance(x_primitive_function_id, Unset):
        headers["x-primitive-function-id"] = x_primitive_function_id



    

    

    _kwargs: dict[str, Any] = {
        "method": "put",
        "url": "/memories",
    }

    _kwargs["json"] = body.to_dict()


    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | SetMemoryResponse200 | SetMemoryResponse201 | None:
    if response.status_code == 200:
        response_200 = SetMemoryResponse200.from_dict(response.json())



        return response_200

    if response.status_code == 201:
        response_201 = SetMemoryResponse201.from_dict(response.json())



        return response_201

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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | SetMemoryResponse200 | SetMemoryResponse201]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: SetMemoryInput,
    x_primitive_function_id: UUID | Unset = UNSET,

) -> Response[ErrorResponse | SetMemoryResponse200 | SetMemoryResponse201]:
    """ Set a memory

     Create or update a durable JSON memory under an org or function scope.
    When no explicit scope is provided, function-authenticated requests
    use that function's id automatically; requests with
    `x-primitive-function-id` use that function id; all other requests
    default to org scope.

    `scope.type = function` requires the function id UUID in `scope.id`.
    Function names are not accepted as scope identifiers. Values must be
    valid JSON and serialize to at most 65536 UTF-8 bytes. Keys must be at
    most 512 UTF-8 bytes. `version`, `read_count`, and `write_count` are
    bigint counters serialized as strings.

    Passing `if_absent` turns the write into create-only. Passing
    `if_version` turns the write into compare-and-set. These options are
    mutually exclusive and return `memory_conflict` on a stale version or
    existing key.

    Args:
        x_primitive_function_id (UUID | Unset):
        body (SetMemoryInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | SetMemoryResponse200 | SetMemoryResponse201]
     """


    kwargs = _get_kwargs(
        body=body,
x_primitive_function_id=x_primitive_function_id,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    *,
    client: AuthenticatedClient | Client,
    body: SetMemoryInput,
    x_primitive_function_id: UUID | Unset = UNSET,

) -> ErrorResponse | SetMemoryResponse200 | SetMemoryResponse201 | None:
    """ Set a memory

     Create or update a durable JSON memory under an org or function scope.
    When no explicit scope is provided, function-authenticated requests
    use that function's id automatically; requests with
    `x-primitive-function-id` use that function id; all other requests
    default to org scope.

    `scope.type = function` requires the function id UUID in `scope.id`.
    Function names are not accepted as scope identifiers. Values must be
    valid JSON and serialize to at most 65536 UTF-8 bytes. Keys must be at
    most 512 UTF-8 bytes. `version`, `read_count`, and `write_count` are
    bigint counters serialized as strings.

    Passing `if_absent` turns the write into create-only. Passing
    `if_version` turns the write into compare-and-set. These options are
    mutually exclusive and return `memory_conflict` on a stale version or
    existing key.

    Args:
        x_primitive_function_id (UUID | Unset):
        body (SetMemoryInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | SetMemoryResponse200 | SetMemoryResponse201
     """


    return sync_detailed(
        client=client,
body=body,
x_primitive_function_id=x_primitive_function_id,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: SetMemoryInput,
    x_primitive_function_id: UUID | Unset = UNSET,

) -> Response[ErrorResponse | SetMemoryResponse200 | SetMemoryResponse201]:
    """ Set a memory

     Create or update a durable JSON memory under an org or function scope.
    When no explicit scope is provided, function-authenticated requests
    use that function's id automatically; requests with
    `x-primitive-function-id` use that function id; all other requests
    default to org scope.

    `scope.type = function` requires the function id UUID in `scope.id`.
    Function names are not accepted as scope identifiers. Values must be
    valid JSON and serialize to at most 65536 UTF-8 bytes. Keys must be at
    most 512 UTF-8 bytes. `version`, `read_count`, and `write_count` are
    bigint counters serialized as strings.

    Passing `if_absent` turns the write into create-only. Passing
    `if_version` turns the write into compare-and-set. These options are
    mutually exclusive and return `memory_conflict` on a stale version or
    existing key.

    Args:
        x_primitive_function_id (UUID | Unset):
        body (SetMemoryInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | SetMemoryResponse200 | SetMemoryResponse201]
     """


    kwargs = _get_kwargs(
        body=body,
x_primitive_function_id=x_primitive_function_id,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    body: SetMemoryInput,
    x_primitive_function_id: UUID | Unset = UNSET,

) -> ErrorResponse | SetMemoryResponse200 | SetMemoryResponse201 | None:
    """ Set a memory

     Create or update a durable JSON memory under an org or function scope.
    When no explicit scope is provided, function-authenticated requests
    use that function's id automatically; requests with
    `x-primitive-function-id` use that function id; all other requests
    default to org scope.

    `scope.type = function` requires the function id UUID in `scope.id`.
    Function names are not accepted as scope identifiers. Values must be
    valid JSON and serialize to at most 65536 UTF-8 bytes. Keys must be at
    most 512 UTF-8 bytes. `version`, `read_count`, and `write_count` are
    bigint counters serialized as strings.

    Passing `if_absent` turns the write into create-only. Passing
    `if_version` turns the write into compare-and-set. These options are
    mutually exclusive and return `memory_conflict` on a stale version or
    existing key.

    Args:
        x_primitive_function_id (UUID | Unset):
        body (SetMemoryInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | SetMemoryResponse200 | SetMemoryResponse201
     """


    return (await asyncio_detailed(
        client=client,
body=body,
x_primitive_function_id=x_primitive_function_id,

    )).parsed
