from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.update_agent_message_schedule_input import UpdateAgentMessageScheduleInput
from ...models.update_agent_message_schedule_response_200 import UpdateAgentMessageScheduleResponse200
from typing import cast
from uuid import UUID



def _get_kwargs(
    id: UUID,
    *,
    body: UpdateAgentMessageScheduleInput,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "patch",
        "url": "/agent-message-schedules/{id}".format(id=quote(str(id), safe=""),),
    }

    _kwargs["json"] = body.to_dict()


    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | UpdateAgentMessageScheduleResponse200 | None:
    if response.status_code == 200:
        response_200 = UpdateAgentMessageScheduleResponse200.from_dict(response.json())



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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | UpdateAgentMessageScheduleResponse200]:
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
    body: UpdateAgentMessageScheduleInput,

) -> Response[ErrorResponse | UpdateAgentMessageScheduleResponse200]:
    """ Update an agent message schedule

     Pause, resume, or stop a schedule, or change its subject, message,
    cadence, inactivity condition, or whether the agent may stop it.
    Setting `status` to `active` resumes a paused or stopped schedule and
    sends on the next scheduler pass. A null `idle_minutes` clears the
    inactivity condition. Member credentials only; API keys and agent
    keys receive 403.

    Args:
        id (UUID):
        body (UpdateAgentMessageScheduleInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | UpdateAgentMessageScheduleResponse200]
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
    body: UpdateAgentMessageScheduleInput,

) -> ErrorResponse | UpdateAgentMessageScheduleResponse200 | None:
    """ Update an agent message schedule

     Pause, resume, or stop a schedule, or change its subject, message,
    cadence, inactivity condition, or whether the agent may stop it.
    Setting `status` to `active` resumes a paused or stopped schedule and
    sends on the next scheduler pass. A null `idle_minutes` clears the
    inactivity condition. Member credentials only; API keys and agent
    keys receive 403.

    Args:
        id (UUID):
        body (UpdateAgentMessageScheduleInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | UpdateAgentMessageScheduleResponse200
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
    body: UpdateAgentMessageScheduleInput,

) -> Response[ErrorResponse | UpdateAgentMessageScheduleResponse200]:
    """ Update an agent message schedule

     Pause, resume, or stop a schedule, or change its subject, message,
    cadence, inactivity condition, or whether the agent may stop it.
    Setting `status` to `active` resumes a paused or stopped schedule and
    sends on the next scheduler pass. A null `idle_minutes` clears the
    inactivity condition. Member credentials only; API keys and agent
    keys receive 403.

    Args:
        id (UUID):
        body (UpdateAgentMessageScheduleInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | UpdateAgentMessageScheduleResponse200]
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
    body: UpdateAgentMessageScheduleInput,

) -> ErrorResponse | UpdateAgentMessageScheduleResponse200 | None:
    """ Update an agent message schedule

     Pause, resume, or stop a schedule, or change its subject, message,
    cadence, inactivity condition, or whether the agent may stop it.
    Setting `status` to `active` resumes a paused or stopped schedule and
    sends on the next scheduler pass. A null `idle_minutes` clears the
    inactivity condition. Member credentials only; API keys and agent
    keys receive 403.

    Args:
        id (UUID):
        body (UpdateAgentMessageScheduleInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | UpdateAgentMessageScheduleResponse200
     """


    return (await asyncio_detailed(
        id=id,
client=client,
body=body,

    )).parsed
