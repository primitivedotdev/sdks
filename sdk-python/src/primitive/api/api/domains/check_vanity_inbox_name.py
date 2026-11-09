from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.check_vanity_inbox_name_response_200 import CheckVanityInboxNameResponse200
from ...models.error_response import ErrorResponse
from typing import cast



def _get_kwargs(
    name: str,

) -> dict[str, Any]:
    

    

    

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/managed-inbox/vanity/{name}".format(name=quote(str(name), safe=""),),
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> CheckVanityInboxNameResponse200 | ErrorResponse | None:
    if response.status_code == 200:
        response_200 = CheckVanityInboxNameResponse200.from_dict(response.json())



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

    if response.status_code == 429:
        response_429 = ErrorResponse.from_dict(response.json())



        return response_429

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[CheckVanityInboxNameResponse200 | ErrorResponse]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    name: str,
    *,
    client: AuthenticatedClient | Client,

) -> Response[CheckVanityInboxNameResponse200 | ErrorResponse]:
    """ Check a vanity inbox name

     Whether a name can be claimed for the managed inbox (name.primitive.email): available, taken,
    reserved (a protected word) or invalid (5 to 30 lowercase letters and digits, starting with a
    letter). Any plan may check; claiming needs Power. Rate limited per organization together with
    claims. Needs domains:read.

    Args:
        name (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[CheckVanityInboxNameResponse200 | ErrorResponse]
     """


    kwargs = _get_kwargs(
        name=name,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    name: str,
    *,
    client: AuthenticatedClient | Client,

) -> CheckVanityInboxNameResponse200 | ErrorResponse | None:
    """ Check a vanity inbox name

     Whether a name can be claimed for the managed inbox (name.primitive.email): available, taken,
    reserved (a protected word) or invalid (5 to 30 lowercase letters and digits, starting with a
    letter). Any plan may check; claiming needs Power. Rate limited per organization together with
    claims. Needs domains:read.

    Args:
        name (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        CheckVanityInboxNameResponse200 | ErrorResponse
     """


    return sync_detailed(
        name=name,
client=client,

    ).parsed

async def asyncio_detailed(
    name: str,
    *,
    client: AuthenticatedClient | Client,

) -> Response[CheckVanityInboxNameResponse200 | ErrorResponse]:
    """ Check a vanity inbox name

     Whether a name can be claimed for the managed inbox (name.primitive.email): available, taken,
    reserved (a protected word) or invalid (5 to 30 lowercase letters and digits, starting with a
    letter). Any plan may check; claiming needs Power. Rate limited per organization together with
    claims. Needs domains:read.

    Args:
        name (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[CheckVanityInboxNameResponse200 | ErrorResponse]
     """


    kwargs = _get_kwargs(
        name=name,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    name: str,
    *,
    client: AuthenticatedClient | Client,

) -> CheckVanityInboxNameResponse200 | ErrorResponse | None:
    """ Check a vanity inbox name

     Whether a name can be claimed for the managed inbox (name.primitive.email): available, taken,
    reserved (a protected word) or invalid (5 to 30 lowercase letters and digits, starting with a
    letter). Any plan may check; claiming needs Power. Rate limited per organization together with
    claims. Needs domains:read.

    Args:
        name (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        CheckVanityInboxNameResponse200 | ErrorResponse
     """


    return (await asyncio_detailed(
        name=name,
client=client,

    )).parsed
