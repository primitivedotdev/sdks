from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.get_org_function_invocation_series_response_200 import GetOrgFunctionInvocationSeriesResponse200
from ...types import UNSET, Unset
from typing import cast
from uuid import UUID



def _get_kwargs(
    *,
    days: float | Unset = UNSET,
    function_id: UUID | Unset = UNSET,

) -> dict[str, Any]:
    

    

    params: dict[str, Any] = {}

    params["days"] = days

    json_function_id: str | Unset = UNSET
    if not isinstance(function_id, Unset):
        json_function_id = str(function_id)
    params["function_id"] = json_function_id


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/functions/invocation-series",
        "params": params,
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | GetOrgFunctionInvocationSeriesResponse200 | None:
    if response.status_code == 200:
        response_200 = GetOrgFunctionInvocationSeriesResponse200.from_dict(response.json())



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

    if response.status_code == 429:
        response_429 = ErrorResponse.from_dict(response.json())



        return response_429

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | GetOrgFunctionInvocationSeriesResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    days: float | Unset = UNSET,
    function_id: UUID | Unset = UNSET,

) -> Response[ErrorResponse | GetOrgFunctionInvocationSeriesResponse200]:
    """ Get daily invocation counts

     Invocations and failures per function per day, for the dashboard's activity chart. Optionally
    limited to one function.

    Args:
        days (float | Unset):
        function_id (UUID | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | GetOrgFunctionInvocationSeriesResponse200]
     """


    kwargs = _get_kwargs(
        days=days,
function_id=function_id,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    *,
    client: AuthenticatedClient | Client,
    days: float | Unset = UNSET,
    function_id: UUID | Unset = UNSET,

) -> ErrorResponse | GetOrgFunctionInvocationSeriesResponse200 | None:
    """ Get daily invocation counts

     Invocations and failures per function per day, for the dashboard's activity chart. Optionally
    limited to one function.

    Args:
        days (float | Unset):
        function_id (UUID | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | GetOrgFunctionInvocationSeriesResponse200
     """


    return sync_detailed(
        client=client,
days=days,
function_id=function_id,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    days: float | Unset = UNSET,
    function_id: UUID | Unset = UNSET,

) -> Response[ErrorResponse | GetOrgFunctionInvocationSeriesResponse200]:
    """ Get daily invocation counts

     Invocations and failures per function per day, for the dashboard's activity chart. Optionally
    limited to one function.

    Args:
        days (float | Unset):
        function_id (UUID | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | GetOrgFunctionInvocationSeriesResponse200]
     """


    kwargs = _get_kwargs(
        days=days,
function_id=function_id,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    days: float | Unset = UNSET,
    function_id: UUID | Unset = UNSET,

) -> ErrorResponse | GetOrgFunctionInvocationSeriesResponse200 | None:
    """ Get daily invocation counts

     Invocations and failures per function per day, for the dashboard's activity chart. Optionally
    limited to one function.

    Args:
        days (float | Unset):
        function_id (UUID | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | GetOrgFunctionInvocationSeriesResponse200
     """


    return (await asyncio_detailed(
        client=client,
days=days,
function_id=function_id,

    )).parsed
