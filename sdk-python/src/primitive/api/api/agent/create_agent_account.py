from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.create_agent_account_input import CreateAgentAccountInput
from ...models.create_agent_account_response_200 import CreateAgentAccountResponse200
from ...models.error_response import ErrorResponse
from typing import cast



def _get_kwargs(
    *,
    body: CreateAgentAccountInput,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/agent/accounts",
    }

    _kwargs["json"] = body.to_dict()


    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> CreateAgentAccountResponse200 | ErrorResponse | None:
    if response.status_code == 200:
        response_200 = CreateAgentAccountResponse200.from_dict(response.json())



        return response_200

    if response.status_code == 400:
        response_400 = ErrorResponse.from_dict(response.json())



        return response_400

    if response.status_code == 429:
        response_429 = ErrorResponse.from_dict(response.json())



        return response_429

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[CreateAgentAccountResponse200 | ErrorResponse]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: CreateAgentAccountInput,

) -> Response[CreateAgentAccountResponse200 | ErrorResponse]:
    """ Create an emailless agent account

     Creates an emailless agent account without authentication and returns a
    one-time API key (prefixed `prim_`) plus a provisioned managed inbox.
    The account is on the `agent` plan: reply-only (it can send only to
    addresses that have already sent it authenticated mail) with tight send
    limits. Use the returned `api_key` as a Bearer token on later calls. The
    account can be upgraded to a full developer account by confirming an
    email through the claim flow. This endpoint does not require an API key.

    Args:
        body (CreateAgentAccountInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[CreateAgentAccountResponse200 | ErrorResponse]
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
    body: CreateAgentAccountInput,

) -> CreateAgentAccountResponse200 | ErrorResponse | None:
    """ Create an emailless agent account

     Creates an emailless agent account without authentication and returns a
    one-time API key (prefixed `prim_`) plus a provisioned managed inbox.
    The account is on the `agent` plan: reply-only (it can send only to
    addresses that have already sent it authenticated mail) with tight send
    limits. Use the returned `api_key` as a Bearer token on later calls. The
    account can be upgraded to a full developer account by confirming an
    email through the claim flow. This endpoint does not require an API key.

    Args:
        body (CreateAgentAccountInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        CreateAgentAccountResponse200 | ErrorResponse
     """


    return sync_detailed(
        client=client,
body=body,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: CreateAgentAccountInput,

) -> Response[CreateAgentAccountResponse200 | ErrorResponse]:
    """ Create an emailless agent account

     Creates an emailless agent account without authentication and returns a
    one-time API key (prefixed `prim_`) plus a provisioned managed inbox.
    The account is on the `agent` plan: reply-only (it can send only to
    addresses that have already sent it authenticated mail) with tight send
    limits. Use the returned `api_key` as a Bearer token on later calls. The
    account can be upgraded to a full developer account by confirming an
    email through the claim flow. This endpoint does not require an API key.

    Args:
        body (CreateAgentAccountInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[CreateAgentAccountResponse200 | ErrorResponse]
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
    body: CreateAgentAccountInput,

) -> CreateAgentAccountResponse200 | ErrorResponse | None:
    """ Create an emailless agent account

     Creates an emailless agent account without authentication and returns a
    one-time API key (prefixed `prim_`) plus a provisioned managed inbox.
    The account is on the `agent` plan: reply-only (it can send only to
    addresses that have already sent it authenticated mail) with tight send
    limits. Use the returned `api_key` as a Bearer token on later calls. The
    account can be upgraded to a full developer account by confirming an
    email through the claim flow. This endpoint does not require an API key.

    Args:
        body (CreateAgentAccountInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        CreateAgentAccountResponse200 | ErrorResponse
     """


    return (await asyncio_detailed(
        client=client,
body=body,

    )).parsed
