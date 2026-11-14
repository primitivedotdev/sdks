from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.get_email_rule_objection_response_200 import GetEmailRuleObjectionResponse200
from typing import cast
from uuid import UUID



def _get_kwargs(
    id: UUID,

) -> dict[str, Any]:
    

    

    

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/email-rule-objections/{id}".format(id=quote(str(id), safe=""),),
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | GetEmailRuleObjectionResponse200 | None:
    if response.status_code == 200:
        response_200 = GetEmailRuleObjectionResponse200.from_dict(response.json())



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

    if response.status_code == 429:
        response_429 = ErrorResponse.from_dict(response.json())



        return response_429

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | GetEmailRuleObjectionResponse200]:
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

) -> Response[ErrorResponse | GetEmailRuleObjectionResponse200]:
    """ Get an objection

     One objection you can see. An objection is seen by the member who made it, the rule's author and the
    organization's owners and admins. It stays pending until the rule's author accepts it, turning the
    rule off, declines it (optionally with a reason the objector sees), or answers it amended once they
    have saved a newer version of the rule, or the member who made it withdraws it, which clears its
    message (not from an email to the author already sent or being sent). It never changes after that.
    Needs mail:read, the email rules feature, and a member's own full-access credential (no API key,
    agent key or narrowed token). Only on your own dashboard session or the Primitive CLI.

    Args:
        id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | GetEmailRuleObjectionResponse200]
     """


    kwargs = _get_kwargs(
        id=id,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,

) -> ErrorResponse | GetEmailRuleObjectionResponse200 | None:
    """ Get an objection

     One objection you can see. An objection is seen by the member who made it, the rule's author and the
    organization's owners and admins. It stays pending until the rule's author accepts it, turning the
    rule off, declines it (optionally with a reason the objector sees), or answers it amended once they
    have saved a newer version of the rule, or the member who made it withdraws it, which clears its
    message (not from an email to the author already sent or being sent). It never changes after that.
    Needs mail:read, the email rules feature, and a member's own full-access credential (no API key,
    agent key or narrowed token). Only on your own dashboard session or the Primitive CLI.

    Args:
        id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | GetEmailRuleObjectionResponse200
     """


    return sync_detailed(
        id=id,
client=client,

    ).parsed

async def asyncio_detailed(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,

) -> Response[ErrorResponse | GetEmailRuleObjectionResponse200]:
    """ Get an objection

     One objection you can see. An objection is seen by the member who made it, the rule's author and the
    organization's owners and admins. It stays pending until the rule's author accepts it, turning the
    rule off, declines it (optionally with a reason the objector sees), or answers it amended once they
    have saved a newer version of the rule, or the member who made it withdraws it, which clears its
    message (not from an email to the author already sent or being sent). It never changes after that.
    Needs mail:read, the email rules feature, and a member's own full-access credential (no API key,
    agent key or narrowed token). Only on your own dashboard session or the Primitive CLI.

    Args:
        id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | GetEmailRuleObjectionResponse200]
     """


    kwargs = _get_kwargs(
        id=id,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,

) -> ErrorResponse | GetEmailRuleObjectionResponse200 | None:
    """ Get an objection

     One objection you can see. An objection is seen by the member who made it, the rule's author and the
    organization's owners and admins. It stays pending until the rule's author accepts it, turning the
    rule off, declines it (optionally with a reason the objector sees), or answers it amended once they
    have saved a newer version of the rule, or the member who made it withdraws it, which clears its
    message (not from an email to the author already sent or being sent). It never changes after that.
    Needs mail:read, the email rules feature, and a member's own full-access credential (no API key,
    agent key or narrowed token). Only on your own dashboard session or the Primitive CLI.

    Args:
        id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | GetEmailRuleObjectionResponse200
     """


    return (await asyncio_detailed(
        id=id,
client=client,

    )).parsed
