from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.get_webhook_delivery_stats_response_200 import GetWebhookDeliveryStatsResponse200
from ...types import UNSET, Unset
from typing import cast
import datetime



def _get_kwargs(
    *,
    since: datetime.datetime | Unset = UNSET,

) -> dict[str, Any]:
    

    

    params: dict[str, Any] = {}

    json_since: str | Unset = UNSET
    if not isinstance(since, Unset):
        json_since = since.isoformat()
    params["since"] = json_since


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/stats/webhook-deliveries",
        "params": params,
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | GetWebhookDeliveryStatsResponse200 | None:
    if response.status_code == 200:
        response_200 = GetWebhookDeliveryStatsResponse200.from_dict(response.json())



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

    if response.status_code == 429:
        response_429 = ErrorResponse.from_dict(response.json())



        return response_429

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | GetWebhookDeliveryStatsResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    since: datetime.datetime | Unset = UNSET,

) -> Response[ErrorResponse | GetWebhookDeliveryStatsResponse200]:
    """ Webhook delivery outcomes

     For each received email with a webhook delivery since `since`, how its latest delivery ended:
    clean_success, recovered (delivered after a failure), failed, or regressed (failed after a success).
    Pull deliveries are not counted, and neither are deliveries an email rule granted to a key: they are
    extra receivers and never change how the email itself was delivered. Needs webhooks:read, which a
    credential narrowed to some addresses never holds.

    Args:
        since (datetime.datetime | Unset): Count emails whose deliveries started at or after this
            time; defaults to 24 hours ago, at most 31 days back.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | GetWebhookDeliveryStatsResponse200]
     """


    kwargs = _get_kwargs(
        since=since,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    *,
    client: AuthenticatedClient | Client,
    since: datetime.datetime | Unset = UNSET,

) -> ErrorResponse | GetWebhookDeliveryStatsResponse200 | None:
    """ Webhook delivery outcomes

     For each received email with a webhook delivery since `since`, how its latest delivery ended:
    clean_success, recovered (delivered after a failure), failed, or regressed (failed after a success).
    Pull deliveries are not counted, and neither are deliveries an email rule granted to a key: they are
    extra receivers and never change how the email itself was delivered. Needs webhooks:read, which a
    credential narrowed to some addresses never holds.

    Args:
        since (datetime.datetime | Unset): Count emails whose deliveries started at or after this
            time; defaults to 24 hours ago, at most 31 days back.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | GetWebhookDeliveryStatsResponse200
     """


    return sync_detailed(
        client=client,
since=since,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    since: datetime.datetime | Unset = UNSET,

) -> Response[ErrorResponse | GetWebhookDeliveryStatsResponse200]:
    """ Webhook delivery outcomes

     For each received email with a webhook delivery since `since`, how its latest delivery ended:
    clean_success, recovered (delivered after a failure), failed, or regressed (failed after a success).
    Pull deliveries are not counted, and neither are deliveries an email rule granted to a key: they are
    extra receivers and never change how the email itself was delivered. Needs webhooks:read, which a
    credential narrowed to some addresses never holds.

    Args:
        since (datetime.datetime | Unset): Count emails whose deliveries started at or after this
            time; defaults to 24 hours ago, at most 31 days back.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | GetWebhookDeliveryStatsResponse200]
     """


    kwargs = _get_kwargs(
        since=since,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    since: datetime.datetime | Unset = UNSET,

) -> ErrorResponse | GetWebhookDeliveryStatsResponse200 | None:
    """ Webhook delivery outcomes

     For each received email with a webhook delivery since `since`, how its latest delivery ended:
    clean_success, recovered (delivered after a failure), failed, or regressed (failed after a success).
    Pull deliveries are not counted, and neither are deliveries an email rule granted to a key: they are
    extra receivers and never change how the email itself was delivered. Needs webhooks:read, which a
    credential narrowed to some addresses never holds.

    Args:
        since (datetime.datetime | Unset): Count emails whose deliveries started at or after this
            time; defaults to 24 hours ago, at most 31 days back.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | GetWebhookDeliveryStatsResponse200
     """


    return (await asyncio_detailed(
        client=client,
since=since,

    )).parsed
