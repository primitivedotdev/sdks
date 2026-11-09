from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.agent_work_manage_state_body import AgentWorkManageStateBody
from ...models.agent_work_manage_state_response_200 import AgentWorkManageStateResponse200
from ...models.error_response import ErrorResponse
from typing import cast
from uuid import UUID



def _get_kwargs(
    agent_id: UUID,
    work_id: UUID,
    *,
    body: AgentWorkManageStateBody,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/agent-work/agents/{agent_id}/records/{work_id}/owner-status".format(agent_id=quote(str(agent_id), safe=""),work_id=quote(str(work_id), safe=""),),
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> AgentWorkManageStateResponse200 | ErrorResponse | None:
    if response.status_code == 200:
        response_200 = AgentWorkManageStateResponse200.from_dict(response.json())



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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[AgentWorkManageStateResponse200 | ErrorResponse]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    agent_id: UUID,
    work_id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: AgentWorkManageStateBody,

) -> Response[AgentWorkManageStateResponse200 | ErrorResponse]:
    """ manage State

     The current human owner may cancel or reopen work with its expected version. Reopening never
    restores a previous agreement. Agent-delegate and primitive-agent OAuth credentials cannot perform
    this action.

    Args:
        agent_id (UUID):
        work_id (UUID):
        body (AgentWorkManageStateBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[AgentWorkManageStateResponse200 | ErrorResponse]
     """


    kwargs = _get_kwargs(
        agent_id=agent_id,
work_id=work_id,
body=body,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    agent_id: UUID,
    work_id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: AgentWorkManageStateBody,

) -> AgentWorkManageStateResponse200 | ErrorResponse | None:
    """ manage State

     The current human owner may cancel or reopen work with its expected version. Reopening never
    restores a previous agreement. Agent-delegate and primitive-agent OAuth credentials cannot perform
    this action.

    Args:
        agent_id (UUID):
        work_id (UUID):
        body (AgentWorkManageStateBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        AgentWorkManageStateResponse200 | ErrorResponse
     """


    return sync_detailed(
        agent_id=agent_id,
work_id=work_id,
client=client,
body=body,

    ).parsed

async def asyncio_detailed(
    agent_id: UUID,
    work_id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: AgentWorkManageStateBody,

) -> Response[AgentWorkManageStateResponse200 | ErrorResponse]:
    """ manage State

     The current human owner may cancel or reopen work with its expected version. Reopening never
    restores a previous agreement. Agent-delegate and primitive-agent OAuth credentials cannot perform
    this action.

    Args:
        agent_id (UUID):
        work_id (UUID):
        body (AgentWorkManageStateBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[AgentWorkManageStateResponse200 | ErrorResponse]
     """


    kwargs = _get_kwargs(
        agent_id=agent_id,
work_id=work_id,
body=body,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    agent_id: UUID,
    work_id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: AgentWorkManageStateBody,

) -> AgentWorkManageStateResponse200 | ErrorResponse | None:
    """ manage State

     The current human owner may cancel or reopen work with its expected version. Reopening never
    restores a previous agreement. Agent-delegate and primitive-agent OAuth credentials cannot perform
    this action.

    Args:
        agent_id (UUID):
        work_id (UUID):
        body (AgentWorkManageStateBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        AgentWorkManageStateResponse200 | ErrorResponse
     """


    return (await asyncio_detailed(
        agent_id=agent_id,
work_id=work_id,
client=client,
body=body,

    )).parsed
