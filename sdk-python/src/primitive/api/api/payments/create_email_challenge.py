from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.create_email_challenge_input import CreateEmailChallengeInput
from ...models.create_email_challenge_response_200 import CreateEmailChallengeResponse200
from ...models.create_email_challenge_response_201 import CreateEmailChallengeResponse201
from ...models.error_response import ErrorResponse
from ...types import UNSET, Unset
from typing import cast



def _get_kwargs(
    *,
    body: CreateEmailChallengeInput,
    idempotency_key: str | Unset = UNSET,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}
    if not isinstance(idempotency_key, Unset):
        headers["idempotency-key"] = idempotency_key



    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/x402/email-challenges",
    }

    _kwargs["json"] = body.to_dict()


    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> CreateEmailChallengeResponse200 | CreateEmailChallengeResponse201 | ErrorResponse | None:
    if response.status_code == 200:
        response_200 = CreateEmailChallengeResponse200.from_dict(response.json())



        return response_200

    if response.status_code == 201:
        response_201 = CreateEmailChallengeResponse201.from_dict(response.json())



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

    if response.status_code == 409:
        response_409 = ErrorResponse.from_dict(response.json())



        return response_409

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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[CreateEmailChallengeResponse200 | CreateEmailChallengeResponse201 | ErrorResponse]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient,
    body: CreateEmailChallengeInput,
    idempotency_key: str | Unset = UNSET,

) -> Response[CreateEmailChallengeResponse200 | CreateEmailChallengeResponse201 | ErrorResponse]:
    r""" Create an email-native payment challenge

     Issue an x402 payment challenge over a real email thread (the payee
    side). Unlike `createChallenge` (which mints a synthetic challenge id),
    this sends the challenge as an email from `from` to `to` and binds the
    payment to that DKIM-authenticated thread. The `pay_to` address and the
    token asset are resolved server-side from your registered default payout
    address for the network, never from the request. The response carries
    the thread's `interaction_id` plus the `challenge` (the
    `payment_requirements`, the `nonce_binding`, and `expires_at`) the payer
    needs to sign; the payer replies with a signed `payment` interaction
    step. Amounts are in token base units (USDC has 6 decimals, so `\"10000\"`
    is 0.01 USDC).

    Args:
        idempotency_key (str | Unset):
        body (CreateEmailChallengeInput): Issue a payment challenge over an email thread. `from`
            is your sending
            address (the funds receiver; ownership is enforced at send, exactly as
            for outbound mail) and `to` is the payer's address. The `pay_to` payout
            wallet and the token asset are resolved server-side, never taken from
            the request.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[CreateEmailChallengeResponse200 | CreateEmailChallengeResponse201 | ErrorResponse]
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
    client: AuthenticatedClient,
    body: CreateEmailChallengeInput,
    idempotency_key: str | Unset = UNSET,

) -> CreateEmailChallengeResponse200 | CreateEmailChallengeResponse201 | ErrorResponse | None:
    r""" Create an email-native payment challenge

     Issue an x402 payment challenge over a real email thread (the payee
    side). Unlike `createChallenge` (which mints a synthetic challenge id),
    this sends the challenge as an email from `from` to `to` and binds the
    payment to that DKIM-authenticated thread. The `pay_to` address and the
    token asset are resolved server-side from your registered default payout
    address for the network, never from the request. The response carries
    the thread's `interaction_id` plus the `challenge` (the
    `payment_requirements`, the `nonce_binding`, and `expires_at`) the payer
    needs to sign; the payer replies with a signed `payment` interaction
    step. Amounts are in token base units (USDC has 6 decimals, so `\"10000\"`
    is 0.01 USDC).

    Args:
        idempotency_key (str | Unset):
        body (CreateEmailChallengeInput): Issue a payment challenge over an email thread. `from`
            is your sending
            address (the funds receiver; ownership is enforced at send, exactly as
            for outbound mail) and `to` is the payer's address. The `pay_to` payout
            wallet and the token asset are resolved server-side, never taken from
            the request.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        CreateEmailChallengeResponse200 | CreateEmailChallengeResponse201 | ErrorResponse
     """


    return sync_detailed(
        client=client,
body=body,
idempotency_key=idempotency_key,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient,
    body: CreateEmailChallengeInput,
    idempotency_key: str | Unset = UNSET,

) -> Response[CreateEmailChallengeResponse200 | CreateEmailChallengeResponse201 | ErrorResponse]:
    r""" Create an email-native payment challenge

     Issue an x402 payment challenge over a real email thread (the payee
    side). Unlike `createChallenge` (which mints a synthetic challenge id),
    this sends the challenge as an email from `from` to `to` and binds the
    payment to that DKIM-authenticated thread. The `pay_to` address and the
    token asset are resolved server-side from your registered default payout
    address for the network, never from the request. The response carries
    the thread's `interaction_id` plus the `challenge` (the
    `payment_requirements`, the `nonce_binding`, and `expires_at`) the payer
    needs to sign; the payer replies with a signed `payment` interaction
    step. Amounts are in token base units (USDC has 6 decimals, so `\"10000\"`
    is 0.01 USDC).

    Args:
        idempotency_key (str | Unset):
        body (CreateEmailChallengeInput): Issue a payment challenge over an email thread. `from`
            is your sending
            address (the funds receiver; ownership is enforced at send, exactly as
            for outbound mail) and `to` is the payer's address. The `pay_to` payout
            wallet and the token asset are resolved server-side, never taken from
            the request.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[CreateEmailChallengeResponse200 | CreateEmailChallengeResponse201 | ErrorResponse]
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
    client: AuthenticatedClient,
    body: CreateEmailChallengeInput,
    idempotency_key: str | Unset = UNSET,

) -> CreateEmailChallengeResponse200 | CreateEmailChallengeResponse201 | ErrorResponse | None:
    r""" Create an email-native payment challenge

     Issue an x402 payment challenge over a real email thread (the payee
    side). Unlike `createChallenge` (which mints a synthetic challenge id),
    this sends the challenge as an email from `from` to `to` and binds the
    payment to that DKIM-authenticated thread. The `pay_to` address and the
    token asset are resolved server-side from your registered default payout
    address for the network, never from the request. The response carries
    the thread's `interaction_id` plus the `challenge` (the
    `payment_requirements`, the `nonce_binding`, and `expires_at`) the payer
    needs to sign; the payer replies with a signed `payment` interaction
    step. Amounts are in token base units (USDC has 6 decimals, so `\"10000\"`
    is 0.01 USDC).

    Args:
        idempotency_key (str | Unset):
        body (CreateEmailChallengeInput): Issue a payment challenge over an email thread. `from`
            is your sending
            address (the funds receiver; ownership is enforced at send, exactly as
            for outbound mail) and `to` is the payer's address. The `pay_to` payout
            wallet and the token asset are resolved server-side, never taken from
            the request.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        CreateEmailChallengeResponse200 | CreateEmailChallengeResponse201 | ErrorResponse
     """


    return (await asyncio_detailed(
        client=client,
body=body,
idempotency_key=idempotency_key,

    )).parsed
