from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.list_email_rule_decisions_on_my_mail_matched import ListEmailRuleDecisionsOnMyMailMatched
from ...models.list_email_rule_decisions_on_my_mail_response_200 import ListEmailRuleDecisionsOnMyMailResponse200
from ...types import UNSET, Unset
from typing import cast
from uuid import UUID



def _get_kwargs(
    id: UUID,
    *,
    limit: int | Unset = 50,
    cursor: str | Unset = UNSET,
    matched: ListEmailRuleDecisionsOnMyMailMatched | Unset = UNSET,

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
        "url": "/email-rules/covering-me/{id}/decisions".format(id=quote(str(id), safe=""),),
        "params": params,
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | ListEmailRuleDecisionsOnMyMailResponse200 | None:
    if response.status_code == 200:
        response_200 = ListEmailRuleDecisionsOnMyMailResponse200.from_dict(response.json())



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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | ListEmailRuleDecisionsOnMyMailResponse200]:
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
    matched: ListEmailRuleDecisionsOnMyMailMatched | Unset = UNSET,

) -> Response[ErrorResponse | ListEmailRuleDecisionsOnMyMailResponse200]:
    """ List what a rule decided about your mail

     What a rule that covers your mailboxes, or decided on your mail, decided about mail at your own
    mailboxes, newest first: never about anyone else's mail. Each decision is in the words of the
    version that made it, which can be earlier than the current one: the questions it asked about that
    email (question_answers) and the columns its conditions read (parts). Needs mail:read, a member's
    own credential with their full access (not an API key, agent key or narrowed token), and the email
    rules feature. Only on your own dashboard session or the Primitive CLI.

    Args:
        id (UUID):
        limit (int | Unset):  Default: 50.
        cursor (str | Unset):
        matched (ListEmailRuleDecisionsOnMyMailMatched | Unset): Only decisions that matched
            (true) or did not (false).

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ListEmailRuleDecisionsOnMyMailResponse200]
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
    matched: ListEmailRuleDecisionsOnMyMailMatched | Unset = UNSET,

) -> ErrorResponse | ListEmailRuleDecisionsOnMyMailResponse200 | None:
    """ List what a rule decided about your mail

     What a rule that covers your mailboxes, or decided on your mail, decided about mail at your own
    mailboxes, newest first: never about anyone else's mail. Each decision is in the words of the
    version that made it, which can be earlier than the current one: the questions it asked about that
    email (question_answers) and the columns its conditions read (parts). Needs mail:read, a member's
    own credential with their full access (not an API key, agent key or narrowed token), and the email
    rules feature. Only on your own dashboard session or the Primitive CLI.

    Args:
        id (UUID):
        limit (int | Unset):  Default: 50.
        cursor (str | Unset):
        matched (ListEmailRuleDecisionsOnMyMailMatched | Unset): Only decisions that matched
            (true) or did not (false).

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ListEmailRuleDecisionsOnMyMailResponse200
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
    matched: ListEmailRuleDecisionsOnMyMailMatched | Unset = UNSET,

) -> Response[ErrorResponse | ListEmailRuleDecisionsOnMyMailResponse200]:
    """ List what a rule decided about your mail

     What a rule that covers your mailboxes, or decided on your mail, decided about mail at your own
    mailboxes, newest first: never about anyone else's mail. Each decision is in the words of the
    version that made it, which can be earlier than the current one: the questions it asked about that
    email (question_answers) and the columns its conditions read (parts). Needs mail:read, a member's
    own credential with their full access (not an API key, agent key or narrowed token), and the email
    rules feature. Only on your own dashboard session or the Primitive CLI.

    Args:
        id (UUID):
        limit (int | Unset):  Default: 50.
        cursor (str | Unset):
        matched (ListEmailRuleDecisionsOnMyMailMatched | Unset): Only decisions that matched
            (true) or did not (false).

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ListEmailRuleDecisionsOnMyMailResponse200]
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
    matched: ListEmailRuleDecisionsOnMyMailMatched | Unset = UNSET,

) -> ErrorResponse | ListEmailRuleDecisionsOnMyMailResponse200 | None:
    """ List what a rule decided about your mail

     What a rule that covers your mailboxes, or decided on your mail, decided about mail at your own
    mailboxes, newest first: never about anyone else's mail. Each decision is in the words of the
    version that made it, which can be earlier than the current one: the questions it asked about that
    email (question_answers) and the columns its conditions read (parts). Needs mail:read, a member's
    own credential with their full access (not an API key, agent key or narrowed token), and the email
    rules feature. Only on your own dashboard session or the Primitive CLI.

    Args:
        id (UUID):
        limit (int | Unset):  Default: 50.
        cursor (str | Unset):
        matched (ListEmailRuleDecisionsOnMyMailMatched | Unset): Only decisions that matched
            (true) or did not (false).

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ListEmailRuleDecisionsOnMyMailResponse200
     """


    return (await asyncio_detailed(
        id=id,
client=client,
limit=limit,
cursor=cursor,
matched=matched,

    )).parsed
