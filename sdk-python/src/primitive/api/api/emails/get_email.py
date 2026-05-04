from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.get_email_response_200 import GetEmailResponse200
from typing import cast
from uuid import UUID



def _get_kwargs(
    id: UUID,

) -> dict[str, Any]:
    

    

    

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/emails/{id}".format(id=quote(str(id), safe=""),),
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | GetEmailResponse200 | None:
    if response.status_code == 200:
        response_200 = GetEmailResponse200.from_dict(response.json())



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

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | GetEmailResponse200]:
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

) -> Response[ErrorResponse | GetEmailResponse200]:
    r""" Get inbound email by id

     Returns the full record for an inbound email received at one
    of your verified domains, including the parsed text and HTML
    bodies, threading metadata, SMTP envelope detail, webhook
    delivery state, and a `replies` array for any outbound sends
    recorded as replies to this inbound.

    For listing inbound emails (with cursor pagination, status
    and date filters, and free-text search), use
    `/emails`. Outbound (sent) email records are NOT returned
    here; use `/sent-emails/{id}` for those.

    The response carries four sender-shaped fields whose
    meanings overlap. `from_email` is the canonical \"who sent
    this\" field for most use cases (parsed bare address from
    the `From:` header, with a `sender` fallback). `from_header`
    is the raw header including any display name. `sender` and
    `smtp_mail_from` both carry the SMTP envelope MAIL FROM
    (return-path) and are equal by construction; `sender` is
    the older field name retained for compatibility. See
    `primitive describe emails:get-email | jq '.responseSchema.properties'`
    for per-field detail.

    Args:
        id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | GetEmailResponse200]
     """


    kwargs = _get_kwargs(
        id=id,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,

) -> ErrorResponse | GetEmailResponse200 | None:
    r""" Get inbound email by id

     Returns the full record for an inbound email received at one
    of your verified domains, including the parsed text and HTML
    bodies, threading metadata, SMTP envelope detail, webhook
    delivery state, and a `replies` array for any outbound sends
    recorded as replies to this inbound.

    For listing inbound emails (with cursor pagination, status
    and date filters, and free-text search), use
    `/emails`. Outbound (sent) email records are NOT returned
    here; use `/sent-emails/{id}` for those.

    The response carries four sender-shaped fields whose
    meanings overlap. `from_email` is the canonical \"who sent
    this\" field for most use cases (parsed bare address from
    the `From:` header, with a `sender` fallback). `from_header`
    is the raw header including any display name. `sender` and
    `smtp_mail_from` both carry the SMTP envelope MAIL FROM
    (return-path) and are equal by construction; `sender` is
    the older field name retained for compatibility. See
    `primitive describe emails:get-email | jq '.responseSchema.properties'`
    for per-field detail.

    Args:
        id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | GetEmailResponse200
     """


    return sync_detailed(
        id=id,
client=client,

    ).parsed

async def asyncio_detailed(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,

) -> Response[ErrorResponse | GetEmailResponse200]:
    r""" Get inbound email by id

     Returns the full record for an inbound email received at one
    of your verified domains, including the parsed text and HTML
    bodies, threading metadata, SMTP envelope detail, webhook
    delivery state, and a `replies` array for any outbound sends
    recorded as replies to this inbound.

    For listing inbound emails (with cursor pagination, status
    and date filters, and free-text search), use
    `/emails`. Outbound (sent) email records are NOT returned
    here; use `/sent-emails/{id}` for those.

    The response carries four sender-shaped fields whose
    meanings overlap. `from_email` is the canonical \"who sent
    this\" field for most use cases (parsed bare address from
    the `From:` header, with a `sender` fallback). `from_header`
    is the raw header including any display name. `sender` and
    `smtp_mail_from` both carry the SMTP envelope MAIL FROM
    (return-path) and are equal by construction; `sender` is
    the older field name retained for compatibility. See
    `primitive describe emails:get-email | jq '.responseSchema.properties'`
    for per-field detail.

    Args:
        id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | GetEmailResponse200]
     """


    kwargs = _get_kwargs(
        id=id,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,

) -> ErrorResponse | GetEmailResponse200 | None:
    r""" Get inbound email by id

     Returns the full record for an inbound email received at one
    of your verified domains, including the parsed text and HTML
    bodies, threading metadata, SMTP envelope detail, webhook
    delivery state, and a `replies` array for any outbound sends
    recorded as replies to this inbound.

    For listing inbound emails (with cursor pagination, status
    and date filters, and free-text search), use
    `/emails`. Outbound (sent) email records are NOT returned
    here; use `/sent-emails/{id}` for those.

    The response carries four sender-shaped fields whose
    meanings overlap. `from_email` is the canonical \"who sent
    this\" field for most use cases (parsed bare address from
    the `From:` header, with a `sender` fallback). `from_header`
    is the raw header including any display name. `sender` and
    `smtp_mail_from` both carry the SMTP envelope MAIL FROM
    (return-path) and are equal by construction; `sender` is
    the older field name retained for compatibility. See
    `primitive describe emails:get-email | jq '.responseSchema.properties'`
    for per-field detail.

    Args:
        id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | GetEmailResponse200
     """


    return (await asyncio_detailed(
        id=id,
client=client,

    )).parsed
