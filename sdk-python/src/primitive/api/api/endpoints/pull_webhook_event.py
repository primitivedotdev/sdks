from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.pull_webhook_input import PullWebhookInput
from ...models.pull_webhook_response import PullWebhookResponse
from typing import cast
from uuid import UUID



def _get_kwargs(
    id: UUID,
    *,
    body: PullWebhookInput,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/endpoints/{id}/pull".format(id=quote(str(id), safe=""),),
    }

    _kwargs["json"] = body.to_dict()


    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | PullWebhookResponse | None:
    if response.status_code == 200:
        response_200 = PullWebhookResponse.from_dict(response.json())



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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | PullWebhookResponse]:
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
    body: PullWebhookInput,

) -> Response[ErrorResponse | PullWebhookResponse]:
    """ Receive a pending webhook event without a public endpoint

     Wait up to 30 seconds for one existing event. The body string preserves the exact webhook
    serialization; headers and canonical occurrence/type metadata travel alongside it. A fixed lease
    protects the attempt while a short handler accepts input. Retry may redeliver an occurrence:
    deduplicate event_id. Empty delivery means no offer now, not proof all input was delivered; inspect
    backlog and persistent gap_count/last_gap_reason. Queue retention is 24 hours and does not extend
    source-content retention. Disconnecting preserves pending work. Same named destination shares
    consumption; different destinations get independent copies.

    Args:
        id (UUID):
        body (PullWebhookInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | PullWebhookResponse]
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
    body: PullWebhookInput,

) -> ErrorResponse | PullWebhookResponse | None:
    """ Receive a pending webhook event without a public endpoint

     Wait up to 30 seconds for one existing event. The body string preserves the exact webhook
    serialization; headers and canonical occurrence/type metadata travel alongside it. A fixed lease
    protects the attempt while a short handler accepts input. Retry may redeliver an occurrence:
    deduplicate event_id. Empty delivery means no offer now, not proof all input was delivered; inspect
    backlog and persistent gap_count/last_gap_reason. Queue retention is 24 hours and does not extend
    source-content retention. Disconnecting preserves pending work. Same named destination shares
    consumption; different destinations get independent copies.

    Args:
        id (UUID):
        body (PullWebhookInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | PullWebhookResponse
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
    body: PullWebhookInput,

) -> Response[ErrorResponse | PullWebhookResponse]:
    """ Receive a pending webhook event without a public endpoint

     Wait up to 30 seconds for one existing event. The body string preserves the exact webhook
    serialization; headers and canonical occurrence/type metadata travel alongside it. A fixed lease
    protects the attempt while a short handler accepts input. Retry may redeliver an occurrence:
    deduplicate event_id. Empty delivery means no offer now, not proof all input was delivered; inspect
    backlog and persistent gap_count/last_gap_reason. Queue retention is 24 hours and does not extend
    source-content retention. Disconnecting preserves pending work. Same named destination shares
    consumption; different destinations get independent copies.

    Args:
        id (UUID):
        body (PullWebhookInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | PullWebhookResponse]
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
    body: PullWebhookInput,

) -> ErrorResponse | PullWebhookResponse | None:
    """ Receive a pending webhook event without a public endpoint

     Wait up to 30 seconds for one existing event. The body string preserves the exact webhook
    serialization; headers and canonical occurrence/type metadata travel alongside it. A fixed lease
    protects the attempt while a short handler accepts input. Retry may redeliver an occurrence:
    deduplicate event_id. Empty delivery means no offer now, not proof all input was delivered; inspect
    backlog and persistent gap_count/last_gap_reason. Queue retention is 24 hours and does not extend
    source-content retention. Disconnecting preserves pending work. Same named destination shares
    consumption; different destinations get independent copies.

    Args:
        id (UUID):
        body (PullWebhookInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | PullWebhookResponse
     """


    return (await asyncio_detailed(
        id=id,
client=client,
body=body,

    )).parsed
