from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.put_mail_topic_edits_request import PutMailTopicEditsRequest
from ...models.update_mail_topic_edits_response_200 import UpdateMailTopicEditsResponse200
from typing import cast



def _get_kwargs(
    *,
    body: PutMailTopicEditsRequest,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "put",
        "url": "/mail-topic-edits",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | UpdateMailTopicEditsResponse200 | None:
    if response.status_code == 200:
        response_200 = UpdateMailTopicEditsResponse200.from_dict(response.json())



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

    if response.status_code == 409:
        response_409 = ErrorResponse.from_dict(response.json())



        return response_409

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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | UpdateMailTopicEditsResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: PutMailTopicEditsRequest,

) -> Response[ErrorResponse | UpdateMailTopicEditsResponse200]:
    """ Save a human topic correction

     Mailbox-owned human membership, summary and task edits. Each field has an independent version.
    Sources must belong to this mailbox and exact visible audience. Automatic generation cannot write
    these records. Identical latest mutations are retryable; stale versions return
    mail_topic_edit_conflict. Source mail remains unchanged. Responses are never cached.

    Args:
        body (PutMailTopicEditsRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | UpdateMailTopicEditsResponse200]
     """


    kwargs = _get_kwargs(
        body=body,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    *,
    client: AuthenticatedClient | Client,
    body: PutMailTopicEditsRequest,

) -> ErrorResponse | UpdateMailTopicEditsResponse200 | None:
    """ Save a human topic correction

     Mailbox-owned human membership, summary and task edits. Each field has an independent version.
    Sources must belong to this mailbox and exact visible audience. Automatic generation cannot write
    these records. Identical latest mutations are retryable; stale versions return
    mail_topic_edit_conflict. Source mail remains unchanged. Responses are never cached.

    Args:
        body (PutMailTopicEditsRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | UpdateMailTopicEditsResponse200
     """


    return sync_detailed(
        client=client,
body=body,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: PutMailTopicEditsRequest,

) -> Response[ErrorResponse | UpdateMailTopicEditsResponse200]:
    """ Save a human topic correction

     Mailbox-owned human membership, summary and task edits. Each field has an independent version.
    Sources must belong to this mailbox and exact visible audience. Automatic generation cannot write
    these records. Identical latest mutations are retryable; stale versions return
    mail_topic_edit_conflict. Source mail remains unchanged. Responses are never cached.

    Args:
        body (PutMailTopicEditsRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | UpdateMailTopicEditsResponse200]
     """


    kwargs = _get_kwargs(
        body=body,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    body: PutMailTopicEditsRequest,

) -> ErrorResponse | UpdateMailTopicEditsResponse200 | None:
    """ Save a human topic correction

     Mailbox-owned human membership, summary and task edits. Each field has an independent version.
    Sources must belong to this mailbox and exact visible audience. Automatic generation cannot write
    these records. Identical latest mutations are retryable; stale versions return
    mail_topic_edit_conflict. Source mail remains unchanged. Responses are never cached.

    Args:
        body (PutMailTopicEditsRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | UpdateMailTopicEditsResponse200
     """


    return (await asyncio_detailed(
        client=client,
body=body,

    )).parsed
