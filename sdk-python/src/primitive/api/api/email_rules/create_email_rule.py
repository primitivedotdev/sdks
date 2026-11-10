from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.create_email_rule_request import CreateEmailRuleRequest
from ...models.create_email_rule_response_201 import CreateEmailRuleResponse201
from ...models.error_response import ErrorResponse
from ...types import UNSET, Unset
from typing import cast



def _get_kwargs(
    *,
    body: CreateEmailRuleRequest,
    idempotency_key: str | Unset = UNSET,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}
    if not isinstance(idempotency_key, Unset):
        headers["Idempotency-Key"] = idempotency_key



    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/email-rules",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> CreateEmailRuleResponse201 | ErrorResponse | None:
    if response.status_code == 201:
        response_201 = CreateEmailRuleResponse201.from_dict(response.json())



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

    if response.status_code == 429:
        response_429 = ErrorResponse.from_dict(response.json())



        return response_429

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[CreateEmailRuleResponse201 | ErrorResponse]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: CreateEmailRuleRequest,
    idempotency_key: str | Unset = UNSET,

) -> Response[CreateEmailRuleResponse201 | ErrorResponse]:
    """ Create a rule

     Saves a rule as version 1 from a compile response or a tree you wrote, checked against the column
    contract; without an explanation the server writes one. It starts in observe (what it matches is
    recorded, nothing granted or blocked) unless state is draft (not evaluated). You are its author, and
    it never reaches mail you cannot read. evaluation_scope is own_mailboxes (your own mail) unless you
    name author (all you can read) or selected; scope_selection may name only what you can read. The
    answer carries the scope as stored. expectations saves emails it must match and must not; the answer
    judges them (expectations_check). kind do_not_share blocks sharing: it runs before every other rule,
    and while active no rule shares an email it matches or cannot decide; a key cannot list it
    (details.reason rule_blocks_sharing). Needs mail:read, a member's own credential with their full
    access (not an API key, agent key or narrowed token), and the email rules feature.

    Args:
        idempotency_key (str | Unset):
        body (CreateEmailRuleRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[CreateEmailRuleResponse201 | ErrorResponse]
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
    body: CreateEmailRuleRequest,
    idempotency_key: str | Unset = UNSET,

) -> CreateEmailRuleResponse201 | ErrorResponse | None:
    """ Create a rule

     Saves a rule as version 1 from a compile response or a tree you wrote, checked against the column
    contract; without an explanation the server writes one. It starts in observe (what it matches is
    recorded, nothing granted or blocked) unless state is draft (not evaluated). You are its author, and
    it never reaches mail you cannot read. evaluation_scope is own_mailboxes (your own mail) unless you
    name author (all you can read) or selected; scope_selection may name only what you can read. The
    answer carries the scope as stored. expectations saves emails it must match and must not; the answer
    judges them (expectations_check). kind do_not_share blocks sharing: it runs before every other rule,
    and while active no rule shares an email it matches or cannot decide; a key cannot list it
    (details.reason rule_blocks_sharing). Needs mail:read, a member's own credential with their full
    access (not an API key, agent key or narrowed token), and the email rules feature.

    Args:
        idempotency_key (str | Unset):
        body (CreateEmailRuleRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        CreateEmailRuleResponse201 | ErrorResponse
     """


    return sync_detailed(
        client=client,
body=body,
idempotency_key=idempotency_key,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: CreateEmailRuleRequest,
    idempotency_key: str | Unset = UNSET,

) -> Response[CreateEmailRuleResponse201 | ErrorResponse]:
    """ Create a rule

     Saves a rule as version 1 from a compile response or a tree you wrote, checked against the column
    contract; without an explanation the server writes one. It starts in observe (what it matches is
    recorded, nothing granted or blocked) unless state is draft (not evaluated). You are its author, and
    it never reaches mail you cannot read. evaluation_scope is own_mailboxes (your own mail) unless you
    name author (all you can read) or selected; scope_selection may name only what you can read. The
    answer carries the scope as stored. expectations saves emails it must match and must not; the answer
    judges them (expectations_check). kind do_not_share blocks sharing: it runs before every other rule,
    and while active no rule shares an email it matches or cannot decide; a key cannot list it
    (details.reason rule_blocks_sharing). Needs mail:read, a member's own credential with their full
    access (not an API key, agent key or narrowed token), and the email rules feature.

    Args:
        idempotency_key (str | Unset):
        body (CreateEmailRuleRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[CreateEmailRuleResponse201 | ErrorResponse]
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
    body: CreateEmailRuleRequest,
    idempotency_key: str | Unset = UNSET,

) -> CreateEmailRuleResponse201 | ErrorResponse | None:
    """ Create a rule

     Saves a rule as version 1 from a compile response or a tree you wrote, checked against the column
    contract; without an explanation the server writes one. It starts in observe (what it matches is
    recorded, nothing granted or blocked) unless state is draft (not evaluated). You are its author, and
    it never reaches mail you cannot read. evaluation_scope is own_mailboxes (your own mail) unless you
    name author (all you can read) or selected; scope_selection may name only what you can read. The
    answer carries the scope as stored. expectations saves emails it must match and must not; the answer
    judges them (expectations_check). kind do_not_share blocks sharing: it runs before every other rule,
    and while active no rule shares an email it matches or cannot decide; a key cannot list it
    (details.reason rule_blocks_sharing). Needs mail:read, a member's own credential with their full
    access (not an API key, agent key or narrowed token), and the email rules feature.

    Args:
        idempotency_key (str | Unset):
        body (CreateEmailRuleRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        CreateEmailRuleResponse201 | ErrorResponse
     """


    return (await asyncio_detailed(
        client=client,
body=body,
idempotency_key=idempotency_key,

    )).parsed
