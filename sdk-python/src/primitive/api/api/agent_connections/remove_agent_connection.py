from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.remove_agent_connection_response_200 import RemoveAgentConnectionResponse200
from ...types import UNSET, Unset
from typing import cast



def _get_kwargs(
    address: str,
    *,
    idempotency_key: str | Unset = UNSET,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}
    if not isinstance(idempotency_key, Unset):
        headers["Idempotency-Key"] = idempotency_key







    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/agent-connections/{address}/remove".format(address=quote(str(address), safe=""),),
    }


    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | RemoveAgentConnectionResponse200 | None:
    if response.status_code == 200:
        response_200 = RemoveAgentConnectionResponse200.from_dict(response.json())



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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | RemoveAgentConnectionResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    address: str,
    *,
    client: AuthenticatedClient,
    idempotency_key: str | Unset = UNSET,

) -> Response[ErrorResponse | RemoveAgentConnectionResponse200]:
    """ remove Agent Connection

     Permanently remove a revoked connection record. A current personal owner may permanently remove
    their own record; organization owners and admins may remove any record. Disconnect first using
    revokeAgentConnection; an active connection returns 409 connection_not_revoked. Missing or already
    removed records return 404. Mail, address notes, domains and external runtimes are preserved. The
    same address can be paired again with a new invitation; old credentials and invitations remain
    invalid.

    Args:
        address (str):
        idempotency_key (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | RemoveAgentConnectionResponse200]
     """


    kwargs = _get_kwargs(
        address=address,
idempotency_key=idempotency_key,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    address: str,
    *,
    client: AuthenticatedClient,
    idempotency_key: str | Unset = UNSET,

) -> ErrorResponse | RemoveAgentConnectionResponse200 | None:
    """ remove Agent Connection

     Permanently remove a revoked connection record. A current personal owner may permanently remove
    their own record; organization owners and admins may remove any record. Disconnect first using
    revokeAgentConnection; an active connection returns 409 connection_not_revoked. Missing or already
    removed records return 404. Mail, address notes, domains and external runtimes are preserved. The
    same address can be paired again with a new invitation; old credentials and invitations remain
    invalid.

    Args:
        address (str):
        idempotency_key (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | RemoveAgentConnectionResponse200
     """


    return sync_detailed(
        address=address,
client=client,
idempotency_key=idempotency_key,

    ).parsed

async def asyncio_detailed(
    address: str,
    *,
    client: AuthenticatedClient,
    idempotency_key: str | Unset = UNSET,

) -> Response[ErrorResponse | RemoveAgentConnectionResponse200]:
    """ remove Agent Connection

     Permanently remove a revoked connection record. A current personal owner may permanently remove
    their own record; organization owners and admins may remove any record. Disconnect first using
    revokeAgentConnection; an active connection returns 409 connection_not_revoked. Missing or already
    removed records return 404. Mail, address notes, domains and external runtimes are preserved. The
    same address can be paired again with a new invitation; old credentials and invitations remain
    invalid.

    Args:
        address (str):
        idempotency_key (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | RemoveAgentConnectionResponse200]
     """


    kwargs = _get_kwargs(
        address=address,
idempotency_key=idempotency_key,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    address: str,
    *,
    client: AuthenticatedClient,
    idempotency_key: str | Unset = UNSET,

) -> ErrorResponse | RemoveAgentConnectionResponse200 | None:
    """ remove Agent Connection

     Permanently remove a revoked connection record. A current personal owner may permanently remove
    their own record; organization owners and admins may remove any record. Disconnect first using
    revokeAgentConnection; an active connection returns 409 connection_not_revoked. Missing or already
    removed records return 404. Mail, address notes, domains and external runtimes are preserved. The
    same address can be paired again with a new invitation; old credentials and invitations remain
    invalid.

    Args:
        address (str):
        idempotency_key (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | RemoveAgentConnectionResponse200
     """


    return (await asyncio_detailed(
        address=address,
client=client,
idempotency_key=idempotency_key,

    )).parsed
