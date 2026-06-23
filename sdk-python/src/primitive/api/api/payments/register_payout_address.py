from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.register_payout_address_input import RegisterPayoutAddressInput
from ...models.register_payout_address_response_201 import RegisterPayoutAddressResponse201
from typing import cast



def _get_kwargs(
    *,
    body: RegisterPayoutAddressInput,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/x402/payout-addresses",
    }

    _kwargs["json"] = body.to_dict()


    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | RegisterPayoutAddressResponse201 | None:
    if response.status_code == 201:
        response_201 = RegisterPayoutAddressResponse201.from_dict(response.json())



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

    if response.status_code == 422:
        response_422 = ErrorResponse.from_dict(response.json())



        return response_422

    if response.status_code == 429:
        response_429 = ErrorResponse.from_dict(response.json())



        return response_429

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | RegisterPayoutAddressResponse201]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient,
    body: RegisterPayoutAddressInput,

) -> Response[ErrorResponse | RegisterPayoutAddressResponse201]:
    """ Register a payout address

     Register (or update) the default payout address your org receives x402
    payments at, for a given network. You prove control of the address with
    an org-bound `personal_sign` signature over the message produced by the
    SDK helper `buildPayoutRegistrationMessage`. The org id is taken from your
    authenticated key, never the body, so a captured signature can't register
    an address under another org. Exactly one default address exists per
    (org, network); registering again replaces it. A payee MUST register a
    payout address before calling `createChallenge`, because the challenge's
    `pay_to` is resolved from this directory.

    Args:
        body (RegisterPayoutAddressInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | RegisterPayoutAddressResponse201]
     """


    kwargs = _get_kwargs(
        body=body,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    *,
    client: AuthenticatedClient,
    body: RegisterPayoutAddressInput,

) -> ErrorResponse | RegisterPayoutAddressResponse201 | None:
    """ Register a payout address

     Register (or update) the default payout address your org receives x402
    payments at, for a given network. You prove control of the address with
    an org-bound `personal_sign` signature over the message produced by the
    SDK helper `buildPayoutRegistrationMessage`. The org id is taken from your
    authenticated key, never the body, so a captured signature can't register
    an address under another org. Exactly one default address exists per
    (org, network); registering again replaces it. A payee MUST register a
    payout address before calling `createChallenge`, because the challenge's
    `pay_to` is resolved from this directory.

    Args:
        body (RegisterPayoutAddressInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | RegisterPayoutAddressResponse201
     """


    return sync_detailed(
        client=client,
body=body,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient,
    body: RegisterPayoutAddressInput,

) -> Response[ErrorResponse | RegisterPayoutAddressResponse201]:
    """ Register a payout address

     Register (or update) the default payout address your org receives x402
    payments at, for a given network. You prove control of the address with
    an org-bound `personal_sign` signature over the message produced by the
    SDK helper `buildPayoutRegistrationMessage`. The org id is taken from your
    authenticated key, never the body, so a captured signature can't register
    an address under another org. Exactly one default address exists per
    (org, network); registering again replaces it. A payee MUST register a
    payout address before calling `createChallenge`, because the challenge's
    `pay_to` is resolved from this directory.

    Args:
        body (RegisterPayoutAddressInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | RegisterPayoutAddressResponse201]
     """


    kwargs = _get_kwargs(
        body=body,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    *,
    client: AuthenticatedClient,
    body: RegisterPayoutAddressInput,

) -> ErrorResponse | RegisterPayoutAddressResponse201 | None:
    """ Register a payout address

     Register (or update) the default payout address your org receives x402
    payments at, for a given network. You prove control of the address with
    an org-bound `personal_sign` signature over the message produced by the
    SDK helper `buildPayoutRegistrationMessage`. The org id is taken from your
    authenticated key, never the body, so a captured signature can't register
    an address under another org. Exactly one default address exists per
    (org, network); registering again replaces it. A payee MUST register a
    payout address before calling `createChallenge`, because the challenge's
    `pay_to` is resolved from this directory.

    Args:
        body (RegisterPayoutAddressInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | RegisterPayoutAddressResponse201
     """


    return (await asyncio_detailed(
        client=client,
body=body,

    )).parsed
