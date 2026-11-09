from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.suspend_function_runtime_key_request import SuspendFunctionRuntimeKeyRequest
from ...models.suspend_function_runtime_key_response_200 import SuspendFunctionRuntimeKeyResponse200
from ...types import UNSET, Unset
from typing import cast
from uuid import UUID



def _get_kwargs(
    id: UUID,
    *,
    body: SuspendFunctionRuntimeKeyRequest,
    idempotency_key: str | Unset = UNSET,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}
    if not isinstance(idempotency_key, Unset):
        headers["Idempotency-Key"] = idempotency_key



    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/functions/{id}/runtime-key/suspend".format(id=quote(str(id), safe=""),),
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | SuspendFunctionRuntimeKeyResponse200 | None:
    if response.status_code == 200:
        response_200 = SuspendFunctionRuntimeKeyResponse200.from_dict(response.json())



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

    if response.status_code == 429:
        response_429 = ErrorResponse.from_dict(response.json())



        return response_429

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | SuspendFunctionRuntimeKeyResponse200]:
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
    body: SuspendFunctionRuntimeKeyRequest,
    idempotency_key: str | Unset = UNSET,

) -> Response[ErrorResponse | SuspendFunctionRuntimeKeyResponse200]:
    """ Suspend a function

     Stop the function from running by suspending its key. Its code, bindings and secrets stay stored;
    reaffirmFunctionRuntimeKey brings it back as it was. A stop an owner or admin places (suspended_by
    owner_or_admin) records their role, is lifted only in a dashboard session by someone whose role is
    at least that one (an owner's stop, only an owner), and replaces any stop but an owner's or admin's
    of at least that role, an access decision's included: keeping that decision on the waiting list then
    leaves the function stopped.

    Args:
        id (UUID):
        idempotency_key (str | Unset):
        body (SuspendFunctionRuntimeKeyRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | SuspendFunctionRuntimeKeyResponse200]
     """


    kwargs = _get_kwargs(
        id=id,
body=body,
idempotency_key=idempotency_key,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: SuspendFunctionRuntimeKeyRequest,
    idempotency_key: str | Unset = UNSET,

) -> ErrorResponse | SuspendFunctionRuntimeKeyResponse200 | None:
    """ Suspend a function

     Stop the function from running by suspending its key. Its code, bindings and secrets stay stored;
    reaffirmFunctionRuntimeKey brings it back as it was. A stop an owner or admin places (suspended_by
    owner_or_admin) records their role, is lifted only in a dashboard session by someone whose role is
    at least that one (an owner's stop, only an owner), and replaces any stop but an owner's or admin's
    of at least that role, an access decision's included: keeping that decision on the waiting list then
    leaves the function stopped.

    Args:
        id (UUID):
        idempotency_key (str | Unset):
        body (SuspendFunctionRuntimeKeyRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | SuspendFunctionRuntimeKeyResponse200
     """


    return sync_detailed(
        id=id,
client=client,
body=body,
idempotency_key=idempotency_key,

    ).parsed

async def asyncio_detailed(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: SuspendFunctionRuntimeKeyRequest,
    idempotency_key: str | Unset = UNSET,

) -> Response[ErrorResponse | SuspendFunctionRuntimeKeyResponse200]:
    """ Suspend a function

     Stop the function from running by suspending its key. Its code, bindings and secrets stay stored;
    reaffirmFunctionRuntimeKey brings it back as it was. A stop an owner or admin places (suspended_by
    owner_or_admin) records their role, is lifted only in a dashboard session by someone whose role is
    at least that one (an owner's stop, only an owner), and replaces any stop but an owner's or admin's
    of at least that role, an access decision's included: keeping that decision on the waiting list then
    leaves the function stopped.

    Args:
        id (UUID):
        idempotency_key (str | Unset):
        body (SuspendFunctionRuntimeKeyRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | SuspendFunctionRuntimeKeyResponse200]
     """


    kwargs = _get_kwargs(
        id=id,
body=body,
idempotency_key=idempotency_key,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: SuspendFunctionRuntimeKeyRequest,
    idempotency_key: str | Unset = UNSET,

) -> ErrorResponse | SuspendFunctionRuntimeKeyResponse200 | None:
    """ Suspend a function

     Stop the function from running by suspending its key. Its code, bindings and secrets stay stored;
    reaffirmFunctionRuntimeKey brings it back as it was. A stop an owner or admin places (suspended_by
    owner_or_admin) records their role, is lifted only in a dashboard session by someone whose role is
    at least that one (an owner's stop, only an owner), and replaces any stop but an owner's or admin's
    of at least that role, an access decision's included: keeping that decision on the waiting list then
    leaves the function stopped.

    Args:
        id (UUID):
        idempotency_key (str | Unset):
        body (SuspendFunctionRuntimeKeyRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | SuspendFunctionRuntimeKeyResponse200
     """


    return (await asyncio_detailed(
        id=id,
client=client,
body=body,
idempotency_key=idempotency_key,

    )).parsed
