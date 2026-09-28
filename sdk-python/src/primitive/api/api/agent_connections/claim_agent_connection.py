from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.claim_agent_connection_body import ClaimAgentConnectionBody
from ...models.claim_agent_connection_response_200 import ClaimAgentConnectionResponse200
from ...models.error_response import ErrorResponse
from ...types import UNSET, Unset
from typing import cast



def _get_kwargs(
    *,
    body: ClaimAgentConnectionBody,
    idempotency_key: str | Unset = UNSET,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}
    if not isinstance(idempotency_key, Unset):
        headers["Idempotency-Key"] = idempotency_key



    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/agent-connections/claim",
    }

    _kwargs["json"] = body.to_dict()


    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ClaimAgentConnectionResponse200 | ErrorResponse | None:
    if response.status_code == 200:
        response_200 = ClaimAgentConnectionResponse200.from_dict(response.json())



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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ClaimAgentConnectionResponse200 | ErrorResponse]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: ClaimAgentConnectionBody,
    idempotency_key: str | Unset = UNSET,

) -> Response[ClaimAgentConnectionResponse200 | ErrorResponse]:
    """ claim Agent Connection

     Address-bound external runtime pairing. Management operations require an organization owner or admin
    session or OAuth token; members and organization API keys cannot manage connections. Claim is
    authorized only by its one-use invitation. Connected means a real challenge was received and a reply
    sent by the current bound credential was received back. Invitations expire after 15 minutes.
    Reconnection preserves the address and revokes previous credentials. Status responses contain no
    credentials. Runtime credentials allow only address-scoped mail operations, organization note reads
    and own-address note writes. The credential is returned once. If the claim response is lost or the
    outcome is unknown, request a fresh owner invitation instead of retrying the consumed invitation.

    Args:
        idempotency_key (str | Unset):
        body (ClaimAgentConnectionBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ClaimAgentConnectionResponse200 | ErrorResponse]
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
    body: ClaimAgentConnectionBody,
    idempotency_key: str | Unset = UNSET,

) -> ClaimAgentConnectionResponse200 | ErrorResponse | None:
    """ claim Agent Connection

     Address-bound external runtime pairing. Management operations require an organization owner or admin
    session or OAuth token; members and organization API keys cannot manage connections. Claim is
    authorized only by its one-use invitation. Connected means a real challenge was received and a reply
    sent by the current bound credential was received back. Invitations expire after 15 minutes.
    Reconnection preserves the address and revokes previous credentials. Status responses contain no
    credentials. Runtime credentials allow only address-scoped mail operations, organization note reads
    and own-address note writes. The credential is returned once. If the claim response is lost or the
    outcome is unknown, request a fresh owner invitation instead of retrying the consumed invitation.

    Args:
        idempotency_key (str | Unset):
        body (ClaimAgentConnectionBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ClaimAgentConnectionResponse200 | ErrorResponse
     """


    return sync_detailed(
        client=client,
body=body,
idempotency_key=idempotency_key,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: ClaimAgentConnectionBody,
    idempotency_key: str | Unset = UNSET,

) -> Response[ClaimAgentConnectionResponse200 | ErrorResponse]:
    """ claim Agent Connection

     Address-bound external runtime pairing. Management operations require an organization owner or admin
    session or OAuth token; members and organization API keys cannot manage connections. Claim is
    authorized only by its one-use invitation. Connected means a real challenge was received and a reply
    sent by the current bound credential was received back. Invitations expire after 15 minutes.
    Reconnection preserves the address and revokes previous credentials. Status responses contain no
    credentials. Runtime credentials allow only address-scoped mail operations, organization note reads
    and own-address note writes. The credential is returned once. If the claim response is lost or the
    outcome is unknown, request a fresh owner invitation instead of retrying the consumed invitation.

    Args:
        idempotency_key (str | Unset):
        body (ClaimAgentConnectionBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ClaimAgentConnectionResponse200 | ErrorResponse]
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
    body: ClaimAgentConnectionBody,
    idempotency_key: str | Unset = UNSET,

) -> ClaimAgentConnectionResponse200 | ErrorResponse | None:
    """ claim Agent Connection

     Address-bound external runtime pairing. Management operations require an organization owner or admin
    session or OAuth token; members and organization API keys cannot manage connections. Claim is
    authorized only by its one-use invitation. Connected means a real challenge was received and a reply
    sent by the current bound credential was received back. Invitations expire after 15 minutes.
    Reconnection preserves the address and revokes previous credentials. Status responses contain no
    credentials. Runtime credentials allow only address-scoped mail operations, organization note reads
    and own-address note writes. The credential is returned once. If the claim response is lost or the
    outcome is unknown, request a fresh owner invitation instead of retrying the consumed invitation.

    Args:
        idempotency_key (str | Unset):
        body (ClaimAgentConnectionBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ClaimAgentConnectionResponse200 | ErrorResponse
     """


    return (await asyncio_detailed(
        client=client,
body=body,
idempotency_key=idempotency_key,

    )).parsed
