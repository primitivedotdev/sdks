from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.list_email_rule_decisions_matched import ListEmailRuleDecisionsMatched
from ...models.list_email_rule_decisions_response_200 import ListEmailRuleDecisionsResponse200
from ...types import UNSET, Unset
from typing import cast
from uuid import UUID



def _get_kwargs(
    id: UUID,
    *,
    limit: int | Unset = 50,
    cursor: str | Unset = UNSET,
    matched: ListEmailRuleDecisionsMatched | Unset = UNSET,

) -> dict[str, Any]:
    

    

    params: dict[str, Any] = {}

    params["limit"] = limit

    params["cursor"] = cursor

    json_matched: str | Unset = UNSET
    if not isinstance(matched, Unset):
        json_matched = matched.value

    params["matched"] = json_matched


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/email-rules/{id}/decisions".format(id=quote(str(id), safe=""),),
        "params": params,
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | ListEmailRuleDecisionsResponse200 | None:
    if response.status_code == 200:
        response_200 = ListEmailRuleDecisionsResponse200.from_dict(response.json())



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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | ListEmailRuleDecisionsResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    limit: int | Unset = 50,
    cursor: str | Unset = UNSET,
    matched: ListEmailRuleDecisionsMatched | Unset = UNSET,

) -> Response[ErrorResponse | ListEmailRuleDecisionsResponse200]:
    """ List a rule's decisions

     What the rule decided for each email it was evaluated against, newest first: whether it matched,
    whether it nearly did, how each part decided and the answers to its questions. Only decisions on
    emails the caller can read are listed. With matched, only matches (true) or only the rest (false).
    Needs mail:read, a credential acting as a member with their full access (API keys, agent keys and
    narrowed tokens are refused), and the email rules feature on the organization.

    Args:
        id (UUID):
        limit (int | Unset):  Default: 50.
        cursor (str | Unset):
        matched (ListEmailRuleDecisionsMatched | Unset): Only decisions that matched (true) or did
            not (false).

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ListEmailRuleDecisionsResponse200]
     """


    kwargs = _get_kwargs(
        id=id,
limit=limit,
cursor=cursor,
matched=matched,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    limit: int | Unset = 50,
    cursor: str | Unset = UNSET,
    matched: ListEmailRuleDecisionsMatched | Unset = UNSET,

) -> ErrorResponse | ListEmailRuleDecisionsResponse200 | None:
    """ List a rule's decisions

     What the rule decided for each email it was evaluated against, newest first: whether it matched,
    whether it nearly did, how each part decided and the answers to its questions. Only decisions on
    emails the caller can read are listed. With matched, only matches (true) or only the rest (false).
    Needs mail:read, a credential acting as a member with their full access (API keys, agent keys and
    narrowed tokens are refused), and the email rules feature on the organization.

    Args:
        id (UUID):
        limit (int | Unset):  Default: 50.
        cursor (str | Unset):
        matched (ListEmailRuleDecisionsMatched | Unset): Only decisions that matched (true) or did
            not (false).

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ListEmailRuleDecisionsResponse200
     """


    return sync_detailed(
        id=id,
client=client,
limit=limit,
cursor=cursor,
matched=matched,

    ).parsed

async def asyncio_detailed(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    limit: int | Unset = 50,
    cursor: str | Unset = UNSET,
    matched: ListEmailRuleDecisionsMatched | Unset = UNSET,

) -> Response[ErrorResponse | ListEmailRuleDecisionsResponse200]:
    """ List a rule's decisions

     What the rule decided for each email it was evaluated against, newest first: whether it matched,
    whether it nearly did, how each part decided and the answers to its questions. Only decisions on
    emails the caller can read are listed. With matched, only matches (true) or only the rest (false).
    Needs mail:read, a credential acting as a member with their full access (API keys, agent keys and
    narrowed tokens are refused), and the email rules feature on the organization.

    Args:
        id (UUID):
        limit (int | Unset):  Default: 50.
        cursor (str | Unset):
        matched (ListEmailRuleDecisionsMatched | Unset): Only decisions that matched (true) or did
            not (false).

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ListEmailRuleDecisionsResponse200]
     """


    kwargs = _get_kwargs(
        id=id,
limit=limit,
cursor=cursor,
matched=matched,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    limit: int | Unset = 50,
    cursor: str | Unset = UNSET,
    matched: ListEmailRuleDecisionsMatched | Unset = UNSET,

) -> ErrorResponse | ListEmailRuleDecisionsResponse200 | None:
    """ List a rule's decisions

     What the rule decided for each email it was evaluated against, newest first: whether it matched,
    whether it nearly did, how each part decided and the answers to its questions. Only decisions on
    emails the caller can read are listed. With matched, only matches (true) or only the rest (false).
    Needs mail:read, a credential acting as a member with their full access (API keys, agent keys and
    narrowed tokens are refused), and the email rules feature on the organization.

    Args:
        id (UUID):
        limit (int | Unset):  Default: 50.
        cursor (str | Unset):
        matched (ListEmailRuleDecisionsMatched | Unset): Only decisions that matched (true) or did
            not (false).

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ListEmailRuleDecisionsResponse200
     """


    return (await asyncio_detailed(
        id=id,
client=client,
limit=limit,
cursor=cursor,
matched=matched,

    )).parsed
