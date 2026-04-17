from __future__ import annotations

from http import HTTPStatus
from io import BytesIO
from uuid import UUID

import httpx

from .client import AuthenticatedClient, Client
from .errors import UnexpectedStatus
from .models.error_response import ErrorResponse
from .types import UNSET, File, Response, Unset


def _request_kwargs(id: UUID, token: str | Unset = UNSET) -> tuple[str, dict[str, str]]:
    params: dict[str, str] = {}
    if token is not UNSET:
        params["token"] = str(token)
    return f"/emails/{id}", params


def _parse_download_response(
    client: AuthenticatedClient | Client,
    response: httpx.Response,
) -> ErrorResponse | File | None:
    if response.status_code == 200:
        return File(payload=BytesIO(response.content))

    if response.status_code == 401:
        return ErrorResponse.from_dict(response.json())

    if response.status_code == 404:
        return ErrorResponse.from_dict(response.json())

    if client.raise_on_unexpected_status:
        raise UnexpectedStatus(response.status_code, response.content)

    return None


def _build_response(
    client: AuthenticatedClient | Client,
    response: httpx.Response,
) -> Response[ErrorResponse | File]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_download_response(client, response),
    )


def download_raw_email_detailed(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    token: str | Unset = UNSET,
) -> Response[ErrorResponse | File]:
    url, params = _request_kwargs(id, token)
    response = client.get_httpx_client().request("get", f"{url}/raw", params=params)
    return _build_response(client, response)


def download_raw_email(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    token: str | Unset = UNSET,
) -> ErrorResponse | File | None:
    return download_raw_email_detailed(id, client=client, token=token).parsed


async def adownload_raw_email_detailed(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    token: str | Unset = UNSET,
) -> Response[ErrorResponse | File]:
    url, params = _request_kwargs(id, token)
    response = await client.get_async_httpx_client().request(
        "get",
        f"{url}/raw",
        params=params,
    )
    return _build_response(client, response)


async def adownload_raw_email(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    token: str | Unset = UNSET,
) -> ErrorResponse | File | None:
    return (await adownload_raw_email_detailed(id, client=client, token=token)).parsed


def download_attachments_detailed(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    token: str | Unset = UNSET,
) -> Response[ErrorResponse | File]:
    url, params = _request_kwargs(id, token)
    response = client.get_httpx_client().request(
        "get",
        f"{url}/attachments.tar.gz",
        params=params,
    )
    return _build_response(client, response)


def download_attachments(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    token: str | Unset = UNSET,
) -> ErrorResponse | File | None:
    return download_attachments_detailed(id, client=client, token=token).parsed


async def adownload_attachments_detailed(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    token: str | Unset = UNSET,
) -> Response[ErrorResponse | File]:
    url, params = _request_kwargs(id, token)
    response = await client.get_async_httpx_client().request(
        "get",
        f"{url}/attachments.tar.gz",
        params=params,
    )
    return _build_response(client, response)


async def adownload_attachments(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    token: str | Unset = UNSET,
) -> ErrorResponse | File | None:
    return (await adownload_attachments_detailed(id, client=client, token=token)).parsed
