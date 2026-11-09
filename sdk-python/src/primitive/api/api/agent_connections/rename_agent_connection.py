from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.rename_agent_connection_body import RenameAgentConnectionBody
from ...models.rename_agent_connection_response_200 import RenameAgentConnectionResponse200
from typing import cast



def _get_kwargs(
    address: str,
    *,
    body: RenameAgentConnectionBody,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}






    _kwargs: dict[str, Any] = {
        "method": "patch",
        "url": "/agent-connections/{address}/name".format(address=quote(str(address), safe=""),),
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | RenameAgentConnectionResponse200 | None:
    if response.status_code == 200:
        response_200 = RenameAgentConnectionResponse200.from_dict(response.json())



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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | RenameAgentConnectionResponse200]:
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
    body: RenameAgentConnectionBody,

) -> Response[ErrorResponse | RenameAgentConnectionResponse200]:
    """ rename Agent Connection

     Change an agent's display name. The address, credential, status and mail are unchanged. The name is
    trimmed and must be 1 to 64 characters with no control characters or line breaks. A connected agent
    may rename only its own exact address using its current bound credential; any other address returns
    403 agent_connection_scope_forbidden. A current personal owner may rename their own agents;
    organization owners and admins may rename any. A disconnected (revoked) connection returns 409
    connection_revoked. The new name appears immediately in GET /agent-connections/me, the connection
    list and the agent network directory.

    Args:
        address (str):
        body (RenameAgentConnectionBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | RenameAgentConnectionResponse200]
     """


    kwargs = _get_kwargs(
        address=address,
body=body,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    address: str,
    *,
    client: AuthenticatedClient | Client,
    body: RenameAgentConnectionBody,

) -> ErrorResponse | RenameAgentConnectionResponse200 | None:
    """ rename Agent Connection

     Change an agent's display name. The address, credential, status and mail are unchanged. The name is
    trimmed and must be 1 to 64 characters with no control characters or line breaks. A connected agent
    may rename only its own exact address using its current bound credential; any other address returns
    403 agent_connection_scope_forbidden. A current personal owner may rename their own agents;
    organization owners and admins may rename any. A disconnected (revoked) connection returns 409
    connection_revoked. The new name appears immediately in GET /agent-connections/me, the connection
    list and the agent network directory.

    Args:
        address (str):
        body (RenameAgentConnectionBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | RenameAgentConnectionResponse200
     """


    return sync_detailed(
        address=address,
client=client,
body=body,

    ).parsed

async def asyncio_detailed(
    address: str,
    *,
    client: AuthenticatedClient | Client,
    body: RenameAgentConnectionBody,

) -> Response[ErrorResponse | RenameAgentConnectionResponse200]:
    """ rename Agent Connection

     Change an agent's display name. The address, credential, status and mail are unchanged. The name is
    trimmed and must be 1 to 64 characters with no control characters or line breaks. A connected agent
    may rename only its own exact address using its current bound credential; any other address returns
    403 agent_connection_scope_forbidden. A current personal owner may rename their own agents;
    organization owners and admins may rename any. A disconnected (revoked) connection returns 409
    connection_revoked. The new name appears immediately in GET /agent-connections/me, the connection
    list and the agent network directory.

    Args:
        address (str):
        body (RenameAgentConnectionBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | RenameAgentConnectionResponse200]
     """


    kwargs = _get_kwargs(
        address=address,
body=body,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    address: str,
    *,
    client: AuthenticatedClient | Client,
    body: RenameAgentConnectionBody,

) -> ErrorResponse | RenameAgentConnectionResponse200 | None:
    """ rename Agent Connection

     Change an agent's display name. The address, credential, status and mail are unchanged. The name is
    trimmed and must be 1 to 64 characters with no control characters or line breaks. A connected agent
    may rename only its own exact address using its current bound credential; any other address returns
    403 agent_connection_scope_forbidden. A current personal owner may rename their own agents;
    organization owners and admins may rename any. A disconnected (revoked) connection returns 409
    connection_revoked. The new name appears immediately in GET /agent-connections/me, the connection
    list and the agent network directory.

    Args:
        address (str):
        body (RenameAgentConnectionBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | RenameAgentConnectionResponse200
     """


    return (await asyncio_detailed(
        address=address,
client=client,
body=body,

    )).parsed
