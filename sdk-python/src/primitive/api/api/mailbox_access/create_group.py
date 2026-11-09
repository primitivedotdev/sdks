from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.create_group_request import CreateGroupRequest
from ...models.create_group_response_201 import CreateGroupResponse201
from ...models.error_response import ErrorResponse
from ...types import UNSET, Unset
from typing import cast



def _get_kwargs(
    *,
    body: CreateGroupRequest,
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
        "url": "/groups",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> CreateGroupResponse201 | ErrorResponse | None:
    if response.status_code == 201:
        response_201 = CreateGroupResponse201.from_dict(response.json())



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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[CreateGroupResponse201 | ErrorResponse]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: CreateGroupRequest,
    primitive_step_up: str | Unset = UNSET,
    idempotency_key: str | Unset = UNSET,

) -> Response[CreateGroupResponse201 | ErrorResponse]:
    """ Create a group

     Creates a group. Needs roles:assign. With an org-wide API key (acting for its person) or the
    person's own Primitive CLI the group must have no role: a group with a role is role assignment, done
    in a dashboard session or with a session step-up. Adding members to a group that holds mailbox
    access gives them that access, so each of its entries is checked as for a mailbox edit. A group
    whose role names a member's personal mailbox holds only that member: giving the role to, or adding,
    anyone else is refused with 403 `grant_forbidden` and `details.reason`
    `personal_mailbox_member_only`.

    Args:
        primitive_step_up (str | Unset):
        idempotency_key (str | Unset):
        body (CreateGroupRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[CreateGroupResponse201 | ErrorResponse]
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
    body: CreateGroupRequest,
    primitive_step_up: str | Unset = UNSET,
    idempotency_key: str | Unset = UNSET,

) -> CreateGroupResponse201 | ErrorResponse | None:
    """ Create a group

     Creates a group. Needs roles:assign. With an org-wide API key (acting for its person) or the
    person's own Primitive CLI the group must have no role: a group with a role is role assignment, done
    in a dashboard session or with a session step-up. Adding members to a group that holds mailbox
    access gives them that access, so each of its entries is checked as for a mailbox edit. A group
    whose role names a member's personal mailbox holds only that member: giving the role to, or adding,
    anyone else is refused with 403 `grant_forbidden` and `details.reason`
    `personal_mailbox_member_only`.

    Args:
        primitive_step_up (str | Unset):
        idempotency_key (str | Unset):
        body (CreateGroupRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        CreateGroupResponse201 | ErrorResponse
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
    body: CreateGroupRequest,
    primitive_step_up: str | Unset = UNSET,
    idempotency_key: str | Unset = UNSET,

) -> Response[CreateGroupResponse201 | ErrorResponse]:
    """ Create a group

     Creates a group. Needs roles:assign. With an org-wide API key (acting for its person) or the
    person's own Primitive CLI the group must have no role: a group with a role is role assignment, done
    in a dashboard session or with a session step-up. Adding members to a group that holds mailbox
    access gives them that access, so each of its entries is checked as for a mailbox edit. A group
    whose role names a member's personal mailbox holds only that member: giving the role to, or adding,
    anyone else is refused with 403 `grant_forbidden` and `details.reason`
    `personal_mailbox_member_only`.

    Args:
        primitive_step_up (str | Unset):
        idempotency_key (str | Unset):
        body (CreateGroupRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[CreateGroupResponse201 | ErrorResponse]
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
    body: CreateGroupRequest,
    primitive_step_up: str | Unset = UNSET,
    idempotency_key: str | Unset = UNSET,

) -> CreateGroupResponse201 | ErrorResponse | None:
    """ Create a group

     Creates a group. Needs roles:assign. With an org-wide API key (acting for its person) or the
    person's own Primitive CLI the group must have no role: a group with a role is role assignment, done
    in a dashboard session or with a session step-up. Adding members to a group that holds mailbox
    access gives them that access, so each of its entries is checked as for a mailbox edit. A group
    whose role names a member's personal mailbox holds only that member: giving the role to, or adding,
    anyone else is refused with 403 `grant_forbidden` and `details.reason`
    `personal_mailbox_member_only`.

    Args:
        primitive_step_up (str | Unset):
        idempotency_key (str | Unset):
        body (CreateGroupRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        CreateGroupResponse201 | ErrorResponse
     """


    return (await asyncio_detailed(
        client=client,
body=body,
primitive_step_up=primitive_step_up,
idempotency_key=idempotency_key,

    )).parsed
