from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.accept_email_rule_objection_response_200 import AcceptEmailRuleObjectionResponse200
from ...models.error_response import ErrorResponse
from ...types import UNSET, Unset
from typing import cast
from uuid import UUID



def _get_kwargs(
    id: UUID,
    *,
    idempotency_key: str | Unset = UNSET,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}
    if not isinstance(idempotency_key, Unset):
        headers["Idempotency-Key"] = idempotency_key



    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/email-rule-objections/{id}/accept".format(id=quote(str(id), safe=""),),
    }


    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> AcceptEmailRuleObjectionResponse200 | ErrorResponse | None:
    if response.status_code == 200:
        response_200 = AcceptEmailRuleObjectionResponse200.from_dict(response.json())



        return response_200

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

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[AcceptEmailRuleObjectionResponse200 | ErrorResponse]:
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
    idempotency_key: str | Unset = UNSET,

) -> Response[AcceptEmailRuleObjectionResponse200 | ErrorResponse]:
    """ Accept an objection to your rule

     Accepts a pending objection to a rule you wrote: turns the rule off (state draft), as updating it
    would, and records the objection accepted, together. You can turn the rule on again later. Needs
    mail:read, the email rules feature, and a member's own full-access credential (no API key, agent key
    or narrowed token). Only on your own dashboard session or the Primitive CLI.

    Args:
        id (UUID):
        idempotency_key (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[AcceptEmailRuleObjectionResponse200 | ErrorResponse]
     """


    kwargs = _get_kwargs(
        id=id,
idempotency_key=idempotency_key,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    idempotency_key: str | Unset = UNSET,

) -> AcceptEmailRuleObjectionResponse200 | ErrorResponse | None:
    """ Accept an objection to your rule

     Accepts a pending objection to a rule you wrote: turns the rule off (state draft), as updating it
    would, and records the objection accepted, together. You can turn the rule on again later. Needs
    mail:read, the email rules feature, and a member's own full-access credential (no API key, agent key
    or narrowed token). Only on your own dashboard session or the Primitive CLI.

    Args:
        id (UUID):
        idempotency_key (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        AcceptEmailRuleObjectionResponse200 | ErrorResponse
     """


    return sync_detailed(
        id=id,
client=client,
idempotency_key=idempotency_key,

    ).parsed

async def asyncio_detailed(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    idempotency_key: str | Unset = UNSET,

) -> Response[AcceptEmailRuleObjectionResponse200 | ErrorResponse]:
    """ Accept an objection to your rule

     Accepts a pending objection to a rule you wrote: turns the rule off (state draft), as updating it
    would, and records the objection accepted, together. You can turn the rule on again later. Needs
    mail:read, the email rules feature, and a member's own full-access credential (no API key, agent key
    or narrowed token). Only on your own dashboard session or the Primitive CLI.

    Args:
        id (UUID):
        idempotency_key (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[AcceptEmailRuleObjectionResponse200 | ErrorResponse]
     """


    kwargs = _get_kwargs(
        id=id,
idempotency_key=idempotency_key,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    idempotency_key: str | Unset = UNSET,

) -> AcceptEmailRuleObjectionResponse200 | ErrorResponse | None:
    """ Accept an objection to your rule

     Accepts a pending objection to a rule you wrote: turns the rule off (state draft), as updating it
    would, and records the objection accepted, together. You can turn the rule on again later. Needs
    mail:read, the email rules feature, and a member's own full-access credential (no API key, agent key
    or narrowed token). Only on your own dashboard session or the Primitive CLI.

    Args:
        id (UUID):
        idempotency_key (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        AcceptEmailRuleObjectionResponse200 | ErrorResponse
     """


    return (await asyncio_detailed(
        id=id,
client=client,
idempotency_key=idempotency_key,

    )).parsed
