from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.search_memories_include_value import SearchMemoriesIncludeValue
from ...models.search_memories_response_200 import SearchMemoriesResponse200
from ...models.search_memories_scope_type import SearchMemoriesScopeType
from ...types import UNSET, Unset
from dateutil.parser import isoparse
from typing import cast
from uuid import UUID
import datetime



def _get_kwargs(
    *,
    prefix: str | Unset = '',
    cursor: str | Unset = UNSET,
    limit: int | Unset = 50,
    include_value: SearchMemoriesIncludeValue | Unset = SearchMemoriesIncludeValue.TRUE,
    updated_after: datetime.datetime | Unset = UNSET,
    updated_before: datetime.datetime | Unset = UNSET,
    scope_type: SearchMemoriesScopeType | Unset = UNSET,
    scope_id: UUID | Unset = UNSET,
    x_primitive_function_id: UUID | Unset = UNSET,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}
    if not isinstance(x_primitive_function_id, Unset):
        headers["x-primitive-function-id"] = x_primitive_function_id



    

    params: dict[str, Any] = {}

    params["prefix"] = prefix

    params["cursor"] = cursor

    params["limit"] = limit

    json_include_value: str | Unset = UNSET
    if not isinstance(include_value, Unset):
        json_include_value = include_value.value

    params["include_value"] = json_include_value

    json_updated_after: str | Unset = UNSET
    if not isinstance(updated_after, Unset):
        json_updated_after = updated_after.isoformat()
    params["updated_after"] = json_updated_after

    json_updated_before: str | Unset = UNSET
    if not isinstance(updated_before, Unset):
        json_updated_before = updated_before.isoformat()
    params["updated_before"] = json_updated_before

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
        "url": "/memories/search",
        "params": params,
    }


    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | SearchMemoriesResponse200 | None:
    if response.status_code == 200:
        response_200 = SearchMemoriesResponse200.from_dict(response.json())



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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | SearchMemoriesResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    prefix: str | Unset = '',
    cursor: str | Unset = UNSET,
    limit: int | Unset = 50,
    include_value: SearchMemoriesIncludeValue | Unset = SearchMemoriesIncludeValue.TRUE,
    updated_after: datetime.datetime | Unset = UNSET,
    updated_before: datetime.datetime | Unset = UNSET,
    scope_type: SearchMemoriesScopeType | Unset = UNSET,
    scope_id: UUID | Unset = UNSET,
    x_primitive_function_id: UUID | Unset = UNSET,

) -> Response[ErrorResponse | SearchMemoriesResponse200]:
    """ Search memories

     List active memories in a scope by lexicographic key prefix. Results
    are ordered by key ascending. The `meta.cursor` value is the next key
    cursor; pass it back as `cursor` to continue after that key.

    Search records one memory read usage event for the operation. Pass
    `include_value=false` to return metadata only.

    Args:
        prefix (str | Unset):  Default: ''.
        cursor (str | Unset):
        limit (int | Unset):  Default: 50.
        include_value (SearchMemoriesIncludeValue | Unset):  Default:
            SearchMemoriesIncludeValue.TRUE.
        updated_after (datetime.datetime | Unset):
        updated_before (datetime.datetime | Unset):
        scope_type (SearchMemoriesScopeType | Unset):
        scope_id (UUID | Unset):
        x_primitive_function_id (UUID | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | SearchMemoriesResponse200]
     """


    kwargs = _get_kwargs(
        prefix=prefix,
cursor=cursor,
limit=limit,
include_value=include_value,
updated_after=updated_after,
updated_before=updated_before,
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
    prefix: str | Unset = '',
    cursor: str | Unset = UNSET,
    limit: int | Unset = 50,
    include_value: SearchMemoriesIncludeValue | Unset = SearchMemoriesIncludeValue.TRUE,
    updated_after: datetime.datetime | Unset = UNSET,
    updated_before: datetime.datetime | Unset = UNSET,
    scope_type: SearchMemoriesScopeType | Unset = UNSET,
    scope_id: UUID | Unset = UNSET,
    x_primitive_function_id: UUID | Unset = UNSET,

) -> ErrorResponse | SearchMemoriesResponse200 | None:
    """ Search memories

     List active memories in a scope by lexicographic key prefix. Results
    are ordered by key ascending. The `meta.cursor` value is the next key
    cursor; pass it back as `cursor` to continue after that key.

    Search records one memory read usage event for the operation. Pass
    `include_value=false` to return metadata only.

    Args:
        prefix (str | Unset):  Default: ''.
        cursor (str | Unset):
        limit (int | Unset):  Default: 50.
        include_value (SearchMemoriesIncludeValue | Unset):  Default:
            SearchMemoriesIncludeValue.TRUE.
        updated_after (datetime.datetime | Unset):
        updated_before (datetime.datetime | Unset):
        scope_type (SearchMemoriesScopeType | Unset):
        scope_id (UUID | Unset):
        x_primitive_function_id (UUID | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | SearchMemoriesResponse200
     """


    return sync_detailed(
        client=client,
prefix=prefix,
cursor=cursor,
limit=limit,
include_value=include_value,
updated_after=updated_after,
updated_before=updated_before,
scope_type=scope_type,
scope_id=scope_id,
x_primitive_function_id=x_primitive_function_id,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    prefix: str | Unset = '',
    cursor: str | Unset = UNSET,
    limit: int | Unset = 50,
    include_value: SearchMemoriesIncludeValue | Unset = SearchMemoriesIncludeValue.TRUE,
    updated_after: datetime.datetime | Unset = UNSET,
    updated_before: datetime.datetime | Unset = UNSET,
    scope_type: SearchMemoriesScopeType | Unset = UNSET,
    scope_id: UUID | Unset = UNSET,
    x_primitive_function_id: UUID | Unset = UNSET,

) -> Response[ErrorResponse | SearchMemoriesResponse200]:
    """ Search memories

     List active memories in a scope by lexicographic key prefix. Results
    are ordered by key ascending. The `meta.cursor` value is the next key
    cursor; pass it back as `cursor` to continue after that key.

    Search records one memory read usage event for the operation. Pass
    `include_value=false` to return metadata only.

    Args:
        prefix (str | Unset):  Default: ''.
        cursor (str | Unset):
        limit (int | Unset):  Default: 50.
        include_value (SearchMemoriesIncludeValue | Unset):  Default:
            SearchMemoriesIncludeValue.TRUE.
        updated_after (datetime.datetime | Unset):
        updated_before (datetime.datetime | Unset):
        scope_type (SearchMemoriesScopeType | Unset):
        scope_id (UUID | Unset):
        x_primitive_function_id (UUID | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | SearchMemoriesResponse200]
     """


    kwargs = _get_kwargs(
        prefix=prefix,
cursor=cursor,
limit=limit,
include_value=include_value,
updated_after=updated_after,
updated_before=updated_before,
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
    prefix: str | Unset = '',
    cursor: str | Unset = UNSET,
    limit: int | Unset = 50,
    include_value: SearchMemoriesIncludeValue | Unset = SearchMemoriesIncludeValue.TRUE,
    updated_after: datetime.datetime | Unset = UNSET,
    updated_before: datetime.datetime | Unset = UNSET,
    scope_type: SearchMemoriesScopeType | Unset = UNSET,
    scope_id: UUID | Unset = UNSET,
    x_primitive_function_id: UUID | Unset = UNSET,

) -> ErrorResponse | SearchMemoriesResponse200 | None:
    """ Search memories

     List active memories in a scope by lexicographic key prefix. Results
    are ordered by key ascending. The `meta.cursor` value is the next key
    cursor; pass it back as `cursor` to continue after that key.

    Search records one memory read usage event for the operation. Pass
    `include_value=false` to return metadata only.

    Args:
        prefix (str | Unset):  Default: ''.
        cursor (str | Unset):
        limit (int | Unset):  Default: 50.
        include_value (SearchMemoriesIncludeValue | Unset):  Default:
            SearchMemoriesIncludeValue.TRUE.
        updated_after (datetime.datetime | Unset):
        updated_before (datetime.datetime | Unset):
        scope_type (SearchMemoriesScopeType | Unset):
        scope_id (UUID | Unset):
        x_primitive_function_id (UUID | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | SearchMemoriesResponse200
     """


    return (await asyncio_detailed(
        client=client,
prefix=prefix,
cursor=cursor,
limit=limit,
include_value=include_value,
updated_after=updated_after,
updated_before=updated_before,
scope_type=scope_type,
scope_id=scope_id,
x_primitive_function_id=x_primitive_function_id,

    )).parsed
