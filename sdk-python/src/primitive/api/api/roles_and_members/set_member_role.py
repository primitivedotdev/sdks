from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.set_member_role_request import SetMemberRoleRequest
from ...models.set_member_role_response_200 import SetMemberRoleResponse200
from ...types import UNSET, Unset
from typing import cast
from uuid import UUID



def _get_kwargs(
    id: UUID,
    *,
    body: SetMemberRoleRequest,
    primitive_step_up: str | Unset = UNSET,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}
    if not isinstance(primitive_step_up, Unset):
        headers["Primitive-Step-Up"] = primitive_step_up



    

    

    _kwargs: dict[str, Any] = {
        "method": "put",
        "url": "/members/{id}/role".format(id=quote(str(id), safe=""),),
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | SetMemberRoleResponse200 | None:
    if response.status_code == 200:
        response_200 = SetMemberRoleResponse200.from_dict(response.json())



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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | SetMemberRoleResponse200]:
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
    body: SetMemberRoleRequest,
    primitive_step_up: str | Unset = UNSET,

) -> Response[ErrorResponse | SetMemberRoleResponse200]:
    """ Assign a member's role

     A built-in role (owner, admin, member), a template key or a role id. Only an owner assigns or
    removes owner; nobody changes someone wider than themselves. A member whose role was changed several
    times in a row may be refused with 429 `rate_limited` for a few seconds; nothing was changed, so
    retry after `Retry-After`. A change the identity provider refuses answers 409 `conflict` with
    `details.reason` `role_change_refused`; nothing was changed. A role naming a member's personal
    mailbox goes to that member only: otherwise 403 `grant_forbidden` with `details.reason`
    `personal_mailbox_member_only`. Person only: a dashboard session, or the person's own OAuth or CLI
    token with a session step-up of purpose `roles.write` (the person confirms at the step_up_url a 403
    step_up_required answer carries, which names this client, then send the token in the Primitive-Step-
    Up header; the token works only with the client it was confirmed for). Needs roles:assign. API keys
    are refused.

    Args:
        id (UUID):
        primitive_step_up (str | Unset):
        body (SetMemberRoleRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | SetMemberRoleResponse200]
     """


    kwargs = _get_kwargs(
        id=id,
body=body,
primitive_step_up=primitive_step_up,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: SetMemberRoleRequest,
    primitive_step_up: str | Unset = UNSET,

) -> ErrorResponse | SetMemberRoleResponse200 | None:
    """ Assign a member's role

     A built-in role (owner, admin, member), a template key or a role id. Only an owner assigns or
    removes owner; nobody changes someone wider than themselves. A member whose role was changed several
    times in a row may be refused with 429 `rate_limited` for a few seconds; nothing was changed, so
    retry after `Retry-After`. A change the identity provider refuses answers 409 `conflict` with
    `details.reason` `role_change_refused`; nothing was changed. A role naming a member's personal
    mailbox goes to that member only: otherwise 403 `grant_forbidden` with `details.reason`
    `personal_mailbox_member_only`. Person only: a dashboard session, or the person's own OAuth or CLI
    token with a session step-up of purpose `roles.write` (the person confirms at the step_up_url a 403
    step_up_required answer carries, which names this client, then send the token in the Primitive-Step-
    Up header; the token works only with the client it was confirmed for). Needs roles:assign. API keys
    are refused.

    Args:
        id (UUID):
        primitive_step_up (str | Unset):
        body (SetMemberRoleRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | SetMemberRoleResponse200
     """


    return sync_detailed(
        id=id,
client=client,
body=body,
primitive_step_up=primitive_step_up,

    ).parsed

async def asyncio_detailed(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: SetMemberRoleRequest,
    primitive_step_up: str | Unset = UNSET,

) -> Response[ErrorResponse | SetMemberRoleResponse200]:
    """ Assign a member's role

     A built-in role (owner, admin, member), a template key or a role id. Only an owner assigns or
    removes owner; nobody changes someone wider than themselves. A member whose role was changed several
    times in a row may be refused with 429 `rate_limited` for a few seconds; nothing was changed, so
    retry after `Retry-After`. A change the identity provider refuses answers 409 `conflict` with
    `details.reason` `role_change_refused`; nothing was changed. A role naming a member's personal
    mailbox goes to that member only: otherwise 403 `grant_forbidden` with `details.reason`
    `personal_mailbox_member_only`. Person only: a dashboard session, or the person's own OAuth or CLI
    token with a session step-up of purpose `roles.write` (the person confirms at the step_up_url a 403
    step_up_required answer carries, which names this client, then send the token in the Primitive-Step-
    Up header; the token works only with the client it was confirmed for). Needs roles:assign. API keys
    are refused.

    Args:
        id (UUID):
        primitive_step_up (str | Unset):
        body (SetMemberRoleRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | SetMemberRoleResponse200]
     """


    kwargs = _get_kwargs(
        id=id,
body=body,
primitive_step_up=primitive_step_up,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: SetMemberRoleRequest,
    primitive_step_up: str | Unset = UNSET,

) -> ErrorResponse | SetMemberRoleResponse200 | None:
    """ Assign a member's role

     A built-in role (owner, admin, member), a template key or a role id. Only an owner assigns or
    removes owner; nobody changes someone wider than themselves. A member whose role was changed several
    times in a row may be refused with 429 `rate_limited` for a few seconds; nothing was changed, so
    retry after `Retry-After`. A change the identity provider refuses answers 409 `conflict` with
    `details.reason` `role_change_refused`; nothing was changed. A role naming a member's personal
    mailbox goes to that member only: otherwise 403 `grant_forbidden` with `details.reason`
    `personal_mailbox_member_only`. Person only: a dashboard session, or the person's own OAuth or CLI
    token with a session step-up of purpose `roles.write` (the person confirms at the step_up_url a 403
    step_up_required answer carries, which names this client, then send the token in the Primitive-Step-
    Up header; the token works only with the client it was confirmed for). Needs roles:assign. API keys
    are refused.

    Args:
        id (UUID):
        primitive_step_up (str | Unset):
        body (SetMemberRoleRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | SetMemberRoleResponse200
     """


    return (await asyncio_detailed(
        id=id,
client=client,
body=body,
primitive_step_up=primitive_step_up,

    )).parsed
