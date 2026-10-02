from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.create_agent_message_schedule_input import CreateAgentMessageScheduleInput
from ...models.create_agent_message_schedule_response_201 import CreateAgentMessageScheduleResponse201
from ...models.error_response import ErrorResponse
from typing import cast



def _get_kwargs(
    *,
    body: CreateAgentMessageScheduleInput,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/agent-message-schedules",
    }

    _kwargs["json"] = body.to_dict()


    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> CreateAgentMessageScheduleResponse201 | ErrorResponse | None:
    if response.status_code == 201:
        response_201 = CreateAgentMessageScheduleResponse201.from_dict(response.json())



        return response_201

    if response.status_code == 400:
        response_400 = ErrorResponse.from_dict(response.json())



        return response_400

    if response.status_code == 401:
        response_401 = ErrorResponse.from_dict(response.json())



        return response_401

    if response.status_code == 403:
        response_403 = ErrorResponse.from_dict(response.json())



        return response_403

    if response.status_code == 409:
        response_409 = ErrorResponse.from_dict(response.json())



        return response_409

    if response.status_code == 422:
        response_422 = ErrorResponse.from_dict(response.json())



        return response_422

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[CreateAgentMessageScheduleResponse201 | ErrorResponse]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: CreateAgentMessageScheduleInput,

) -> Response[CreateAgentMessageScheduleResponse201 | ErrorResponse]:
    """ Create an agent message schedule

     Schedule a recurring message from the calling member's personal
    address to one of the org's connected agents. The first message is
    sent on the next scheduler pass; later messages reply in the same
    thread every `interval_minutes`. With `idle_minutes` set, a due
    message is skipped while the agent has been active within that many
    minutes. Member credentials only; API keys and agent keys receive
    403.

    Args:
        body (CreateAgentMessageScheduleInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[CreateAgentMessageScheduleResponse201 | ErrorResponse]
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
    body: CreateAgentMessageScheduleInput,

) -> CreateAgentMessageScheduleResponse201 | ErrorResponse | None:
    """ Create an agent message schedule

     Schedule a recurring message from the calling member's personal
    address to one of the org's connected agents. The first message is
    sent on the next scheduler pass; later messages reply in the same
    thread every `interval_minutes`. With `idle_minutes` set, a due
    message is skipped while the agent has been active within that many
    minutes. Member credentials only; API keys and agent keys receive
    403.

    Args:
        body (CreateAgentMessageScheduleInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        CreateAgentMessageScheduleResponse201 | ErrorResponse
     """


    return sync_detailed(
        client=client,
body=body,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: CreateAgentMessageScheduleInput,

) -> Response[CreateAgentMessageScheduleResponse201 | ErrorResponse]:
    """ Create an agent message schedule

     Schedule a recurring message from the calling member's personal
    address to one of the org's connected agents. The first message is
    sent on the next scheduler pass; later messages reply in the same
    thread every `interval_minutes`. With `idle_minutes` set, a due
    message is skipped while the agent has been active within that many
    minutes. Member credentials only; API keys and agent keys receive
    403.

    Args:
        body (CreateAgentMessageScheduleInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[CreateAgentMessageScheduleResponse201 | ErrorResponse]
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
    body: CreateAgentMessageScheduleInput,

) -> CreateAgentMessageScheduleResponse201 | ErrorResponse | None:
    """ Create an agent message schedule

     Schedule a recurring message from the calling member's personal
    address to one of the org's connected agents. The first message is
    sent on the next scheduler pass; later messages reply in the same
    thread every `interval_minutes`. With `idle_minutes` set, a due
    message is skipped while the agent has been active within that many
    minutes. Member credentials only; API keys and agent keys receive
    403.

    Args:
        body (CreateAgentMessageScheduleInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        CreateAgentMessageScheduleResponse201 | ErrorResponse
     """


    return (await asyncio_detailed(
        client=client,
body=body,

    )).parsed
