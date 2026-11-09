from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.set_function_runtime_key_request import SetFunctionRuntimeKeyRequest
from ...models.set_function_runtime_key_response_200 import SetFunctionRuntimeKeyResponse200
from typing import cast
from uuid import UUID



def _get_kwargs(
    id: UUID,
    *,
    body: SetFunctionRuntimeKeyRequest,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "put",
        "url": "/functions/{id}/runtime-key".format(id=quote(str(id), safe=""),),
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | SetFunctionRuntimeKeyResponse200 | None:
    if response.status_code == 200:
        response_200 = SetFunctionRuntimeKeyResponse200.from_dict(response.json())



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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | SetFunctionRuntimeKeyResponse200]:
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
    body: SetFunctionRuntimeKeyRequest,

) -> Response[ErrorResponse | SetFunctionRuntimeKeyResponse200]:
    """ Change a function's runtime key

     Change the key the function runs with, or the secrets attached to it. A grant wider than the
    caller's own is refused. A custom runtime_grant must list addresses or send mail_scope "org" for
    every mailbox; one that does neither is refused (400 validation_error, details.reason
    mail_scope_required). The function is redeployed with the new key.

    Args:
        id (UUID):
        body (SetFunctionRuntimeKeyRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | SetFunctionRuntimeKeyResponse200]
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
    body: SetFunctionRuntimeKeyRequest,

) -> ErrorResponse | SetFunctionRuntimeKeyResponse200 | None:
    """ Change a function's runtime key

     Change the key the function runs with, or the secrets attached to it. A grant wider than the
    caller's own is refused. A custom runtime_grant must list addresses or send mail_scope "org" for
    every mailbox; one that does neither is refused (400 validation_error, details.reason
    mail_scope_required). The function is redeployed with the new key.

    Args:
        id (UUID):
        body (SetFunctionRuntimeKeyRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | SetFunctionRuntimeKeyResponse200
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
    body: SetFunctionRuntimeKeyRequest,

) -> Response[ErrorResponse | SetFunctionRuntimeKeyResponse200]:
    """ Change a function's runtime key

     Change the key the function runs with, or the secrets attached to it. A grant wider than the
    caller's own is refused. A custom runtime_grant must list addresses or send mail_scope "org" for
    every mailbox; one that does neither is refused (400 validation_error, details.reason
    mail_scope_required). The function is redeployed with the new key.

    Args:
        id (UUID):
        body (SetFunctionRuntimeKeyRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | SetFunctionRuntimeKeyResponse200]
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
    body: SetFunctionRuntimeKeyRequest,

) -> ErrorResponse | SetFunctionRuntimeKeyResponse200 | None:
    """ Change a function's runtime key

     Change the key the function runs with, or the secrets attached to it. A grant wider than the
    caller's own is refused. A custom runtime_grant must list addresses or send mail_scope "org" for
    every mailbox; one that does neither is refused (400 validation_error, details.reason
    mail_scope_required). The function is redeployed with the new key.

    Args:
        id (UUID):
        body (SetFunctionRuntimeKeyRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | SetFunctionRuntimeKeyResponse200
     """


    return (await asyncio_detailed(
        id=id,
client=client,
body=body,

    )).parsed
