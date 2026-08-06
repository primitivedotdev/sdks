from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.check_domain_dns_response_200 import CheckDomainDnsResponse200
from ...models.error_response import ErrorResponse
from typing import cast
from uuid import UUID



def _get_kwargs(
    id: UUID,

) -> dict[str, Any]:
    

    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/domains/{id}/dns/check".format(id=quote(str(id), safe=""),),
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> CheckDomainDnsResponse200 | ErrorResponse | None:
    if response.status_code == 200:
        response_200 = CheckDomainDnsResponse200.from_dict(response.json())



        return response_200

    if response.status_code == 400:
        response_400 = ErrorResponse.from_dict(response.json())



        return response_400

    if response.status_code == 401:
        response_401 = ErrorResponse.from_dict(response.json())



        return response_401

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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[CheckDomainDnsResponse200 | ErrorResponse]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,

) -> Response[CheckDomainDnsResponse200 | ErrorResponse]:
    """ Run an on-demand DNS health check

     Re-checks the domain's DNS records and persists the result as
    the domain's current DNS health state. This is the on-demand
    counterpart of the scheduled background checker: the response
    mirrors what the checker records, broken down per scope
    (`ownership`, `inbound`, `outbound`) with the exact records
    inspected and each record's individual status.

    Unlike /domains/{id}/verify, this call never promotes an
    unverified domain; it only re-evaluates and records health for
    an existing claim. Managed (Primitive-operated) domains are
    rejected with a validation error because their DNS is not
    customer-published.

    Rate limited per organization; a `Retry-After` header
    accompanies 429 responses.

    Args:
        id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[CheckDomainDnsResponse200 | ErrorResponse]
     """


    kwargs = _get_kwargs(
        id=id,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,

) -> CheckDomainDnsResponse200 | ErrorResponse | None:
    """ Run an on-demand DNS health check

     Re-checks the domain's DNS records and persists the result as
    the domain's current DNS health state. This is the on-demand
    counterpart of the scheduled background checker: the response
    mirrors what the checker records, broken down per scope
    (`ownership`, `inbound`, `outbound`) with the exact records
    inspected and each record's individual status.

    Unlike /domains/{id}/verify, this call never promotes an
    unverified domain; it only re-evaluates and records health for
    an existing claim. Managed (Primitive-operated) domains are
    rejected with a validation error because their DNS is not
    customer-published.

    Rate limited per organization; a `Retry-After` header
    accompanies 429 responses.

    Args:
        id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        CheckDomainDnsResponse200 | ErrorResponse
     """


    return sync_detailed(
        id=id,
client=client,

    ).parsed

async def asyncio_detailed(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,

) -> Response[CheckDomainDnsResponse200 | ErrorResponse]:
    """ Run an on-demand DNS health check

     Re-checks the domain's DNS records and persists the result as
    the domain's current DNS health state. This is the on-demand
    counterpart of the scheduled background checker: the response
    mirrors what the checker records, broken down per scope
    (`ownership`, `inbound`, `outbound`) with the exact records
    inspected and each record's individual status.

    Unlike /domains/{id}/verify, this call never promotes an
    unverified domain; it only re-evaluates and records health for
    an existing claim. Managed (Primitive-operated) domains are
    rejected with a validation error because their DNS is not
    customer-published.

    Rate limited per organization; a `Retry-After` header
    accompanies 429 responses.

    Args:
        id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[CheckDomainDnsResponse200 | ErrorResponse]
     """


    kwargs = _get_kwargs(
        id=id,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,

) -> CheckDomainDnsResponse200 | ErrorResponse | None:
    """ Run an on-demand DNS health check

     Re-checks the domain's DNS records and persists the result as
    the domain's current DNS health state. This is the on-demand
    counterpart of the scheduled background checker: the response
    mirrors what the checker records, broken down per scope
    (`ownership`, `inbound`, `outbound`) with the exact records
    inspected and each record's individual status.

    Unlike /domains/{id}/verify, this call never promotes an
    unverified domain; it only re-evaluates and records health for
    an existing claim. Managed (Primitive-operated) domains are
    rejected with a validation error because their DNS is not
    customer-published.

    Rate limited per organization; a `Retry-After` header
    accompanies 429 responses.

    Args:
        id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        CheckDomainDnsResponse200 | ErrorResponse
     """


    return (await asyncio_detailed(
        id=id,
client=client,

    )).parsed
