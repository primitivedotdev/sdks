from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.cancel_sent_email_response_200 import CancelSentEmailResponse200
from ...models.error_response import ErrorResponse
from typing import cast
from uuid import UUID



def _get_kwargs(
    id: UUID,

) -> dict[str, Any]:
    

    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/sent-emails/{id}/cancel".format(id=quote(str(id), safe=""),),
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> CancelSentEmailResponse200 | ErrorResponse | None:
    if response.status_code == 200:
        response_200 = CancelSentEmailResponse200.from_dict(response.json())



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

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[CancelSentEmailResponse200 | ErrorResponse]:
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

) -> Response[CancelSentEmailResponse200 | ErrorResponse]:
    """ Cancel a scheduled send

     Cancels a STILL-SCHEDULED send (status `scheduled`), moving it
    to the terminal `canceled` status. Nothing is dispatched and
    the row is kept for historical lookup with `canceled_at` set.

    Uses the same compare-and-swap guard as reschedule: once the
    scheduler has claimed the row for execution, or it was already
    canceled or executed, the call returns a 409 `not_scheduled`
    conflict naming the row's current status. Canceling can
    therefore never race an in-progress execution; a send that
    reports `canceled` was never handed to the delivery path.

    Returns the full updated sent-email record on success.

    Args:
        id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[CancelSentEmailResponse200 | ErrorResponse]
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

) -> CancelSentEmailResponse200 | ErrorResponse | None:
    """ Cancel a scheduled send

     Cancels a STILL-SCHEDULED send (status `scheduled`), moving it
    to the terminal `canceled` status. Nothing is dispatched and
    the row is kept for historical lookup with `canceled_at` set.

    Uses the same compare-and-swap guard as reschedule: once the
    scheduler has claimed the row for execution, or it was already
    canceled or executed, the call returns a 409 `not_scheduled`
    conflict naming the row's current status. Canceling can
    therefore never race an in-progress execution; a send that
    reports `canceled` was never handed to the delivery path.

    Returns the full updated sent-email record on success.

    Args:
        id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        CancelSentEmailResponse200 | ErrorResponse
     """


    return sync_detailed(
        id=id,
client=client,

    ).parsed

async def asyncio_detailed(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,

) -> Response[CancelSentEmailResponse200 | ErrorResponse]:
    """ Cancel a scheduled send

     Cancels a STILL-SCHEDULED send (status `scheduled`), moving it
    to the terminal `canceled` status. Nothing is dispatched and
    the row is kept for historical lookup with `canceled_at` set.

    Uses the same compare-and-swap guard as reschedule: once the
    scheduler has claimed the row for execution, or it was already
    canceled or executed, the call returns a 409 `not_scheduled`
    conflict naming the row's current status. Canceling can
    therefore never race an in-progress execution; a send that
    reports `canceled` was never handed to the delivery path.

    Returns the full updated sent-email record on success.

    Args:
        id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[CancelSentEmailResponse200 | ErrorResponse]
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

) -> CancelSentEmailResponse200 | ErrorResponse | None:
    """ Cancel a scheduled send

     Cancels a STILL-SCHEDULED send (status `scheduled`), moving it
    to the terminal `canceled` status. Nothing is dispatched and
    the row is kept for historical lookup with `canceled_at` set.

    Uses the same compare-and-swap guard as reschedule: once the
    scheduler has claimed the row for execution, or it was already
    canceled or executed, the call returns a 409 `not_scheduled`
    conflict naming the row's current status. Canceling can
    therefore never race an in-progress execution; a send that
    reports `canceled` was never handed to the delivery path.

    Returns the full updated sent-email record on success.

    Args:
        id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        CancelSentEmailResponse200 | ErrorResponse
     """


    return (await asyncio_detailed(
        id=id,
client=client,

    )).parsed
