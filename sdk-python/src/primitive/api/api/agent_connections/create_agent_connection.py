from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.create_agent_connection_body import CreateAgentConnectionBody
from ...models.create_agent_connection_response_200 import CreateAgentConnectionResponse200
from ...models.error_response import ErrorResponse
from ...types import UNSET, Unset
from typing import cast



def _get_kwargs(
    *,
    body: CreateAgentConnectionBody,
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
        "url": "/agent-connections",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> CreateAgentConnectionResponse200 | ErrorResponse | None:
    if response.status_code == 200:
        response_200 = CreateAgentConnectionResponse200.from_dict(response.json())



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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[CreateAgentConnectionResponse200 | ErrorResponse]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: CreateAgentConnectionBody,
    primitive_step_up: str | Unset = UNSET,
    idempotency_key: str | Unset = UNSET,

) -> Response[CreateAgentConnectionResponse200 | ErrorResponse]:
    """ create Agent Connection

     Create an address-bound agent. An explicit address may be on a Primitive-managed domain or on one of
    the organization's own verified custom domains that receives and sends through Primitive; a
    narrower-than-organization creator needs agent_connections:custom_domains for a custom domain and a
    fresh address. Without an explicit address, allocate a readable name on a managed domain with a
    bounded collision suffix. Persist create_request_id before dispatch to recover the same current
    connection on retry; recovered responses have invitation:null and never rotate a key. Changed
    choices or membership return 409 connection_create_request_conflict; a removed identity returns 409
    connection_removed. A pending recovered connection can use inviteAgentConnection with
    pending_only:true once to obtain a fresh invitation.

    Args:
        primitive_step_up (str | Unset):
        idempotency_key (str | Unset):
        body (CreateAgentConnectionBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[CreateAgentConnectionResponse200 | ErrorResponse]
     """


    kwargs = _get_kwargs(
        body=body,
primitive_step_up=primitive_step_up,
idempotency_key=idempotency_key,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    *,
    client: AuthenticatedClient | Client,
    body: CreateAgentConnectionBody,
    primitive_step_up: str | Unset = UNSET,
    idempotency_key: str | Unset = UNSET,

) -> CreateAgentConnectionResponse200 | ErrorResponse | None:
    """ create Agent Connection

     Create an address-bound agent. An explicit address may be on a Primitive-managed domain or on one of
    the organization's own verified custom domains that receives and sends through Primitive; a
    narrower-than-organization creator needs agent_connections:custom_domains for a custom domain and a
    fresh address. Without an explicit address, allocate a readable name on a managed domain with a
    bounded collision suffix. Persist create_request_id before dispatch to recover the same current
    connection on retry; recovered responses have invitation:null and never rotate a key. Changed
    choices or membership return 409 connection_create_request_conflict; a removed identity returns 409
    connection_removed. A pending recovered connection can use inviteAgentConnection with
    pending_only:true once to obtain a fresh invitation.

    Args:
        primitive_step_up (str | Unset):
        idempotency_key (str | Unset):
        body (CreateAgentConnectionBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        CreateAgentConnectionResponse200 | ErrorResponse
     """


    return sync_detailed(
        client=client,
body=body,
primitive_step_up=primitive_step_up,
idempotency_key=idempotency_key,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: CreateAgentConnectionBody,
    primitive_step_up: str | Unset = UNSET,
    idempotency_key: str | Unset = UNSET,

) -> Response[CreateAgentConnectionResponse200 | ErrorResponse]:
    """ create Agent Connection

     Create an address-bound agent. An explicit address may be on a Primitive-managed domain or on one of
    the organization's own verified custom domains that receives and sends through Primitive; a
    narrower-than-organization creator needs agent_connections:custom_domains for a custom domain and a
    fresh address. Without an explicit address, allocate a readable name on a managed domain with a
    bounded collision suffix. Persist create_request_id before dispatch to recover the same current
    connection on retry; recovered responses have invitation:null and never rotate a key. Changed
    choices or membership return 409 connection_create_request_conflict; a removed identity returns 409
    connection_removed. A pending recovered connection can use inviteAgentConnection with
    pending_only:true once to obtain a fresh invitation.

    Args:
        primitive_step_up (str | Unset):
        idempotency_key (str | Unset):
        body (CreateAgentConnectionBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[CreateAgentConnectionResponse200 | ErrorResponse]
     """


    kwargs = _get_kwargs(
        body=body,
primitive_step_up=primitive_step_up,
idempotency_key=idempotency_key,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    body: CreateAgentConnectionBody,
    primitive_step_up: str | Unset = UNSET,
    idempotency_key: str | Unset = UNSET,

) -> CreateAgentConnectionResponse200 | ErrorResponse | None:
    """ create Agent Connection

     Create an address-bound agent. An explicit address may be on a Primitive-managed domain or on one of
    the organization's own verified custom domains that receives and sends through Primitive; a
    narrower-than-organization creator needs agent_connections:custom_domains for a custom domain and a
    fresh address. Without an explicit address, allocate a readable name on a managed domain with a
    bounded collision suffix. Persist create_request_id before dispatch to recover the same current
    connection on retry; recovered responses have invitation:null and never rotate a key. Changed
    choices or membership return 409 connection_create_request_conflict; a removed identity returns 409
    connection_removed. A pending recovered connection can use inviteAgentConnection with
    pending_only:true once to obtain a fresh invitation.

    Args:
        primitive_step_up (str | Unset):
        idempotency_key (str | Unset):
        body (CreateAgentConnectionBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        CreateAgentConnectionResponse200 | ErrorResponse
     """


    return (await asyncio_detailed(
        client=client,
body=body,
primitive_step_up=primitive_step_up,
idempotency_key=idempotency_key,

    )).parsed
