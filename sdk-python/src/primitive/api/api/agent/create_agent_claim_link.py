from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.create_agent_claim_link_input import CreateAgentClaimLinkInput
from ...models.create_agent_claim_link_response_200 import CreateAgentClaimLinkResponse200
from ...models.error_response import ErrorResponse
from ...types import UNSET, Unset
from typing import cast



def _get_kwargs(
    *,
    body: CreateAgentClaimLinkInput | Unset = UNSET,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/agent/claim/link",
    }

    
    if not isinstance(body, Unset):
        _kwargs["json"] = body.to_dict()
        headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> CreateAgentClaimLinkResponse200 | ErrorResponse | None:
    if response.status_code == 200:
        response_200 = CreateAgentClaimLinkResponse200.from_dict(response.json())



        return response_200

    if response.status_code == 401:
        response_401 = ErrorResponse.from_dict(response.json())



        return response_401

    if response.status_code == 429:
        response_429 = ErrorResponse.from_dict(response.json())



        return response_429

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[CreateAgentClaimLinkResponse200 | ErrorResponse]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: CreateAgentClaimLinkInput | Unset = UNSET,

) -> Response[CreateAgentClaimLinkResponse200 | ErrorResponse]:
    """ Create a browser claim link

     Mints an opaque, single-use link an agent can hand to a human to
    complete the email-confirmation upgrade in a browser. Authenticated by
    the agent's own API key. `claim_url` is null when the API host cannot
    resolve a web origin to build the link.

    Args:
        body (CreateAgentClaimLinkInput | Unset): No fields; an empty object is accepted.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[CreateAgentClaimLinkResponse200 | ErrorResponse]
     """


    kwargs = _get_kwargs(
        body=body,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    *,
    client: AuthenticatedClient | Client,
    body: CreateAgentClaimLinkInput | Unset = UNSET,

) -> CreateAgentClaimLinkResponse200 | ErrorResponse | None:
    """ Create a browser claim link

     Mints an opaque, single-use link an agent can hand to a human to
    complete the email-confirmation upgrade in a browser. Authenticated by
    the agent's own API key. `claim_url` is null when the API host cannot
    resolve a web origin to build the link.

    Args:
        body (CreateAgentClaimLinkInput | Unset): No fields; an empty object is accepted.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        CreateAgentClaimLinkResponse200 | ErrorResponse
     """


    return sync_detailed(
        client=client,
body=body,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: CreateAgentClaimLinkInput | Unset = UNSET,

) -> Response[CreateAgentClaimLinkResponse200 | ErrorResponse]:
    """ Create a browser claim link

     Mints an opaque, single-use link an agent can hand to a human to
    complete the email-confirmation upgrade in a browser. Authenticated by
    the agent's own API key. `claim_url` is null when the API host cannot
    resolve a web origin to build the link.

    Args:
        body (CreateAgentClaimLinkInput | Unset): No fields; an empty object is accepted.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[CreateAgentClaimLinkResponse200 | ErrorResponse]
     """


    kwargs = _get_kwargs(
        body=body,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    body: CreateAgentClaimLinkInput | Unset = UNSET,

) -> CreateAgentClaimLinkResponse200 | ErrorResponse | None:
    """ Create a browser claim link

     Mints an opaque, single-use link an agent can hand to a human to
    complete the email-confirmation upgrade in a browser. Authenticated by
    the agent's own API key. `claim_url` is null when the API host cannot
    resolve a web origin to build the link.

    Args:
        body (CreateAgentClaimLinkInput | Unset): No fields; an empty object is accepted.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        CreateAgentClaimLinkResponse200 | ErrorResponse
     """


    return (await asyncio_detailed(
        client=client,
body=body,

    )).parsed
