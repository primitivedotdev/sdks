from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.list_email_rule_objections_box import ListEmailRuleObjectionsBox
from ...models.list_email_rule_objections_response_200 import ListEmailRuleObjectionsResponse200
from ...models.list_email_rule_objections_status import ListEmailRuleObjectionsStatus
from ...types import UNSET, Unset
from typing import cast



def _get_kwargs(
    *,
    box: ListEmailRuleObjectionsBox | Unset = ListEmailRuleObjectionsBox.OUTGOING,
    status: ListEmailRuleObjectionsStatus | Unset = ListEmailRuleObjectionsStatus.PENDING,
    limit: int | Unset = 25,
    cursor: str | Unset = UNSET,

) -> dict[str, Any]:
    

    

    params: dict[str, Any] = {}

    json_box: str | Unset = UNSET
    if not isinstance(box, Unset):
        json_box = box.value

    params["box"] = json_box

    json_status: str | Unset = UNSET
    if not isinstance(status, Unset):
        json_status = status.value

    params["status"] = json_status

    params["limit"] = limit

    params["cursor"] = cursor


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/email-rule-objections",
        "params": params,
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | ListEmailRuleObjectionsResponse200 | None:
    if response.status_code == 200:
        response_200 = ListEmailRuleObjectionsResponse200.from_dict(response.json())



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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | ListEmailRuleObjectionsResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    box: ListEmailRuleObjectionsBox | Unset = ListEmailRuleObjectionsBox.OUTGOING,
    status: ListEmailRuleObjectionsStatus | Unset = ListEmailRuleObjectionsStatus.PENDING,
    limit: int | Unset = 25,
    cursor: str | Unset = UNSET,

) -> Response[ErrorResponse | ListEmailRuleObjectionsResponse200]:
    """ List objections

     Objections you made, objections to rules you wrote, or every objection you can see, newest first. An
    objection is seen by the member who made it, the rule's author and the organization's owners and
    admins. It stays pending until the rule's author accepts it, turning the rule off, or declines it,
    or the member who made it withdraws it, which clears its message. It never changes after that. Needs
    mail:read, the email rules feature, and a member's own full-access credential (no API key, agent key
    or narrowed token). Only on your own dashboard session or the Primitive CLI.

    Args:
        box (ListEmailRuleObjectionsBox | Unset): outgoing: objections you made; incoming:
            objections to rules you wrote; all: every objection you can see (owners and admins see the
            organization's). Default: ListEmailRuleObjectionsBox.OUTGOING.
        status (ListEmailRuleObjectionsStatus | Unset):  Default:
            ListEmailRuleObjectionsStatus.PENDING.
        limit (int | Unset):  Default: 25.
        cursor (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ListEmailRuleObjectionsResponse200]
     """


    kwargs = _get_kwargs(
        box=box,
status=status,
limit=limit,
cursor=cursor,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    *,
    client: AuthenticatedClient | Client,
    box: ListEmailRuleObjectionsBox | Unset = ListEmailRuleObjectionsBox.OUTGOING,
    status: ListEmailRuleObjectionsStatus | Unset = ListEmailRuleObjectionsStatus.PENDING,
    limit: int | Unset = 25,
    cursor: str | Unset = UNSET,

) -> ErrorResponse | ListEmailRuleObjectionsResponse200 | None:
    """ List objections

     Objections you made, objections to rules you wrote, or every objection you can see, newest first. An
    objection is seen by the member who made it, the rule's author and the organization's owners and
    admins. It stays pending until the rule's author accepts it, turning the rule off, or declines it,
    or the member who made it withdraws it, which clears its message. It never changes after that. Needs
    mail:read, the email rules feature, and a member's own full-access credential (no API key, agent key
    or narrowed token). Only on your own dashboard session or the Primitive CLI.

    Args:
        box (ListEmailRuleObjectionsBox | Unset): outgoing: objections you made; incoming:
            objections to rules you wrote; all: every objection you can see (owners and admins see the
            organization's). Default: ListEmailRuleObjectionsBox.OUTGOING.
        status (ListEmailRuleObjectionsStatus | Unset):  Default:
            ListEmailRuleObjectionsStatus.PENDING.
        limit (int | Unset):  Default: 25.
        cursor (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ListEmailRuleObjectionsResponse200
     """


    return sync_detailed(
        client=client,
box=box,
status=status,
limit=limit,
cursor=cursor,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    box: ListEmailRuleObjectionsBox | Unset = ListEmailRuleObjectionsBox.OUTGOING,
    status: ListEmailRuleObjectionsStatus | Unset = ListEmailRuleObjectionsStatus.PENDING,
    limit: int | Unset = 25,
    cursor: str | Unset = UNSET,

) -> Response[ErrorResponse | ListEmailRuleObjectionsResponse200]:
    """ List objections

     Objections you made, objections to rules you wrote, or every objection you can see, newest first. An
    objection is seen by the member who made it, the rule's author and the organization's owners and
    admins. It stays pending until the rule's author accepts it, turning the rule off, or declines it,
    or the member who made it withdraws it, which clears its message. It never changes after that. Needs
    mail:read, the email rules feature, and a member's own full-access credential (no API key, agent key
    or narrowed token). Only on your own dashboard session or the Primitive CLI.

    Args:
        box (ListEmailRuleObjectionsBox | Unset): outgoing: objections you made; incoming:
            objections to rules you wrote; all: every objection you can see (owners and admins see the
            organization's). Default: ListEmailRuleObjectionsBox.OUTGOING.
        status (ListEmailRuleObjectionsStatus | Unset):  Default:
            ListEmailRuleObjectionsStatus.PENDING.
        limit (int | Unset):  Default: 25.
        cursor (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ListEmailRuleObjectionsResponse200]
     """


    kwargs = _get_kwargs(
        box=box,
status=status,
limit=limit,
cursor=cursor,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    box: ListEmailRuleObjectionsBox | Unset = ListEmailRuleObjectionsBox.OUTGOING,
    status: ListEmailRuleObjectionsStatus | Unset = ListEmailRuleObjectionsStatus.PENDING,
    limit: int | Unset = 25,
    cursor: str | Unset = UNSET,

) -> ErrorResponse | ListEmailRuleObjectionsResponse200 | None:
    """ List objections

     Objections you made, objections to rules you wrote, or every objection you can see, newest first. An
    objection is seen by the member who made it, the rule's author and the organization's owners and
    admins. It stays pending until the rule's author accepts it, turning the rule off, or declines it,
    or the member who made it withdraws it, which clears its message. It never changes after that. Needs
    mail:read, the email rules feature, and a member's own full-access credential (no API key, agent key
    or narrowed token). Only on your own dashboard session or the Primitive CLI.

    Args:
        box (ListEmailRuleObjectionsBox | Unset): outgoing: objections you made; incoming:
            objections to rules you wrote; all: every objection you can see (owners and admins see the
            organization's). Default: ListEmailRuleObjectionsBox.OUTGOING.
        status (ListEmailRuleObjectionsStatus | Unset):  Default:
            ListEmailRuleObjectionsStatus.PENDING.
        limit (int | Unset):  Default: 25.
        cursor (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ListEmailRuleObjectionsResponse200
     """


    return (await asyncio_detailed(
        client=client,
box=box,
status=status,
limit=limit,
cursor=cursor,

    )).parsed
