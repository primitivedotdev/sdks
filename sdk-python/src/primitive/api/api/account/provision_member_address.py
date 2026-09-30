from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.provision_member_address_body import ProvisionMemberAddressBody
from ...models.provision_member_address_response_200 import ProvisionMemberAddressResponse200
from typing import cast



def _get_kwargs(
    *,
    body: ProvisionMemberAddressBody,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "put",
        "url": "/account/member-address",
    }

    _kwargs["json"] = body.to_dict()


    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | ProvisionMemberAddressResponse200 | None:
    if response.status_code == 200:
        response_200 = ProvisionMemberAddressResponse200.from_dict(response.json())



        return response_200

    if response.status_code == 401:
        response_401 = ErrorResponse.from_dict(response.json())



        return response_401

    if response.status_code == 403:
        response_403 = ErrorResponse.from_dict(response.json())



        return response_403

    if response.status_code == 409:
        response_409 = ErrorResponse.from_dict(response.json())



        return response_409

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | ProvisionMemberAddressResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: ProvisionMemberAddressBody,

) -> Response[ErrorResponse | ProvisionMemberAddressResponse200]:
    """ Provision your member email address

     Provision or return this authenticated human member's stable managed address in this organization.
    API keys, connected agents and Functions cannot provision or impersonate humans. The owner
    explicitly chooses the address. Existing retained mail requires confirmation; reserved identities
    cannot be overridden. There is no target user input. An unavailable domain never silently changes
    the address.

    Args:
        body (ProvisionMemberAddressBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ProvisionMemberAddressResponse200]
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
    body: ProvisionMemberAddressBody,

) -> ErrorResponse | ProvisionMemberAddressResponse200 | None:
    """ Provision your member email address

     Provision or return this authenticated human member's stable managed address in this organization.
    API keys, connected agents and Functions cannot provision or impersonate humans. The owner
    explicitly chooses the address. Existing retained mail requires confirmation; reserved identities
    cannot be overridden. There is no target user input. An unavailable domain never silently changes
    the address.

    Args:
        body (ProvisionMemberAddressBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ProvisionMemberAddressResponse200
     """


    return sync_detailed(
        client=client,
body=body,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: ProvisionMemberAddressBody,

) -> Response[ErrorResponse | ProvisionMemberAddressResponse200]:
    """ Provision your member email address

     Provision or return this authenticated human member's stable managed address in this organization.
    API keys, connected agents and Functions cannot provision or impersonate humans. The owner
    explicitly chooses the address. Existing retained mail requires confirmation; reserved identities
    cannot be overridden. There is no target user input. An unavailable domain never silently changes
    the address.

    Args:
        body (ProvisionMemberAddressBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ProvisionMemberAddressResponse200]
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
    body: ProvisionMemberAddressBody,

) -> ErrorResponse | ProvisionMemberAddressResponse200 | None:
    """ Provision your member email address

     Provision or return this authenticated human member's stable managed address in this organization.
    API keys, connected agents and Functions cannot provision or impersonate humans. The owner
    explicitly chooses the address. Existing retained mail requires confirmation; reserved identities
    cannot be overridden. There is no target user input. An unavailable domain never silently changes
    the address.

    Args:
        body (ProvisionMemberAddressBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ProvisionMemberAddressResponse200
     """


    return (await asyncio_detailed(
        client=client,
body=body,

    )).parsed
