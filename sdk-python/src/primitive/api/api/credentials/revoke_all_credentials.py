from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.credentials_revoke_all_credentials_input import CredentialsRevokeAllCredentialsInput
from ...models.error_response import ErrorResponse
from ...models.revoke_all_credentials_response_200 import RevokeAllCredentialsResponse200
from ...types import UNSET, Unset
from typing import cast



def _get_kwargs(
    *,
    body: CredentialsRevokeAllCredentialsInput,
    idempotency_key: str | Unset = UNSET,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}
    if not isinstance(idempotency_key, Unset):
        headers["Idempotency-Key"] = idempotency_key



    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/credentials/revoke-all",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | RevokeAllCredentialsResponse200 | None:
    if response.status_code == 200:
        response_200 = RevokeAllCredentialsResponse200.from_dict(response.json())



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

    if response.status_code == 429:
        response_429 = ErrorResponse.from_dict(response.json())



        return response_429

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | RevokeAllCredentialsResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: CredentialsRevokeAllCredentialsInput,
    idempotency_key: str | Unset = UNSET,

) -> Response[ErrorResponse | RevokeAllCredentialsResponse200]:
    """ Revoke every credential (emergency)

     The emergency response to a leak: revokes every API key, agent connection key and connected app
    created since a time, rotates the organization Function key and every running Function's own key,
    and optionally suspends Functions. Owners only, from a dashboard session, and the body must confirm
    with "revoke all". Needs the organization's credential features to be enabled; while they are not,
    this answers 404 feature_disabled, with details.feature naming the feature. Contact Primitive to
    turn them on.

    Person only: a dashboard session. The person's role must hold credentials:revoke_all. API keys,
    agent connection keys and agents are refused.

    Args:
        idempotency_key (str | Unset):
        body (CredentialsRevokeAllCredentialsInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | RevokeAllCredentialsResponse200]
     """


    kwargs = _get_kwargs(
        body=body,
idempotency_key=idempotency_key,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    *,
    client: AuthenticatedClient | Client,
    body: CredentialsRevokeAllCredentialsInput,
    idempotency_key: str | Unset = UNSET,

) -> ErrorResponse | RevokeAllCredentialsResponse200 | None:
    """ Revoke every credential (emergency)

     The emergency response to a leak: revokes every API key, agent connection key and connected app
    created since a time, rotates the organization Function key and every running Function's own key,
    and optionally suspends Functions. Owners only, from a dashboard session, and the body must confirm
    with "revoke all". Needs the organization's credential features to be enabled; while they are not,
    this answers 404 feature_disabled, with details.feature naming the feature. Contact Primitive to
    turn them on.

    Person only: a dashboard session. The person's role must hold credentials:revoke_all. API keys,
    agent connection keys and agents are refused.

    Args:
        idempotency_key (str | Unset):
        body (CredentialsRevokeAllCredentialsInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | RevokeAllCredentialsResponse200
     """


    return sync_detailed(
        client=client,
body=body,
idempotency_key=idempotency_key,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: CredentialsRevokeAllCredentialsInput,
    idempotency_key: str | Unset = UNSET,

) -> Response[ErrorResponse | RevokeAllCredentialsResponse200]:
    """ Revoke every credential (emergency)

     The emergency response to a leak: revokes every API key, agent connection key and connected app
    created since a time, rotates the organization Function key and every running Function's own key,
    and optionally suspends Functions. Owners only, from a dashboard session, and the body must confirm
    with "revoke all". Needs the organization's credential features to be enabled; while they are not,
    this answers 404 feature_disabled, with details.feature naming the feature. Contact Primitive to
    turn them on.

    Person only: a dashboard session. The person's role must hold credentials:revoke_all. API keys,
    agent connection keys and agents are refused.

    Args:
        idempotency_key (str | Unset):
        body (CredentialsRevokeAllCredentialsInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | RevokeAllCredentialsResponse200]
     """


    kwargs = _get_kwargs(
        body=body,
idempotency_key=idempotency_key,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    body: CredentialsRevokeAllCredentialsInput,
    idempotency_key: str | Unset = UNSET,

) -> ErrorResponse | RevokeAllCredentialsResponse200 | None:
    """ Revoke every credential (emergency)

     The emergency response to a leak: revokes every API key, agent connection key and connected app
    created since a time, rotates the organization Function key and every running Function's own key,
    and optionally suspends Functions. Owners only, from a dashboard session, and the body must confirm
    with "revoke all". Needs the organization's credential features to be enabled; while they are not,
    this answers 404 feature_disabled, with details.feature naming the feature. Contact Primitive to
    turn them on.

    Person only: a dashboard session. The person's role must hold credentials:revoke_all. API keys,
    agent connection keys and agents are refused.

    Args:
        idempotency_key (str | Unset):
        body (CredentialsRevokeAllCredentialsInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | RevokeAllCredentialsResponse200
     """


    return (await asyncio_detailed(
        client=client,
body=body,
idempotency_key=idempotency_key,

    )).parsed
