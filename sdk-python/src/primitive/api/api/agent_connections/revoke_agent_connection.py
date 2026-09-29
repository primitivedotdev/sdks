from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.revoke_agent_connection_response_200 import RevokeAgentConnectionResponse200
from typing import cast



def _get_kwargs(
    address: str,

) -> dict[str, Any]:






    _kwargs: dict[str, Any] = {
        "method": "delete",
        "url": "/agent-connections/{address}".format(address=quote(str(address), safe=""),),
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | RevokeAgentConnectionResponse200 | None:
    if response.status_code == 200:
        response_200 = RevokeAgentConnectionResponse200.from_dict(response.json())



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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | RevokeAgentConnectionResponse200]:
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

) -> Response[ErrorResponse | RevokeAgentConnectionResponse200]:
    """ revoke Agent Connection

     Disconnect an agent and invalidate its bound credential. A current personal owner may disconnect
    their own agent; organization owners and admins may disconnect any connection. A connected agent may
    disconnect only its own exact address using its current bound credential. This preserves the
    connection record, mail, notes and domain. A current personal owner may permanently remove their own
    revoked record.

    Args:
        address (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | RevokeAgentConnectionResponse200]
     """


    kwargs = _get_kwargs(
        address=address,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    address: str,
    *,
    client: AuthenticatedClient,

) -> ErrorResponse | RevokeAgentConnectionResponse200 | None:
    """ revoke Agent Connection

     Disconnect an agent and invalidate its bound credential. A current personal owner may disconnect
    their own agent; organization owners and admins may disconnect any connection. A connected agent may
    disconnect only its own exact address using its current bound credential. This preserves the
    connection record, mail, notes and domain. A current personal owner may permanently remove their own
    revoked record.

    Args:
        address (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | RevokeAgentConnectionResponse200
     """


    return sync_detailed(
        address=address,
client=client,

    ).parsed

async def asyncio_detailed(
    address: str,
    *,
    client: AuthenticatedClient,

) -> Response[ErrorResponse | RevokeAgentConnectionResponse200]:
    """ revoke Agent Connection

     Disconnect an agent and invalidate its bound credential. A current personal owner may disconnect
    their own agent; organization owners and admins may disconnect any connection. A connected agent may
    disconnect only its own exact address using its current bound credential. This preserves the
    connection record, mail, notes and domain. A current personal owner may permanently remove their own
    revoked record.

    Args:
        address (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | RevokeAgentConnectionResponse200]
     """


    kwargs = _get_kwargs(
        address=address,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    address: str,
    *,
    client: AuthenticatedClient,

) -> ErrorResponse | RevokeAgentConnectionResponse200 | None:
    """ revoke Agent Connection

     Disconnect an agent and invalidate its bound credential. A current personal owner may disconnect
    their own agent; organization owners and admins may disconnect any connection. A connected agent may
    disconnect only its own exact address using its current bound credential. This preserves the
    connection record, mail, notes and domain. A current personal owner may permanently remove their own
    revoked record.

    Args:
        address (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | RevokeAgentConnectionResponse200
     """


    return (await asyncio_detailed(
        address=address,
client=client,

    )).parsed
