from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.get_send_from_response_200 import GetSendFromResponse200
from typing import cast



def _get_kwargs(
    
) -> dict[str, Any]:
    

    

    

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/whoami/send-from",
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | GetSendFromResponse200 | None:
    if response.status_code == 200:
        response_200 = GetSendFromResponse200.from_dict(response.json())



        return response_200

    if response.status_code == 401:
        response_401 = ErrorResponse.from_dict(response.json())



        return response_401

    if response.status_code == 403:
        response_403 = ErrorResponse.from_dict(response.json())



        return response_403

    if response.status_code == 429:
        response_429 = ErrorResponse.from_dict(response.json())



        return response_429

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | GetSendFromResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,

) -> Response[ErrorResponse | GetSendFromResponse200]:
    """ List the addresses this credential can send from

     The From addresses the calling credential may send from with POST /send-mail, and the one a send
    that names no From should use. Every address listed is one that send would accept as From for this
    credential, recipients aside. A connected agent's default is its own address. A person's default is
    their own member address, for a session and for every OAuth login of theirs, an agent's included.
    Any other credential has a default only when exactly one address and no domain is listed, and never
    a person's own member address. When there is no default, `reason` says why. `domains` lists the
    domains at which the credential may send from any address that is not reserved to someone else or
    left out of its grant; each is one GET /outbound/status lists as sendable for it. A credential that
    cannot send new mail, or one in an account where outbound mail is not enabled, gets no addresses and
    no domains. Every credential may ask about itself, a connected agent's key included, except a
    Function-bound key limited to its Function's own operations (403 function_scope_forbidden). It
    answers nothing about any other credential.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | GetSendFromResponse200]
     """


    kwargs = _get_kwargs(
        
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    *,
    client: AuthenticatedClient | Client,

) -> ErrorResponse | GetSendFromResponse200 | None:
    """ List the addresses this credential can send from

     The From addresses the calling credential may send from with POST /send-mail, and the one a send
    that names no From should use. Every address listed is one that send would accept as From for this
    credential, recipients aside. A connected agent's default is its own address. A person's default is
    their own member address, for a session and for every OAuth login of theirs, an agent's included.
    Any other credential has a default only when exactly one address and no domain is listed, and never
    a person's own member address. When there is no default, `reason` says why. `domains` lists the
    domains at which the credential may send from any address that is not reserved to someone else or
    left out of its grant; each is one GET /outbound/status lists as sendable for it. A credential that
    cannot send new mail, or one in an account where outbound mail is not enabled, gets no addresses and
    no domains. Every credential may ask about itself, a connected agent's key included, except a
    Function-bound key limited to its Function's own operations (403 function_scope_forbidden). It
    answers nothing about any other credential.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | GetSendFromResponse200
     """


    return sync_detailed(
        client=client,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,

) -> Response[ErrorResponse | GetSendFromResponse200]:
    """ List the addresses this credential can send from

     The From addresses the calling credential may send from with POST /send-mail, and the one a send
    that names no From should use. Every address listed is one that send would accept as From for this
    credential, recipients aside. A connected agent's default is its own address. A person's default is
    their own member address, for a session and for every OAuth login of theirs, an agent's included.
    Any other credential has a default only when exactly one address and no domain is listed, and never
    a person's own member address. When there is no default, `reason` says why. `domains` lists the
    domains at which the credential may send from any address that is not reserved to someone else or
    left out of its grant; each is one GET /outbound/status lists as sendable for it. A credential that
    cannot send new mail, or one in an account where outbound mail is not enabled, gets no addresses and
    no domains. Every credential may ask about itself, a connected agent's key included, except a
    Function-bound key limited to its Function's own operations (403 function_scope_forbidden). It
    answers nothing about any other credential.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | GetSendFromResponse200]
     """


    kwargs = _get_kwargs(
        
    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    *,
    client: AuthenticatedClient | Client,

) -> ErrorResponse | GetSendFromResponse200 | None:
    """ List the addresses this credential can send from

     The From addresses the calling credential may send from with POST /send-mail, and the one a send
    that names no From should use. Every address listed is one that send would accept as From for this
    credential, recipients aside. A connected agent's default is its own address. A person's default is
    their own member address, for a session and for every OAuth login of theirs, an agent's included.
    Any other credential has a default only when exactly one address and no domain is listed, and never
    a person's own member address. When there is no default, `reason` says why. `domains` lists the
    domains at which the credential may send from any address that is not reserved to someone else or
    left out of its grant; each is one GET /outbound/status lists as sendable for it. A credential that
    cannot send new mail, or one in an account where outbound mail is not enabled, gets no addresses and
    no domains. Every credential may ask about itself, a connected agent's key included, except a
    Function-bound key limited to its Function's own operations (403 function_scope_forbidden). It
    answers nothing about any other credential.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | GetSendFromResponse200
     """


    return (await asyncio_detailed(
        client=client,

    )).parsed
