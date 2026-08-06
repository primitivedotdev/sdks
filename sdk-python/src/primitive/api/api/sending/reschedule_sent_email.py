from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.reschedule_sent_email_response_200 import RescheduleSentEmailResponse200
from ...models.sent_email_reschedule_input import SentEmailRescheduleInput
from typing import cast
from uuid import UUID



def _get_kwargs(
    id: UUID,
    *,
    body: SentEmailRescheduleInput,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "patch",
        "url": "/sent-emails/{id}".format(id=quote(str(id), safe=""),),
    }

    _kwargs["json"] = body.to_dict()


    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | RescheduleSentEmailResponse200 | None:
    if response.status_code == 200:
        response_200 = RescheduleSentEmailResponse200.from_dict(response.json())



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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | RescheduleSentEmailResponse200]:
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
    body: SentEmailRescheduleInput,

) -> Response[ErrorResponse | RescheduleSentEmailResponse200]:
    """ Reschedule a scheduled send

     Moves a STILL-SCHEDULED send (status `scheduled`) to a new
    execution time. The new `scheduled_at` must be in the future
    and at most 30 days out, the same bounds as the create-time
    field on /send-mail.

    The update is a compare-and-swap on `status = 'scheduled'`:
    once the scheduler has claimed the row for execution, or it
    was already canceled or executed, the update loses and the
    call returns a 409 `not_scheduled` conflict naming the row's
    current status. A due send can therefore never be moved out
    from under an in-progress execution.

    Returns the full updated sent-email record on success.

    Args:
        id (UUID):
        body (SentEmailRescheduleInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | RescheduleSentEmailResponse200]
     """


    kwargs = _get_kwargs(
        id=id,
body=body,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: SentEmailRescheduleInput,

) -> ErrorResponse | RescheduleSentEmailResponse200 | None:
    """ Reschedule a scheduled send

     Moves a STILL-SCHEDULED send (status `scheduled`) to a new
    execution time. The new `scheduled_at` must be in the future
    and at most 30 days out, the same bounds as the create-time
    field on /send-mail.

    The update is a compare-and-swap on `status = 'scheduled'`:
    once the scheduler has claimed the row for execution, or it
    was already canceled or executed, the update loses and the
    call returns a 409 `not_scheduled` conflict naming the row's
    current status. A due send can therefore never be moved out
    from under an in-progress execution.

    Returns the full updated sent-email record on success.

    Args:
        id (UUID):
        body (SentEmailRescheduleInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | RescheduleSentEmailResponse200
     """


    return sync_detailed(
        id=id,
client=client,
body=body,

    ).parsed

async def asyncio_detailed(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: SentEmailRescheduleInput,

) -> Response[ErrorResponse | RescheduleSentEmailResponse200]:
    """ Reschedule a scheduled send

     Moves a STILL-SCHEDULED send (status `scheduled`) to a new
    execution time. The new `scheduled_at` must be in the future
    and at most 30 days out, the same bounds as the create-time
    field on /send-mail.

    The update is a compare-and-swap on `status = 'scheduled'`:
    once the scheduler has claimed the row for execution, or it
    was already canceled or executed, the update loses and the
    call returns a 409 `not_scheduled` conflict naming the row's
    current status. A due send can therefore never be moved out
    from under an in-progress execution.

    Returns the full updated sent-email record on success.

    Args:
        id (UUID):
        body (SentEmailRescheduleInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | RescheduleSentEmailResponse200]
     """


    kwargs = _get_kwargs(
        id=id,
body=body,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: SentEmailRescheduleInput,

) -> ErrorResponse | RescheduleSentEmailResponse200 | None:
    """ Reschedule a scheduled send

     Moves a STILL-SCHEDULED send (status `scheduled`) to a new
    execution time. The new `scheduled_at` must be in the future
    and at most 30 days out, the same bounds as the create-time
    field on /send-mail.

    The update is a compare-and-swap on `status = 'scheduled'`:
    once the scheduler has claimed the row for execution, or it
    was already canceled or executed, the update loses and the
    call returns a 409 `not_scheduled` conflict naming the row's
    current status. A due send can therefore never be moved out
    from under an in-progress execution.

    Returns the full updated sent-email record on success.

    Args:
        id (UUID):
        body (SentEmailRescheduleInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | RescheduleSentEmailResponse200
     """


    return (await asyncio_detailed(
        id=id,
client=client,
body=body,

    )).parsed
