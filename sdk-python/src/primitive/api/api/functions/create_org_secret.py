from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.create_org_secret_input import CreateOrgSecretInput
from ...models.create_org_secret_response_200 import CreateOrgSecretResponse200
from ...models.create_org_secret_response_201 import CreateOrgSecretResponse201
from ...models.error_response import ErrorResponse
from typing import cast



def _get_kwargs(
    *,
    body: CreateOrgSecretInput,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/org/secrets",
    }

    _kwargs["json"] = body.to_dict()


    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> CreateOrgSecretResponse200 | CreateOrgSecretResponse201 | ErrorResponse | None:
    if response.status_code == 200:
        response_200 = CreateOrgSecretResponse200.from_dict(response.json())



        return response_200

    if response.status_code == 201:
        response_201 = CreateOrgSecretResponse201.from_dict(response.json())



        return response_201

    if response.status_code == 400:
        response_400 = ErrorResponse.from_dict(response.json())



        return response_400

    if response.status_code == 401:
        response_401 = ErrorResponse.from_dict(response.json())



        return response_401

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[CreateOrgSecretResponse200 | CreateOrgSecretResponse201 | ErrorResponse]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: CreateOrgSecretInput,

) -> Response[CreateOrgSecretResponse200 | CreateOrgSecretResponse201 | ErrorResponse]:
    """ Create or update an org secret

     Idempotent insert-or-update keyed on `(org_id, key)`. Returns
    201 the first time the key is set, 200 on subsequent updates.
    Values are encrypted at rest. A changed value lands in a
    function only on that function's next deploy.

    Keys must match `^[A-Z_][A-Z0-9_]*$` (uppercase letters,
    digits, underscores; first character is a letter or
    underscore). Values are at most 4096 UTF-8 bytes. System-
    managed keys are reserved and rejected.

    Args:
        body (CreateOrgSecretInput): Body for POST /org/secrets.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[CreateOrgSecretResponse200 | CreateOrgSecretResponse201 | ErrorResponse]
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
    body: CreateOrgSecretInput,

) -> CreateOrgSecretResponse200 | CreateOrgSecretResponse201 | ErrorResponse | None:
    """ Create or update an org secret

     Idempotent insert-or-update keyed on `(org_id, key)`. Returns
    201 the first time the key is set, 200 on subsequent updates.
    Values are encrypted at rest. A changed value lands in a
    function only on that function's next deploy.

    Keys must match `^[A-Z_][A-Z0-9_]*$` (uppercase letters,
    digits, underscores; first character is a letter or
    underscore). Values are at most 4096 UTF-8 bytes. System-
    managed keys are reserved and rejected.

    Args:
        body (CreateOrgSecretInput): Body for POST /org/secrets.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        CreateOrgSecretResponse200 | CreateOrgSecretResponse201 | ErrorResponse
     """


    return sync_detailed(
        client=client,
body=body,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: CreateOrgSecretInput,

) -> Response[CreateOrgSecretResponse200 | CreateOrgSecretResponse201 | ErrorResponse]:
    """ Create or update an org secret

     Idempotent insert-or-update keyed on `(org_id, key)`. Returns
    201 the first time the key is set, 200 on subsequent updates.
    Values are encrypted at rest. A changed value lands in a
    function only on that function's next deploy.

    Keys must match `^[A-Z_][A-Z0-9_]*$` (uppercase letters,
    digits, underscores; first character is a letter or
    underscore). Values are at most 4096 UTF-8 bytes. System-
    managed keys are reserved and rejected.

    Args:
        body (CreateOrgSecretInput): Body for POST /org/secrets.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[CreateOrgSecretResponse200 | CreateOrgSecretResponse201 | ErrorResponse]
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
    body: CreateOrgSecretInput,

) -> CreateOrgSecretResponse200 | CreateOrgSecretResponse201 | ErrorResponse | None:
    """ Create or update an org secret

     Idempotent insert-or-update keyed on `(org_id, key)`. Returns
    201 the first time the key is set, 200 on subsequent updates.
    Values are encrypted at rest. A changed value lands in a
    function only on that function's next deploy.

    Keys must match `^[A-Z_][A-Z0-9_]*$` (uppercase letters,
    digits, underscores; first character is a letter or
    underscore). Values are at most 4096 UTF-8 bytes. System-
    managed keys are reserved and rejected.

    Args:
        body (CreateOrgSecretInput): Body for POST /org/secrets.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        CreateOrgSecretResponse200 | CreateOrgSecretResponse201 | ErrorResponse
     """


    return (await asyncio_detailed(
        client=client,
body=body,

    )).parsed
