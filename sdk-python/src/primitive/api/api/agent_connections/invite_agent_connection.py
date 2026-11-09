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
    primitive_step_up: str | Unset = UNSET,
    idempotency_key: str | Unset = UNSET,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}
    if not isinstance(primitive_step_up, Unset):
        headers["Primitive-Step-Up"] = primitive_step_up

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

    if response.status_code == 503:
        response_503 = ErrorResponse.from_dict(response.json())



        return response_503

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
    client: AuthenticatedClient | Client,
    body: InviteAgentConnectionBody,
    primitive_step_up: str | Unset = UNSET,
    idempotency_key: str | Unset = UNSET,

) -> Response[ErrorResponse | InviteAgentConnectionResponse200]:
    """ invite Agent Connection

     Explicitly reconnect an existing agent. Set pending_only:true for Continue setup: the locked
    connection must still be pending or the server returns 409 connection_already_claimed without
    deleting any credential. Generic reconnect revokes old credentials and returns a new single-use
    invitation. An uncertain response must not be automatically retried.

    Args:
        address (str):
        primitive_step_up (str | Unset):
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
primitive_step_up=primitive_step_up,
idempotency_key=idempotency_key,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    address: str,
    *,
    client: AuthenticatedClient | Client,
    body: InviteAgentConnectionBody,
    primitive_step_up: str | Unset = UNSET,
    idempotency_key: str | Unset = UNSET,

) -> ErrorResponse | InviteAgentConnectionResponse200 | None:
    """ invite Agent Connection

     Explicitly reconnect an existing agent. Set pending_only:true for Continue setup: the locked
    connection must still be pending or the server returns 409 connection_already_claimed without
    deleting any credential. Generic reconnect revokes old credentials and returns a new single-use
    invitation. An uncertain response must not be automatically retried.

    Args:
        address (str):
        primitive_step_up (str | Unset):
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
primitive_step_up=primitive_step_up,
idempotency_key=idempotency_key,

    ).parsed

async def asyncio_detailed(
    address: str,
    *,
    client: AuthenticatedClient | Client,
    body: InviteAgentConnectionBody,
    primitive_step_up: str | Unset = UNSET,
    idempotency_key: str | Unset = UNSET,

) -> Response[ErrorResponse | InviteAgentConnectionResponse200]:
    """ invite Agent Connection

     Explicitly reconnect an existing agent. Set pending_only:true for Continue setup: the locked
    connection must still be pending or the server returns 409 connection_already_claimed without
    deleting any credential. Generic reconnect revokes old credentials and returns a new single-use
    invitation. An uncertain response must not be automatically retried.

    Args:
        address (str):
        primitive_step_up (str | Unset):
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
primitive_step_up=primitive_step_up,
idempotency_key=idempotency_key,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    address: str,
    *,
    client: AuthenticatedClient | Client,
    body: InviteAgentConnectionBody,
    primitive_step_up: str | Unset = UNSET,
    idempotency_key: str | Unset = UNSET,

) -> ErrorResponse | InviteAgentConnectionResponse200 | None:
    """ invite Agent Connection

     Explicitly reconnect an existing agent. Set pending_only:true for Continue setup: the locked
    connection must still be pending or the server returns 409 connection_already_claimed without
    deleting any credential. Generic reconnect revokes old credentials and returns a new single-use
    invitation. An uncertain response must not be automatically retried.

    Args:
        address (str):
        primitive_step_up (str | Unset):
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
primitive_step_up=primitive_step_up,
idempotency_key=idempotency_key,

    )).parsed
