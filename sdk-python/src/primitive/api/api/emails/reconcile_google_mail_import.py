from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.reconcile_google_mail_import_request import ReconcileGoogleMailImportRequest
from ...models.reconcile_google_mail_import_response_200 import ReconcileGoogleMailImportResponse200
from ...types import UNSET, Unset
from typing import cast



def _get_kwargs(
    *,
    body: ReconcileGoogleMailImportRequest,
    idempotency_key: str | Unset = UNSET,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}
    if not isinstance(idempotency_key, Unset):
        headers["Idempotency-Key"] = idempotency_key



    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/mail-imports/google/reconcile",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | ReconcileGoogleMailImportResponse200 | None:
    if response.status_code == 200:
        response_200 = ReconcileGoogleMailImportResponse200.from_dict(response.json())



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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | ReconcileGoogleMailImportResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: ReconcileGoogleMailImportRequest,
    idempotency_key: str | Unset = UNSET,

) -> Response[ErrorResponse | ReconcileGoogleMailImportResponse200]:
    """ Reconcile scoped historical import attempts

     The same configured owner may recover expired attempts after the email_import entitlement is
    revoked. Recovery does not require that entitlement. Selects only server-owned manifests for the
    configured mailbox/account/policy. No provider token, object keys, prefixes or email IDs are
    accepted. Unsettled uploads remain unresolved and charged; this operation does not promise automatic
    cleanup after a process dies.

    Args:
        idempotency_key (str | Unset):
        body (ReconcileGoogleMailImportRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ReconcileGoogleMailImportResponse200]
     """


    kwargs = _get_kwargs(
        body=body,
idempotency_key=idempotency_key,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    *,
    client: AuthenticatedClient | Client,
    body: ReconcileGoogleMailImportRequest,
    idempotency_key: str | Unset = UNSET,

) -> ErrorResponse | ReconcileGoogleMailImportResponse200 | None:
    """ Reconcile scoped historical import attempts

     The same configured owner may recover expired attempts after the email_import entitlement is
    revoked. Recovery does not require that entitlement. Selects only server-owned manifests for the
    configured mailbox/account/policy. No provider token, object keys, prefixes or email IDs are
    accepted. Unsettled uploads remain unresolved and charged; this operation does not promise automatic
    cleanup after a process dies.

    Args:
        idempotency_key (str | Unset):
        body (ReconcileGoogleMailImportRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ReconcileGoogleMailImportResponse200
     """


    return sync_detailed(
        client=client,
body=body,
idempotency_key=idempotency_key,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: ReconcileGoogleMailImportRequest,
    idempotency_key: str | Unset = UNSET,

) -> Response[ErrorResponse | ReconcileGoogleMailImportResponse200]:
    """ Reconcile scoped historical import attempts

     The same configured owner may recover expired attempts after the email_import entitlement is
    revoked. Recovery does not require that entitlement. Selects only server-owned manifests for the
    configured mailbox/account/policy. No provider token, object keys, prefixes or email IDs are
    accepted. Unsettled uploads remain unresolved and charged; this operation does not promise automatic
    cleanup after a process dies.

    Args:
        idempotency_key (str | Unset):
        body (ReconcileGoogleMailImportRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ReconcileGoogleMailImportResponse200]
     """


    kwargs = _get_kwargs(
        body=body,
idempotency_key=idempotency_key,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    body: ReconcileGoogleMailImportRequest,
    idempotency_key: str | Unset = UNSET,

) -> ErrorResponse | ReconcileGoogleMailImportResponse200 | None:
    """ Reconcile scoped historical import attempts

     The same configured owner may recover expired attempts after the email_import entitlement is
    revoked. Recovery does not require that entitlement. Selects only server-owned manifests for the
    configured mailbox/account/policy. No provider token, object keys, prefixes or email IDs are
    accepted. Unsettled uploads remain unresolved and charged; this operation does not promise automatic
    cleanup after a process dies.

    Args:
        idempotency_key (str | Unset):
        body (ReconcileGoogleMailImportRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ReconcileGoogleMailImportResponse200
     """


    return (await asyncio_detailed(
        client=client,
body=body,
idempotency_key=idempotency_key,

    )).parsed
