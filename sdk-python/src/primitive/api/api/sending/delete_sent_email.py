from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.delete_sent_email_response_200 import DeleteSentEmailResponse200
from ...models.error_response import ErrorResponse
from typing import cast
from uuid import UUID



def _get_kwargs(
    id: UUID,

) -> dict[str, Any]:
    

    

    

    _kwargs: dict[str, Any] = {
        "method": "delete",
        "url": "/sent-emails/{id}".format(id=quote(str(id), safe=""),),
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> DeleteSentEmailResponse200 | ErrorResponse | None:
    if response.status_code == 200:
        response_200 = DeleteSentEmailResponse200.from_dict(response.json())



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

    if response.status_code == 500:
        response_500 = ErrorResponse.from_dict(response.json())



        return response_500

    if response.status_code == 503:
        response_503 = ErrorResponse.from_dict(response.json())



        return response_503

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[DeleteSentEmailResponse200 | ErrorResponse]:
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

) -> Response[DeleteSentEmailResponse200 | ErrorResponse]:
    """ Delete a sent email

     Permanently deletes sender mailbox history and its owned attachment archive
    and transient payload. Allows delivered, bounced, agent_failed, gate_denied,
    canceled, deferred and wait_timeout; other states return 409. Cancel scheduled
    sends first. This does not recall or cancel delivery already admitted.
    Recipient copies, received replies and independent audit records are preserved.
    Occupied idempotency keys and delivered-reply deduplication remain reserved.
    Keys already released by cancellation, gate denial or a never-attempted failure
    remain reusable. Repeating a completed deletion succeeds; unknown or foreign
    IDs return 404. Organization API keys, sessions and OAuth are supported;
    Function and connected-agent credentials are denied.

    Args:
        id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[DeleteSentEmailResponse200 | ErrorResponse]
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

) -> DeleteSentEmailResponse200 | ErrorResponse | None:
    """ Delete a sent email

     Permanently deletes sender mailbox history and its owned attachment archive
    and transient payload. Allows delivered, bounced, agent_failed, gate_denied,
    canceled, deferred and wait_timeout; other states return 409. Cancel scheduled
    sends first. This does not recall or cancel delivery already admitted.
    Recipient copies, received replies and independent audit records are preserved.
    Occupied idempotency keys and delivered-reply deduplication remain reserved.
    Keys already released by cancellation, gate denial or a never-attempted failure
    remain reusable. Repeating a completed deletion succeeds; unknown or foreign
    IDs return 404. Organization API keys, sessions and OAuth are supported;
    Function and connected-agent credentials are denied.

    Args:
        id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        DeleteSentEmailResponse200 | ErrorResponse
     """


    return sync_detailed(
        id=id,
client=client,

    ).parsed

async def asyncio_detailed(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,

) -> Response[DeleteSentEmailResponse200 | ErrorResponse]:
    """ Delete a sent email

     Permanently deletes sender mailbox history and its owned attachment archive
    and transient payload. Allows delivered, bounced, agent_failed, gate_denied,
    canceled, deferred and wait_timeout; other states return 409. Cancel scheduled
    sends first. This does not recall or cancel delivery already admitted.
    Recipient copies, received replies and independent audit records are preserved.
    Occupied idempotency keys and delivered-reply deduplication remain reserved.
    Keys already released by cancellation, gate denial or a never-attempted failure
    remain reusable. Repeating a completed deletion succeeds; unknown or foreign
    IDs return 404. Organization API keys, sessions and OAuth are supported;
    Function and connected-agent credentials are denied.

    Args:
        id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[DeleteSentEmailResponse200 | ErrorResponse]
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

) -> DeleteSentEmailResponse200 | ErrorResponse | None:
    """ Delete a sent email

     Permanently deletes sender mailbox history and its owned attachment archive
    and transient payload. Allows delivered, bounced, agent_failed, gate_denied,
    canceled, deferred and wait_timeout; other states return 409. Cancel scheduled
    sends first. This does not recall or cancel delivery already admitted.
    Recipient copies, received replies and independent audit records are preserved.
    Occupied idempotency keys and delivered-reply deduplication remain reserved.
    Keys already released by cancellation, gate denial or a never-attempted failure
    remain reusable. Repeating a completed deletion succeeds; unknown or foreign
    IDs return 404. Organization API keys, sessions and OAuth are supported;
    Function and connected-agent credentials are denied.

    Args:
        id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        DeleteSentEmailResponse200 | ErrorResponse
     """


    return (await asyncio_detailed(
        id=id,
client=client,

    )).parsed
