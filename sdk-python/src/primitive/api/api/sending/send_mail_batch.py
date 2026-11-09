from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.send_mail_batch_body import SendMailBatchBody
from ...models.send_mail_batch_response_200 import SendMailBatchResponse200
from ...types import UNSET, Unset
from typing import cast



def _get_kwargs(
    *,
    body: SendMailBatchBody,
    idempotency_key: str | Unset = UNSET,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}
    if not isinstance(idempotency_key, Unset):
        headers["Idempotency-Key"] = idempotency_key



    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/send-mail/batch",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | SendMailBatchResponse200 | None:
    if response.status_code == 200:
        response_200 = SendMailBatchResponse200.from_dict(response.json())



        return response_200

    if response.status_code == 400:
        response_400 = ErrorResponse.from_dict(response.json())



        return response_400

    if response.status_code == 401:
        response_401 = ErrorResponse.from_dict(response.json())



        return response_401

    if response.status_code == 429:
        response_429 = ErrorResponse.from_dict(response.json())



        return response_429

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | SendMailBatchResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: SendMailBatchBody,
    idempotency_key: str | Unset = UNSET,

) -> Response[ErrorResponse | SendMailBatchResponse200]:
    """ Send a batch of emails in one request

     Send up to 100 independent messages in a single call. Each message uses the same body schema and the
    same send path as `POST /send-mail`, so auth, validation, rate limiting, and idempotency apply per
    message. Messages are processed independently: one failing does not fail the others. Every message
    gets an entry in `results` carrying either `data` (on success) or `error` (on failure), with the
    original `index`.

    Args:
        idempotency_key (str | Unset):
        body (SendMailBatchBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | SendMailBatchResponse200]
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
    body: SendMailBatchBody,
    idempotency_key: str | Unset = UNSET,

) -> ErrorResponse | SendMailBatchResponse200 | None:
    """ Send a batch of emails in one request

     Send up to 100 independent messages in a single call. Each message uses the same body schema and the
    same send path as `POST /send-mail`, so auth, validation, rate limiting, and idempotency apply per
    message. Messages are processed independently: one failing does not fail the others. Every message
    gets an entry in `results` carrying either `data` (on success) or `error` (on failure), with the
    original `index`.

    Args:
        idempotency_key (str | Unset):
        body (SendMailBatchBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | SendMailBatchResponse200
     """


    return sync_detailed(
        client=client,
body=body,
idempotency_key=idempotency_key,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: SendMailBatchBody,
    idempotency_key: str | Unset = UNSET,

) -> Response[ErrorResponse | SendMailBatchResponse200]:
    """ Send a batch of emails in one request

     Send up to 100 independent messages in a single call. Each message uses the same body schema and the
    same send path as `POST /send-mail`, so auth, validation, rate limiting, and idempotency apply per
    message. Messages are processed independently: one failing does not fail the others. Every message
    gets an entry in `results` carrying either `data` (on success) or `error` (on failure), with the
    original `index`.

    Args:
        idempotency_key (str | Unset):
        body (SendMailBatchBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | SendMailBatchResponse200]
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
    body: SendMailBatchBody,
    idempotency_key: str | Unset = UNSET,

) -> ErrorResponse | SendMailBatchResponse200 | None:
    """ Send a batch of emails in one request

     Send up to 100 independent messages in a single call. Each message uses the same body schema and the
    same send path as `POST /send-mail`, so auth, validation, rate limiting, and idempotency apply per
    message. Messages are processed independently: one failing does not fail the others. Every message
    gets an entry in `results` carrying either `data` (on success) or `error` (on failure), with the
    original `index`.

    Args:
        idempotency_key (str | Unset):
        body (SendMailBatchBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | SendMailBatchResponse200
     """


    return (await asyncio_detailed(
        client=client,
body=body,
idempotency_key=idempotency_key,

    )).parsed
