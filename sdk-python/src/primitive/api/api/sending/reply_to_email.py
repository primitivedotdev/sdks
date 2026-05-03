from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.reply_input import ReplyInput
from ...models.reply_to_email_response_200 import ReplyToEmailResponse200
from typing import cast
from uuid import UUID



def _get_kwargs(
    id: UUID,
    *,
    body: ReplyInput,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/emails/{id}/reply".format(id=quote(str(id), safe=""),),
    }

    _kwargs["json"] = body.to_dict()


    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | ReplyToEmailResponse200 | None:
    if response.status_code == 200:
        response_200 = ReplyToEmailResponse200.from_dict(response.json())



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

    if response.status_code == 422:
        response_422 = ErrorResponse.from_dict(response.json())



        return response_422

    if response.status_code == 429:
        response_429 = ErrorResponse.from_dict(response.json())



        return response_429

    if response.status_code == 500:
        response_500 = ErrorResponse.from_dict(response.json())



        return response_500

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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | ReplyToEmailResponse200]:
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
    body: ReplyInput,

) -> Response[ErrorResponse | ReplyToEmailResponse200]:
    """ Reply to an inbound email

     Sends an outbound reply to the inbound email identified by `id`.
    Threading headers (`In-Reply-To`, `References`), recipient
    derivation (Reply-To, then From, then bare sender), and the
    `Re:` subject prefix are all derived server-side from the
    stored inbound row. The request body carries only the message
    body and optional `wait` flag; passing any header or recipient
    override is rejected by the schema (`additionalProperties:
    false`).

    Forwards through the same gates as `/send-mail`: the response
    status, error envelope, and `idempotent_replay` flag mirror
    the send-mail contract verbatim.

    Args:
        id (UUID):
        body (ReplyInput): Body shape for `/emails/{id}/reply`. Intentionally narrow:
            recipients (`to`), subject, and threading headers
            (`in_reply_to`, `references`) are derived server-side from
            the inbound row referenced by the path id and are rejected by
            `additionalProperties` if passed (returns 400).

            `from` IS allowed because of legitimate use cases (display-name
            addition, replying from a different verified outbound address,
            multi-team triage). Send-mail's per-send `canSendFrom` gate
            validates the from-domain regardless, so the override carries
            no extra privilege.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ReplyToEmailResponse200]
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
    body: ReplyInput,

) -> ErrorResponse | ReplyToEmailResponse200 | None:
    """ Reply to an inbound email

     Sends an outbound reply to the inbound email identified by `id`.
    Threading headers (`In-Reply-To`, `References`), recipient
    derivation (Reply-To, then From, then bare sender), and the
    `Re:` subject prefix are all derived server-side from the
    stored inbound row. The request body carries only the message
    body and optional `wait` flag; passing any header or recipient
    override is rejected by the schema (`additionalProperties:
    false`).

    Forwards through the same gates as `/send-mail`: the response
    status, error envelope, and `idempotent_replay` flag mirror
    the send-mail contract verbatim.

    Args:
        id (UUID):
        body (ReplyInput): Body shape for `/emails/{id}/reply`. Intentionally narrow:
            recipients (`to`), subject, and threading headers
            (`in_reply_to`, `references`) are derived server-side from
            the inbound row referenced by the path id and are rejected by
            `additionalProperties` if passed (returns 400).

            `from` IS allowed because of legitimate use cases (display-name
            addition, replying from a different verified outbound address,
            multi-team triage). Send-mail's per-send `canSendFrom` gate
            validates the from-domain regardless, so the override carries
            no extra privilege.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ReplyToEmailResponse200
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
    body: ReplyInput,

) -> Response[ErrorResponse | ReplyToEmailResponse200]:
    """ Reply to an inbound email

     Sends an outbound reply to the inbound email identified by `id`.
    Threading headers (`In-Reply-To`, `References`), recipient
    derivation (Reply-To, then From, then bare sender), and the
    `Re:` subject prefix are all derived server-side from the
    stored inbound row. The request body carries only the message
    body and optional `wait` flag; passing any header or recipient
    override is rejected by the schema (`additionalProperties:
    false`).

    Forwards through the same gates as `/send-mail`: the response
    status, error envelope, and `idempotent_replay` flag mirror
    the send-mail contract verbatim.

    Args:
        id (UUID):
        body (ReplyInput): Body shape for `/emails/{id}/reply`. Intentionally narrow:
            recipients (`to`), subject, and threading headers
            (`in_reply_to`, `references`) are derived server-side from
            the inbound row referenced by the path id and are rejected by
            `additionalProperties` if passed (returns 400).

            `from` IS allowed because of legitimate use cases (display-name
            addition, replying from a different verified outbound address,
            multi-team triage). Send-mail's per-send `canSendFrom` gate
            validates the from-domain regardless, so the override carries
            no extra privilege.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ReplyToEmailResponse200]
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
    body: ReplyInput,

) -> ErrorResponse | ReplyToEmailResponse200 | None:
    """ Reply to an inbound email

     Sends an outbound reply to the inbound email identified by `id`.
    Threading headers (`In-Reply-To`, `References`), recipient
    derivation (Reply-To, then From, then bare sender), and the
    `Re:` subject prefix are all derived server-side from the
    stored inbound row. The request body carries only the message
    body and optional `wait` flag; passing any header or recipient
    override is rejected by the schema (`additionalProperties:
    false`).

    Forwards through the same gates as `/send-mail`: the response
    status, error envelope, and `idempotent_replay` flag mirror
    the send-mail contract verbatim.

    Args:
        id (UUID):
        body (ReplyInput): Body shape for `/emails/{id}/reply`. Intentionally narrow:
            recipients (`to`), subject, and threading headers
            (`in_reply_to`, `references`) are derived server-side from
            the inbound row referenced by the path id and are rejected by
            `additionalProperties` if passed (returns 400).

            `from` IS allowed because of legitimate use cases (display-name
            addition, replying from a different verified outbound address,
            multi-team triage). Send-mail's per-send `canSendFrom` gate
            validates the from-domain regardless, so the override carries
            no extra privilege.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ReplyToEmailResponse200
     """


    return (await asyncio_detailed(
        id=id,
client=client,
body=body,

    )).parsed
