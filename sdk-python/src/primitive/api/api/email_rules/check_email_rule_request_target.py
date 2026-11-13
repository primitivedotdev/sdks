from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.check_email_rule_request_target_request import CheckEmailRuleRequestTargetRequest
from ...models.check_email_rule_request_target_response_200 import CheckEmailRuleRequestTargetResponse200
from ...models.error_response import ErrorResponse
from ...types import UNSET, Unset
from typing import cast



def _get_kwargs(
    *,
    body: CheckEmailRuleRequestTargetRequest,
    idempotency_key: str | Unset = UNSET,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}
    if not isinstance(idempotency_key, Unset):
        headers["Idempotency-Key"] = idempotency_key



    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/email-rule-requests/target-check",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> CheckEmailRuleRequestTargetResponse200 | ErrorResponse | None:
    if response.status_code == 200:
        response_200 = CheckEmailRuleRequestTargetResponse200.from_dict(response.json())



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

    if response.status_code == 503:
        response_503 = ErrorResponse.from_dict(response.json())



        return response_503

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[CheckEmailRuleRequestTargetResponse200 | ErrorResponse]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: CheckEmailRuleRequestTargetRequest,
    idempotency_key: str | Unset = UNSET,

) -> Response[CheckEmailRuleRequestTargetResponse200 | ErrorResponse]:
    """ Check whether a member can accept a rule request

     Says, before you ask, whether a member could accept a rule request now under their role, and if not,
    which permission their role lacks. Nothing is sent and nothing is recorded. Needs members:read, as
    listing members and their roles does. At most 60 checks an hour. Name them by user id, or by their
    member mailbox address or verified work email (counted with asking: at most 30 lookups by address an
    hour). Needs mail:read, the email rules feature, and a member's own full-access credential (no API
    key, agent key or narrowed token).

    Args:
        idempotency_key (str | Unset):
        body (CheckEmailRuleRequestTargetRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[CheckEmailRuleRequestTargetResponse200 | ErrorResponse]
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
    body: CheckEmailRuleRequestTargetRequest,
    idempotency_key: str | Unset = UNSET,

) -> CheckEmailRuleRequestTargetResponse200 | ErrorResponse | None:
    """ Check whether a member can accept a rule request

     Says, before you ask, whether a member could accept a rule request now under their role, and if not,
    which permission their role lacks. Nothing is sent and nothing is recorded. Needs members:read, as
    listing members and their roles does. At most 60 checks an hour. Name them by user id, or by their
    member mailbox address or verified work email (counted with asking: at most 30 lookups by address an
    hour). Needs mail:read, the email rules feature, and a member's own full-access credential (no API
    key, agent key or narrowed token).

    Args:
        idempotency_key (str | Unset):
        body (CheckEmailRuleRequestTargetRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        CheckEmailRuleRequestTargetResponse200 | ErrorResponse
     """


    return sync_detailed(
        client=client,
body=body,
idempotency_key=idempotency_key,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: CheckEmailRuleRequestTargetRequest,
    idempotency_key: str | Unset = UNSET,

) -> Response[CheckEmailRuleRequestTargetResponse200 | ErrorResponse]:
    """ Check whether a member can accept a rule request

     Says, before you ask, whether a member could accept a rule request now under their role, and if not,
    which permission their role lacks. Nothing is sent and nothing is recorded. Needs members:read, as
    listing members and their roles does. At most 60 checks an hour. Name them by user id, or by their
    member mailbox address or verified work email (counted with asking: at most 30 lookups by address an
    hour). Needs mail:read, the email rules feature, and a member's own full-access credential (no API
    key, agent key or narrowed token).

    Args:
        idempotency_key (str | Unset):
        body (CheckEmailRuleRequestTargetRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[CheckEmailRuleRequestTargetResponse200 | ErrorResponse]
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
    body: CheckEmailRuleRequestTargetRequest,
    idempotency_key: str | Unset = UNSET,

) -> CheckEmailRuleRequestTargetResponse200 | ErrorResponse | None:
    """ Check whether a member can accept a rule request

     Says, before you ask, whether a member could accept a rule request now under their role, and if not,
    which permission their role lacks. Nothing is sent and nothing is recorded. Needs members:read, as
    listing members and their roles does. At most 60 checks an hour. Name them by user id, or by their
    member mailbox address or verified work email (counted with asking: at most 30 lookups by address an
    hour). Needs mail:read, the email rules feature, and a member's own full-access credential (no API
    key, agent key or narrowed token).

    Args:
        idempotency_key (str | Unset):
        body (CheckEmailRuleRequestTargetRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        CheckEmailRuleRequestTargetResponse200 | ErrorResponse
     """


    return (await asyncio_detailed(
        client=client,
body=body,
idempotency_key=idempotency_key,

    )).parsed
