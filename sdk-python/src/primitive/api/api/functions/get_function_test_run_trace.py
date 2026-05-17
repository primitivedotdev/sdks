from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.get_function_test_run_trace_response_200 import GetFunctionTestRunTraceResponse200
from typing import cast
from uuid import UUID



def _get_kwargs(
    id: UUID,
    run_id: UUID,

) -> dict[str, Any]:
    

    

    

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/functions/{id}/test-runs/{run_id}/trace".format(id=quote(str(id), safe=""),run_id=quote(str(run_id), safe=""),),
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | GetFunctionTestRunTraceResponse200 | None:
    if response.status_code == 200:
        response_200 = GetFunctionTestRunTraceResponse200.from_dict(response.json())



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

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | GetFunctionTestRunTraceResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    id: UUID,
    run_id: UUID,
    *,
    client: AuthenticatedClient | Client,

) -> Response[ErrorResponse | GetFunctionTestRunTraceResponse200]:
    """ Get a function test run trace

     Returns the current end-to-end trace for a function test run.
    The trace is intentionally partial while the test is still in
    flight: callers can poll this endpoint and watch it fill in
    from send -> inbound -> webhook deliveries -> outbound
    requests, logs, and replies.

    Args:
        id (UUID):
        run_id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | GetFunctionTestRunTraceResponse200]
     """


    kwargs = _get_kwargs(
        id=id,
run_id=run_id,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    id: UUID,
    run_id: UUID,
    *,
    client: AuthenticatedClient | Client,

) -> ErrorResponse | GetFunctionTestRunTraceResponse200 | None:
    """ Get a function test run trace

     Returns the current end-to-end trace for a function test run.
    The trace is intentionally partial while the test is still in
    flight: callers can poll this endpoint and watch it fill in
    from send -> inbound -> webhook deliveries -> outbound
    requests, logs, and replies.

    Args:
        id (UUID):
        run_id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | GetFunctionTestRunTraceResponse200
     """


    return sync_detailed(
        id=id,
run_id=run_id,
client=client,

    ).parsed

async def asyncio_detailed(
    id: UUID,
    run_id: UUID,
    *,
    client: AuthenticatedClient | Client,

) -> Response[ErrorResponse | GetFunctionTestRunTraceResponse200]:
    """ Get a function test run trace

     Returns the current end-to-end trace for a function test run.
    The trace is intentionally partial while the test is still in
    flight: callers can poll this endpoint and watch it fill in
    from send -> inbound -> webhook deliveries -> outbound
    requests, logs, and replies.

    Args:
        id (UUID):
        run_id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | GetFunctionTestRunTraceResponse200]
     """


    kwargs = _get_kwargs(
        id=id,
run_id=run_id,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    id: UUID,
    run_id: UUID,
    *,
    client: AuthenticatedClient | Client,

) -> ErrorResponse | GetFunctionTestRunTraceResponse200 | None:
    """ Get a function test run trace

     Returns the current end-to-end trace for a function test run.
    The trace is intentionally partial while the test is still in
    flight: callers can poll this endpoint and watch it fill in
    from send -> inbound -> webhook deliveries -> outbound
    requests, logs, and replies.

    Args:
        id (UUID):
        run_id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | GetFunctionTestRunTraceResponse200
     """


    return (await asyncio_detailed(
        id=id,
run_id=run_id,
client=client,

    )).parsed
