from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.list_project_invitations_response_200 import ListProjectInvitationsResponse200
from typing import cast
from uuid import UUID



def _get_kwargs(
    project_id: UUID,

) -> dict[str, Any]:
    

    

    

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/projects/{project_id}/invitations".format(project_id=quote(str(project_id), safe=""),),
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | ListProjectInvitationsResponse200 | None:
    if response.status_code == 200:
        response_200 = ListProjectInvitationsResponse200.from_dict(response.json())



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

    if response.status_code == 503:
        response_503 = ErrorResponse.from_dict(response.json())



        return response_503

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | ListProjectInvitationsResponse200]:
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

) -> Response[ErrorResponse | ListProjectInvitationsResponse200]:
    """  Requires a current human organization membership. Machine credentials are refused. Results are
    scoped to current project access. No local paths or existing conversation history are shared.

    Args:
        project_id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ListProjectInvitationsResponse200]
     """


    kwargs = _get_kwargs(
        project_id=project_id,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    project_id: UUID,
    *,
    client: AuthenticatedClient | Client,

) -> ErrorResponse | ListProjectInvitationsResponse200 | None:
    """  Requires a current human organization membership. Machine credentials are refused. Results are
    scoped to current project access. No local paths or existing conversation history are shared.

    Args:
        project_id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ListProjectInvitationsResponse200
     """


    return sync_detailed(
        project_id=project_id,
client=client,

    ).parsed

async def asyncio_detailed(
    project_id: UUID,
    *,
    client: AuthenticatedClient | Client,

) -> Response[ErrorResponse | ListProjectInvitationsResponse200]:
    """  Requires a current human organization membership. Machine credentials are refused. Results are
    scoped to current project access. No local paths or existing conversation history are shared.

    Args:
        project_id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ListProjectInvitationsResponse200]
     """


    kwargs = _get_kwargs(
        project_id=project_id,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    project_id: UUID,
    *,
    client: AuthenticatedClient | Client,

) -> ErrorResponse | ListProjectInvitationsResponse200 | None:
    """  Requires a current human organization membership. Machine credentials are refused. Results are
    scoped to current project access. No local paths or existing conversation history are shared.

    Args:
        project_id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ListProjectInvitationsResponse200
     """


    return (await asyncio_detailed(
        project_id=project_id,
client=client,

    )).parsed
