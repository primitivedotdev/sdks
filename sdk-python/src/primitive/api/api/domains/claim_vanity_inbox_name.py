from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.claim_vanity_inbox_name_request import ClaimVanityInboxNameRequest
from ...models.claim_vanity_inbox_name_response_201 import ClaimVanityInboxNameResponse201
from ...models.error_response import ErrorResponse
from ...types import UNSET, Unset
from typing import cast



def _get_kwargs(
    *,
    body: ClaimVanityInboxNameRequest,
    idempotency_key: str | Unset = UNSET,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}
    if not isinstance(idempotency_key, Unset):
        headers["Idempotency-Key"] = idempotency_key



    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/managed-inbox/vanity",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ClaimVanityInboxNameResponse201 | ErrorResponse | None:
    if response.status_code == 201:
        response_201 = ClaimVanityInboxNameResponse201.from_dict(response.json())



        return response_201

    if response.status_code == 400:
        response_400 = ErrorResponse.from_dict(response.json())



        return response_400

    if response.status_code == 401:
        response_401 = ErrorResponse.from_dict(response.json())



        return response_401

    if response.status_code == 402:
        response_402 = ErrorResponse.from_dict(response.json())



        return response_402

    if response.status_code == 403:
        response_403 = ErrorResponse.from_dict(response.json())



        return response_403

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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ClaimVanityInboxNameResponse201 | ErrorResponse]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: ClaimVanityInboxNameRequest,
    idempotency_key: str | Unset = UNSET,

) -> Response[ClaimVanityInboxNameResponse201 | ErrorResponse]:
    """ Claim a vanity inbox name

     Make the name the organization's current managed inbox. The previous inbox stops being current but
    keeps receiving mail. Needs the Power plan and domains:manage, which a credential confined to some
    mailboxes never holds. Sending records are published in the same request when they can be.
    outbound_ready false means they could not be yet: mail to the new name still arrives, but sending
    from it is refused until they are published.

    Args:
        idempotency_key (str | Unset):
        body (ClaimVanityInboxNameRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ClaimVanityInboxNameResponse201 | ErrorResponse]
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
    body: ClaimVanityInboxNameRequest,
    idempotency_key: str | Unset = UNSET,

) -> ClaimVanityInboxNameResponse201 | ErrorResponse | None:
    """ Claim a vanity inbox name

     Make the name the organization's current managed inbox. The previous inbox stops being current but
    keeps receiving mail. Needs the Power plan and domains:manage, which a credential confined to some
    mailboxes never holds. Sending records are published in the same request when they can be.
    outbound_ready false means they could not be yet: mail to the new name still arrives, but sending
    from it is refused until they are published.

    Args:
        idempotency_key (str | Unset):
        body (ClaimVanityInboxNameRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ClaimVanityInboxNameResponse201 | ErrorResponse
     """


    return sync_detailed(
        client=client,
body=body,
idempotency_key=idempotency_key,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: ClaimVanityInboxNameRequest,
    idempotency_key: str | Unset = UNSET,

) -> Response[ClaimVanityInboxNameResponse201 | ErrorResponse]:
    """ Claim a vanity inbox name

     Make the name the organization's current managed inbox. The previous inbox stops being current but
    keeps receiving mail. Needs the Power plan and domains:manage, which a credential confined to some
    mailboxes never holds. Sending records are published in the same request when they can be.
    outbound_ready false means they could not be yet: mail to the new name still arrives, but sending
    from it is refused until they are published.

    Args:
        idempotency_key (str | Unset):
        body (ClaimVanityInboxNameRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ClaimVanityInboxNameResponse201 | ErrorResponse]
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
    body: ClaimVanityInboxNameRequest,
    idempotency_key: str | Unset = UNSET,

) -> ClaimVanityInboxNameResponse201 | ErrorResponse | None:
    """ Claim a vanity inbox name

     Make the name the organization's current managed inbox. The previous inbox stops being current but
    keeps receiving mail. Needs the Power plan and domains:manage, which a credential confined to some
    mailboxes never holds. Sending records are published in the same request when they can be.
    outbound_ready false means they could not be yet: mail to the new name still arrives, but sending
    from it is refused until they are published.

    Args:
        idempotency_key (str | Unset):
        body (ClaimVanityInboxNameRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ClaimVanityInboxNameResponse201 | ErrorResponse
     """


    return (await asyncio_detailed(
        client=client,
body=body,
idempotency_key=idempotency_key,

    )).parsed
