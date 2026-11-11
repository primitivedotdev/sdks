from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.credentials_rotate_key_input import CredentialsRotateKeyInput
from ...models.error_response import ErrorResponse
from ...models.rotate_key_response_200 import RotateKeyResponse200
from ...types import UNSET, Unset
from typing import cast
from uuid import UUID



def _get_kwargs(
    id: UUID,
    *,
    body: CredentialsRotateKeyInput,
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
        "url": "/keys/{id}/rotate".format(id=quote(str(id), safe=""),),
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | RotateKeyResponse200 | None:
    if response.status_code == 200:
        response_200 = RotateKeyResponse200.from_dict(response.json())



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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | RotateKeyResponse200]:
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
    body: CredentialsRotateKeyInput,
    primitive_step_up: str | Unset = UNSET,
    idempotency_key: str | Unset = UNSET,

) -> Response[ErrorResponse | RotateKeyResponse200]:
    """ Rotate an API key

     Mint a successor with a new id and the same name, grant, expiry and conditions, and return its
    secret once. The old key keeps working for overlap_seconds, then stops: 24 hours when
    overlap_seconds is omitted, at most 7 days, never past its own expires_at, and at once with 0 (which
    is how to rotate a key whose secret leaked). previous_key_expires_at says when the old key stops.
    Rotating does not extend a key: the successor keeps the old expiry unless expires_at gives it a new
    one. That needs keys:manage (403 forbidden otherwise), is held to the credential policy (400 when
    past its maximum lifetime, with the latest expiry it allows now in the message), and someone limited
    to their own keys can only keep or bring it forward (403 grant_forbidden, details.reason
    own_key_tighten_only); the old key then never outlives the new one. The person rotating must cover
    the key's access (403 grant_forbidden, details.reason target_not_covered), and a key an owner holds
    is rotated by an owner only (403 forbidden, details.reason owner_key_rotation), since rotating hands
    over the new secret. The person's own Primitive CLI login needs no step-up (it acts as the person,
    held to the same rules) unless the organization's credential policy sets
    cli_writes_require_approval; the Primitive app's token is refused, even with one. Needs the
    organization's credential features to be enabled; while they are not, this answers 404
    feature_disabled, with details.feature naming the feature. Contact Primitive to turn them on.

    Person only: a dashboard session, the person's own Primitive CLI login with no step-up (unless the
    organization's credential policy sets cli_writes_require_approval), or the person's own OAuth token
    with a step-up token for purpose `keys.create` in the Primitive-Step-Up header. Without one any
    other OAuth token is answered 403 step_up_required, whose details carry the dashboard URL that
    issues it (or 403 grant_forbidden when the person's role, or the client, could not do it anyway).
    The person's role must hold keys:manage. API keys and agent connection keys are refused. An agent
    acting for the person is refused unless it carries a step-up token the person issued in the
    dashboard.

    Args:
        id (UUID):
        primitive_step_up (str | Unset):
        idempotency_key (str | Unset):
        body (CredentialsRotateKeyInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | RotateKeyResponse200]
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
    body: CredentialsRotateKeyInput,
    primitive_step_up: str | Unset = UNSET,
    idempotency_key: str | Unset = UNSET,

) -> ErrorResponse | RotateKeyResponse200 | None:
    """ Rotate an API key

     Mint a successor with a new id and the same name, grant, expiry and conditions, and return its
    secret once. The old key keeps working for overlap_seconds, then stops: 24 hours when
    overlap_seconds is omitted, at most 7 days, never past its own expires_at, and at once with 0 (which
    is how to rotate a key whose secret leaked). previous_key_expires_at says when the old key stops.
    Rotating does not extend a key: the successor keeps the old expiry unless expires_at gives it a new
    one. That needs keys:manage (403 forbidden otherwise), is held to the credential policy (400 when
    past its maximum lifetime, with the latest expiry it allows now in the message), and someone limited
    to their own keys can only keep or bring it forward (403 grant_forbidden, details.reason
    own_key_tighten_only); the old key then never outlives the new one. The person rotating must cover
    the key's access (403 grant_forbidden, details.reason target_not_covered), and a key an owner holds
    is rotated by an owner only (403 forbidden, details.reason owner_key_rotation), since rotating hands
    over the new secret. The person's own Primitive CLI login needs no step-up (it acts as the person,
    held to the same rules) unless the organization's credential policy sets
    cli_writes_require_approval; the Primitive app's token is refused, even with one. Needs the
    organization's credential features to be enabled; while they are not, this answers 404
    feature_disabled, with details.feature naming the feature. Contact Primitive to turn them on.

    Person only: a dashboard session, the person's own Primitive CLI login with no step-up (unless the
    organization's credential policy sets cli_writes_require_approval), or the person's own OAuth token
    with a step-up token for purpose `keys.create` in the Primitive-Step-Up header. Without one any
    other OAuth token is answered 403 step_up_required, whose details carry the dashboard URL that
    issues it (or 403 grant_forbidden when the person's role, or the client, could not do it anyway).
    The person's role must hold keys:manage. API keys and agent connection keys are refused. An agent
    acting for the person is refused unless it carries a step-up token the person issued in the
    dashboard.

    Args:
        id (UUID):
        primitive_step_up (str | Unset):
        idempotency_key (str | Unset):
        body (CredentialsRotateKeyInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | RotateKeyResponse200
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
    body: CredentialsRotateKeyInput,
    primitive_step_up: str | Unset = UNSET,
    idempotency_key: str | Unset = UNSET,

) -> Response[ErrorResponse | RotateKeyResponse200]:
    """ Rotate an API key

     Mint a successor with a new id and the same name, grant, expiry and conditions, and return its
    secret once. The old key keeps working for overlap_seconds, then stops: 24 hours when
    overlap_seconds is omitted, at most 7 days, never past its own expires_at, and at once with 0 (which
    is how to rotate a key whose secret leaked). previous_key_expires_at says when the old key stops.
    Rotating does not extend a key: the successor keeps the old expiry unless expires_at gives it a new
    one. That needs keys:manage (403 forbidden otherwise), is held to the credential policy (400 when
    past its maximum lifetime, with the latest expiry it allows now in the message), and someone limited
    to their own keys can only keep or bring it forward (403 grant_forbidden, details.reason
    own_key_tighten_only); the old key then never outlives the new one. The person rotating must cover
    the key's access (403 grant_forbidden, details.reason target_not_covered), and a key an owner holds
    is rotated by an owner only (403 forbidden, details.reason owner_key_rotation), since rotating hands
    over the new secret. The person's own Primitive CLI login needs no step-up (it acts as the person,
    held to the same rules) unless the organization's credential policy sets
    cli_writes_require_approval; the Primitive app's token is refused, even with one. Needs the
    organization's credential features to be enabled; while they are not, this answers 404
    feature_disabled, with details.feature naming the feature. Contact Primitive to turn them on.

    Person only: a dashboard session, the person's own Primitive CLI login with no step-up (unless the
    organization's credential policy sets cli_writes_require_approval), or the person's own OAuth token
    with a step-up token for purpose `keys.create` in the Primitive-Step-Up header. Without one any
    other OAuth token is answered 403 step_up_required, whose details carry the dashboard URL that
    issues it (or 403 grant_forbidden when the person's role, or the client, could not do it anyway).
    The person's role must hold keys:manage. API keys and agent connection keys are refused. An agent
    acting for the person is refused unless it carries a step-up token the person issued in the
    dashboard.

    Args:
        id (UUID):
        primitive_step_up (str | Unset):
        idempotency_key (str | Unset):
        body (CredentialsRotateKeyInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | RotateKeyResponse200]
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
    body: CredentialsRotateKeyInput,
    primitive_step_up: str | Unset = UNSET,
    idempotency_key: str | Unset = UNSET,

) -> ErrorResponse | RotateKeyResponse200 | None:
    """ Rotate an API key

     Mint a successor with a new id and the same name, grant, expiry and conditions, and return its
    secret once. The old key keeps working for overlap_seconds, then stops: 24 hours when
    overlap_seconds is omitted, at most 7 days, never past its own expires_at, and at once with 0 (which
    is how to rotate a key whose secret leaked). previous_key_expires_at says when the old key stops.
    Rotating does not extend a key: the successor keeps the old expiry unless expires_at gives it a new
    one. That needs keys:manage (403 forbidden otherwise), is held to the credential policy (400 when
    past its maximum lifetime, with the latest expiry it allows now in the message), and someone limited
    to their own keys can only keep or bring it forward (403 grant_forbidden, details.reason
    own_key_tighten_only); the old key then never outlives the new one. The person rotating must cover
    the key's access (403 grant_forbidden, details.reason target_not_covered), and a key an owner holds
    is rotated by an owner only (403 forbidden, details.reason owner_key_rotation), since rotating hands
    over the new secret. The person's own Primitive CLI login needs no step-up (it acts as the person,
    held to the same rules) unless the organization's credential policy sets
    cli_writes_require_approval; the Primitive app's token is refused, even with one. Needs the
    organization's credential features to be enabled; while they are not, this answers 404
    feature_disabled, with details.feature naming the feature. Contact Primitive to turn them on.

    Person only: a dashboard session, the person's own Primitive CLI login with no step-up (unless the
    organization's credential policy sets cli_writes_require_approval), or the person's own OAuth token
    with a step-up token for purpose `keys.create` in the Primitive-Step-Up header. Without one any
    other OAuth token is answered 403 step_up_required, whose details carry the dashboard URL that
    issues it (or 403 grant_forbidden when the person's role, or the client, could not do it anyway).
    The person's role must hold keys:manage. API keys and agent connection keys are refused. An agent
    acting for the person is refused unless it carries a step-up token the person issued in the
    dashboard.

    Args:
        id (UUID):
        primitive_step_up (str | Unset):
        idempotency_key (str | Unset):
        body (CredentialsRotateKeyInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | RotateKeyResponse200
     """


    return (await asyncio_detailed(
        id=id,
client=client,
body=body,
primitive_step_up=primitive_step_up,
idempotency_key=idempotency_key,

    )).parsed
