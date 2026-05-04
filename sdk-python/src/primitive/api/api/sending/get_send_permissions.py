from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.get_send_permissions_response_200 import GetSendPermissionsResponse200
from typing import cast



def _get_kwargs(
    
) -> dict[str, Any]:
    

    

    

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/send-permissions",
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | GetSendPermissionsResponse200 | None:
    if response.status_code == 200:
        response_200 = GetSendPermissionsResponse200.from_dict(response.json())



        return response_200

    if response.status_code == 401:
        response_401 = ErrorResponse.from_dict(response.json())



        return response_401

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | GetSendPermissionsResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,

) -> Response[ErrorResponse | GetSendPermissionsResponse200]:
    r""" List send-permission rules

     Returns a flat list of rules describing every recipient the
    caller may send to. Each rule has a `type`, a kind-specific
    payload, and a human-readable `description`. If any rule
    matches the recipient, /send-mail will accept the send under
    the recipient-scope check.

    The endpoint is the answer to \"where can I send\" without
    exposing internal entitlement names. Agents that don't
    recognize a `type` can still read the `description` prose
    and act on it.

    Rule kinds, ordered broadest-first so an agent can stop
    scanning at the first match:

      1. `any_recipient` (one entry, only when the org can send
         anywhere): every other rule below it is redundant.
      2. `managed_zone` (always emitted, one per Primitive-managed
         zone): sends to any address at *.primitive.email or
         *.email.works always succeed; no entitlement required.
      3. `your_domain` (one per active verified outbound domain
         owned by the org): sends to that domain are approved.
      4. `address` (one per address that has authenticated
         inbound mail to the org, capped at `meta.address_cap`):
         sends to that exact address are approved.

    The list is informational, not an authorization check.
    /send-mail remains the source of truth on whether an
    individual send will succeed (it also enforces the
    from-address and the `send_mail` entitlement, which are
    not recipient-scope concerns and are not represented here).

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | GetSendPermissionsResponse200]
     """


    kwargs = _get_kwargs(
        
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    *,
    client: AuthenticatedClient | Client,

) -> ErrorResponse | GetSendPermissionsResponse200 | None:
    r""" List send-permission rules

     Returns a flat list of rules describing every recipient the
    caller may send to. Each rule has a `type`, a kind-specific
    payload, and a human-readable `description`. If any rule
    matches the recipient, /send-mail will accept the send under
    the recipient-scope check.

    The endpoint is the answer to \"where can I send\" without
    exposing internal entitlement names. Agents that don't
    recognize a `type` can still read the `description` prose
    and act on it.

    Rule kinds, ordered broadest-first so an agent can stop
    scanning at the first match:

      1. `any_recipient` (one entry, only when the org can send
         anywhere): every other rule below it is redundant.
      2. `managed_zone` (always emitted, one per Primitive-managed
         zone): sends to any address at *.primitive.email or
         *.email.works always succeed; no entitlement required.
      3. `your_domain` (one per active verified outbound domain
         owned by the org): sends to that domain are approved.
      4. `address` (one per address that has authenticated
         inbound mail to the org, capped at `meta.address_cap`):
         sends to that exact address are approved.

    The list is informational, not an authorization check.
    /send-mail remains the source of truth on whether an
    individual send will succeed (it also enforces the
    from-address and the `send_mail` entitlement, which are
    not recipient-scope concerns and are not represented here).

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | GetSendPermissionsResponse200
     """


    return sync_detailed(
        client=client,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,

) -> Response[ErrorResponse | GetSendPermissionsResponse200]:
    r""" List send-permission rules

     Returns a flat list of rules describing every recipient the
    caller may send to. Each rule has a `type`, a kind-specific
    payload, and a human-readable `description`. If any rule
    matches the recipient, /send-mail will accept the send under
    the recipient-scope check.

    The endpoint is the answer to \"where can I send\" without
    exposing internal entitlement names. Agents that don't
    recognize a `type` can still read the `description` prose
    and act on it.

    Rule kinds, ordered broadest-first so an agent can stop
    scanning at the first match:

      1. `any_recipient` (one entry, only when the org can send
         anywhere): every other rule below it is redundant.
      2. `managed_zone` (always emitted, one per Primitive-managed
         zone): sends to any address at *.primitive.email or
         *.email.works always succeed; no entitlement required.
      3. `your_domain` (one per active verified outbound domain
         owned by the org): sends to that domain are approved.
      4. `address` (one per address that has authenticated
         inbound mail to the org, capped at `meta.address_cap`):
         sends to that exact address are approved.

    The list is informational, not an authorization check.
    /send-mail remains the source of truth on whether an
    individual send will succeed (it also enforces the
    from-address and the `send_mail` entitlement, which are
    not recipient-scope concerns and are not represented here).

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | GetSendPermissionsResponse200]
     """


    kwargs = _get_kwargs(
        
    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    *,
    client: AuthenticatedClient | Client,

) -> ErrorResponse | GetSendPermissionsResponse200 | None:
    r""" List send-permission rules

     Returns a flat list of rules describing every recipient the
    caller may send to. Each rule has a `type`, a kind-specific
    payload, and a human-readable `description`. If any rule
    matches the recipient, /send-mail will accept the send under
    the recipient-scope check.

    The endpoint is the answer to \"where can I send\" without
    exposing internal entitlement names. Agents that don't
    recognize a `type` can still read the `description` prose
    and act on it.

    Rule kinds, ordered broadest-first so an agent can stop
    scanning at the first match:

      1. `any_recipient` (one entry, only when the org can send
         anywhere): every other rule below it is redundant.
      2. `managed_zone` (always emitted, one per Primitive-managed
         zone): sends to any address at *.primitive.email or
         *.email.works always succeed; no entitlement required.
      3. `your_domain` (one per active verified outbound domain
         owned by the org): sends to that domain are approved.
      4. `address` (one per address that has authenticated
         inbound mail to the org, capped at `meta.address_cap`):
         sends to that exact address are approved.

    The list is informational, not an authorization check.
    /send-mail remains the source of truth on whether an
    individual send will succeed (it also enforces the
    from-address and the `send_mail` entitlement, which are
    not recipient-scope concerns and are not represented here).

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | GetSendPermissionsResponse200
     """


    return (await asyncio_detailed(
        client=client,

    )).parsed
