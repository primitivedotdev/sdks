from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.release_sent_email_body import ReleaseSentEmailBody
from ...models.release_sent_email_response_200 import ReleaseSentEmailResponse200
from ...types import UNSET, Unset
from typing import cast
from uuid import UUID



def _get_kwargs(
    id: UUID,
    *,
    body: ReleaseSentEmailBody | Unset = UNSET,
    idempotency_key: str | Unset = UNSET,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}
    if not isinstance(idempotency_key, Unset):
        headers["Idempotency-Key"] = idempotency_key



    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/sent-emails/{id}/release".format(id=quote(str(id), safe=""),),
    }

    
    if not isinstance(body, Unset):
        _kwargs["json"] = body.to_dict()
        headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | ReleaseSentEmailResponse200 | None:
    if response.status_code == 200:
        response_200 = ReleaseSentEmailResponse200.from_dict(response.json())



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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | ReleaseSentEmailResponse200]:
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
    body: ReleaseSentEmailBody | Unset = UNSET,
    idempotency_key: str | Unset = UNSET,

) -> Response[ErrorResponse | ReleaseSentEmailResponse200]:
    """ Release a held scheduled send

     Releases a held scheduled send (it carries `hold`) back to its schedule, as the releasing person's.
    For owners, admins and the person whose grant scheduled it; not API keys. More than an hour past its
    time it needs a new `scheduled_at` (else 409 scheduled_at_required); a send that is not held gets
    409 not_held.

    Args:
        id (UUID):
        idempotency_key (str | Unset):
        body (ReleaseSentEmailBody | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ReleaseSentEmailResponse200]
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
    body: ReleaseSentEmailBody | Unset = UNSET,
    idempotency_key: str | Unset = UNSET,

) -> ErrorResponse | ReleaseSentEmailResponse200 | None:
    """ Release a held scheduled send

     Releases a held scheduled send (it carries `hold`) back to its schedule, as the releasing person's.
    For owners, admins and the person whose grant scheduled it; not API keys. More than an hour past its
    time it needs a new `scheduled_at` (else 409 scheduled_at_required); a send that is not held gets
    409 not_held.

    Args:
        id (UUID):
        idempotency_key (str | Unset):
        body (ReleaseSentEmailBody | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ReleaseSentEmailResponse200
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
    body: ReleaseSentEmailBody | Unset = UNSET,
    idempotency_key: str | Unset = UNSET,

) -> Response[ErrorResponse | ReleaseSentEmailResponse200]:
    """ Release a held scheduled send

     Releases a held scheduled send (it carries `hold`) back to its schedule, as the releasing person's.
    For owners, admins and the person whose grant scheduled it; not API keys. More than an hour past its
    time it needs a new `scheduled_at` (else 409 scheduled_at_required); a send that is not held gets
    409 not_held.

    Args:
        id (UUID):
        idempotency_key (str | Unset):
        body (ReleaseSentEmailBody | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ReleaseSentEmailResponse200]
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
    body: ReleaseSentEmailBody | Unset = UNSET,
    idempotency_key: str | Unset = UNSET,

) -> ErrorResponse | ReleaseSentEmailResponse200 | None:
    """ Release a held scheduled send

     Releases a held scheduled send (it carries `hold`) back to its schedule, as the releasing person's.
    For owners, admins and the person whose grant scheduled it; not API keys. More than an hour past its
    time it needs a new `scheduled_at` (else 409 scheduled_at_required); a send that is not held gets
    409 not_held.

    Args:
        id (UUID):
        idempotency_key (str | Unset):
        body (ReleaseSentEmailBody | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ReleaseSentEmailResponse200
     """


    return (await asyncio_detailed(
        id=id,
client=client,
body=body,
idempotency_key=idempotency_key,

    )).parsed
