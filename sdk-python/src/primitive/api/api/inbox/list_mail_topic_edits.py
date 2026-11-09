from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.list_mail_topic_edits_response_200 import ListMailTopicEditsResponse200
from ...types import UNSET, Unset
from typing import cast



def _get_kwargs(
    *,
    mailbox: str,
    cursor: str | Unset = UNSET,
    limit: int | Unset = 100,

) -> dict[str, Any]:
    

    

    params: dict[str, Any] = {}

    params["mailbox"] = mailbox

    params["cursor"] = cursor

    params["limit"] = limit


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/mail-topic-edits",
        "params": params,
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | ListMailTopicEditsResponse200 | None:
    if response.status_code == 200:
        response_200 = ListMailTopicEditsResponse200.from_dict(response.json())



        return response_200

    if response.status_code == 400:
        response_400 = ErrorResponse.from_dict(response.json())



        return response_400

    if response.status_code == 401:
        response_401 = ErrorResponse.from_dict(response.json())



        return response_401

    if response.status_code == 404:
        response_404 = ErrorResponse.from_dict(response.json())



        return response_404

    if response.status_code == 413:
        response_413 = ErrorResponse.from_dict(response.json())



        return response_413

    if response.status_code == 429:
        response_429 = ErrorResponse.from_dict(response.json())



        return response_429

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | ListMailTopicEditsResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    mailbox: str,
    cursor: str | Unset = UNSET,
    limit: int | Unset = 100,

) -> Response[ErrorResponse | ListMailTopicEditsResponse200]:
    """ List human topic corrections

     Mailbox-owned human membership, summary and task edits. Each field has an independent version.
    Sources must belong to this mailbox and exact visible audience. Automatic generation cannot write
    these records. Identical latest mutations are retryable; stale versions return
    mail_topic_edit_conflict. Source mail remains unchanged. Responses are never cached.

    Args:
        mailbox (str):
        cursor (str | Unset):
        limit (int | Unset):  Default: 100.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ListMailTopicEditsResponse200]
     """


    kwargs = _get_kwargs(
        mailbox=mailbox,
cursor=cursor,
limit=limit,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    *,
    client: AuthenticatedClient | Client,
    mailbox: str,
    cursor: str | Unset = UNSET,
    limit: int | Unset = 100,

) -> ErrorResponse | ListMailTopicEditsResponse200 | None:
    """ List human topic corrections

     Mailbox-owned human membership, summary and task edits. Each field has an independent version.
    Sources must belong to this mailbox and exact visible audience. Automatic generation cannot write
    these records. Identical latest mutations are retryable; stale versions return
    mail_topic_edit_conflict. Source mail remains unchanged. Responses are never cached.

    Args:
        mailbox (str):
        cursor (str | Unset):
        limit (int | Unset):  Default: 100.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ListMailTopicEditsResponse200
     """


    return sync_detailed(
        client=client,
mailbox=mailbox,
cursor=cursor,
limit=limit,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    mailbox: str,
    cursor: str | Unset = UNSET,
    limit: int | Unset = 100,

) -> Response[ErrorResponse | ListMailTopicEditsResponse200]:
    """ List human topic corrections

     Mailbox-owned human membership, summary and task edits. Each field has an independent version.
    Sources must belong to this mailbox and exact visible audience. Automatic generation cannot write
    these records. Identical latest mutations are retryable; stale versions return
    mail_topic_edit_conflict. Source mail remains unchanged. Responses are never cached.

    Args:
        mailbox (str):
        cursor (str | Unset):
        limit (int | Unset):  Default: 100.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ListMailTopicEditsResponse200]
     """


    kwargs = _get_kwargs(
        mailbox=mailbox,
cursor=cursor,
limit=limit,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    mailbox: str,
    cursor: str | Unset = UNSET,
    limit: int | Unset = 100,

) -> ErrorResponse | ListMailTopicEditsResponse200 | None:
    """ List human topic corrections

     Mailbox-owned human membership, summary and task edits. Each field has an independent version.
    Sources must belong to this mailbox and exact visible audience. Automatic generation cannot write
    these records. Identical latest mutations are retryable; stale versions return
    mail_topic_edit_conflict. Source mail remains unchanged. Responses are never cached.

    Args:
        mailbox (str):
        cursor (str | Unset):
        limit (int | Unset):  Default: 100.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ListMailTopicEditsResponse200
     """


    return (await asyncio_detailed(
        client=client,
mailbox=mailbox,
cursor=cursor,
limit=limit,

    )).parsed
