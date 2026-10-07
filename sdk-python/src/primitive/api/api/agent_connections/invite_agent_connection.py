from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.invite_agent_connection_body import InviteAgentConnectionBody
from ...models.invite_agent_connection_response_200 import InviteAgentConnectionResponse200
from ...types import UNSET, Unset
from typing import cast



def _get_kwargs(
    address: str,
    *,
    body: InviteAgentConnectionBody,
    idempotency_key: str | Unset = UNSET,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}
    if not isinstance(idempotency_key, Unset):
        headers["Idempotency-Key"] = idempotency_key







    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/agent-connections/{address}/invitation".format(address=quote(str(address), safe=""),),
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | InviteAgentConnectionResponse200 | None:
    if response.status_code == 200:
        response_200 = InviteAgentConnectionResponse200.from_dict(response.json())



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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | InviteAgentConnectionResponse200]:
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
    body: InviteAgentConnectionBody,
    idempotency_key: str | Unset = UNSET,

) -> Response[ErrorResponse | InviteAgentConnectionResponse200]:
    """ invite Agent Connection

     Address-bound external runtime pairing. Any current human organization member may create and manage
    their personal agent connections. Organization owners and admins may manage all connections and
    explicitly create shared ones. An owner removed from the organization loses personal agent access,
    and rejoining does not revive the old connection. Organization API keys cannot manage connections. A
    current connected credential may disconnect only its own exact address. Claim is authorized only by
    its one-use invitation. Connected means a real challenge was received and a reply sent by the
    current bound credential was received back. Invitations expire after 15 minutes. Reconnection
    preserves the address and revokes previous credentials. Status responses contain no credentials.
    Runtime credentials allow address-scoped mail operations, organization note reads, own-address note
    writes, exact-address self-disconnect, network discovery when can_view is enabled, and recipient-
    bound network contact admission. pending_only protects an already claimed credential. An ambiguous
    invitation response must not be retried automatically; invitation secrets are never replayed.

    Args:
        address (str):
        idempotency_key (str | Unset):
        body (InviteAgentConnectionBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | InviteAgentConnectionResponse200]
     """


    kwargs = _get_kwargs(
        address=address,
body=body,
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
    body: InviteAgentConnectionBody,
    idempotency_key: str | Unset = UNSET,

) -> ErrorResponse | InviteAgentConnectionResponse200 | None:
    """ invite Agent Connection

     Address-bound external runtime pairing. Any current human organization member may create and manage
    their personal agent connections. Organization owners and admins may manage all connections and
    explicitly create shared ones. An owner removed from the organization loses personal agent access,
    and rejoining does not revive the old connection. Organization API keys cannot manage connections. A
    current connected credential may disconnect only its own exact address. Claim is authorized only by
    its one-use invitation. Connected means a real challenge was received and a reply sent by the
    current bound credential was received back. Invitations expire after 15 minutes. Reconnection
    preserves the address and revokes previous credentials. Status responses contain no credentials.
    Runtime credentials allow address-scoped mail operations, organization note reads, own-address note
    writes, exact-address self-disconnect, network discovery when can_view is enabled, and recipient-
    bound network contact admission. pending_only protects an already claimed credential. An ambiguous
    invitation response must not be retried automatically; invitation secrets are never replayed.

    Args:
        address (str):
        idempotency_key (str | Unset):
        body (InviteAgentConnectionBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | InviteAgentConnectionResponse200
     """


    return sync_detailed(
        address=address,
client=client,
body=body,
idempotency_key=idempotency_key,

    ).parsed

async def asyncio_detailed(
    address: str,
    *,
    client: AuthenticatedClient,
    body: InviteAgentConnectionBody,
    idempotency_key: str | Unset = UNSET,

) -> Response[ErrorResponse | InviteAgentConnectionResponse200]:
    """ invite Agent Connection

     Address-bound external runtime pairing. Any current human organization member may create and manage
    their personal agent connections. Organization owners and admins may manage all connections and
    explicitly create shared ones. An owner removed from the organization loses personal agent access,
    and rejoining does not revive the old connection. Organization API keys cannot manage connections. A
    current connected credential may disconnect only its own exact address. Claim is authorized only by
    its one-use invitation. Connected means a real challenge was received and a reply sent by the
    current bound credential was received back. Invitations expire after 15 minutes. Reconnection
    preserves the address and revokes previous credentials. Status responses contain no credentials.
    Runtime credentials allow address-scoped mail operations, organization note reads, own-address note
    writes, exact-address self-disconnect, network discovery when can_view is enabled, and recipient-
    bound network contact admission. pending_only protects an already claimed credential. An ambiguous
    invitation response must not be retried automatically; invitation secrets are never replayed.

    Args:
        address (str):
        idempotency_key (str | Unset):
        body (InviteAgentConnectionBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | InviteAgentConnectionResponse200]
     """


    kwargs = _get_kwargs(
        address=address,
body=body,
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
    body: InviteAgentConnectionBody,
    idempotency_key: str | Unset = UNSET,

) -> ErrorResponse | InviteAgentConnectionResponse200 | None:
    """ invite Agent Connection

     Address-bound external runtime pairing. Any current human organization member may create and manage
    their personal agent connections. Organization owners and admins may manage all connections and
    explicitly create shared ones. An owner removed from the organization loses personal agent access,
    and rejoining does not revive the old connection. Organization API keys cannot manage connections. A
    current connected credential may disconnect only its own exact address. Claim is authorized only by
    its one-use invitation. Connected means a real challenge was received and a reply sent by the
    current bound credential was received back. Invitations expire after 15 minutes. Reconnection
    preserves the address and revokes previous credentials. Status responses contain no credentials.
    Runtime credentials allow address-scoped mail operations, organization note reads, own-address note
    writes, exact-address self-disconnect, network discovery when can_view is enabled, and recipient-
    bound network contact admission. pending_only protects an already claimed credential. An ambiguous
    invitation response must not be retried automatically; invitation secrets are never replayed.

    Args:
        address (str):
        idempotency_key (str | Unset):
        body (InviteAgentConnectionBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | InviteAgentConnectionResponse200
     """


    return (await asyncio_detailed(
        address=address,
client=client,
body=body,
idempotency_key=idempotency_key,

    )).parsed
