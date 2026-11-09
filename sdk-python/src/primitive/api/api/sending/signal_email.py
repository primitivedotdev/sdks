from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.email_signal_input import EmailSignalInput
from ...models.error_response import ErrorResponse
from ...models.signal_email_response_200 import SignalEmailResponse200
from ...types import UNSET, Unset
from typing import cast
from uuid import UUID



def _get_kwargs(
    id: UUID,
    *,
    body: EmailSignalInput,
    idempotency_key: str | Unset = UNSET,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}
    if not isinstance(idempotency_key, Unset):
        headers["Idempotency-Key"] = idempotency_key



    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/emails/{id}/signal".format(id=quote(str(id), safe=""),),
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | SignalEmailResponse200 | None:
    if response.status_code == 200:
        response_200 = SignalEmailResponse200.from_dict(response.json())



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

    if response.status_code == 422:
        response_422 = ErrorResponse.from_dict(response.json())



        return response_422

    if response.status_code == 429:
        response_429 = ErrorResponse.from_dict(response.json())



        return response_429

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | SignalEmailResponse200]:
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
    body: EmailSignalInput,
    idempotency_key: str | Unset = UNSET,

) -> Response[ErrorResponse | SignalEmailResponse200]:
    """ Send a read, working or typing signal about an email

     Builds and sends the standard signal email about this received email: one `interaction.json` part
    (read/1, working/1 or typing/1 naming the email's Message-ID) plus only the fixed fallback text,
    threaded to it. It goes only to the email's authenticated sender, never to Reply-To or other
    recipients. Receivers see it as `fyi: true`, and the sender sees it as `peer_signal_on_my_last`
    (typing is not reported there). Refused (422) for a signal, interaction or other structured email,
    for an unauthenticated sender, and while the email is still being processed. Each call is a new
    signal with fresh ids; a read retried with the same Idempotency-Key rebuilds the identical message
    and dedupes.

    Args:
        id (UUID):
        idempotency_key (str | Unset):
        body (EmailSignalInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | SignalEmailResponse200]
     """


    kwargs = _get_kwargs(
        id=id,
body=body,
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
    body: EmailSignalInput,
    idempotency_key: str | Unset = UNSET,

) -> ErrorResponse | SignalEmailResponse200 | None:
    """ Send a read, working or typing signal about an email

     Builds and sends the standard signal email about this received email: one `interaction.json` part
    (read/1, working/1 or typing/1 naming the email's Message-ID) plus only the fixed fallback text,
    threaded to it. It goes only to the email's authenticated sender, never to Reply-To or other
    recipients. Receivers see it as `fyi: true`, and the sender sees it as `peer_signal_on_my_last`
    (typing is not reported there). Refused (422) for a signal, interaction or other structured email,
    for an unauthenticated sender, and while the email is still being processed. Each call is a new
    signal with fresh ids; a read retried with the same Idempotency-Key rebuilds the identical message
    and dedupes.

    Args:
        id (UUID):
        idempotency_key (str | Unset):
        body (EmailSignalInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | SignalEmailResponse200
     """


    return sync_detailed(
        id=id,
client=client,
body=body,
idempotency_key=idempotency_key,

    ).parsed

async def asyncio_detailed(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: EmailSignalInput,
    idempotency_key: str | Unset = UNSET,

) -> Response[ErrorResponse | SignalEmailResponse200]:
    """ Send a read, working or typing signal about an email

     Builds and sends the standard signal email about this received email: one `interaction.json` part
    (read/1, working/1 or typing/1 naming the email's Message-ID) plus only the fixed fallback text,
    threaded to it. It goes only to the email's authenticated sender, never to Reply-To or other
    recipients. Receivers see it as `fyi: true`, and the sender sees it as `peer_signal_on_my_last`
    (typing is not reported there). Refused (422) for a signal, interaction or other structured email,
    for an unauthenticated sender, and while the email is still being processed. Each call is a new
    signal with fresh ids; a read retried with the same Idempotency-Key rebuilds the identical message
    and dedupes.

    Args:
        id (UUID):
        idempotency_key (str | Unset):
        body (EmailSignalInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | SignalEmailResponse200]
     """


    kwargs = _get_kwargs(
        id=id,
body=body,
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
    body: EmailSignalInput,
    idempotency_key: str | Unset = UNSET,

) -> ErrorResponse | SignalEmailResponse200 | None:
    """ Send a read, working or typing signal about an email

     Builds and sends the standard signal email about this received email: one `interaction.json` part
    (read/1, working/1 or typing/1 naming the email's Message-ID) plus only the fixed fallback text,
    threaded to it. It goes only to the email's authenticated sender, never to Reply-To or other
    recipients. Receivers see it as `fyi: true`, and the sender sees it as `peer_signal_on_my_last`
    (typing is not reported there). Refused (422) for a signal, interaction or other structured email,
    for an unauthenticated sender, and while the email is still being processed. Each call is a new
    signal with fresh ids; a read retried with the same Idempotency-Key rebuilds the identical message
    and dedupes.

    Args:
        id (UUID):
        idempotency_key (str | Unset):
        body (EmailSignalInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | SignalEmailResponse200
     """


    return (await asyncio_detailed(
        id=id,
client=client,
body=body,
idempotency_key=idempotency_key,

    )).parsed
