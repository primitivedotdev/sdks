from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.pay_challenge_input import PayChallengeInput
from ...models.pay_challenge_response_200 import PayChallengeResponse200
from typing import cast
from uuid import UUID



def _get_kwargs(
    id: UUID,
    *,
    body: PayChallengeInput,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/x402/challenges/{id}/pay".format(id=quote(str(id), safe=""),),
    }

    _kwargs["json"] = body.to_dict()


    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | PayChallengeResponse200 | None:
    if response.status_code == 200:
        response_200 = PayChallengeResponse200.from_dict(response.json())



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

    if response.status_code == 422:
        response_422 = ErrorResponse.from_dict(response.json())



        return response_422

    if response.status_code == 429:
        response_429 = ErrorResponse.from_dict(response.json())



        return response_429

    if response.status_code == 502:
        response_502 = ErrorResponse.from_dict(response.json())



        return response_502

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | PayChallengeResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    id: UUID,
    *,
    client: AuthenticatedClient,
    body: PayChallengeInput,

) -> Response[ErrorResponse | PayChallengeResponse200]:
    """ Pay a payment challenge

     Settle a challenge addressed to your org as payer. The request body
    carries a signed x402 `PaymentPayload`: an EIP-3009
    `transferWithAuthorization` signed locally with your own key, whose nonce
    is bound to the challenge via the SDK's `deriveEip3009Nonce`. The platform
    verifies every signed field against its own record of the challenge,
    applies your spend policy, and settles on-chain through a facilitator.
    Settlement is non-custodial; Primitive never holds funds. Idempotent:
    paying an already-settled challenge returns the original receipt. Most
    callers use the SDK `pay()` helper rather than building the payload by
    hand.

    Args:
        id (UUID):
        body (PayChallengeInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | PayChallengeResponse200]
     """


    kwargs = _get_kwargs(
        id=id,
body=body,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    id: UUID,
    *,
    client: AuthenticatedClient,
    body: PayChallengeInput,

) -> ErrorResponse | PayChallengeResponse200 | None:
    """ Pay a payment challenge

     Settle a challenge addressed to your org as payer. The request body
    carries a signed x402 `PaymentPayload`: an EIP-3009
    `transferWithAuthorization` signed locally with your own key, whose nonce
    is bound to the challenge via the SDK's `deriveEip3009Nonce`. The platform
    verifies every signed field against its own record of the challenge,
    applies your spend policy, and settles on-chain through a facilitator.
    Settlement is non-custodial; Primitive never holds funds. Idempotent:
    paying an already-settled challenge returns the original receipt. Most
    callers use the SDK `pay()` helper rather than building the payload by
    hand.

    Args:
        id (UUID):
        body (PayChallengeInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | PayChallengeResponse200
     """


    return sync_detailed(
        id=id,
client=client,
body=body,

    ).parsed

async def asyncio_detailed(
    id: UUID,
    *,
    client: AuthenticatedClient,
    body: PayChallengeInput,

) -> Response[ErrorResponse | PayChallengeResponse200]:
    """ Pay a payment challenge

     Settle a challenge addressed to your org as payer. The request body
    carries a signed x402 `PaymentPayload`: an EIP-3009
    `transferWithAuthorization` signed locally with your own key, whose nonce
    is bound to the challenge via the SDK's `deriveEip3009Nonce`. The platform
    verifies every signed field against its own record of the challenge,
    applies your spend policy, and settles on-chain through a facilitator.
    Settlement is non-custodial; Primitive never holds funds. Idempotent:
    paying an already-settled challenge returns the original receipt. Most
    callers use the SDK `pay()` helper rather than building the payload by
    hand.

    Args:
        id (UUID):
        body (PayChallengeInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | PayChallengeResponse200]
     """


    kwargs = _get_kwargs(
        id=id,
body=body,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    id: UUID,
    *,
    client: AuthenticatedClient,
    body: PayChallengeInput,

) -> ErrorResponse | PayChallengeResponse200 | None:
    """ Pay a payment challenge

     Settle a challenge addressed to your org as payer. The request body
    carries a signed x402 `PaymentPayload`: an EIP-3009
    `transferWithAuthorization` signed locally with your own key, whose nonce
    is bound to the challenge via the SDK's `deriveEip3009Nonce`. The platform
    verifies every signed field against its own record of the challenge,
    applies your spend policy, and settles on-chain through a facilitator.
    Settlement is non-custodial; Primitive never holds funds. Idempotent:
    paying an already-settled challenge returns the original receipt. Most
    callers use the SDK `pay()` helper rather than building the payload by
    hand.

    Args:
        id (UUID):
        body (PayChallengeInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | PayChallengeResponse200
     """


    return (await asyncio_detailed(
        id=id,
client=client,
body=body,

    )).parsed
