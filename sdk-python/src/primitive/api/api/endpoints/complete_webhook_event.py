from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.complete_webhook_exec_input import CompleteWebhookExecInput
from ...models.complete_webhook_http_input import CompleteWebhookHttpInput
from ...models.complete_webhook_response import CompleteWebhookResponse
from ...models.complete_webhook_stdout_input import CompleteWebhookStdoutInput
from ...models.error_response import ErrorResponse
from typing import cast
from uuid import UUID



def _get_kwargs(
    id: UUID,
    *,
    body: CompleteWebhookExecInput | CompleteWebhookHttpInput | CompleteWebhookStdoutInput,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/endpoints/{id}/complete".format(id=quote(str(id), safe=""),),
    }

    
    if isinstance(body, CompleteWebhookHttpInput):
        _kwargs["json"] = body.to_dict()
    elif isinstance(body, CompleteWebhookExecInput):
        _kwargs["json"] = body.to_dict()
    else:
        _kwargs["json"] = body.to_dict()



    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> CompleteWebhookResponse | ErrorResponse | None:
    if response.status_code == 200:
        response_200 = CompleteWebhookResponse.from_dict(response.json())



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

    if response.status_code == 408:
        response_408 = ErrorResponse.from_dict(response.json())



        return response_408

    if response.status_code == 409:
        response_409 = ErrorResponse.from_dict(response.json())



        return response_409

    if response.status_code == 410:
        response_410 = ErrorResponse.from_dict(response.json())



        return response_410

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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[CompleteWebhookResponse | ErrorResponse]:
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
    body: CompleteWebhookExecInput | CompleteWebhookHttpInput | CompleteWebhookStdoutInput,

) -> Response[CompleteWebhookResponse | ErrorResponse]:
    """ Report the outcome of a local webhook delivery attempt

     Report normalized handling evidence for the queue, attempt and lease. Required JSON fields:
    queue_id, delivery_id, lease_token, mode, duration_ms. For mode=exec include exit_code; stdout
    includes write_succeeded; http includes status_code and optional transport_error, error_code,
    confirmed. Supply this discriminated request with --raw-body in the generated CLI. The server
    classifies success and retry. Duplicate identical completion is idempotent; a stale lease cannot
    finish a newer attempt. Exec success means durable input acceptance, not completion of agent
    reasoning. Only successful HTTP handling with recognized confirmation evidence can confirm content
    discard. Never send arbitrary handler output or HTTP response bodies.

    Args:
        id (UUID):
        body (CompleteWebhookExecInput | CompleteWebhookHttpInput | CompleteWebhookStdoutInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[CompleteWebhookResponse | ErrorResponse]
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
    body: CompleteWebhookExecInput | CompleteWebhookHttpInput | CompleteWebhookStdoutInput,

) -> CompleteWebhookResponse | ErrorResponse | None:
    """ Report the outcome of a local webhook delivery attempt

     Report normalized handling evidence for the queue, attempt and lease. Required JSON fields:
    queue_id, delivery_id, lease_token, mode, duration_ms. For mode=exec include exit_code; stdout
    includes write_succeeded; http includes status_code and optional transport_error, error_code,
    confirmed. Supply this discriminated request with --raw-body in the generated CLI. The server
    classifies success and retry. Duplicate identical completion is idempotent; a stale lease cannot
    finish a newer attempt. Exec success means durable input acceptance, not completion of agent
    reasoning. Only successful HTTP handling with recognized confirmation evidence can confirm content
    discard. Never send arbitrary handler output or HTTP response bodies.

    Args:
        id (UUID):
        body (CompleteWebhookExecInput | CompleteWebhookHttpInput | CompleteWebhookStdoutInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        CompleteWebhookResponse | ErrorResponse
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
    body: CompleteWebhookExecInput | CompleteWebhookHttpInput | CompleteWebhookStdoutInput,

) -> Response[CompleteWebhookResponse | ErrorResponse]:
    """ Report the outcome of a local webhook delivery attempt

     Report normalized handling evidence for the queue, attempt and lease. Required JSON fields:
    queue_id, delivery_id, lease_token, mode, duration_ms. For mode=exec include exit_code; stdout
    includes write_succeeded; http includes status_code and optional transport_error, error_code,
    confirmed. Supply this discriminated request with --raw-body in the generated CLI. The server
    classifies success and retry. Duplicate identical completion is idempotent; a stale lease cannot
    finish a newer attempt. Exec success means durable input acceptance, not completion of agent
    reasoning. Only successful HTTP handling with recognized confirmation evidence can confirm content
    discard. Never send arbitrary handler output or HTTP response bodies.

    Args:
        id (UUID):
        body (CompleteWebhookExecInput | CompleteWebhookHttpInput | CompleteWebhookStdoutInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[CompleteWebhookResponse | ErrorResponse]
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
    body: CompleteWebhookExecInput | CompleteWebhookHttpInput | CompleteWebhookStdoutInput,

) -> CompleteWebhookResponse | ErrorResponse | None:
    """ Report the outcome of a local webhook delivery attempt

     Report normalized handling evidence for the queue, attempt and lease. Required JSON fields:
    queue_id, delivery_id, lease_token, mode, duration_ms. For mode=exec include exit_code; stdout
    includes write_succeeded; http includes status_code and optional transport_error, error_code,
    confirmed. Supply this discriminated request with --raw-body in the generated CLI. The server
    classifies success and retry. Duplicate identical completion is idempotent; a stale lease cannot
    finish a newer attempt. Exec success means durable input acceptance, not completion of agent
    reasoning. Only successful HTTP handling with recognized confirmation evidence can confirm content
    discard. Never send arbitrary handler output or HTTP response bodies.

    Args:
        id (UUID):
        body (CompleteWebhookExecInput | CompleteWebhookHttpInput | CompleteWebhookStdoutInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        CompleteWebhookResponse | ErrorResponse
     """


    return (await asyncio_detailed(
        id=id,
client=client,
body=body,

    )).parsed
