from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.list_email_rule_share_emails_response_200 import ListEmailRuleShareEmailsResponse200
from ...types import UNSET, Unset
from typing import cast
from uuid import UUID



def _get_kwargs(
    id: UUID,
    *,
    limit: int | Unset = 25,
    cursor: str | Unset = UNSET,

) -> dict[str, Any]:
    

    

    params: dict[str, Any] = {}

    params["limit"] = limit

    params["cursor"] = cursor


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/email-rule-shares/{id}/emails".format(id=quote(str(id), safe=""),),
        "params": params,
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | ListEmailRuleShareEmailsResponse200 | None:
    if response.status_code == 200:
        response_200 = ListEmailRuleShareEmailsResponse200.from_dict(response.json())



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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | ListEmailRuleShareEmailsResponse200]:
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
    limit: int | Unset = 25,
    cursor: str | Unset = UNSET,

) -> Response[ErrorResponse | ListEmailRuleShareEmailsResponse200]:
    """ List the emails a rule share has given you

     The emails a rule shared with you has matched, newest first, as the email list shows them. Only the
    person it was shared with can list them, from the dashboard or the Primitive CLI. An ended share
    lists nothing. A page can be short or empty and still carry a cursor: keep reading until meta.cursor
    is null.

    Args:
        id (UUID):
        limit (int | Unset):  Default: 25.
        cursor (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ListEmailRuleShareEmailsResponse200]
     """


    kwargs = _get_kwargs(
        id=id,
limit=limit,
cursor=cursor,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    limit: int | Unset = 25,
    cursor: str | Unset = UNSET,

) -> ErrorResponse | ListEmailRuleShareEmailsResponse200 | None:
    """ List the emails a rule share has given you

     The emails a rule shared with you has matched, newest first, as the email list shows them. Only the
    person it was shared with can list them, from the dashboard or the Primitive CLI. An ended share
    lists nothing. A page can be short or empty and still carry a cursor: keep reading until meta.cursor
    is null.

    Args:
        id (UUID):
        limit (int | Unset):  Default: 25.
        cursor (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ListEmailRuleShareEmailsResponse200
     """


    return sync_detailed(
        id=id,
client=client,
limit=limit,
cursor=cursor,

    ).parsed

async def asyncio_detailed(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    limit: int | Unset = 25,
    cursor: str | Unset = UNSET,

) -> Response[ErrorResponse | ListEmailRuleShareEmailsResponse200]:
    """ List the emails a rule share has given you

     The emails a rule shared with you has matched, newest first, as the email list shows them. Only the
    person it was shared with can list them, from the dashboard or the Primitive CLI. An ended share
    lists nothing. A page can be short or empty and still carry a cursor: keep reading until meta.cursor
    is null.

    Args:
        id (UUID):
        limit (int | Unset):  Default: 25.
        cursor (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ListEmailRuleShareEmailsResponse200]
     """


    kwargs = _get_kwargs(
        id=id,
limit=limit,
cursor=cursor,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    limit: int | Unset = 25,
    cursor: str | Unset = UNSET,

) -> ErrorResponse | ListEmailRuleShareEmailsResponse200 | None:
    """ List the emails a rule share has given you

     The emails a rule shared with you has matched, newest first, as the email list shows them. Only the
    person it was shared with can list them, from the dashboard or the Primitive CLI. An ended share
    lists nothing. A page can be short or empty and still carry a cursor: keep reading until meta.cursor
    is null.

    Args:
        id (UUID):
        limit (int | Unset):  Default: 25.
        cursor (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ListEmailRuleShareEmailsResponse200
     """


    return (await asyncio_detailed(
        id=id,
client=client,
limit=limit,
cursor=cursor,

    )).parsed
