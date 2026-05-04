from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.get_sent_email_response_200 import GetSentEmailResponse200
from typing import cast
from uuid import UUID



def _get_kwargs(
    id: UUID,

) -> dict[str, Any]:
    

    

    

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/sent-emails/{id}".format(id=quote(str(id), safe=""),),
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | GetSentEmailResponse200 | None:
    if response.status_code == 200:
        response_200 = GetSentEmailResponse200.from_dict(response.json())



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

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | GetSentEmailResponse200]:
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

) -> Response[ErrorResponse | GetSentEmailResponse200]:
    """ Get a sent email by id

     Returns the full sent-email record by id, including
    `body_text` and `body_html` (omitted from the listing
    endpoint to keep paginated responses small). Use this when
    diagnosing a specific send, e.g. inspecting the receiver's
    SMTP response on a `bounced` row or pulling the gate
    denial detail on a `gate_denied` row.

    Args:
        id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | GetSentEmailResponse200]
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

) -> ErrorResponse | GetSentEmailResponse200 | None:
    """ Get a sent email by id

     Returns the full sent-email record by id, including
    `body_text` and `body_html` (omitted from the listing
    endpoint to keep paginated responses small). Use this when
    diagnosing a specific send, e.g. inspecting the receiver's
    SMTP response on a `bounced` row or pulling the gate
    denial detail on a `gate_denied` row.

    Args:
        id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | GetSentEmailResponse200
     """


    return sync_detailed(
        id=id,
client=client,

    ).parsed

async def asyncio_detailed(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,

) -> Response[ErrorResponse | GetSentEmailResponse200]:
    """ Get a sent email by id

     Returns the full sent-email record by id, including
    `body_text` and `body_html` (omitted from the listing
    endpoint to keep paginated responses small). Use this when
    diagnosing a specific send, e.g. inspecting the receiver's
    SMTP response on a `bounced` row or pulling the gate
    denial detail on a `gate_denied` row.

    Args:
        id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | GetSentEmailResponse200]
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

) -> ErrorResponse | GetSentEmailResponse200 | None:
    """ Get a sent email by id

     Returns the full sent-email record by id, including
    `body_text` and `body_html` (omitted from the listing
    endpoint to keep paginated responses small). Use this when
    diagnosing a specific send, e.g. inspecting the receiver's
    SMTP response on a `bounced` row or pulling the gate
    denial detail on a `gate_denied` row.

    Args:
        id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | GetSentEmailResponse200
     """


    return (await asyncio_detailed(
        id=id,
client=client,

    )).parsed
