from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.get_webhook_secret_response_200 import GetWebhookSecretResponse200
from typing import cast



def _get_kwargs(
    
) -> dict[str, Any]:
    

    

    

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/account/webhook-secret",
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | GetWebhookSecretResponse200 | None:
    if response.status_code == 200:
        response_200 = GetWebhookSecretResponse200.from_dict(response.json())



        return response_200

    if response.status_code == 401:
        response_401 = ErrorResponse.from_dict(response.json())



        return response_401

    if response.status_code == 404:
        response_404 = ErrorResponse.from_dict(response.json())



        return response_404

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | GetWebhookSecretResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,

) -> Response[ErrorResponse | GetWebhookSecretResponse200]:
    r""" Get webhook signing secret

     Returns the webhook signing secret for your account. If no
    secret exists yet, one is generated automatically on first
    access.

    Signing is account-scoped, not per-endpoint. Every webhook
    delivery from any of your registered endpoints is signed
    with this single secret. Rotate via
    `POST /account/webhook-secret/rotate`.

    **Secret format**: the returned string looks base64-shaped
    (e.g. `XNHBBW8VqoBjRfNs1tkZj11jTk...`) but is NOT base64.
    Use it AS-IS as a UTF-8 string when computing HMAC over a
    delivery body. Base64-decoding before HMAC will silently
    produce mismatched signatures.

    See the API-level \"Webhook signing\" section for the full
    wire format (header name, signed string shape, hash algo,
    tolerance) including a language-agnostic verification
    recipe.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | GetWebhookSecretResponse200]
     """


    kwargs = _get_kwargs(
        
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    *,
    client: AuthenticatedClient | Client,

) -> ErrorResponse | GetWebhookSecretResponse200 | None:
    r""" Get webhook signing secret

     Returns the webhook signing secret for your account. If no
    secret exists yet, one is generated automatically on first
    access.

    Signing is account-scoped, not per-endpoint. Every webhook
    delivery from any of your registered endpoints is signed
    with this single secret. Rotate via
    `POST /account/webhook-secret/rotate`.

    **Secret format**: the returned string looks base64-shaped
    (e.g. `XNHBBW8VqoBjRfNs1tkZj11jTk...`) but is NOT base64.
    Use it AS-IS as a UTF-8 string when computing HMAC over a
    delivery body. Base64-decoding before HMAC will silently
    produce mismatched signatures.

    See the API-level \"Webhook signing\" section for the full
    wire format (header name, signed string shape, hash algo,
    tolerance) including a language-agnostic verification
    recipe.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | GetWebhookSecretResponse200
     """


    return sync_detailed(
        client=client,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,

) -> Response[ErrorResponse | GetWebhookSecretResponse200]:
    r""" Get webhook signing secret

     Returns the webhook signing secret for your account. If no
    secret exists yet, one is generated automatically on first
    access.

    Signing is account-scoped, not per-endpoint. Every webhook
    delivery from any of your registered endpoints is signed
    with this single secret. Rotate via
    `POST /account/webhook-secret/rotate`.

    **Secret format**: the returned string looks base64-shaped
    (e.g. `XNHBBW8VqoBjRfNs1tkZj11jTk...`) but is NOT base64.
    Use it AS-IS as a UTF-8 string when computing HMAC over a
    delivery body. Base64-decoding before HMAC will silently
    produce mismatched signatures.

    See the API-level \"Webhook signing\" section for the full
    wire format (header name, signed string shape, hash algo,
    tolerance) including a language-agnostic verification
    recipe.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | GetWebhookSecretResponse200]
     """


    kwargs = _get_kwargs(
        
    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    *,
    client: AuthenticatedClient | Client,

) -> ErrorResponse | GetWebhookSecretResponse200 | None:
    r""" Get webhook signing secret

     Returns the webhook signing secret for your account. If no
    secret exists yet, one is generated automatically on first
    access.

    Signing is account-scoped, not per-endpoint. Every webhook
    delivery from any of your registered endpoints is signed
    with this single secret. Rotate via
    `POST /account/webhook-secret/rotate`.

    **Secret format**: the returned string looks base64-shaped
    (e.g. `XNHBBW8VqoBjRfNs1tkZj11jTk...`) but is NOT base64.
    Use it AS-IS as a UTF-8 string when computing HMAC over a
    delivery body. Base64-decoding before HMAC will silently
    produce mismatched signatures.

    See the API-level \"Webhook signing\" section for the full
    wire format (header name, signed string shape, hash algo,
    tolerance) including a language-agnostic verification
    recipe.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | GetWebhookSecretResponse200
     """


    return (await asyncio_detailed(
        client=client,

    )).parsed
