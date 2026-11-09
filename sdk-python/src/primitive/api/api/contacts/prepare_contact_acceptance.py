from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.prepare_contact_acceptance_body import PrepareContactAcceptanceBody
from ...models.prepare_contact_acceptance_response_200 import PrepareContactAcceptanceResponse200
from ...types import UNSET, Unset
from typing import cast



def _get_kwargs(
    *,
    body: PrepareContactAcceptanceBody,
    idempotency_key: str | Unset = UNSET,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}
    if not isinstance(idempotency_key, Unset):
        headers["Idempotency-Key"] = idempotency_key



    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/contact-requests/accept/prepare",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | PrepareContactAcceptanceResponse200 | None:
    if response.status_code == 200:
        response_200 = PrepareContactAcceptanceResponse200.from_dict(response.json())



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

    if response.status_code == 409:
        response_409 = ErrorResponse.from_dict(response.json())



        return response_409

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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | PrepareContactAcceptanceResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: PrepareContactAcceptanceBody,
    idempotency_key: str | Unset = UNSET,

) -> Response[ErrorResponse | PrepareContactAcceptanceResponse200]:
    """ Prepare the acceptance of a received contact request

     Validates a received contact request (authenticated sender, valid unexpired primitive.contact/1
    request, delivered to you) and returns the POST /send-mail call that accepts it, threaded to the
    request and addressed to its authenticated sender (never to a Reply-To). Nothing is sent and no
    contact preference changes. Preparing twice returns the same message and Idempotency-Key.

    Args:
        idempotency_key (str | Unset):
        body (PrepareContactAcceptanceBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | PrepareContactAcceptanceResponse200]
     """


    kwargs = _get_kwargs(
        body=body,
idempotency_key=idempotency_key,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    *,
    client: AuthenticatedClient | Client,
    body: PrepareContactAcceptanceBody,
    idempotency_key: str | Unset = UNSET,

) -> ErrorResponse | PrepareContactAcceptanceResponse200 | None:
    """ Prepare the acceptance of a received contact request

     Validates a received contact request (authenticated sender, valid unexpired primitive.contact/1
    request, delivered to you) and returns the POST /send-mail call that accepts it, threaded to the
    request and addressed to its authenticated sender (never to a Reply-To). Nothing is sent and no
    contact preference changes. Preparing twice returns the same message and Idempotency-Key.

    Args:
        idempotency_key (str | Unset):
        body (PrepareContactAcceptanceBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | PrepareContactAcceptanceResponse200
     """


    return sync_detailed(
        client=client,
body=body,
idempotency_key=idempotency_key,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: PrepareContactAcceptanceBody,
    idempotency_key: str | Unset = UNSET,

) -> Response[ErrorResponse | PrepareContactAcceptanceResponse200]:
    """ Prepare the acceptance of a received contact request

     Validates a received contact request (authenticated sender, valid unexpired primitive.contact/1
    request, delivered to you) and returns the POST /send-mail call that accepts it, threaded to the
    request and addressed to its authenticated sender (never to a Reply-To). Nothing is sent and no
    contact preference changes. Preparing twice returns the same message and Idempotency-Key.

    Args:
        idempotency_key (str | Unset):
        body (PrepareContactAcceptanceBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | PrepareContactAcceptanceResponse200]
     """


    kwargs = _get_kwargs(
        body=body,
idempotency_key=idempotency_key,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    body: PrepareContactAcceptanceBody,
    idempotency_key: str | Unset = UNSET,

) -> ErrorResponse | PrepareContactAcceptanceResponse200 | None:
    """ Prepare the acceptance of a received contact request

     Validates a received contact request (authenticated sender, valid unexpired primitive.contact/1
    request, delivered to you) and returns the POST /send-mail call that accepts it, threaded to the
    request and addressed to its authenticated sender (never to a Reply-To). Nothing is sent and no
    contact preference changes. Preparing twice returns the same message and Idempotency-Key.

    Args:
        idempotency_key (str | Unset):
        body (PrepareContactAcceptanceBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | PrepareContactAcceptanceResponse200
     """


    return (await asyncio_detailed(
        client=client,
body=body,
idempotency_key=idempotency_key,

    )).parsed
