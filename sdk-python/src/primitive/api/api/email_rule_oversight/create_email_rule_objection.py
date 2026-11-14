from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.create_email_rule_objection_request import CreateEmailRuleObjectionRequest
from ...models.create_email_rule_objection_response_200 import CreateEmailRuleObjectionResponse200
from ...models.error_response import ErrorResponse
from ...types import UNSET, Unset
from typing import cast



def _get_kwargs(
    *,
    body: CreateEmailRuleObjectionRequest,
    idempotency_key: str | Unset = UNSET,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}
    if not isinstance(idempotency_key, Unset):
        headers["Idempotency-Key"] = idempotency_key



    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/email-rule-objections",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> CreateEmailRuleObjectionResponse200 | ErrorResponse | None:
    if response.status_code == 200:
        response_200 = CreateEmailRuleObjectionResponse200.from_dict(response.json())



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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[CreateEmailRuleObjectionResponse200 | ErrorResponse]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: CreateEmailRuleObjectionRequest,
    idempotency_key: str | Unset = UNSET,

) -> Response[CreateEmailRuleObjectionResponse200 | ErrorResponse]:
    """ Object to a rule over your mail

     Objects to a rule that covers one of your own mailboxes now: say in the message what you ask its
    author, to turn it off, narrow it, or explain who receives what it matches. The author answers by
    accepting, which turns it off, or by declining, optionally with a reason you see; the rule keeps
    running unless they accept. Only a rule that covers you now: one you see only because it once
    decided on your mail cannot be objected to. An objection is seen by the member who made it, the
    rule's author and the organization's owners and admins. It stays pending until the rule's author
    accepts it, turning the rule off, declines it (optionally with a reason the objector sees), or
    answers it amended once they have saved a newer version of the rule, or the member who made it
    withdraws it, which clears its message (not from an email to the author already sent or being sent).
    It never changes after that. You may have one pending objection per rule and 50 in all, and object
    to the same rule again only 10 minutes after you last did, whatever became of it. Needs mail:read,
    the email rules feature, and a member's own full-access credential (no API key, agent key or
    narrowed token). Only on your own dashboard session or the Primitive CLI.

    Args:
        idempotency_key (str | Unset):
        body (CreateEmailRuleObjectionRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[CreateEmailRuleObjectionResponse200 | ErrorResponse]
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
    body: CreateEmailRuleObjectionRequest,
    idempotency_key: str | Unset = UNSET,

) -> CreateEmailRuleObjectionResponse200 | ErrorResponse | None:
    """ Object to a rule over your mail

     Objects to a rule that covers one of your own mailboxes now: say in the message what you ask its
    author, to turn it off, narrow it, or explain who receives what it matches. The author answers by
    accepting, which turns it off, or by declining, optionally with a reason you see; the rule keeps
    running unless they accept. Only a rule that covers you now: one you see only because it once
    decided on your mail cannot be objected to. An objection is seen by the member who made it, the
    rule's author and the organization's owners and admins. It stays pending until the rule's author
    accepts it, turning the rule off, declines it (optionally with a reason the objector sees), or
    answers it amended once they have saved a newer version of the rule, or the member who made it
    withdraws it, which clears its message (not from an email to the author already sent or being sent).
    It never changes after that. You may have one pending objection per rule and 50 in all, and object
    to the same rule again only 10 minutes after you last did, whatever became of it. Needs mail:read,
    the email rules feature, and a member's own full-access credential (no API key, agent key or
    narrowed token). Only on your own dashboard session or the Primitive CLI.

    Args:
        idempotency_key (str | Unset):
        body (CreateEmailRuleObjectionRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        CreateEmailRuleObjectionResponse200 | ErrorResponse
     """


    return sync_detailed(
        client=client,
body=body,
idempotency_key=idempotency_key,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: CreateEmailRuleObjectionRequest,
    idempotency_key: str | Unset = UNSET,

) -> Response[CreateEmailRuleObjectionResponse200 | ErrorResponse]:
    """ Object to a rule over your mail

     Objects to a rule that covers one of your own mailboxes now: say in the message what you ask its
    author, to turn it off, narrow it, or explain who receives what it matches. The author answers by
    accepting, which turns it off, or by declining, optionally with a reason you see; the rule keeps
    running unless they accept. Only a rule that covers you now: one you see only because it once
    decided on your mail cannot be objected to. An objection is seen by the member who made it, the
    rule's author and the organization's owners and admins. It stays pending until the rule's author
    accepts it, turning the rule off, declines it (optionally with a reason the objector sees), or
    answers it amended once they have saved a newer version of the rule, or the member who made it
    withdraws it, which clears its message (not from an email to the author already sent or being sent).
    It never changes after that. You may have one pending objection per rule and 50 in all, and object
    to the same rule again only 10 minutes after you last did, whatever became of it. Needs mail:read,
    the email rules feature, and a member's own full-access credential (no API key, agent key or
    narrowed token). Only on your own dashboard session or the Primitive CLI.

    Args:
        idempotency_key (str | Unset):
        body (CreateEmailRuleObjectionRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[CreateEmailRuleObjectionResponse200 | ErrorResponse]
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
    body: CreateEmailRuleObjectionRequest,
    idempotency_key: str | Unset = UNSET,

) -> CreateEmailRuleObjectionResponse200 | ErrorResponse | None:
    """ Object to a rule over your mail

     Objects to a rule that covers one of your own mailboxes now: say in the message what you ask its
    author, to turn it off, narrow it, or explain who receives what it matches. The author answers by
    accepting, which turns it off, or by declining, optionally with a reason you see; the rule keeps
    running unless they accept. Only a rule that covers you now: one you see only because it once
    decided on your mail cannot be objected to. An objection is seen by the member who made it, the
    rule's author and the organization's owners and admins. It stays pending until the rule's author
    accepts it, turning the rule off, declines it (optionally with a reason the objector sees), or
    answers it amended once they have saved a newer version of the rule, or the member who made it
    withdraws it, which clears its message (not from an email to the author already sent or being sent).
    It never changes after that. You may have one pending objection per rule and 50 in all, and object
    to the same rule again only 10 minutes after you last did, whatever became of it. Needs mail:read,
    the email rules feature, and a member's own full-access credential (no API key, agent key or
    narrowed token). Only on your own dashboard session or the Primitive CLI.

    Args:
        idempotency_key (str | Unset):
        body (CreateEmailRuleObjectionRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        CreateEmailRuleObjectionResponse200 | ErrorResponse
     """


    return (await asyncio_detailed(
        client=client,
body=body,
idempotency_key=idempotency_key,

    )).parsed
