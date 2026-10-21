from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.cancel_sent_email_by_idempotency_key_body import CancelSentEmailByIdempotencyKeyBody
from ...models.cancel_sent_email_by_idempotency_key_response_200 import CancelSentEmailByIdempotencyKeyResponse200
from ...models.error_response import ErrorResponse
from typing import cast



def _get_kwargs(
    *,
    body: CancelSentEmailByIdempotencyKeyBody,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/sent-emails/cancel",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> CancelSentEmailByIdempotencyKeyResponse200 | ErrorResponse | None:
    if response.status_code == 200:
        response_200 = CancelSentEmailByIdempotencyKeyResponse200.from_dict(response.json())



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

    if response.status_code == 429:
        response_429 = ErrorResponse.from_dict(response.json())



        return response_429

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[CancelSentEmailByIdempotencyKeyResponse200 | ErrorResponse]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient,
    body: CancelSentEmailByIdempotencyKeyBody,

) -> Response[CancelSentEmailByIdempotencyKeyResponse200 | ErrorResponse]:
    """ Cancel a scheduled send by idempotency key

     Cancels the still-scheduled send created with this `Idempotency-Key` (matched exactly), as `POST
    /sent-emails/{id}/cancel` does, and releases the key. 404 `not_found`: no send this credential can
    act on was created with the key. 409 `not_scheduled`: the send holding the key is no longer
    scheduled; `error.details` names its `sent_email_id` and `status` (`canceled` if already canceled).
    Pass `created_before` on a retry so it cannot reach a newer send that reused the released key. A
    connected agent can cancel any scheduled send from its own address, whoever created it, and no
    other.

    Args:
        body (CancelSentEmailByIdempotencyKeyBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[CancelSentEmailByIdempotencyKeyResponse200 | ErrorResponse]
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
    client: AuthenticatedClient,
    body: CancelSentEmailByIdempotencyKeyBody,

) -> CancelSentEmailByIdempotencyKeyResponse200 | ErrorResponse | None:
    """ Cancel a scheduled send by idempotency key

     Cancels the still-scheduled send created with this `Idempotency-Key` (matched exactly), as `POST
    /sent-emails/{id}/cancel` does, and releases the key. 404 `not_found`: no send this credential can
    act on was created with the key. 409 `not_scheduled`: the send holding the key is no longer
    scheduled; `error.details` names its `sent_email_id` and `status` (`canceled` if already canceled).
    Pass `created_before` on a retry so it cannot reach a newer send that reused the released key. A
    connected agent can cancel any scheduled send from its own address, whoever created it, and no
    other.

    Args:
        body (CancelSentEmailByIdempotencyKeyBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        CancelSentEmailByIdempotencyKeyResponse200 | ErrorResponse
     """


    return sync_detailed(
        client=client,
body=body,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient,
    body: CancelSentEmailByIdempotencyKeyBody,

) -> Response[CancelSentEmailByIdempotencyKeyResponse200 | ErrorResponse]:
    """ Cancel a scheduled send by idempotency key

     Cancels the still-scheduled send created with this `Idempotency-Key` (matched exactly), as `POST
    /sent-emails/{id}/cancel` does, and releases the key. 404 `not_found`: no send this credential can
    act on was created with the key. 409 `not_scheduled`: the send holding the key is no longer
    scheduled; `error.details` names its `sent_email_id` and `status` (`canceled` if already canceled).
    Pass `created_before` on a retry so it cannot reach a newer send that reused the released key. A
    connected agent can cancel any scheduled send from its own address, whoever created it, and no
    other.

    Args:
        body (CancelSentEmailByIdempotencyKeyBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[CancelSentEmailByIdempotencyKeyResponse200 | ErrorResponse]
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
    client: AuthenticatedClient,
    body: CancelSentEmailByIdempotencyKeyBody,

) -> CancelSentEmailByIdempotencyKeyResponse200 | ErrorResponse | None:
    """ Cancel a scheduled send by idempotency key

     Cancels the still-scheduled send created with this `Idempotency-Key` (matched exactly), as `POST
    /sent-emails/{id}/cancel` does, and releases the key. 404 `not_found`: no send this credential can
    act on was created with the key. 409 `not_scheduled`: the send holding the key is no longer
    scheduled; `error.details` names its `sent_email_id` and `status` (`canceled` if already canceled).
    Pass `created_before` on a retry so it cannot reach a newer send that reused the released key. A
    connected agent can cancel any scheduled send from its own address, whoever created it, and no
    other.

    Args:
        body (CancelSentEmailByIdempotencyKeyBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        CancelSentEmailByIdempotencyKeyResponse200 | ErrorResponse
     """


    return (await asyncio_detailed(
        client=client,
body=body,

    )).parsed
