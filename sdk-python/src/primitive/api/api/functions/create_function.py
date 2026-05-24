from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.create_function_input import CreateFunctionInput
from ...models.create_function_response_201 import CreateFunctionResponse201
from ...models.error_response import ErrorResponse
from typing import cast



def _get_kwargs(
    *,
    body: CreateFunctionInput,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/functions",
    }

    _kwargs["json"] = body.to_dict()


    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> CreateFunctionResponse201 | ErrorResponse | None:
    if response.status_code == 201:
        response_201 = CreateFunctionResponse201.from_dict(response.json())



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

    if response.status_code == 424:
        response_424 = ErrorResponse.from_dict(response.json())



        return response_424

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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[CreateFunctionResponse201 | ErrorResponse]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: CreateFunctionInput,

) -> Response[CreateFunctionResponse201 | ErrorResponse]:
    """ Deploy a function

     Creates and deploys a new function. The handler must be a single
    ESM module whose default export is an object with an async
    `fetch(request, env)` method (Workers-style). Primitive signs
    each delivery and forwards the `Primitive-Signature` header to
    the handler. Verify the raw request body with
    `PRIMITIVE_WEBHOOK_SECRET` before parsing JSON; after verification
    the request body parses to an `email.received` event (see
    `EmailReceivedEvent` and the Webhook payload section for the full
    schema). Code is bundled before being uploaded; ship a single
    self-contained file rather than relying on external imports.

    **Code limits.** `code` is capped at 1 MiB UTF-8. `sourceMap`
    (optional) is capped at 5 MiB UTF-8, stored with each deployment
    attempt, and sent to the runtime so stack traces can resolve to
    original source files.

    **Auto-wiring.** On successful deploy, Primitive automatically
    creates a webhook endpoint that delivers inbound mail to the
    function. There is nothing to configure on the Endpoints API
    for this to work; the internal runtime URL is not returned by
    the API and is not a customer-facing integration surface.

    **Secrets.** New functions ship with the managed secrets
    (`PRIMITIVE_WEBHOOK_SECRET`, `PRIMITIVE_API_KEY`,
    `PRIMITIVE_API_BASE_URL`) already bound. Add user-set secrets via
    `POST /functions/{id}/secrets`; secret writes only land in the
    running handler on the next redeploy.

    Args:
        body (CreateFunctionInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[CreateFunctionResponse201 | ErrorResponse]
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
    body: CreateFunctionInput,

) -> CreateFunctionResponse201 | ErrorResponse | None:
    """ Deploy a function

     Creates and deploys a new function. The handler must be a single
    ESM module whose default export is an object with an async
    `fetch(request, env)` method (Workers-style). Primitive signs
    each delivery and forwards the `Primitive-Signature` header to
    the handler. Verify the raw request body with
    `PRIMITIVE_WEBHOOK_SECRET` before parsing JSON; after verification
    the request body parses to an `email.received` event (see
    `EmailReceivedEvent` and the Webhook payload section for the full
    schema). Code is bundled before being uploaded; ship a single
    self-contained file rather than relying on external imports.

    **Code limits.** `code` is capped at 1 MiB UTF-8. `sourceMap`
    (optional) is capped at 5 MiB UTF-8, stored with each deployment
    attempt, and sent to the runtime so stack traces can resolve to
    original source files.

    **Auto-wiring.** On successful deploy, Primitive automatically
    creates a webhook endpoint that delivers inbound mail to the
    function. There is nothing to configure on the Endpoints API
    for this to work; the internal runtime URL is not returned by
    the API and is not a customer-facing integration surface.

    **Secrets.** New functions ship with the managed secrets
    (`PRIMITIVE_WEBHOOK_SECRET`, `PRIMITIVE_API_KEY`,
    `PRIMITIVE_API_BASE_URL`) already bound. Add user-set secrets via
    `POST /functions/{id}/secrets`; secret writes only land in the
    running handler on the next redeploy.

    Args:
        body (CreateFunctionInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        CreateFunctionResponse201 | ErrorResponse
     """


    return sync_detailed(
        client=client,
body=body,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: CreateFunctionInput,

) -> Response[CreateFunctionResponse201 | ErrorResponse]:
    """ Deploy a function

     Creates and deploys a new function. The handler must be a single
    ESM module whose default export is an object with an async
    `fetch(request, env)` method (Workers-style). Primitive signs
    each delivery and forwards the `Primitive-Signature` header to
    the handler. Verify the raw request body with
    `PRIMITIVE_WEBHOOK_SECRET` before parsing JSON; after verification
    the request body parses to an `email.received` event (see
    `EmailReceivedEvent` and the Webhook payload section for the full
    schema). Code is bundled before being uploaded; ship a single
    self-contained file rather than relying on external imports.

    **Code limits.** `code` is capped at 1 MiB UTF-8. `sourceMap`
    (optional) is capped at 5 MiB UTF-8, stored with each deployment
    attempt, and sent to the runtime so stack traces can resolve to
    original source files.

    **Auto-wiring.** On successful deploy, Primitive automatically
    creates a webhook endpoint that delivers inbound mail to the
    function. There is nothing to configure on the Endpoints API
    for this to work; the internal runtime URL is not returned by
    the API and is not a customer-facing integration surface.

    **Secrets.** New functions ship with the managed secrets
    (`PRIMITIVE_WEBHOOK_SECRET`, `PRIMITIVE_API_KEY`,
    `PRIMITIVE_API_BASE_URL`) already bound. Add user-set secrets via
    `POST /functions/{id}/secrets`; secret writes only land in the
    running handler on the next redeploy.

    Args:
        body (CreateFunctionInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[CreateFunctionResponse201 | ErrorResponse]
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
    body: CreateFunctionInput,

) -> CreateFunctionResponse201 | ErrorResponse | None:
    """ Deploy a function

     Creates and deploys a new function. The handler must be a single
    ESM module whose default export is an object with an async
    `fetch(request, env)` method (Workers-style). Primitive signs
    each delivery and forwards the `Primitive-Signature` header to
    the handler. Verify the raw request body with
    `PRIMITIVE_WEBHOOK_SECRET` before parsing JSON; after verification
    the request body parses to an `email.received` event (see
    `EmailReceivedEvent` and the Webhook payload section for the full
    schema). Code is bundled before being uploaded; ship a single
    self-contained file rather than relying on external imports.

    **Code limits.** `code` is capped at 1 MiB UTF-8. `sourceMap`
    (optional) is capped at 5 MiB UTF-8, stored with each deployment
    attempt, and sent to the runtime so stack traces can resolve to
    original source files.

    **Auto-wiring.** On successful deploy, Primitive automatically
    creates a webhook endpoint that delivers inbound mail to the
    function. There is nothing to configure on the Endpoints API
    for this to work; the internal runtime URL is not returned by
    the API and is not a customer-facing integration surface.

    **Secrets.** New functions ship with the managed secrets
    (`PRIMITIVE_WEBHOOK_SECRET`, `PRIMITIVE_API_KEY`,
    `PRIMITIVE_API_BASE_URL`) already bound. Add user-set secrets via
    `POST /functions/{id}/secrets`; secret writes only land in the
    running handler on the next redeploy.

    Args:
        body (CreateFunctionInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        CreateFunctionResponse201 | ErrorResponse
     """


    return (await asyncio_detailed(
        client=client,
body=body,

    )).parsed
