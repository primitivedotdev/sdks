from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.set_relay_auto_join_request import SetRelayAutoJoinRequest
from ...models.set_relay_auto_join_response_200 import SetRelayAutoJoinResponse200
from ...types import UNSET, Unset
from typing import cast



def _get_kwargs(
    *,
    body: SetRelayAutoJoinRequest,
    primitive_step_up: str | Unset = UNSET,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}
    if not isinstance(primitive_step_up, Unset):
        headers["Primitive-Step-Up"] = primitive_step_up



    

    

    _kwargs: dict[str, Any] = {
        "method": "put",
        "url": "/relay-auto-join",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | SetRelayAutoJoinResponse200 | None:
    if response.status_code == 200:
        response_200 = SetRelayAutoJoinResponse200.from_dict(response.json())



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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | SetRelayAutoJoinResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: SetRelayAutoJoinRequest,
    primitive_step_up: str | Unset = UNSET,

) -> Response[ErrorResponse | SetRelayAutoJoinResponse200]:
    """ Change the auto-join setting

     `option` is a choice's id from the GET, or null to require an invitation (turning it off needs only
    members:manage). Auto-joined people have no mail access until an owner or admin assigns a role;
    legacy mail-grant choices cannot be selected. Choosing an option answers 404 `feature_disabled`
    unless the organization has mail relay, 400 `validation_error` for an id outside the current
    catalog, 403 `grant_forbidden` without owner or admin assignment authority, and 409
    `role_assignment_unavailable` when the restricted role cannot be assigned yet. Person only: a
    dashboard session, or the person's own OAuth or CLI token with a session step-up of purpose
    `relay_auto_join.write` (the person confirms at the step_up_url a 403 step_up_required answer
    carries, which names this client, then send the token in the Primitive-Step-Up header; the token
    works only with the client it was confirmed for). Needs members:manage, and roles:assign to turn it
    on. API keys are refused.

    Args:
        primitive_step_up (str | Unset):
        body (SetRelayAutoJoinRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | SetRelayAutoJoinResponse200]
     """


    kwargs = _get_kwargs(
        body=body,
primitive_step_up=primitive_step_up,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    *,
    client: AuthenticatedClient | Client,
    body: SetRelayAutoJoinRequest,
    primitive_step_up: str | Unset = UNSET,

) -> ErrorResponse | SetRelayAutoJoinResponse200 | None:
    """ Change the auto-join setting

     `option` is a choice's id from the GET, or null to require an invitation (turning it off needs only
    members:manage). Auto-joined people have no mail access until an owner or admin assigns a role;
    legacy mail-grant choices cannot be selected. Choosing an option answers 404 `feature_disabled`
    unless the organization has mail relay, 400 `validation_error` for an id outside the current
    catalog, 403 `grant_forbidden` without owner or admin assignment authority, and 409
    `role_assignment_unavailable` when the restricted role cannot be assigned yet. Person only: a
    dashboard session, or the person's own OAuth or CLI token with a session step-up of purpose
    `relay_auto_join.write` (the person confirms at the step_up_url a 403 step_up_required answer
    carries, which names this client, then send the token in the Primitive-Step-Up header; the token
    works only with the client it was confirmed for). Needs members:manage, and roles:assign to turn it
    on. API keys are refused.

    Args:
        primitive_step_up (str | Unset):
        body (SetRelayAutoJoinRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | SetRelayAutoJoinResponse200
     """


    return sync_detailed(
        client=client,
body=body,
primitive_step_up=primitive_step_up,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: SetRelayAutoJoinRequest,
    primitive_step_up: str | Unset = UNSET,

) -> Response[ErrorResponse | SetRelayAutoJoinResponse200]:
    """ Change the auto-join setting

     `option` is a choice's id from the GET, or null to require an invitation (turning it off needs only
    members:manage). Auto-joined people have no mail access until an owner or admin assigns a role;
    legacy mail-grant choices cannot be selected. Choosing an option answers 404 `feature_disabled`
    unless the organization has mail relay, 400 `validation_error` for an id outside the current
    catalog, 403 `grant_forbidden` without owner or admin assignment authority, and 409
    `role_assignment_unavailable` when the restricted role cannot be assigned yet. Person only: a
    dashboard session, or the person's own OAuth or CLI token with a session step-up of purpose
    `relay_auto_join.write` (the person confirms at the step_up_url a 403 step_up_required answer
    carries, which names this client, then send the token in the Primitive-Step-Up header; the token
    works only with the client it was confirmed for). Needs members:manage, and roles:assign to turn it
    on. API keys are refused.

    Args:
        primitive_step_up (str | Unset):
        body (SetRelayAutoJoinRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | SetRelayAutoJoinResponse200]
     """


    kwargs = _get_kwargs(
        body=body,
primitive_step_up=primitive_step_up,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    body: SetRelayAutoJoinRequest,
    primitive_step_up: str | Unset = UNSET,

) -> ErrorResponse | SetRelayAutoJoinResponse200 | None:
    """ Change the auto-join setting

     `option` is a choice's id from the GET, or null to require an invitation (turning it off needs only
    members:manage). Auto-joined people have no mail access until an owner or admin assigns a role;
    legacy mail-grant choices cannot be selected. Choosing an option answers 404 `feature_disabled`
    unless the organization has mail relay, 400 `validation_error` for an id outside the current
    catalog, 403 `grant_forbidden` without owner or admin assignment authority, and 409
    `role_assignment_unavailable` when the restricted role cannot be assigned yet. Person only: a
    dashboard session, or the person's own OAuth or CLI token with a session step-up of purpose
    `relay_auto_join.write` (the person confirms at the step_up_url a 403 step_up_required answer
    carries, which names this client, then send the token in the Primitive-Step-Up header; the token
    works only with the client it was confirmed for). Needs members:manage, and roles:assign to turn it
    on. API keys are refused.

    Args:
        primitive_step_up (str | Unset):
        body (SetRelayAutoJoinRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | SetRelayAutoJoinResponse200
     """


    return (await asyncio_detailed(
        client=client,
body=body,
primitive_step_up=primitive_step_up,

    )).parsed
