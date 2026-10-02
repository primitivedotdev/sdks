from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.stop_agent_message_schedule_input import StopAgentMessageScheduleInput
from ...models.stop_agent_message_schedule_response_200 import StopAgentMessageScheduleResponse200
from ...types import UNSET, Unset
from typing import cast
from uuid import UUID



def _get_kwargs(
    id: UUID,
    *,
    body: StopAgentMessageScheduleInput | Unset = UNSET,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/emails/{id}/schedule-stop".format(id=quote(str(id), safe=""),),
    }

    
    if not isinstance(body, Unset):
        _kwargs["json"] = body.to_dict()
        headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | StopAgentMessageScheduleResponse200 | None:
    if response.status_code == 200:
        response_200 = StopAgentMessageScheduleResponse200.from_dict(response.json())



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

    if response.status_code == 422:
        response_422 = ErrorResponse.from_dict(response.json())



        return response_422

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | StopAgentMessageScheduleResponse200]:
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
    body: StopAgentMessageScheduleInput | Unset = UNSET,

) -> Response[ErrorResponse | StopAgentMessageScheduleResponse200]:
    """ Stop the schedule behind a scheduled message

     Called by the receiving agent with its own connected-agent
    credential. `id` is the agent's received copy of any message of the
    schedule. Stops the schedule when it allows the agent to, and sends a
    reply in the schedule's thread carrying a `schedule.stop/1`
    interaction so the owner sees it. Calling it again on a schedule the
    agent already stopped returns the same result without a second reply.

    Args:
        id (UUID):
        body (StopAgentMessageScheduleInput | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | StopAgentMessageScheduleResponse200]
     """


    kwargs = _get_kwargs(
        id=id,
body=body,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: StopAgentMessageScheduleInput | Unset = UNSET,

) -> ErrorResponse | StopAgentMessageScheduleResponse200 | None:
    """ Stop the schedule behind a scheduled message

     Called by the receiving agent with its own connected-agent
    credential. `id` is the agent's received copy of any message of the
    schedule. Stops the schedule when it allows the agent to, and sends a
    reply in the schedule's thread carrying a `schedule.stop/1`
    interaction so the owner sees it. Calling it again on a schedule the
    agent already stopped returns the same result without a second reply.

    Args:
        id (UUID):
        body (StopAgentMessageScheduleInput | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | StopAgentMessageScheduleResponse200
     """


    return sync_detailed(
        id=id,
client=client,
body=body,

    ).parsed

async def asyncio_detailed(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: StopAgentMessageScheduleInput | Unset = UNSET,

) -> Response[ErrorResponse | StopAgentMessageScheduleResponse200]:
    """ Stop the schedule behind a scheduled message

     Called by the receiving agent with its own connected-agent
    credential. `id` is the agent's received copy of any message of the
    schedule. Stops the schedule when it allows the agent to, and sends a
    reply in the schedule's thread carrying a `schedule.stop/1`
    interaction so the owner sees it. Calling it again on a schedule the
    agent already stopped returns the same result without a second reply.

    Args:
        id (UUID):
        body (StopAgentMessageScheduleInput | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | StopAgentMessageScheduleResponse200]
     """


    kwargs = _get_kwargs(
        id=id,
body=body,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: StopAgentMessageScheduleInput | Unset = UNSET,

) -> ErrorResponse | StopAgentMessageScheduleResponse200 | None:
    """ Stop the schedule behind a scheduled message

     Called by the receiving agent with its own connected-agent
    credential. `id` is the agent's received copy of any message of the
    schedule. Stops the schedule when it allows the agent to, and sends a
    reply in the schedule's thread carrying a `schedule.stop/1`
    interaction so the owner sees it. Calling it again on a schedule the
    agent already stopped returns the same result without a second reply.

    Args:
        id (UUID):
        body (StopAgentMessageScheduleInput | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | StopAgentMessageScheduleResponse200
     """


    return (await asyncio_detailed(
        id=id,
client=client,
body=body,

    )).parsed
