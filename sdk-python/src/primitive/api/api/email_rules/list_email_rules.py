from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.list_email_rules_response_200 import ListEmailRulesResponse200
from ...types import UNSET, Unset
from typing import cast
from uuid import UUID



def _get_kwargs(
    *,
    limit: int | Unset = 50,
    cursor: str | Unset = UNSET,
    matched_email_id: UUID | Unset = UNSET,

) -> dict[str, Any]:
    

    

    params: dict[str, Any] = {}

    params["limit"] = limit

    params["cursor"] = cursor

    json_matched_email_id: str | Unset = UNSET
    if not isinstance(matched_email_id, Unset):
        json_matched_email_id = str(matched_email_id)
    params["matched_email_id"] = json_matched_email_id


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/email-rules",
        "params": params,
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | ListEmailRulesResponse200 | None:
    if response.status_code == 200:
        response_200 = ListEmailRulesResponse200.from_dict(response.json())



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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | ListEmailRulesResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    limit: int | Unset = 50,
    cursor: str | Unset = UNSET,
    matched_email_id: UUID | Unset = UNSET,

) -> Response[ErrorResponse | ListEmailRulesResponse200]:
    """ List rules

     The rules the caller can see, newest first: their own, or every member's rules for a caller who
    reads the whole organization's mail. With matched_email_id, only the rules that matched that email.
    Needs mail:read, a credential acting as a member with their full access (API keys, agent keys and
    narrowed tokens are refused), and the email rules feature on the organization.

    Args:
        limit (int | Unset):  Default: 50.
        cursor (str | Unset):
        matched_email_id (UUID | Unset): Only rules that matched this email.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ListEmailRulesResponse200]
     """


    kwargs = _get_kwargs(
        limit=limit,
cursor=cursor,
matched_email_id=matched_email_id,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    *,
    client: AuthenticatedClient | Client,
    limit: int | Unset = 50,
    cursor: str | Unset = UNSET,
    matched_email_id: UUID | Unset = UNSET,

) -> ErrorResponse | ListEmailRulesResponse200 | None:
    """ List rules

     The rules the caller can see, newest first: their own, or every member's rules for a caller who
    reads the whole organization's mail. With matched_email_id, only the rules that matched that email.
    Needs mail:read, a credential acting as a member with their full access (API keys, agent keys and
    narrowed tokens are refused), and the email rules feature on the organization.

    Args:
        limit (int | Unset):  Default: 50.
        cursor (str | Unset):
        matched_email_id (UUID | Unset): Only rules that matched this email.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ListEmailRulesResponse200
     """


    return sync_detailed(
        client=client,
limit=limit,
cursor=cursor,
matched_email_id=matched_email_id,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    limit: int | Unset = 50,
    cursor: str | Unset = UNSET,
    matched_email_id: UUID | Unset = UNSET,

) -> Response[ErrorResponse | ListEmailRulesResponse200]:
    """ List rules

     The rules the caller can see, newest first: their own, or every member's rules for a caller who
    reads the whole organization's mail. With matched_email_id, only the rules that matched that email.
    Needs mail:read, a credential acting as a member with their full access (API keys, agent keys and
    narrowed tokens are refused), and the email rules feature on the organization.

    Args:
        limit (int | Unset):  Default: 50.
        cursor (str | Unset):
        matched_email_id (UUID | Unset): Only rules that matched this email.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ListEmailRulesResponse200]
     """


    kwargs = _get_kwargs(
        limit=limit,
cursor=cursor,
matched_email_id=matched_email_id,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    limit: int | Unset = 50,
    cursor: str | Unset = UNSET,
    matched_email_id: UUID | Unset = UNSET,

) -> ErrorResponse | ListEmailRulesResponse200 | None:
    """ List rules

     The rules the caller can see, newest first: their own, or every member's rules for a caller who
    reads the whole organization's mail. With matched_email_id, only the rules that matched that email.
    Needs mail:read, a credential acting as a member with their full access (API keys, agent keys and
    narrowed tokens are refused), and the email rules feature on the organization.

    Args:
        limit (int | Unset):  Default: 50.
        cursor (str | Unset):
        matched_email_id (UUID | Unset): Only rules that matched this email.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ListEmailRulesResponse200
     """


    return (await asyncio_detailed(
        client=client,
limit=limit,
cursor=cursor,
matched_email_id=matched_email_id,

    )).parsed
