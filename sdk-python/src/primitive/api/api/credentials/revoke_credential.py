from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.credentials_revoke_credential_input import CredentialsRevokeCredentialInput
from ...models.error_response import ErrorResponse
from ...models.revoke_credential_response_200 import RevokeCredentialResponse200
from ...types import UNSET, Unset
from typing import cast



def _get_kwargs(
    *,
    body: CredentialsRevokeCredentialInput,
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
        "url": "/credentials/revoke",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | RevokeCredentialResponse200 | None:
    if response.status_code == 200:
        response_200 = RevokeCredentialResponse200.from_dict(response.json())



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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | RevokeCredentialResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: CredentialsRevokeCredentialInput,
    primitive_step_up: str | Unset = UNSET,
    idempotency_key: str | Unset = UNSET,

) -> Response[ErrorResponse | RevokeCredentialResponse200]:
    """ Revoke a credential

     Revoke one credential by kind and id. A Function key is rotated, never revoked (409 rotate_instead).
    An API key is revoked by the person who holds it, whatever it reaches, or by a person whose own
    access covers the key's access (an owner covers every key); otherwise 403 grant_forbidden,
    details.reason target_not_covered. Revoking an API key also revokes the keys it replaced in its
    rotation that are still in their overlap and that you may revoke (predecessors_revoked_count;
    predecessors_left counts the rest), so its webhooks stop at once; the keys that replaced it carry
    its work on. Revoking a key already revoked does the same for those keys. What the credential set up
    or owns is listed in standing_objects for review, and for an API key also what it carries on for the
    keys it was rotated from, each saying whether anything still acts for it (still_acting, with the key
    in acting_key_id) and, for a webhook, whether it is still delivering. An organization-owned object
    (org_owned true) keeps working; any other keeps working only while someone can still act for it,
    such as a key of the same rotation that still works, or whoever it was given to, except that a block
    filter an app made keeps blocking, within the reach the app had, unless the person revoking chose to
    stop it. An API key (kind org_key or connected_key) that is already revoked, and whose record is
    kept, answers 200 with already_revoked true, to a caller who could have revoked it, and revoked
    counts only the keys it replaced that were revoked now; anyone else gets the answer they would get
    for a key that does not exist. The person's own Primitive CLI login revokes an API key (kind
    org_key) as the person, with no step-up unless the organization's credential policy sets
    cli_writes_require_approval (then it takes a keys.create step-up); every other kind (a connected key
    named as org_key included, 403 grant_forbidden target_not_covered), and every other app even with a
    step-up, is refused outside the dashboard (403). Needs the organization's credential features to be
    enabled; while they are not, this answers 404 feature_disabled, with details.feature naming the
    feature. Contact Primitive to turn them on.

    Person only: a dashboard session or the person's own Primitive CLI token; no other OAuth app. The
    person's role must hold keys:manage. API keys, agent connection keys and agents are refused.

    Args:
        primitive_step_up (str | Unset):
        idempotency_key (str | Unset):
        body (CredentialsRevokeCredentialInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | RevokeCredentialResponse200]
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
    body: CredentialsRevokeCredentialInput,
    primitive_step_up: str | Unset = UNSET,
    idempotency_key: str | Unset = UNSET,

) -> ErrorResponse | RevokeCredentialResponse200 | None:
    """ Revoke a credential

     Revoke one credential by kind and id. A Function key is rotated, never revoked (409 rotate_instead).
    An API key is revoked by the person who holds it, whatever it reaches, or by a person whose own
    access covers the key's access (an owner covers every key); otherwise 403 grant_forbidden,
    details.reason target_not_covered. Revoking an API key also revokes the keys it replaced in its
    rotation that are still in their overlap and that you may revoke (predecessors_revoked_count;
    predecessors_left counts the rest), so its webhooks stop at once; the keys that replaced it carry
    its work on. Revoking a key already revoked does the same for those keys. What the credential set up
    or owns is listed in standing_objects for review, and for an API key also what it carries on for the
    keys it was rotated from, each saying whether anything still acts for it (still_acting, with the key
    in acting_key_id) and, for a webhook, whether it is still delivering. An organization-owned object
    (org_owned true) keeps working; any other keeps working only while someone can still act for it,
    such as a key of the same rotation that still works, or whoever it was given to, except that a block
    filter an app made keeps blocking, within the reach the app had, unless the person revoking chose to
    stop it. An API key (kind org_key or connected_key) that is already revoked, and whose record is
    kept, answers 200 with already_revoked true, to a caller who could have revoked it, and revoked
    counts only the keys it replaced that were revoked now; anyone else gets the answer they would get
    for a key that does not exist. The person's own Primitive CLI login revokes an API key (kind
    org_key) as the person, with no step-up unless the organization's credential policy sets
    cli_writes_require_approval (then it takes a keys.create step-up); every other kind (a connected key
    named as org_key included, 403 grant_forbidden target_not_covered), and every other app even with a
    step-up, is refused outside the dashboard (403). Needs the organization's credential features to be
    enabled; while they are not, this answers 404 feature_disabled, with details.feature naming the
    feature. Contact Primitive to turn them on.

    Person only: a dashboard session or the person's own Primitive CLI token; no other OAuth app. The
    person's role must hold keys:manage. API keys, agent connection keys and agents are refused.

    Args:
        primitive_step_up (str | Unset):
        idempotency_key (str | Unset):
        body (CredentialsRevokeCredentialInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | RevokeCredentialResponse200
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
    body: CredentialsRevokeCredentialInput,
    primitive_step_up: str | Unset = UNSET,
    idempotency_key: str | Unset = UNSET,

) -> Response[ErrorResponse | RevokeCredentialResponse200]:
    """ Revoke a credential

     Revoke one credential by kind and id. A Function key is rotated, never revoked (409 rotate_instead).
    An API key is revoked by the person who holds it, whatever it reaches, or by a person whose own
    access covers the key's access (an owner covers every key); otherwise 403 grant_forbidden,
    details.reason target_not_covered. Revoking an API key also revokes the keys it replaced in its
    rotation that are still in their overlap and that you may revoke (predecessors_revoked_count;
    predecessors_left counts the rest), so its webhooks stop at once; the keys that replaced it carry
    its work on. Revoking a key already revoked does the same for those keys. What the credential set up
    or owns is listed in standing_objects for review, and for an API key also what it carries on for the
    keys it was rotated from, each saying whether anything still acts for it (still_acting, with the key
    in acting_key_id) and, for a webhook, whether it is still delivering. An organization-owned object
    (org_owned true) keeps working; any other keeps working only while someone can still act for it,
    such as a key of the same rotation that still works, or whoever it was given to, except that a block
    filter an app made keeps blocking, within the reach the app had, unless the person revoking chose to
    stop it. An API key (kind org_key or connected_key) that is already revoked, and whose record is
    kept, answers 200 with already_revoked true, to a caller who could have revoked it, and revoked
    counts only the keys it replaced that were revoked now; anyone else gets the answer they would get
    for a key that does not exist. The person's own Primitive CLI login revokes an API key (kind
    org_key) as the person, with no step-up unless the organization's credential policy sets
    cli_writes_require_approval (then it takes a keys.create step-up); every other kind (a connected key
    named as org_key included, 403 grant_forbidden target_not_covered), and every other app even with a
    step-up, is refused outside the dashboard (403). Needs the organization's credential features to be
    enabled; while they are not, this answers 404 feature_disabled, with details.feature naming the
    feature. Contact Primitive to turn them on.

    Person only: a dashboard session or the person's own Primitive CLI token; no other OAuth app. The
    person's role must hold keys:manage. API keys, agent connection keys and agents are refused.

    Args:
        primitive_step_up (str | Unset):
        idempotency_key (str | Unset):
        body (CredentialsRevokeCredentialInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | RevokeCredentialResponse200]
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
    body: CredentialsRevokeCredentialInput,
    primitive_step_up: str | Unset = UNSET,
    idempotency_key: str | Unset = UNSET,

) -> ErrorResponse | RevokeCredentialResponse200 | None:
    """ Revoke a credential

     Revoke one credential by kind and id. A Function key is rotated, never revoked (409 rotate_instead).
    An API key is revoked by the person who holds it, whatever it reaches, or by a person whose own
    access covers the key's access (an owner covers every key); otherwise 403 grant_forbidden,
    details.reason target_not_covered. Revoking an API key also revokes the keys it replaced in its
    rotation that are still in their overlap and that you may revoke (predecessors_revoked_count;
    predecessors_left counts the rest), so its webhooks stop at once; the keys that replaced it carry
    its work on. Revoking a key already revoked does the same for those keys. What the credential set up
    or owns is listed in standing_objects for review, and for an API key also what it carries on for the
    keys it was rotated from, each saying whether anything still acts for it (still_acting, with the key
    in acting_key_id) and, for a webhook, whether it is still delivering. An organization-owned object
    (org_owned true) keeps working; any other keeps working only while someone can still act for it,
    such as a key of the same rotation that still works, or whoever it was given to, except that a block
    filter an app made keeps blocking, within the reach the app had, unless the person revoking chose to
    stop it. An API key (kind org_key or connected_key) that is already revoked, and whose record is
    kept, answers 200 with already_revoked true, to a caller who could have revoked it, and revoked
    counts only the keys it replaced that were revoked now; anyone else gets the answer they would get
    for a key that does not exist. The person's own Primitive CLI login revokes an API key (kind
    org_key) as the person, with no step-up unless the organization's credential policy sets
    cli_writes_require_approval (then it takes a keys.create step-up); every other kind (a connected key
    named as org_key included, 403 grant_forbidden target_not_covered), and every other app even with a
    step-up, is refused outside the dashboard (403). Needs the organization's credential features to be
    enabled; while they are not, this answers 404 feature_disabled, with details.feature naming the
    feature. Contact Primitive to turn them on.

    Person only: a dashboard session or the person's own Primitive CLI token; no other OAuth app. The
    person's role must hold keys:manage. API keys, agent connection keys and agents are refused.

    Args:
        primitive_step_up (str | Unset):
        idempotency_key (str | Unset):
        body (CredentialsRevokeCredentialInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | RevokeCredentialResponse200
     """


    return (await asyncio_detailed(
        client=client,
body=body,
primitive_step_up=primitive_step_up,
idempotency_key=idempotency_key,

    )).parsed
