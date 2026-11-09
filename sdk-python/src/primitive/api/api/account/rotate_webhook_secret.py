from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.rotate_webhook_secret_response_200 import RotateWebhookSecretResponse200
from ...types import UNSET, Unset
from typing import cast



def _get_kwargs(
    *,
    idempotency_key: str | Unset = UNSET,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}
    if not isinstance(idempotency_key, Unset):
        headers["Idempotency-Key"] = idempotency_key



    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/account/webhook-secret/rotate",
    }


    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | RotateWebhookSecretResponse200 | None:
    if response.status_code == 200:
        response_200 = RotateWebhookSecretResponse200.from_dict(response.json())



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

    if response.status_code == 429:
        response_429 = ErrorResponse.from_dict(response.json())



        return response_429

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | RotateWebhookSecretResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    idempotency_key: str | Unset = UNSET,

) -> Response[ErrorResponse | RotateWebhookSecretResponse200]:
    """ Rotate webhook signing secret

     Generates a new webhook signing secret, replacing the current one.
    Rate limited to once per 60 minutes.

    Args:
        idempotency_key (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | RotateWebhookSecretResponse200]
     """


    kwargs = _get_kwargs(
        idempotency_key=idempotency_key,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    *,
    client: AuthenticatedClient | Client,
    idempotency_key: str | Unset = UNSET,

) -> ErrorResponse | RotateWebhookSecretResponse200 | None:
    """ Rotate webhook signing secret

     Generates a new webhook signing secret, replacing the current one.
    Rate limited to once per 60 minutes.

    Args:
        idempotency_key (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | RotateWebhookSecretResponse200
     """


    return sync_detailed(
        client=client,
idempotency_key=idempotency_key,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    idempotency_key: str | Unset = UNSET,

) -> Response[ErrorResponse | RotateWebhookSecretResponse200]:
    """ Rotate webhook signing secret

     Generates a new webhook signing secret, replacing the current one.
    Rate limited to once per 60 minutes.

    Args:
        idempotency_key (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | RotateWebhookSecretResponse200]
     """


    kwargs = _get_kwargs(
        idempotency_key=idempotency_key,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    idempotency_key: str | Unset = UNSET,

) -> ErrorResponse | RotateWebhookSecretResponse200 | None:
    """ Rotate webhook signing secret

     Generates a new webhook signing secret, replacing the current one.
    Rate limited to once per 60 minutes.

    Args:
        idempotency_key (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | RotateWebhookSecretResponse200
     """


    return (await asyncio_detailed(
        client=client,
idempotency_key=idempotency_key,

    )).parsed
