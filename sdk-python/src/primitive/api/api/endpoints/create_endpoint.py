from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.create_endpoint_input import CreateEndpointInput
from ...models.create_endpoint_response_200 import CreateEndpointResponse200
from ...models.create_endpoint_response_201 import CreateEndpointResponse201
from ...models.error_response import ErrorResponse
from typing import cast



def _get_kwargs(
    *,
    body: CreateEndpointInput,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/endpoints",
    }

    _kwargs["json"] = body.to_dict()


    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> CreateEndpointResponse200 | CreateEndpointResponse201 | ErrorResponse | None:
    if response.status_code == 200:
        response_200 = CreateEndpointResponse200.from_dict(response.json())



        return response_200

    if response.status_code == 201:
        response_201 = CreateEndpointResponse201.from_dict(response.json())



        return response_201

    if response.status_code == 400:
        response_400 = ErrorResponse.from_dict(response.json())



        return response_400

    if response.status_code == 401:
        response_401 = ErrorResponse.from_dict(response.json())



        return response_401

    if response.status_code == 409:
        response_409 = ErrorResponse.from_dict(response.json())



        return response_409

    if response.status_code == 503:
        response_503 = ErrorResponse.from_dict(response.json())



        return response_503

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[CreateEndpointResponse200 | CreateEndpointResponse201 | ErrorResponse]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: CreateEndpointInput,

) -> Response[CreateEndpointResponse200 | CreateEndpointResponse201 | ErrorResponse]:
    r""" Create a webhook endpoint

     Creates a new webhook endpoint. If a deactivated endpoint
    with the same URL and domain exists, it is reactivated
    instead. Subject to plan limits on the number of active
    endpoints.

    **Signing is account-scoped, not per-endpoint.** This call
    does not return any signing material; every endpoint on the
    account uses the same webhook secret, fetched via
    `GET /account/webhook-secret`. See the API-level \"Webhook
    signing\" section for the full wire format (header name,
    signed string, hash algo, secret format, tolerance) and a
    language-agnostic verification recipe.

    After creating the endpoint, fire a test delivery against
    it via `POST /endpoints/{id}/test` to confirm your verifier
    accepts the signature.


    For local receiving, use kind=pull and a stable name, without url, function_id or domain_id. Named
    creation resumes the same active destination; omitted filters preserve its selection, while
    conflicting supplied configuration returns 409. New unfiltered destinations receive all subsequently
    ready eligible event types within their credential scope. Connected-agent credentials automatically
    create private subscriptions restricted to inbound email for their assigned address. Names are
    isolated per credential; revocation or replacement deletes its subscriptions. Address-scoped events
    contain parsed mail without raw MIME, signed download links, routing metadata, or sibling envelope
    recipients. Pull destinations do not occupy HTTP routing slots. Signing-secret setup and a test HTTP
    delivery are not required for pull receiving.

    Args:
        body (CreateEndpointInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[CreateEndpointResponse200 | CreateEndpointResponse201 | ErrorResponse]
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
    client: AuthenticatedClient | Client,
    body: CreateEndpointInput,

) -> CreateEndpointResponse200 | CreateEndpointResponse201 | ErrorResponse | None:
    r""" Create a webhook endpoint

     Creates a new webhook endpoint. If a deactivated endpoint
    with the same URL and domain exists, it is reactivated
    instead. Subject to plan limits on the number of active
    endpoints.

    **Signing is account-scoped, not per-endpoint.** This call
    does not return any signing material; every endpoint on the
    account uses the same webhook secret, fetched via
    `GET /account/webhook-secret`. See the API-level \"Webhook
    signing\" section for the full wire format (header name,
    signed string, hash algo, secret format, tolerance) and a
    language-agnostic verification recipe.

    After creating the endpoint, fire a test delivery against
    it via `POST /endpoints/{id}/test` to confirm your verifier
    accepts the signature.


    For local receiving, use kind=pull and a stable name, without url, function_id or domain_id. Named
    creation resumes the same active destination; omitted filters preserve its selection, while
    conflicting supplied configuration returns 409. New unfiltered destinations receive all subsequently
    ready eligible event types within their credential scope. Connected-agent credentials automatically
    create private subscriptions restricted to inbound email for their assigned address. Names are
    isolated per credential; revocation or replacement deletes its subscriptions. Address-scoped events
    contain parsed mail without raw MIME, signed download links, routing metadata, or sibling envelope
    recipients. Pull destinations do not occupy HTTP routing slots. Signing-secret setup and a test HTTP
    delivery are not required for pull receiving.

    Args:
        body (CreateEndpointInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        CreateEndpointResponse200 | CreateEndpointResponse201 | ErrorResponse
     """


    return sync_detailed(
        client=client,
body=body,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: CreateEndpointInput,

) -> Response[CreateEndpointResponse200 | CreateEndpointResponse201 | ErrorResponse]:
    r""" Create a webhook endpoint

     Creates a new webhook endpoint. If a deactivated endpoint
    with the same URL and domain exists, it is reactivated
    instead. Subject to plan limits on the number of active
    endpoints.

    **Signing is account-scoped, not per-endpoint.** This call
    does not return any signing material; every endpoint on the
    account uses the same webhook secret, fetched via
    `GET /account/webhook-secret`. See the API-level \"Webhook
    signing\" section for the full wire format (header name,
    signed string, hash algo, secret format, tolerance) and a
    language-agnostic verification recipe.

    After creating the endpoint, fire a test delivery against
    it via `POST /endpoints/{id}/test` to confirm your verifier
    accepts the signature.


    For local receiving, use kind=pull and a stable name, without url, function_id or domain_id. Named
    creation resumes the same active destination; omitted filters preserve its selection, while
    conflicting supplied configuration returns 409. New unfiltered destinations receive all subsequently
    ready eligible event types within their credential scope. Connected-agent credentials automatically
    create private subscriptions restricted to inbound email for their assigned address. Names are
    isolated per credential; revocation or replacement deletes its subscriptions. Address-scoped events
    contain parsed mail without raw MIME, signed download links, routing metadata, or sibling envelope
    recipients. Pull destinations do not occupy HTTP routing slots. Signing-secret setup and a test HTTP
    delivery are not required for pull receiving.

    Args:
        body (CreateEndpointInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[CreateEndpointResponse200 | CreateEndpointResponse201 | ErrorResponse]
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
    client: AuthenticatedClient | Client,
    body: CreateEndpointInput,

) -> CreateEndpointResponse200 | CreateEndpointResponse201 | ErrorResponse | None:
    r""" Create a webhook endpoint

     Creates a new webhook endpoint. If a deactivated endpoint
    with the same URL and domain exists, it is reactivated
    instead. Subject to plan limits on the number of active
    endpoints.

    **Signing is account-scoped, not per-endpoint.** This call
    does not return any signing material; every endpoint on the
    account uses the same webhook secret, fetched via
    `GET /account/webhook-secret`. See the API-level \"Webhook
    signing\" section for the full wire format (header name,
    signed string, hash algo, secret format, tolerance) and a
    language-agnostic verification recipe.

    After creating the endpoint, fire a test delivery against
    it via `POST /endpoints/{id}/test` to confirm your verifier
    accepts the signature.


    For local receiving, use kind=pull and a stable name, without url, function_id or domain_id. Named
    creation resumes the same active destination; omitted filters preserve its selection, while
    conflicting supplied configuration returns 409. New unfiltered destinations receive all subsequently
    ready eligible event types within their credential scope. Connected-agent credentials automatically
    create private subscriptions restricted to inbound email for their assigned address. Names are
    isolated per credential; revocation or replacement deletes its subscriptions. Address-scoped events
    contain parsed mail without raw MIME, signed download links, routing metadata, or sibling envelope
    recipients. Pull destinations do not occupy HTTP routing slots. Signing-secret setup and a test HTTP
    delivery are not required for pull receiving.

    Args:
        body (CreateEndpointInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        CreateEndpointResponse200 | CreateEndpointResponse201 | ErrorResponse
     """


    return (await asyncio_detailed(
        client=client,
body=body,

    )).parsed
