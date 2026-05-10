from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.create_function_secret_input import CreateFunctionSecretInput
from ...models.create_function_secret_response_200 import CreateFunctionSecretResponse200
from ...models.create_function_secret_response_201 import CreateFunctionSecretResponse201
from ...models.error_response import ErrorResponse
from typing import cast
from uuid import UUID



def _get_kwargs(
    id: UUID,
    *,
    body: CreateFunctionSecretInput,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/functions/{id}/secrets".format(id=quote(str(id), safe=""),),
    }

    _kwargs["json"] = body.to_dict()


    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> CreateFunctionSecretResponse200 | CreateFunctionSecretResponse201 | ErrorResponse | None:
    if response.status_code == 200:
        response_200 = CreateFunctionSecretResponse200.from_dict(response.json())



        return response_200

    if response.status_code == 201:
        response_201 = CreateFunctionSecretResponse201.from_dict(response.json())



        return response_201

    if response.status_code == 400:
        response_400 = ErrorResponse.from_dict(response.json())



        return response_400

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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[CreateFunctionSecretResponse200 | CreateFunctionSecretResponse201 | ErrorResponse]:
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
    body: CreateFunctionSecretInput,

) -> Response[CreateFunctionSecretResponse200 | CreateFunctionSecretResponse201 | ErrorResponse]:
    """ Create or update a secret

     Idempotent insert-or-update keyed on `(function_id, key)`.
    Returns 201 the first time the key is set, 200 on subsequent
    updates. Values are encrypted at rest and only become visible
    to the running handler on the next deploy (`PUT /functions/{id}`
    with the existing code is sufficient to refresh bindings).

    Keys must match `^[A-Z_][A-Z0-9_]*$` (uppercase letters,
    digits, underscores; first character is a letter or
    underscore). Values are at most 4096 UTF-8 bytes. System-
    managed keys are reserved and rejected.

    Args:
        id (UUID):
        body (CreateFunctionSecretInput): Body for POST /functions/{id}/secrets.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[CreateFunctionSecretResponse200 | CreateFunctionSecretResponse201 | ErrorResponse]
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
    body: CreateFunctionSecretInput,

) -> CreateFunctionSecretResponse200 | CreateFunctionSecretResponse201 | ErrorResponse | None:
    """ Create or update a secret

     Idempotent insert-or-update keyed on `(function_id, key)`.
    Returns 201 the first time the key is set, 200 on subsequent
    updates. Values are encrypted at rest and only become visible
    to the running handler on the next deploy (`PUT /functions/{id}`
    with the existing code is sufficient to refresh bindings).

    Keys must match `^[A-Z_][A-Z0-9_]*$` (uppercase letters,
    digits, underscores; first character is a letter or
    underscore). Values are at most 4096 UTF-8 bytes. System-
    managed keys are reserved and rejected.

    Args:
        id (UUID):
        body (CreateFunctionSecretInput): Body for POST /functions/{id}/secrets.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        CreateFunctionSecretResponse200 | CreateFunctionSecretResponse201 | ErrorResponse
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
    body: CreateFunctionSecretInput,

) -> Response[CreateFunctionSecretResponse200 | CreateFunctionSecretResponse201 | ErrorResponse]:
    """ Create or update a secret

     Idempotent insert-or-update keyed on `(function_id, key)`.
    Returns 201 the first time the key is set, 200 on subsequent
    updates. Values are encrypted at rest and only become visible
    to the running handler on the next deploy (`PUT /functions/{id}`
    with the existing code is sufficient to refresh bindings).

    Keys must match `^[A-Z_][A-Z0-9_]*$` (uppercase letters,
    digits, underscores; first character is a letter or
    underscore). Values are at most 4096 UTF-8 bytes. System-
    managed keys are reserved and rejected.

    Args:
        id (UUID):
        body (CreateFunctionSecretInput): Body for POST /functions/{id}/secrets.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[CreateFunctionSecretResponse200 | CreateFunctionSecretResponse201 | ErrorResponse]
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
    body: CreateFunctionSecretInput,

) -> CreateFunctionSecretResponse200 | CreateFunctionSecretResponse201 | ErrorResponse | None:
    """ Create or update a secret

     Idempotent insert-or-update keyed on `(function_id, key)`.
    Returns 201 the first time the key is set, 200 on subsequent
    updates. Values are encrypted at rest and only become visible
    to the running handler on the next deploy (`PUT /functions/{id}`
    with the existing code is sufficient to refresh bindings).

    Keys must match `^[A-Z_][A-Z0-9_]*$` (uppercase letters,
    digits, underscores; first character is a letter or
    underscore). Values are at most 4096 UTF-8 bytes. System-
    managed keys are reserved and rejected.

    Args:
        id (UUID):
        body (CreateFunctionSecretInput): Body for POST /functions/{id}/secrets.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        CreateFunctionSecretResponse200 | CreateFunctionSecretResponse201 | ErrorResponse
     """


    return (await asyncio_detailed(
        id=id,
client=client,
body=body,

    )).parsed
