from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.redeem_credit_code_input import RedeemCreditCodeInput
from ...models.redeem_credit_code_response_200 import RedeemCreditCodeResponse200
from typing import cast



def _get_kwargs(
    *,
    body: RedeemCreditCodeInput,
    idempotency_key: str,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}
    headers["Idempotency-Key"] = idempotency_key



    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/credits/redeem",
    }

    _kwargs["json"] = body.to_dict()


    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | RedeemCreditCodeResponse200 | None:
    if response.status_code == 200:
        response_200 = RedeemCreditCodeResponse200.from_dict(response.json())



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

    if response.status_code == 409:
        response_409 = ErrorResponse.from_dict(response.json())



        return response_409

    if response.status_code == 422:
        response_422 = ErrorResponse.from_dict(response.json())



        return response_422

    if response.status_code == 429:
        response_429 = ErrorResponse.from_dict(response.json())



        return response_429

    if response.status_code == 503:
        response_503 = ErrorResponse.from_dict(response.json())



        return response_503

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | RedeemCreditCodeResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: RedeemCreditCodeInput,
    idempotency_key: str,

) -> Response[ErrorResponse | RedeemCreditCodeResponse200]:
    """ Redeem a credit code

     Redeem a credit code for the authenticated organization. The credit is
    added to the organization prepaid credit and shows in
    `GET /credits/balance` under `prepaid_credit`.

    Redeeming requires an organization owner or admin. An API key redeems
    with the authority of the user who created it, based on that user's
    current role; a key without that authority gets the same
    `credit_code_invalid` refusal as an unknown code.

    The `Idempotency-Key` header is required. Retrying with the same key
    and code returns the original grant with `replayed: true` and grants
    nothing new; the same key with a different code is refused with
    `idempotency_key_reused`. Every refusal carries a human-readable
    `error.message` that can be shown to the user as is.

    Args:
        idempotency_key (str):
        body (RedeemCreditCodeInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | RedeemCreditCodeResponse200]
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
    body: RedeemCreditCodeInput,
    idempotency_key: str,

) -> ErrorResponse | RedeemCreditCodeResponse200 | None:
    """ Redeem a credit code

     Redeem a credit code for the authenticated organization. The credit is
    added to the organization prepaid credit and shows in
    `GET /credits/balance` under `prepaid_credit`.

    Redeeming requires an organization owner or admin. An API key redeems
    with the authority of the user who created it, based on that user's
    current role; a key without that authority gets the same
    `credit_code_invalid` refusal as an unknown code.

    The `Idempotency-Key` header is required. Retrying with the same key
    and code returns the original grant with `replayed: true` and grants
    nothing new; the same key with a different code is refused with
    `idempotency_key_reused`. Every refusal carries a human-readable
    `error.message` that can be shown to the user as is.

    Args:
        idempotency_key (str):
        body (RedeemCreditCodeInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | RedeemCreditCodeResponse200
     """


    return sync_detailed(
        client=client,
body=body,
idempotency_key=idempotency_key,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: RedeemCreditCodeInput,
    idempotency_key: str,

) -> Response[ErrorResponse | RedeemCreditCodeResponse200]:
    """ Redeem a credit code

     Redeem a credit code for the authenticated organization. The credit is
    added to the organization prepaid credit and shows in
    `GET /credits/balance` under `prepaid_credit`.

    Redeeming requires an organization owner or admin. An API key redeems
    with the authority of the user who created it, based on that user's
    current role; a key without that authority gets the same
    `credit_code_invalid` refusal as an unknown code.

    The `Idempotency-Key` header is required. Retrying with the same key
    and code returns the original grant with `replayed: true` and grants
    nothing new; the same key with a different code is refused with
    `idempotency_key_reused`. Every refusal carries a human-readable
    `error.message` that can be shown to the user as is.

    Args:
        idempotency_key (str):
        body (RedeemCreditCodeInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | RedeemCreditCodeResponse200]
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
    body: RedeemCreditCodeInput,
    idempotency_key: str,

) -> ErrorResponse | RedeemCreditCodeResponse200 | None:
    """ Redeem a credit code

     Redeem a credit code for the authenticated organization. The credit is
    added to the organization prepaid credit and shows in
    `GET /credits/balance` under `prepaid_credit`.

    Redeeming requires an organization owner or admin. An API key redeems
    with the authority of the user who created it, based on that user's
    current role; a key without that authority gets the same
    `credit_code_invalid` refusal as an unknown code.

    The `Idempotency-Key` header is required. Retrying with the same key
    and code returns the original grant with `replayed: true` and grants
    nothing new; the same key with a different code is refused with
    `idempotency_key_reused`. Every refusal carries a human-readable
    `error.message` that can be shown to the user as is.

    Args:
        idempotency_key (str):
        body (RedeemCreditCodeInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | RedeemCreditCodeResponse200
     """


    return (await asyncio_detailed(
        client=client,
body=body,
idempotency_key=idempotency_key,

    )).parsed
