from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.invite_project_member_response_200 import InviteProjectMemberResponse200
from ...models.projects_invite_project_member_input import ProjectsInviteProjectMemberInput
from ...types import UNSET, Unset
from typing import cast
from uuid import UUID



def _get_kwargs(
    project_id: UUID,
    *,
    body: ProjectsInviteProjectMemberInput,
    primitive_step_up: str | Unset = UNSET,
    idempotency_key: str | Unset = UNSET,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}
    if not isinstance(primitive_step_up, Unset):
        headers["Primitive-Step-Up"] = primitive_step_up

    if not isinstance(idempotency_key, Unset):
        headers["Idempotency-Key"] = idempotency_key



    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/projects/{project_id}/invitations".format(project_id=quote(str(project_id), safe=""),),
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | InviteProjectMemberResponse200 | None:
    if response.status_code == 200:
        response_200 = InviteProjectMemberResponse200.from_dict(response.json())



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

    if response.status_code == 502:
        response_502 = ErrorResponse.from_dict(response.json())



        return response_502

    if response.status_code == 503:
        response_503 = ErrorResponse.from_dict(response.json())



        return response_503

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | InviteProjectMemberResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    project_id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: ProjectsInviteProjectMemberInput,
    primitive_step_up: str | Unset = UNSET,
    idempotency_key: str | Unset = UNSET,

) -> Response[ErrorResponse | InviteProjectMemberResponse200]:
    """  Requires a current human organization membership. Machine credentials are refused. Results are
    scoped to current project access. No local paths or existing conversation history are shared.

    Args:
        project_id (UUID):
        primitive_step_up (str | Unset):
        idempotency_key (str | Unset):
        body (ProjectsInviteProjectMemberInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | InviteProjectMemberResponse200]
     """


    kwargs = _get_kwargs(
        project_id=project_id,
body=body,
primitive_step_up=primitive_step_up,
idempotency_key=idempotency_key,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    project_id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: ProjectsInviteProjectMemberInput,
    primitive_step_up: str | Unset = UNSET,
    idempotency_key: str | Unset = UNSET,

) -> ErrorResponse | InviteProjectMemberResponse200 | None:
    """  Requires a current human organization membership. Machine credentials are refused. Results are
    scoped to current project access. No local paths or existing conversation history are shared.

    Args:
        project_id (UUID):
        primitive_step_up (str | Unset):
        idempotency_key (str | Unset):
        body (ProjectsInviteProjectMemberInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | InviteProjectMemberResponse200
     """


    return sync_detailed(
        project_id=project_id,
client=client,
body=body,
primitive_step_up=primitive_step_up,
idempotency_key=idempotency_key,

    ).parsed

async def asyncio_detailed(
    project_id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: ProjectsInviteProjectMemberInput,
    primitive_step_up: str | Unset = UNSET,
    idempotency_key: str | Unset = UNSET,

) -> Response[ErrorResponse | InviteProjectMemberResponse200]:
    """  Requires a current human organization membership. Machine credentials are refused. Results are
    scoped to current project access. No local paths or existing conversation history are shared.

    Args:
        project_id (UUID):
        primitive_step_up (str | Unset):
        idempotency_key (str | Unset):
        body (ProjectsInviteProjectMemberInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | InviteProjectMemberResponse200]
     """


    kwargs = _get_kwargs(
        project_id=project_id,
body=body,
primitive_step_up=primitive_step_up,
idempotency_key=idempotency_key,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    project_id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: ProjectsInviteProjectMemberInput,
    primitive_step_up: str | Unset = UNSET,
    idempotency_key: str | Unset = UNSET,

) -> ErrorResponse | InviteProjectMemberResponse200 | None:
    """  Requires a current human organization membership. Machine credentials are refused. Results are
    scoped to current project access. No local paths or existing conversation history are shared.

    Args:
        project_id (UUID):
        primitive_step_up (str | Unset):
        idempotency_key (str | Unset):
        body (ProjectsInviteProjectMemberInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | InviteProjectMemberResponse200
     """


    return (await asyncio_detailed(
        project_id=project_id,
client=client,
body=body,
primitive_step_up=primitive_step_up,
idempotency_key=idempotency_key,

    )).parsed
