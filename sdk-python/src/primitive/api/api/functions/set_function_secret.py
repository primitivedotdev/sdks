from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.set_function_secret_input import SetFunctionSecretInput
from ...models.set_function_secret_response_200 import SetFunctionSecretResponse200
from ...models.set_function_secret_response_201 import SetFunctionSecretResponse201
from typing import cast
from uuid import UUID



def _get_kwargs(
    id: UUID,
    key: str,
    *,
    body: SetFunctionSecretInput,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "put",
        "url": "/functions/{id}/secrets/{key}".format(id=quote(str(id), safe=""),key=quote(str(key), safe=""),),
    }

    _kwargs["json"] = body.to_dict()


    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | SetFunctionSecretResponse200 | SetFunctionSecretResponse201 | None:
    if response.status_code == 200:
        response_200 = SetFunctionSecretResponse200.from_dict(response.json())



        return response_200

    if response.status_code == 201:
        response_201 = SetFunctionSecretResponse201.from_dict(response.json())



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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | SetFunctionSecretResponse200 | SetFunctionSecretResponse201]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    id: UUID,
    key: str,
    *,
    client: AuthenticatedClient | Client,
    body: SetFunctionSecretInput,

) -> Response[ErrorResponse | SetFunctionSecretResponse200 | SetFunctionSecretResponse201]:
    """ Set a secret by key

     Path-keyed companion to `POST /functions/{id}/secrets`.
    Idempotent: returns 201 the first time the key is set, 200 on
    subsequent updates. Same validation rules and same write-only
    guarantees as the POST verb; the new value lands in the running
    handler on the next deploy.

    Args:
        id (UUID):
        key (str):
        body (SetFunctionSecretInput): Body for PUT /functions/{id}/secrets/{key}. Key comes from
            the path.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | SetFunctionSecretResponse200 | SetFunctionSecretResponse201]
     """


    kwargs = _get_kwargs(
        id=id,
key=key,
body=body,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    id: UUID,
    key: str,
    *,
    client: AuthenticatedClient | Client,
    body: SetFunctionSecretInput,

) -> ErrorResponse | SetFunctionSecretResponse200 | SetFunctionSecretResponse201 | None:
    """ Set a secret by key

     Path-keyed companion to `POST /functions/{id}/secrets`.
    Idempotent: returns 201 the first time the key is set, 200 on
    subsequent updates. Same validation rules and same write-only
    guarantees as the POST verb; the new value lands in the running
    handler on the next deploy.

    Args:
        id (UUID):
        key (str):
        body (SetFunctionSecretInput): Body for PUT /functions/{id}/secrets/{key}. Key comes from
            the path.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | SetFunctionSecretResponse200 | SetFunctionSecretResponse201
     """


    return sync_detailed(
        id=id,
key=key,
client=client,
body=body,

    ).parsed

async def asyncio_detailed(
    id: UUID,
    key: str,
    *,
    client: AuthenticatedClient | Client,
    body: SetFunctionSecretInput,

) -> Response[ErrorResponse | SetFunctionSecretResponse200 | SetFunctionSecretResponse201]:
    """ Set a secret by key

     Path-keyed companion to `POST /functions/{id}/secrets`.
    Idempotent: returns 201 the first time the key is set, 200 on
    subsequent updates. Same validation rules and same write-only
    guarantees as the POST verb; the new value lands in the running
    handler on the next deploy.

    Args:
        id (UUID):
        key (str):
        body (SetFunctionSecretInput): Body for PUT /functions/{id}/secrets/{key}. Key comes from
            the path.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | SetFunctionSecretResponse200 | SetFunctionSecretResponse201]
     """


    kwargs = _get_kwargs(
        id=id,
key=key,
body=body,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    id: UUID,
    key: str,
    *,
    client: AuthenticatedClient | Client,
    body: SetFunctionSecretInput,

) -> ErrorResponse | SetFunctionSecretResponse200 | SetFunctionSecretResponse201 | None:
    """ Set a secret by key

     Path-keyed companion to `POST /functions/{id}/secrets`.
    Idempotent: returns 201 the first time the key is set, 200 on
    subsequent updates. Same validation rules and same write-only
    guarantees as the POST verb; the new value lands in the running
    handler on the next deploy.

    Args:
        id (UUID):
        key (str):
        body (SetFunctionSecretInput): Body for PUT /functions/{id}/secrets/{key}. Key comes from
            the path.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | SetFunctionSecretResponse200 | SetFunctionSecretResponse201
     """


    return (await asyncio_detailed(
        id=id,
key=key,
client=client,
body=body,

    )).parsed
