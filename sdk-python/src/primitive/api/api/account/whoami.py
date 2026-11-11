from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.whoami_response_200 import WhoamiResponse200
from ...types import UNSET, Unset
from typing import cast



def _get_kwargs(
    *,
    include: str | Unset = UNSET,
    check: str | Unset = UNSET,
    resource: str | Unset = UNSET,

) -> dict[str, Any]:
    

    

    params: dict[str, Any] = {}

    params["include"] = include

    params["check"] = check

    params["resource"] = resource


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/whoami",
        "params": params,
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | WhoamiResponse200 | None:
    if response.status_code == 200:
        response_200 = WhoamiResponse200.from_dict(response.json())



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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | WhoamiResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    include: str | Unset = UNSET,
    check: str | Unset = UNSET,
    resource: str | Unset = UNSET,

) -> Response[ErrorResponse | WhoamiResponse200]:
    """ Get current caller identity

     Current authenticated identity. member_address is null for machine credentials or an unavailable
    member address. email (your own sign-in email) and role_name (your role as the members list labels
    it) are set only when you are signed in as yourself, in the dashboard or with your own Primitive CLI
    or app login, and are null for API keys, Functions, connected agents, agent signup logins and other
    apps acting for you.

    Args:
        include (str | Unset):
        check (str | Unset):
        resource (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | WhoamiResponse200]
     """


    kwargs = _get_kwargs(
        include=include,
check=check,
resource=resource,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    *,
    client: AuthenticatedClient | Client,
    include: str | Unset = UNSET,
    check: str | Unset = UNSET,
    resource: str | Unset = UNSET,

) -> ErrorResponse | WhoamiResponse200 | None:
    """ Get current caller identity

     Current authenticated identity. member_address is null for machine credentials or an unavailable
    member address. email (your own sign-in email) and role_name (your role as the members list labels
    it) are set only when you are signed in as yourself, in the dashboard or with your own Primitive CLI
    or app login, and are null for API keys, Functions, connected agents, agent signup logins and other
    apps acting for you.

    Args:
        include (str | Unset):
        check (str | Unset):
        resource (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | WhoamiResponse200
     """


    return sync_detailed(
        client=client,
include=include,
check=check,
resource=resource,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    include: str | Unset = UNSET,
    check: str | Unset = UNSET,
    resource: str | Unset = UNSET,

) -> Response[ErrorResponse | WhoamiResponse200]:
    """ Get current caller identity

     Current authenticated identity. member_address is null for machine credentials or an unavailable
    member address. email (your own sign-in email) and role_name (your role as the members list labels
    it) are set only when you are signed in as yourself, in the dashboard or with your own Primitive CLI
    or app login, and are null for API keys, Functions, connected agents, agent signup logins and other
    apps acting for you.

    Args:
        include (str | Unset):
        check (str | Unset):
        resource (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | WhoamiResponse200]
     """


    kwargs = _get_kwargs(
        include=include,
check=check,
resource=resource,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    include: str | Unset = UNSET,
    check: str | Unset = UNSET,
    resource: str | Unset = UNSET,

) -> ErrorResponse | WhoamiResponse200 | None:
    """ Get current caller identity

     Current authenticated identity. member_address is null for machine credentials or an unavailable
    member address. email (your own sign-in email) and role_name (your role as the members list labels
    it) are set only when you are signed in as yourself, in the dashboard or with your own Primitive CLI
    or app login, and are null for API keys, Functions, connected agents, agent signup logins and other
    apps acting for you.

    Args:
        include (str | Unset):
        check (str | Unset):
        resource (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | WhoamiResponse200
     """


    return (await asyncio_detailed(
        client=client,
include=include,
check=check,
resource=resource,

    )).parsed
