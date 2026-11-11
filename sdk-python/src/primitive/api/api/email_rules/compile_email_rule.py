from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.compile_email_rule_request import CompileEmailRuleRequest
from ...models.compile_email_rule_response_200 import CompileEmailRuleResponse200
from ...models.error_response import ErrorResponse
from ...types import UNSET, Unset
from typing import cast



def _get_kwargs(
    *,
    body: CompileEmailRuleRequest,
    idempotency_key: str | Unset = UNSET,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}
    if not isinstance(idempotency_key, Unset):
        headers["Idempotency-Key"] = idempotency_key



    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/email-rules/compile",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> CompileEmailRuleResponse200 | ErrorResponse | None:
    if response.status_code == 200:
        response_200 = CompileEmailRuleResponse200.from_dict(response.json())



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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[CompileEmailRuleResponse200 | ErrorResponse]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: CompileEmailRuleRequest,
    idempotency_key: str | Unset = UNSET,

) -> Response[CompileEmailRuleResponse200 | ErrorResponse]:
    """ Compile a rule description

     Turns a plain-English description of which received emails to match into a rule tree over the
    published column contract, with a plain-English explanation of what it matches, the assumptions
    made, and warnings for anything the columns cannot express. Where the columns fall short the rule
    may carry up to three yes/no questions, asked about an email only after its conditions match.
    Nothing is saved. A rule with no questions has its conditions counted, read only, over the caller's
    recent classified mail (what a test of it covers by default): breadth is that count, and a warning
    says when it matches nearly all of it. The SQL the rule renders to is returned only when include_sql
    is true. kind do_not_share compiles a do-not-share rule for recall: conditions only as narrow as the
    description says, the judgement of what it describes put into questions, and with nothing a column
    decides for certain, conditions that hold for every email. Needs mail:read, a member's own
    credential with their full access (not an API key, agent key or narrowed token), and the email rules
    feature.

    Args:
        idempotency_key (str | Unset):
        body (CompileEmailRuleRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[CompileEmailRuleResponse200 | ErrorResponse]
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
    body: CompileEmailRuleRequest,
    idempotency_key: str | Unset = UNSET,

) -> CompileEmailRuleResponse200 | ErrorResponse | None:
    """ Compile a rule description

     Turns a plain-English description of which received emails to match into a rule tree over the
    published column contract, with a plain-English explanation of what it matches, the assumptions
    made, and warnings for anything the columns cannot express. Where the columns fall short the rule
    may carry up to three yes/no questions, asked about an email only after its conditions match.
    Nothing is saved. A rule with no questions has its conditions counted, read only, over the caller's
    recent classified mail (what a test of it covers by default): breadth is that count, and a warning
    says when it matches nearly all of it. The SQL the rule renders to is returned only when include_sql
    is true. kind do_not_share compiles a do-not-share rule for recall: conditions only as narrow as the
    description says, the judgement of what it describes put into questions, and with nothing a column
    decides for certain, conditions that hold for every email. Needs mail:read, a member's own
    credential with their full access (not an API key, agent key or narrowed token), and the email rules
    feature.

    Args:
        idempotency_key (str | Unset):
        body (CompileEmailRuleRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        CompileEmailRuleResponse200 | ErrorResponse
     """


    return sync_detailed(
        client=client,
body=body,
idempotency_key=idempotency_key,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: CompileEmailRuleRequest,
    idempotency_key: str | Unset = UNSET,

) -> Response[CompileEmailRuleResponse200 | ErrorResponse]:
    """ Compile a rule description

     Turns a plain-English description of which received emails to match into a rule tree over the
    published column contract, with a plain-English explanation of what it matches, the assumptions
    made, and warnings for anything the columns cannot express. Where the columns fall short the rule
    may carry up to three yes/no questions, asked about an email only after its conditions match.
    Nothing is saved. A rule with no questions has its conditions counted, read only, over the caller's
    recent classified mail (what a test of it covers by default): breadth is that count, and a warning
    says when it matches nearly all of it. The SQL the rule renders to is returned only when include_sql
    is true. kind do_not_share compiles a do-not-share rule for recall: conditions only as narrow as the
    description says, the judgement of what it describes put into questions, and with nothing a column
    decides for certain, conditions that hold for every email. Needs mail:read, a member's own
    credential with their full access (not an API key, agent key or narrowed token), and the email rules
    feature.

    Args:
        idempotency_key (str | Unset):
        body (CompileEmailRuleRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[CompileEmailRuleResponse200 | ErrorResponse]
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
    body: CompileEmailRuleRequest,
    idempotency_key: str | Unset = UNSET,

) -> CompileEmailRuleResponse200 | ErrorResponse | None:
    """ Compile a rule description

     Turns a plain-English description of which received emails to match into a rule tree over the
    published column contract, with a plain-English explanation of what it matches, the assumptions
    made, and warnings for anything the columns cannot express. Where the columns fall short the rule
    may carry up to three yes/no questions, asked about an email only after its conditions match.
    Nothing is saved. A rule with no questions has its conditions counted, read only, over the caller's
    recent classified mail (what a test of it covers by default): breadth is that count, and a warning
    says when it matches nearly all of it. The SQL the rule renders to is returned only when include_sql
    is true. kind do_not_share compiles a do-not-share rule for recall: conditions only as narrow as the
    description says, the judgement of what it describes put into questions, and with nothing a column
    decides for certain, conditions that hold for every email. Needs mail:read, a member's own
    credential with their full access (not an API key, agent key or narrowed token), and the email rules
    feature.

    Args:
        idempotency_key (str | Unset):
        body (CompileEmailRuleRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        CompileEmailRuleResponse200 | ErrorResponse
     """


    return (await asyncio_detailed(
        client=client,
body=body,
idempotency_key=idempotency_key,

    )).parsed
