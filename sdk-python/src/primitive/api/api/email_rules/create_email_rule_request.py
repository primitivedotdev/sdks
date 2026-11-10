from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.create_email_rule_request_request import CreateEmailRuleRequestRequest
from ...models.create_email_rule_request_response_201 import CreateEmailRuleRequestResponse201
from ...models.error_response import ErrorResponse
from ...types import UNSET, Unset
from typing import cast



def _get_kwargs(
    *,
    body: CreateEmailRuleRequestRequest,
    idempotency_key: str | Unset = UNSET,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}
    if not isinstance(idempotency_key, Unset):
        headers["Idempotency-Key"] = idempotency_key



    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/email-rule-requests",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> CreateEmailRuleRequestResponse201 | ErrorResponse | None:
    if response.status_code == 201:
        response_201 = CreateEmailRuleRequestResponse201.from_dict(response.json())



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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[CreateEmailRuleRequestResponse201 | ErrorResponse]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: CreateEmailRuleRequestRequest,
    idempotency_key: str | Unset = UNSET,

) -> Response[CreateEmailRuleRequestResponse201 | ErrorResponse]:
    """ Ask a member for a rule

     Asks another member of the organization for a rule over their own mail, from a compile response or a
    tree you wrote. Name them by user id, or by their member mailbox address, or by their verified work
    email if you can list members (at most 30 lookups by address an hour). Nothing is evaluated and
    nothing is shared until they accept, and they may change the rule first; they see the request and
    can preview what it matches in their own mail. You may have at most 5 pending requests to one member
    and 50 in all. If you can list members (members:read), the answer also says whether they can accept
    it under their role (target_can_accept), and if not, why (target_warning); the request is sent
    either way. To find out before asking, use POST /v1/email-rule-requests/target-check. Needs
    mail:read, a member's own credential with their full access (not an API key, agent key or narrowed
    token), and the email rules feature.

    Args:
        idempotency_key (str | Unset):
        body (CreateEmailRuleRequestRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[CreateEmailRuleRequestResponse201 | ErrorResponse]
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
    body: CreateEmailRuleRequestRequest,
    idempotency_key: str | Unset = UNSET,

) -> CreateEmailRuleRequestResponse201 | ErrorResponse | None:
    """ Ask a member for a rule

     Asks another member of the organization for a rule over their own mail, from a compile response or a
    tree you wrote. Name them by user id, or by their member mailbox address, or by their verified work
    email if you can list members (at most 30 lookups by address an hour). Nothing is evaluated and
    nothing is shared until they accept, and they may change the rule first; they see the request and
    can preview what it matches in their own mail. You may have at most 5 pending requests to one member
    and 50 in all. If you can list members (members:read), the answer also says whether they can accept
    it under their role (target_can_accept), and if not, why (target_warning); the request is sent
    either way. To find out before asking, use POST /v1/email-rule-requests/target-check. Needs
    mail:read, a member's own credential with their full access (not an API key, agent key or narrowed
    token), and the email rules feature.

    Args:
        idempotency_key (str | Unset):
        body (CreateEmailRuleRequestRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        CreateEmailRuleRequestResponse201 | ErrorResponse
     """


    return sync_detailed(
        client=client,
body=body,
idempotency_key=idempotency_key,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: CreateEmailRuleRequestRequest,
    idempotency_key: str | Unset = UNSET,

) -> Response[CreateEmailRuleRequestResponse201 | ErrorResponse]:
    """ Ask a member for a rule

     Asks another member of the organization for a rule over their own mail, from a compile response or a
    tree you wrote. Name them by user id, or by their member mailbox address, or by their verified work
    email if you can list members (at most 30 lookups by address an hour). Nothing is evaluated and
    nothing is shared until they accept, and they may change the rule first; they see the request and
    can preview what it matches in their own mail. You may have at most 5 pending requests to one member
    and 50 in all. If you can list members (members:read), the answer also says whether they can accept
    it under their role (target_can_accept), and if not, why (target_warning); the request is sent
    either way. To find out before asking, use POST /v1/email-rule-requests/target-check. Needs
    mail:read, a member's own credential with their full access (not an API key, agent key or narrowed
    token), and the email rules feature.

    Args:
        idempotency_key (str | Unset):
        body (CreateEmailRuleRequestRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[CreateEmailRuleRequestResponse201 | ErrorResponse]
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
    body: CreateEmailRuleRequestRequest,
    idempotency_key: str | Unset = UNSET,

) -> CreateEmailRuleRequestResponse201 | ErrorResponse | None:
    """ Ask a member for a rule

     Asks another member of the organization for a rule over their own mail, from a compile response or a
    tree you wrote. Name them by user id, or by their member mailbox address, or by their verified work
    email if you can list members (at most 30 lookups by address an hour). Nothing is evaluated and
    nothing is shared until they accept, and they may change the rule first; they see the request and
    can preview what it matches in their own mail. You may have at most 5 pending requests to one member
    and 50 in all. If you can list members (members:read), the answer also says whether they can accept
    it under their role (target_can_accept), and if not, why (target_warning); the request is sent
    either way. To find out before asking, use POST /v1/email-rule-requests/target-check. Needs
    mail:read, a member's own credential with their full access (not an API key, agent key or narrowed
    token), and the email rules feature.

    Args:
        idempotency_key (str | Unset):
        body (CreateEmailRuleRequestRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        CreateEmailRuleRequestResponse201 | ErrorResponse
     """


    return (await asyncio_detailed(
        client=client,
body=body,
idempotency_key=idempotency_key,

    )).parsed
