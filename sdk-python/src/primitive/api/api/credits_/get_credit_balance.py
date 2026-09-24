from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.get_credit_balance_response_200 import GetCreditBalanceResponse200
from typing import cast



def _get_kwargs(
    
) -> dict[str, Any]:
    

    

    

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/credits/balance",
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | GetCreditBalanceResponse200 | None:
    if response.status_code == 200:
        response_200 = GetCreditBalanceResponse200.from_dict(response.json())



        return response_200

    if response.status_code == 401:
        response_401 = ErrorResponse.from_dict(response.json())



        return response_401

    if response.status_code == 403:
        response_403 = ErrorResponse.from_dict(response.json())



        return response_403

    if response.status_code == 429:
        response_429 = ErrorResponse.from_dict(response.json())



        return response_429

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | GetCreditBalanceResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,

) -> Response[ErrorResponse | GetCreditBalanceResponse200]:
    """ Get credit balance

     Read the organization credit position. `prepaid_credit` is the prepaid
    usage credit (paid top-ups, redeemed credit codes and granted credit)
    that can still pay for usage. `budget` is the active agent spending
    budget an operator funded for top-ups, or null when there is none.
    Amounts are strings of integer micros (1 USD = 1000000 micros).

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | GetCreditBalanceResponse200]
     """


    kwargs = _get_kwargs(
        
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    *,
    client: AuthenticatedClient | Client,

) -> ErrorResponse | GetCreditBalanceResponse200 | None:
    """ Get credit balance

     Read the organization credit position. `prepaid_credit` is the prepaid
    usage credit (paid top-ups, redeemed credit codes and granted credit)
    that can still pay for usage. `budget` is the active agent spending
    budget an operator funded for top-ups, or null when there is none.
    Amounts are strings of integer micros (1 USD = 1000000 micros).

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | GetCreditBalanceResponse200
     """


    return sync_detailed(
        client=client,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,

) -> Response[ErrorResponse | GetCreditBalanceResponse200]:
    """ Get credit balance

     Read the organization credit position. `prepaid_credit` is the prepaid
    usage credit (paid top-ups, redeemed credit codes and granted credit)
    that can still pay for usage. `budget` is the active agent spending
    budget an operator funded for top-ups, or null when there is none.
    Amounts are strings of integer micros (1 USD = 1000000 micros).

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | GetCreditBalanceResponse200]
     """


    kwargs = _get_kwargs(
        
    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    *,
    client: AuthenticatedClient | Client,

) -> ErrorResponse | GetCreditBalanceResponse200 | None:
    """ Get credit balance

     Read the organization credit position. `prepaid_credit` is the prepaid
    usage credit (paid top-ups, redeemed credit codes and granted credit)
    that can still pay for usage. `budget` is the active agent spending
    budget an operator funded for top-ups, or null when there is none.
    Amounts are strings of integer micros (1 USD = 1000000 micros).

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | GetCreditBalanceResponse200
     """


    return (await asyncio_detailed(
        client=client,

    )).parsed
