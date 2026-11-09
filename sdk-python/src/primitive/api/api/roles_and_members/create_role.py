from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.create_role_request import CreateRoleRequest
from ...models.create_role_response_201 import CreateRoleResponse201
from ...models.error_response import ErrorResponse
from ...types import UNSET, Unset
from typing import cast



def _get_kwargs(
    *,
    body: CreateRoleRequest,
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
        "url": "/roles",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> CreateRoleResponse201 | ErrorResponse | None:
    if response.status_code == 201:
        response_201 = CreateRoleResponse201.from_dict(response.json())



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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[CreateRoleResponse201 | ErrorResponse]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: CreateRoleRequest,
    primitive_step_up: str | Unset = UNSET,
    idempotency_key: str | Unset = UNSET,

) -> Response[CreateRoleResponse201 | ErrorResponse]:
    """ Create a custom role

     A role nobody can use to gain access they do not hold: its permissions and mail scope must be within
    the author's own. mail_scope is "org" (the default) or { addresses, domains }; any other value is
    refused with 400 `validation_error`. Every role that reaches mail reads it in full, and raw MIME
    follows the role's mail.raw:read; `depth` is deprecated and ignored. Its mail scope names no other
    member's personal mailbox: otherwise 403 `grant_forbidden` with `details.reason`
    `personal_mailbox_member_only`. Person only: a dashboard session, or the person's own OAuth or CLI
    token with a session step-up of purpose `roles.write` (the person confirms at the step_up_url a 403
    step_up_required answer carries, which names this client, then send the token in the Primitive-Step-
    Up header; the token works only with the client it was confirmed for). Needs roles:assign. API keys
    are refused.

    Args:
        primitive_step_up (str | Unset):
        idempotency_key (str | Unset):
        body (CreateRoleRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[CreateRoleResponse201 | ErrorResponse]
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
    body: CreateRoleRequest,
    primitive_step_up: str | Unset = UNSET,
    idempotency_key: str | Unset = UNSET,

) -> CreateRoleResponse201 | ErrorResponse | None:
    """ Create a custom role

     A role nobody can use to gain access they do not hold: its permissions and mail scope must be within
    the author's own. mail_scope is "org" (the default) or { addresses, domains }; any other value is
    refused with 400 `validation_error`. Every role that reaches mail reads it in full, and raw MIME
    follows the role's mail.raw:read; `depth` is deprecated and ignored. Its mail scope names no other
    member's personal mailbox: otherwise 403 `grant_forbidden` with `details.reason`
    `personal_mailbox_member_only`. Person only: a dashboard session, or the person's own OAuth or CLI
    token with a session step-up of purpose `roles.write` (the person confirms at the step_up_url a 403
    step_up_required answer carries, which names this client, then send the token in the Primitive-Step-
    Up header; the token works only with the client it was confirmed for). Needs roles:assign. API keys
    are refused.

    Args:
        primitive_step_up (str | Unset):
        idempotency_key (str | Unset):
        body (CreateRoleRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        CreateRoleResponse201 | ErrorResponse
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
    body: CreateRoleRequest,
    primitive_step_up: str | Unset = UNSET,
    idempotency_key: str | Unset = UNSET,

) -> Response[CreateRoleResponse201 | ErrorResponse]:
    """ Create a custom role

     A role nobody can use to gain access they do not hold: its permissions and mail scope must be within
    the author's own. mail_scope is "org" (the default) or { addresses, domains }; any other value is
    refused with 400 `validation_error`. Every role that reaches mail reads it in full, and raw MIME
    follows the role's mail.raw:read; `depth` is deprecated and ignored. Its mail scope names no other
    member's personal mailbox: otherwise 403 `grant_forbidden` with `details.reason`
    `personal_mailbox_member_only`. Person only: a dashboard session, or the person's own OAuth or CLI
    token with a session step-up of purpose `roles.write` (the person confirms at the step_up_url a 403
    step_up_required answer carries, which names this client, then send the token in the Primitive-Step-
    Up header; the token works only with the client it was confirmed for). Needs roles:assign. API keys
    are refused.

    Args:
        primitive_step_up (str | Unset):
        idempotency_key (str | Unset):
        body (CreateRoleRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[CreateRoleResponse201 | ErrorResponse]
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
    body: CreateRoleRequest,
    primitive_step_up: str | Unset = UNSET,
    idempotency_key: str | Unset = UNSET,

) -> CreateRoleResponse201 | ErrorResponse | None:
    """ Create a custom role

     A role nobody can use to gain access they do not hold: its permissions and mail scope must be within
    the author's own. mail_scope is "org" (the default) or { addresses, domains }; any other value is
    refused with 400 `validation_error`. Every role that reaches mail reads it in full, and raw MIME
    follows the role's mail.raw:read; `depth` is deprecated and ignored. Its mail scope names no other
    member's personal mailbox: otherwise 403 `grant_forbidden` with `details.reason`
    `personal_mailbox_member_only`. Person only: a dashboard session, or the person's own OAuth or CLI
    token with a session step-up of purpose `roles.write` (the person confirms at the step_up_url a 403
    step_up_required answer carries, which names this client, then send the token in the Primitive-Step-
    Up header; the token works only with the client it was confirmed for). Needs roles:assign. API keys
    are refused.

    Args:
        primitive_step_up (str | Unset):
        idempotency_key (str | Unset):
        body (CreateRoleRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        CreateRoleResponse201 | ErrorResponse
     """


    return (await asyncio_detailed(
        client=client,
body=body,
primitive_step_up=primitive_step_up,
idempotency_key=idempotency_key,

    )).parsed
