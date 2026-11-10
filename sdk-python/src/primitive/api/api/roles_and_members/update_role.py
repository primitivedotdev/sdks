from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.update_role_request import UpdateRoleRequest
from ...models.update_role_response_200 import UpdateRoleResponse200
from ...types import UNSET, Unset
from typing import cast
from uuid import UUID



def _get_kwargs(
    id: UUID,
    *,
    body: UpdateRoleRequest,
    primitive_step_up: str | Unset = UNSET,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}
    if not isinstance(primitive_step_up, Unset):
        headers["Primitive-Step-Up"] = primitive_step_up



    

    

    _kwargs: dict[str, Any] = {
        "method": "patch",
        "url": "/roles/{id}".format(id=quote(str(id), safe=""),),
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | UpdateRoleResponse200 | None:
    if response.status_code == 200:
        response_200 = UpdateRoleResponse200.from_dict(response.json())



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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | UpdateRoleResponse200]:
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
    body: UpdateRoleRequest,
    primitive_step_up: str | Unset = UNSET,

) -> Response[ErrorResponse | UpdateRoleResponse200]:
    """ Change a custom role

     A new version of the role, with a new `id`: the version you edited is retired, the response is the
    new one (same `key`, `version` one higher), and every member and group holding the role moves to it.
    The old id answers 404 `not_found` from then on, so store the returned `id` (or look the role up by
    `key` in GET /roles) before editing or assigning it again. Every holder whose access shrinks goes
    through the reduction path. mail_scope follows the same rules as creating a role; a role whose
    stored scope cannot be read must be sent a new mail_scope, otherwise 400 `validation_error` with
    `details.reason` `invalid_mail_scope`.  A personal mailbox the new version adds must be the author's
    own, and every holder must be the member of each personal mailbox it names: otherwise 403
    `grant_forbidden` with `details.reason` `personal_mailbox_member_only`. Each permission in the new
    version must have what it requires in the same role, as when creating one, including permissions
    carried over unchanged. Person only: a dashboard session, or the person's own OAuth or CLI token
    with a session step-up of purpose `roles.write` (the person confirms at the step_up_url a 403
    step_up_required answer carries, which names this client, then send the token in the Primitive-Step-
    Up header; the token works only with the client it was confirmed for). Needs roles:assign. API keys
    are refused.

    Args:
        id (UUID):
        primitive_step_up (str | Unset):
        body (UpdateRoleRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | UpdateRoleResponse200]
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
    body: UpdateRoleRequest,
    primitive_step_up: str | Unset = UNSET,

) -> ErrorResponse | UpdateRoleResponse200 | None:
    """ Change a custom role

     A new version of the role, with a new `id`: the version you edited is retired, the response is the
    new one (same `key`, `version` one higher), and every member and group holding the role moves to it.
    The old id answers 404 `not_found` from then on, so store the returned `id` (or look the role up by
    `key` in GET /roles) before editing or assigning it again. Every holder whose access shrinks goes
    through the reduction path. mail_scope follows the same rules as creating a role; a role whose
    stored scope cannot be read must be sent a new mail_scope, otherwise 400 `validation_error` with
    `details.reason` `invalid_mail_scope`.  A personal mailbox the new version adds must be the author's
    own, and every holder must be the member of each personal mailbox it names: otherwise 403
    `grant_forbidden` with `details.reason` `personal_mailbox_member_only`. Each permission in the new
    version must have what it requires in the same role, as when creating one, including permissions
    carried over unchanged. Person only: a dashboard session, or the person's own OAuth or CLI token
    with a session step-up of purpose `roles.write` (the person confirms at the step_up_url a 403
    step_up_required answer carries, which names this client, then send the token in the Primitive-Step-
    Up header; the token works only with the client it was confirmed for). Needs roles:assign. API keys
    are refused.

    Args:
        id (UUID):
        primitive_step_up (str | Unset):
        body (UpdateRoleRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | UpdateRoleResponse200
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
    body: UpdateRoleRequest,
    primitive_step_up: str | Unset = UNSET,

) -> Response[ErrorResponse | UpdateRoleResponse200]:
    """ Change a custom role

     A new version of the role, with a new `id`: the version you edited is retired, the response is the
    new one (same `key`, `version` one higher), and every member and group holding the role moves to it.
    The old id answers 404 `not_found` from then on, so store the returned `id` (or look the role up by
    `key` in GET /roles) before editing or assigning it again. Every holder whose access shrinks goes
    through the reduction path. mail_scope follows the same rules as creating a role; a role whose
    stored scope cannot be read must be sent a new mail_scope, otherwise 400 `validation_error` with
    `details.reason` `invalid_mail_scope`.  A personal mailbox the new version adds must be the author's
    own, and every holder must be the member of each personal mailbox it names: otherwise 403
    `grant_forbidden` with `details.reason` `personal_mailbox_member_only`. Each permission in the new
    version must have what it requires in the same role, as when creating one, including permissions
    carried over unchanged. Person only: a dashboard session, or the person's own OAuth or CLI token
    with a session step-up of purpose `roles.write` (the person confirms at the step_up_url a 403
    step_up_required answer carries, which names this client, then send the token in the Primitive-Step-
    Up header; the token works only with the client it was confirmed for). Needs roles:assign. API keys
    are refused.

    Args:
        id (UUID):
        primitive_step_up (str | Unset):
        body (UpdateRoleRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | UpdateRoleResponse200]
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
    body: UpdateRoleRequest,
    primitive_step_up: str | Unset = UNSET,

) -> ErrorResponse | UpdateRoleResponse200 | None:
    """ Change a custom role

     A new version of the role, with a new `id`: the version you edited is retired, the response is the
    new one (same `key`, `version` one higher), and every member and group holding the role moves to it.
    The old id answers 404 `not_found` from then on, so store the returned `id` (or look the role up by
    `key` in GET /roles) before editing or assigning it again. Every holder whose access shrinks goes
    through the reduction path. mail_scope follows the same rules as creating a role; a role whose
    stored scope cannot be read must be sent a new mail_scope, otherwise 400 `validation_error` with
    `details.reason` `invalid_mail_scope`.  A personal mailbox the new version adds must be the author's
    own, and every holder must be the member of each personal mailbox it names: otherwise 403
    `grant_forbidden` with `details.reason` `personal_mailbox_member_only`. Each permission in the new
    version must have what it requires in the same role, as when creating one, including permissions
    carried over unchanged. Person only: a dashboard session, or the person's own OAuth or CLI token
    with a session step-up of purpose `roles.write` (the person confirms at the step_up_url a 403
    step_up_required answer carries, which names this client, then send the token in the Primitive-Step-
    Up header; the token works only with the client it was confirmed for). Needs roles:assign. API keys
    are refused.

    Args:
        id (UUID):
        primitive_step_up (str | Unset):
        body (UpdateRoleRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | UpdateRoleResponse200
     """


    return (await asyncio_detailed(
        id=id,
client=client,
body=body,
primitive_step_up=primitive_step_up,

    )).parsed
