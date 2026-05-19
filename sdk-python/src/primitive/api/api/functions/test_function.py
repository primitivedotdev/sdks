from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.test_function_body import TestFunctionBody
from ...models.test_function_response_200 import TestFunctionResponse200
from ...types import UNSET, Unset
from typing import cast
from uuid import UUID



def _get_kwargs(
    id: UUID,
    *,
    body: TestFunctionBody | Unset = UNSET,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/functions/{id}/test".format(id=quote(str(id), safe=""),),
    }

    
    if not isinstance(body, Unset):
        _kwargs["json"] = body.to_dict()
        headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | TestFunctionResponse200 | None:
    if response.status_code == 200:
        response_200 = TestFunctionResponse200.from_dict(response.json())



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

    if response.status_code == 422:
        response_422 = ErrorResponse.from_dict(response.json())



        return response_422

    if response.status_code == 502:
        response_502 = ErrorResponse.from_dict(response.json())



        return response_502

    if response.status_code == 503:
        response_503 = ErrorResponse.from_dict(response.json())



        return response_503

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | TestFunctionResponse200]:
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
    body: TestFunctionBody | Unset = UNSET,

) -> Response[ErrorResponse | TestFunctionResponse200]:
    """ Send a test invocation

     Sends a real test email from a Primitive-controlled sender to a
    local-part on one of the org's verified inbound domains. By
    default the recipient is a synthetic
    `__primitive_function_test+<random>@<domain>` address on a
    domain selected to route to the function. Scoped functions use
    their scoped domain; fallback functions use a domain that has
    no enabled domain-scoped endpoint. Pass `local_part` to
    override and exercise routing logic that branches on a specific
    recipient (the common pattern when one function handles multiple
    inboxes like `summarize@` and `action@`). The function fires
    through the normal MX delivery path, so reply / send-mail calls
    from inside the handler against the inbound's `email.id` work
    the same as in production. Returns immediately after the send is
    queued; the invocation appears on the function's invocations
    list within a few seconds.

    Requires that the function is currently `deployed`. Returns 422
    if the function is in `pending` or `failed` state, or if the
    org has no verified inbound domain to receive the test mail.
    Returns 400 if `local_part` is set to a value that does not
    match the local-part character set.

    Args:
        id (UUID):
        body (TestFunctionBody | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | TestFunctionResponse200]
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
    body: TestFunctionBody | Unset = UNSET,

) -> ErrorResponse | TestFunctionResponse200 | None:
    """ Send a test invocation

     Sends a real test email from a Primitive-controlled sender to a
    local-part on one of the org's verified inbound domains. By
    default the recipient is a synthetic
    `__primitive_function_test+<random>@<domain>` address on a
    domain selected to route to the function. Scoped functions use
    their scoped domain; fallback functions use a domain that has
    no enabled domain-scoped endpoint. Pass `local_part` to
    override and exercise routing logic that branches on a specific
    recipient (the common pattern when one function handles multiple
    inboxes like `summarize@` and `action@`). The function fires
    through the normal MX delivery path, so reply / send-mail calls
    from inside the handler against the inbound's `email.id` work
    the same as in production. Returns immediately after the send is
    queued; the invocation appears on the function's invocations
    list within a few seconds.

    Requires that the function is currently `deployed`. Returns 422
    if the function is in `pending` or `failed` state, or if the
    org has no verified inbound domain to receive the test mail.
    Returns 400 if `local_part` is set to a value that does not
    match the local-part character set.

    Args:
        id (UUID):
        body (TestFunctionBody | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | TestFunctionResponse200
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
    body: TestFunctionBody | Unset = UNSET,

) -> Response[ErrorResponse | TestFunctionResponse200]:
    """ Send a test invocation

     Sends a real test email from a Primitive-controlled sender to a
    local-part on one of the org's verified inbound domains. By
    default the recipient is a synthetic
    `__primitive_function_test+<random>@<domain>` address on a
    domain selected to route to the function. Scoped functions use
    their scoped domain; fallback functions use a domain that has
    no enabled domain-scoped endpoint. Pass `local_part` to
    override and exercise routing logic that branches on a specific
    recipient (the common pattern when one function handles multiple
    inboxes like `summarize@` and `action@`). The function fires
    through the normal MX delivery path, so reply / send-mail calls
    from inside the handler against the inbound's `email.id` work
    the same as in production. Returns immediately after the send is
    queued; the invocation appears on the function's invocations
    list within a few seconds.

    Requires that the function is currently `deployed`. Returns 422
    if the function is in `pending` or `failed` state, or if the
    org has no verified inbound domain to receive the test mail.
    Returns 400 if `local_part` is set to a value that does not
    match the local-part character set.

    Args:
        id (UUID):
        body (TestFunctionBody | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | TestFunctionResponse200]
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
    body: TestFunctionBody | Unset = UNSET,

) -> ErrorResponse | TestFunctionResponse200 | None:
    """ Send a test invocation

     Sends a real test email from a Primitive-controlled sender to a
    local-part on one of the org's verified inbound domains. By
    default the recipient is a synthetic
    `__primitive_function_test+<random>@<domain>` address on a
    domain selected to route to the function. Scoped functions use
    their scoped domain; fallback functions use a domain that has
    no enabled domain-scoped endpoint. Pass `local_part` to
    override and exercise routing logic that branches on a specific
    recipient (the common pattern when one function handles multiple
    inboxes like `summarize@` and `action@`). The function fires
    through the normal MX delivery path, so reply / send-mail calls
    from inside the handler against the inbound's `email.id` work
    the same as in production. Returns immediately after the send is
    queued; the invocation appears on the function's invocations
    list within a few seconds.

    Requires that the function is currently `deployed`. Returns 422
    if the function is in `pending` or `failed` state, or if the
    org has no verified inbound domain to receive the test mail.
    Returns 400 if `local_part` is set to a value that does not
    match the local-part character set.

    Args:
        id (UUID):
        body (TestFunctionBody | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | TestFunctionResponse200
     """


    return (await asyncio_detailed(
        id=id,
client=client,
body=body,

    )).parsed
