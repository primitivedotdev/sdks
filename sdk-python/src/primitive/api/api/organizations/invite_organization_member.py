from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.invite_organization_member_response_200 import InviteOrganizationMemberResponse200
from ...models.projects_invite_organization_member_input import ProjectsInviteOrganizationMemberInput
from ...types import UNSET, Unset
from typing import cast



def _get_kwargs(
    *,
    body: ProjectsInviteOrganizationMemberInput,
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
        "url": "/organization/invitations",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | InviteOrganizationMemberResponse200 | None:
    if response.status_code == 200:
        response_200 = InviteOrganizationMemberResponse200.from_dict(response.json())



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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | InviteOrganizationMemberResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: ProjectsInviteOrganizationMemberInput,
    primitive_step_up: str | Unset = UNSET,
    idempotency_key: str | Unset = UNSET,

) -> Response[ErrorResponse | InviteOrganizationMemberResponse200]:
    """  Requires a current human organization owner or administrator. Machine credentials are refused.
    Invitations grant the chosen role, Member by default, only after verified acceptance through the
    sign-in or sign-up flow. Other organization memberships and project access are unchanged. Delivery
    accepted means submitted, not inbox delivery. Reuse request_id after an uncertain response.

    Args:
        primitive_step_up (str | Unset):
        idempotency_key (str | Unset):
        body (ProjectsInviteOrganizationMemberInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | InviteOrganizationMemberResponse200]
     """


    kwargs = _get_kwargs(
        body=body,
primitive_step_up=primitive_step_up,
idempotency_key=idempotency_key,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    *,
    client: AuthenticatedClient | Client,
    body: ProjectsInviteOrganizationMemberInput,
    primitive_step_up: str | Unset = UNSET,
    idempotency_key: str | Unset = UNSET,

) -> ErrorResponse | InviteOrganizationMemberResponse200 | None:
    """  Requires a current human organization owner or administrator. Machine credentials are refused.
    Invitations grant the chosen role, Member by default, only after verified acceptance through the
    sign-in or sign-up flow. Other organization memberships and project access are unchanged. Delivery
    accepted means submitted, not inbox delivery. Reuse request_id after an uncertain response.

    Args:
        primitive_step_up (str | Unset):
        idempotency_key (str | Unset):
        body (ProjectsInviteOrganizationMemberInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | InviteOrganizationMemberResponse200
     """


    return sync_detailed(
        client=client,
body=body,
primitive_step_up=primitive_step_up,
idempotency_key=idempotency_key,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: ProjectsInviteOrganizationMemberInput,
    primitive_step_up: str | Unset = UNSET,
    idempotency_key: str | Unset = UNSET,

) -> Response[ErrorResponse | InviteOrganizationMemberResponse200]:
    """  Requires a current human organization owner or administrator. Machine credentials are refused.
    Invitations grant the chosen role, Member by default, only after verified acceptance through the
    sign-in or sign-up flow. Other organization memberships and project access are unchanged. Delivery
    accepted means submitted, not inbox delivery. Reuse request_id after an uncertain response.

    Args:
        primitive_step_up (str | Unset):
        idempotency_key (str | Unset):
        body (ProjectsInviteOrganizationMemberInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | InviteOrganizationMemberResponse200]
     """


    kwargs = _get_kwargs(
        body=body,
primitive_step_up=primitive_step_up,
idempotency_key=idempotency_key,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    body: ProjectsInviteOrganizationMemberInput,
    primitive_step_up: str | Unset = UNSET,
    idempotency_key: str | Unset = UNSET,

) -> ErrorResponse | InviteOrganizationMemberResponse200 | None:
    """  Requires a current human organization owner or administrator. Machine credentials are refused.
    Invitations grant the chosen role, Member by default, only after verified acceptance through the
    sign-in or sign-up flow. Other organization memberships and project access are unchanged. Delivery
    accepted means submitted, not inbox delivery. Reuse request_id after an uncertain response.

    Args:
        primitive_step_up (str | Unset):
        idempotency_key (str | Unset):
        body (ProjectsInviteOrganizationMemberInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | InviteOrganizationMemberResponse200
     """


    return (await asyncio_detailed(
        client=client,
body=body,
primitive_step_up=primitive_step_up,
idempotency_key=idempotency_key,

    )).parsed
