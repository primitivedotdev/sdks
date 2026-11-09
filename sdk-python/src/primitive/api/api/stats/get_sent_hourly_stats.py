from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.get_sent_hourly_stats_response_200 import GetSentHourlyStatsResponse200
from ...types import UNSET, Unset
from typing import cast



def _get_kwargs(
    *,
    days: int | Unset = 8,

) -> dict[str, Any]:
    

    

    params: dict[str, Any] = {}

    params["days"] = days


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/stats/sent-emails/hourly",
        "params": params,
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | GetSentHourlyStatsResponse200 | None:
    if response.status_code == 200:
        response_200 = GetSentHourlyStatsResponse200.from_dict(response.json())



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

    if response.status_code == 429:
        response_429 = ErrorResponse.from_dict(response.json())



        return response_429

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | GetSentHourlyStatsResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    days: int | Unset = 8,

) -> Response[ErrorResponse | GetSentHourlyStatsResponse200]:
    """ Sent mail per hour

     Sent mail per UTC hour over the last `days` days, by outcome: delivered, bounced (including agent
    failures, wait timeouts and unknown endings) and denied by a send gate. Sends still in flight are
    not counted until they end. Hours with no mail are left out. Needs mail:read. Counts only the mail
    the credential may read: a credential narrowed to some addresses counts the mail its scope admits.

    Args:
        days (int | Unset): How many days back, from 1 to 31; defaults to 8. Default: 8.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | GetSentHourlyStatsResponse200]
     """


    kwargs = _get_kwargs(
        days=days,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    *,
    client: AuthenticatedClient | Client,
    days: int | Unset = 8,

) -> ErrorResponse | GetSentHourlyStatsResponse200 | None:
    """ Sent mail per hour

     Sent mail per UTC hour over the last `days` days, by outcome: delivered, bounced (including agent
    failures, wait timeouts and unknown endings) and denied by a send gate. Sends still in flight are
    not counted until they end. Hours with no mail are left out. Needs mail:read. Counts only the mail
    the credential may read: a credential narrowed to some addresses counts the mail its scope admits.

    Args:
        days (int | Unset): How many days back, from 1 to 31; defaults to 8. Default: 8.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | GetSentHourlyStatsResponse200
     """


    return sync_detailed(
        client=client,
days=days,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    days: int | Unset = 8,

) -> Response[ErrorResponse | GetSentHourlyStatsResponse200]:
    """ Sent mail per hour

     Sent mail per UTC hour over the last `days` days, by outcome: delivered, bounced (including agent
    failures, wait timeouts and unknown endings) and denied by a send gate. Sends still in flight are
    not counted until they end. Hours with no mail are left out. Needs mail:read. Counts only the mail
    the credential may read: a credential narrowed to some addresses counts the mail its scope admits.

    Args:
        days (int | Unset): How many days back, from 1 to 31; defaults to 8. Default: 8.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | GetSentHourlyStatsResponse200]
     """


    kwargs = _get_kwargs(
        days=days,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    days: int | Unset = 8,

) -> ErrorResponse | GetSentHourlyStatsResponse200 | None:
    """ Sent mail per hour

     Sent mail per UTC hour over the last `days` days, by outcome: delivered, bounced (including agent
    failures, wait timeouts and unknown endings) and denied by a send gate. Sends still in flight are
    not counted until they end. Hours with no mail are left out. Needs mail:read. Counts only the mail
    the credential may read: a credential narrowed to some addresses counts the mail its scope admits.

    Args:
        days (int | Unset): How many days back, from 1 to 31; defaults to 8. Default: 8.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | GetSentHourlyStatsResponse200
     """


    return (await asyncio_detailed(
        client=client,
days=days,

    )).parsed
