from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.list_email_rule_shares_box import ListEmailRuleSharesBox
from ...models.list_email_rule_shares_live import ListEmailRuleSharesLive
from ...models.list_email_rule_shares_response_200 import ListEmailRuleSharesResponse200
from ...types import UNSET, Unset
from typing import cast



def _get_kwargs(
    *,
    box: ListEmailRuleSharesBox | Unset = ListEmailRuleSharesBox.RECEIVED,
    live: ListEmailRuleSharesLive | Unset = ListEmailRuleSharesLive.TRUE,
    limit: int | Unset = 25,
    cursor: str | Unset = UNSET,

) -> dict[str, Any]:
    

    

    params: dict[str, Any] = {}

    json_box: str | Unset = UNSET
    if not isinstance(box, Unset):
        json_box = box.value

    params["box"] = json_box

    json_live: str | Unset = UNSET
    if not isinstance(live, Unset):
        json_live = live.value

    params["live"] = json_live

    params["limit"] = limit

    params["cursor"] = cursor


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/email-rule-shares",
        "params": params,
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | ListEmailRuleSharesResponse200 | None:
    if response.status_code == 200:
        response_200 = ListEmailRuleSharesResponse200.from_dict(response.json())



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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | ListEmailRuleSharesResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    box: ListEmailRuleSharesBox | Unset = ListEmailRuleSharesBox.RECEIVED,
    live: ListEmailRuleSharesLive | Unset = ListEmailRuleSharesLive.TRUE,
    limit: int | Unset = 25,
    cursor: str | Unset = UNSET,

) -> Response[ErrorResponse | ListEmailRuleSharesResponse200]:
    """ List rule shares

     Lists rules shared with you, rules you share, or every share you can see. A share is visible to its
    two people and the organization's owners and admins. Needs mail:read, the email rules feature, and a
    member's own full-access credential (no API key, agent key or narrowed token).

    Args:
        box (ListEmailRuleSharesBox | Unset): received: rules shared with you; given: rules you
            share; all: every share you can see (owners and admins see the organization's). Default:
            ListEmailRuleSharesBox.RECEIVED.
        live (ListEmailRuleSharesLive | Unset): Whether to list live shares, ended ones, or both.
            Default: ListEmailRuleSharesLive.TRUE.
        limit (int | Unset):  Default: 25.
        cursor (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ListEmailRuleSharesResponse200]
     """


    kwargs = _get_kwargs(
        box=box,
live=live,
limit=limit,
cursor=cursor,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    *,
    client: AuthenticatedClient | Client,
    box: ListEmailRuleSharesBox | Unset = ListEmailRuleSharesBox.RECEIVED,
    live: ListEmailRuleSharesLive | Unset = ListEmailRuleSharesLive.TRUE,
    limit: int | Unset = 25,
    cursor: str | Unset = UNSET,

) -> ErrorResponse | ListEmailRuleSharesResponse200 | None:
    """ List rule shares

     Lists rules shared with you, rules you share, or every share you can see. A share is visible to its
    two people and the organization's owners and admins. Needs mail:read, the email rules feature, and a
    member's own full-access credential (no API key, agent key or narrowed token).

    Args:
        box (ListEmailRuleSharesBox | Unset): received: rules shared with you; given: rules you
            share; all: every share you can see (owners and admins see the organization's). Default:
            ListEmailRuleSharesBox.RECEIVED.
        live (ListEmailRuleSharesLive | Unset): Whether to list live shares, ended ones, or both.
            Default: ListEmailRuleSharesLive.TRUE.
        limit (int | Unset):  Default: 25.
        cursor (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ListEmailRuleSharesResponse200
     """


    return sync_detailed(
        client=client,
box=box,
live=live,
limit=limit,
cursor=cursor,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    box: ListEmailRuleSharesBox | Unset = ListEmailRuleSharesBox.RECEIVED,
    live: ListEmailRuleSharesLive | Unset = ListEmailRuleSharesLive.TRUE,
    limit: int | Unset = 25,
    cursor: str | Unset = UNSET,

) -> Response[ErrorResponse | ListEmailRuleSharesResponse200]:
    """ List rule shares

     Lists rules shared with you, rules you share, or every share you can see. A share is visible to its
    two people and the organization's owners and admins. Needs mail:read, the email rules feature, and a
    member's own full-access credential (no API key, agent key or narrowed token).

    Args:
        box (ListEmailRuleSharesBox | Unset): received: rules shared with you; given: rules you
            share; all: every share you can see (owners and admins see the organization's). Default:
            ListEmailRuleSharesBox.RECEIVED.
        live (ListEmailRuleSharesLive | Unset): Whether to list live shares, ended ones, or both.
            Default: ListEmailRuleSharesLive.TRUE.
        limit (int | Unset):  Default: 25.
        cursor (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ListEmailRuleSharesResponse200]
     """


    kwargs = _get_kwargs(
        box=box,
live=live,
limit=limit,
cursor=cursor,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    box: ListEmailRuleSharesBox | Unset = ListEmailRuleSharesBox.RECEIVED,
    live: ListEmailRuleSharesLive | Unset = ListEmailRuleSharesLive.TRUE,
    limit: int | Unset = 25,
    cursor: str | Unset = UNSET,

) -> ErrorResponse | ListEmailRuleSharesResponse200 | None:
    """ List rule shares

     Lists rules shared with you, rules you share, or every share you can see. A share is visible to its
    two people and the organization's owners and admins. Needs mail:read, the email rules feature, and a
    member's own full-access credential (no API key, agent key or narrowed token).

    Args:
        box (ListEmailRuleSharesBox | Unset): received: rules shared with you; given: rules you
            share; all: every share you can see (owners and admins see the organization's). Default:
            ListEmailRuleSharesBox.RECEIVED.
        live (ListEmailRuleSharesLive | Unset): Whether to list live shares, ended ones, or both.
            Default: ListEmailRuleSharesLive.TRUE.
        limit (int | Unset):  Default: 25.
        cursor (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ListEmailRuleSharesResponse200
     """


    return (await asyncio_detailed(
        client=client,
box=box,
live=live,
limit=limit,
cursor=cursor,

    )).parsed
