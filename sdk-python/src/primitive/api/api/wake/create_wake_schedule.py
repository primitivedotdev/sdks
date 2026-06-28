from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.create_wake_schedule_input import CreateWakeScheduleInput
from ...models.create_wake_schedule_response_201 import CreateWakeScheduleResponse201
from ...models.error_response import ErrorResponse
from typing import cast



def _get_kwargs(
    *,
    body: CreateWakeScheduleInput,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/wake/schedules",
    }

    _kwargs["json"] = body.to_dict()


    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> CreateWakeScheduleResponse201 | ErrorResponse | None:
    if response.status_code == 201:
        response_201 = CreateWakeScheduleResponse201.from_dict(response.json())



        return response_201

    if response.status_code == 400:
        response_400 = ErrorResponse.from_dict(response.json())



        return response_400

    if response.status_code == 401:
        response_401 = ErrorResponse.from_dict(response.json())



        return response_401

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[CreateWakeScheduleResponse201 | ErrorResponse]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: CreateWakeScheduleInput,

) -> Response[CreateWakeScheduleResponse201 | ErrorResponse]:
    """ Create a wake schedule

     Create a cron schedule that sends a wake.dispatch command to one of your
    own function addresses. `from` and `to` must differ (no self-dispatch);
    the cron expression and IANA timezone are validated and the first fire
    time is computed without firing immediately.

    Args:
        body (CreateWakeScheduleInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[CreateWakeScheduleResponse201 | ErrorResponse]
     """


    kwargs = _get_kwargs(
        body=body,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    *,
    client: AuthenticatedClient | Client,
    body: CreateWakeScheduleInput,

) -> CreateWakeScheduleResponse201 | ErrorResponse | None:
    """ Create a wake schedule

     Create a cron schedule that sends a wake.dispatch command to one of your
    own function addresses. `from` and `to` must differ (no self-dispatch);
    the cron expression and IANA timezone are validated and the first fire
    time is computed without firing immediately.

    Args:
        body (CreateWakeScheduleInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        CreateWakeScheduleResponse201 | ErrorResponse
     """


    return sync_detailed(
        client=client,
body=body,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: CreateWakeScheduleInput,

) -> Response[CreateWakeScheduleResponse201 | ErrorResponse]:
    """ Create a wake schedule

     Create a cron schedule that sends a wake.dispatch command to one of your
    own function addresses. `from` and `to` must differ (no self-dispatch);
    the cron expression and IANA timezone are validated and the first fire
    time is computed without firing immediately.

    Args:
        body (CreateWakeScheduleInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[CreateWakeScheduleResponse201 | ErrorResponse]
     """


    kwargs = _get_kwargs(
        body=body,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    body: CreateWakeScheduleInput,

) -> CreateWakeScheduleResponse201 | ErrorResponse | None:
    """ Create a wake schedule

     Create a cron schedule that sends a wake.dispatch command to one of your
    own function addresses. `from` and `to` must differ (no self-dispatch);
    the cron expression and IANA timezone are validated and the first fire
    time is computed without firing immediately.

    Args:
        body (CreateWakeScheduleInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        CreateWakeScheduleResponse201 | ErrorResponse
     """


    return (await asyncio_detailed(
        client=client,
body=body,

    )).parsed
