from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.decide_suspension_request import DecideSuspensionRequest
from ...models.decide_suspension_response_200 import DecideSuspensionResponse200
from ...models.error_response import ErrorResponse
from ...types import UNSET, Unset
from typing import cast
from uuid import UUID



def _get_kwargs(
    id: UUID,
    *,
    body: DecideSuspensionRequest,
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
        "url": "/access-suspensions/{id}/decision".format(id=quote(str(id), safe=""),),
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> DecideSuspensionResponse200 | ErrorResponse | None:
    if response.status_code == 200:
        response_200 = DecideSuspensionResponse200.from_dict(response.json())



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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[DecideSuspensionResponse200 | ErrorResponse]:
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
    body: DecideSuspensionRequest,
    primitive_step_up: str | Unset = UNSET,
    idempotency_key: str | Unset = UNSET,

) -> Response[DecideSuspensionResponse200 | ErrorResponse]:
    """ Decide a suspension

     Keep, narrow or revoke one suspended or flagged item. Keeping it, and revoking an API key, needs the
    decider to cover it (revoking an uncovered key is refused with `grant_forbidden`,
    `target_not_covered`). Keeping an API key rotated (`rotate: true`, other than the shared Function
    key) also revokes its older secrets still in a rotation overlap, and needs keys:manage on both the
    credential and the person: without it, or if the decider lost members:manage meanwhile, it is
    refused with `grant_forbidden` (`keys_manage_required` or `actor_access_changed`) and nothing is
    rotated. Person only: a dashboard session, or the person's own OAuth or CLI token with a session
    step-up of purpose `suspensions.decide` (the person confirms at the step_up_url a 403
    step_up_required answer carries, which names this client, then send the token in the Primitive-Step-
    Up header; the token works only with the client it was confirmed for). Needs members:manage. API
    keys are refused.

    Args:
        id (UUID):
        primitive_step_up (str | Unset):
        idempotency_key (str | Unset):
        body (DecideSuspensionRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[DecideSuspensionResponse200 | ErrorResponse]
     """


    kwargs = _get_kwargs(
        id=id,
body=body,
primitive_step_up=primitive_step_up,
idempotency_key=idempotency_key,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: DecideSuspensionRequest,
    primitive_step_up: str | Unset = UNSET,
    idempotency_key: str | Unset = UNSET,

) -> DecideSuspensionResponse200 | ErrorResponse | None:
    """ Decide a suspension

     Keep, narrow or revoke one suspended or flagged item. Keeping it, and revoking an API key, needs the
    decider to cover it (revoking an uncovered key is refused with `grant_forbidden`,
    `target_not_covered`). Keeping an API key rotated (`rotate: true`, other than the shared Function
    key) also revokes its older secrets still in a rotation overlap, and needs keys:manage on both the
    credential and the person: without it, or if the decider lost members:manage meanwhile, it is
    refused with `grant_forbidden` (`keys_manage_required` or `actor_access_changed`) and nothing is
    rotated. Person only: a dashboard session, or the person's own OAuth or CLI token with a session
    step-up of purpose `suspensions.decide` (the person confirms at the step_up_url a 403
    step_up_required answer carries, which names this client, then send the token in the Primitive-Step-
    Up header; the token works only with the client it was confirmed for). Needs members:manage. API
    keys are refused.

    Args:
        id (UUID):
        primitive_step_up (str | Unset):
        idempotency_key (str | Unset):
        body (DecideSuspensionRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        DecideSuspensionResponse200 | ErrorResponse
     """


    return sync_detailed(
        id=id,
client=client,
body=body,
primitive_step_up=primitive_step_up,
idempotency_key=idempotency_key,

    ).parsed

async def asyncio_detailed(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: DecideSuspensionRequest,
    primitive_step_up: str | Unset = UNSET,
    idempotency_key: str | Unset = UNSET,

) -> Response[DecideSuspensionResponse200 | ErrorResponse]:
    """ Decide a suspension

     Keep, narrow or revoke one suspended or flagged item. Keeping it, and revoking an API key, needs the
    decider to cover it (revoking an uncovered key is refused with `grant_forbidden`,
    `target_not_covered`). Keeping an API key rotated (`rotate: true`, other than the shared Function
    key) also revokes its older secrets still in a rotation overlap, and needs keys:manage on both the
    credential and the person: without it, or if the decider lost members:manage meanwhile, it is
    refused with `grant_forbidden` (`keys_manage_required` or `actor_access_changed`) and nothing is
    rotated. Person only: a dashboard session, or the person's own OAuth or CLI token with a session
    step-up of purpose `suspensions.decide` (the person confirms at the step_up_url a 403
    step_up_required answer carries, which names this client, then send the token in the Primitive-Step-
    Up header; the token works only with the client it was confirmed for). Needs members:manage. API
    keys are refused.

    Args:
        id (UUID):
        primitive_step_up (str | Unset):
        idempotency_key (str | Unset):
        body (DecideSuspensionRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[DecideSuspensionResponse200 | ErrorResponse]
     """


    kwargs = _get_kwargs(
        id=id,
body=body,
primitive_step_up=primitive_step_up,
idempotency_key=idempotency_key,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: DecideSuspensionRequest,
    primitive_step_up: str | Unset = UNSET,
    idempotency_key: str | Unset = UNSET,

) -> DecideSuspensionResponse200 | ErrorResponse | None:
    """ Decide a suspension

     Keep, narrow or revoke one suspended or flagged item. Keeping it, and revoking an API key, needs the
    decider to cover it (revoking an uncovered key is refused with `grant_forbidden`,
    `target_not_covered`). Keeping an API key rotated (`rotate: true`, other than the shared Function
    key) also revokes its older secrets still in a rotation overlap, and needs keys:manage on both the
    credential and the person: without it, or if the decider lost members:manage meanwhile, it is
    refused with `grant_forbidden` (`keys_manage_required` or `actor_access_changed`) and nothing is
    rotated. Person only: a dashboard session, or the person's own OAuth or CLI token with a session
    step-up of purpose `suspensions.decide` (the person confirms at the step_up_url a 403
    step_up_required answer carries, which names this client, then send the token in the Primitive-Step-
    Up header; the token works only with the client it was confirmed for). Needs members:manage. API
    keys are refused.

    Args:
        id (UUID):
        primitive_step_up (str | Unset):
        idempotency_key (str | Unset):
        body (DecideSuspensionRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        DecideSuspensionResponse200 | ErrorResponse
     """


    return (await asyncio_detailed(
        id=id,
client=client,
body=body,
primitive_step_up=primitive_step_up,
idempotency_key=idempotency_key,

    )).parsed
