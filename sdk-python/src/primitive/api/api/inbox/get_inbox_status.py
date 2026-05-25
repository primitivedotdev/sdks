from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.get_inbox_status_response_200 import GetInboxStatusResponse200
from typing import cast



def _get_kwargs(
    
) -> dict[str, Any]:
    

    

    

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/inbox/status",
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | GetInboxStatusResponse200 | None:
    if response.status_code == 200:
        response_200 = GetInboxStatusResponse200.from_dict(response.json())



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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | GetInboxStatusResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,

) -> Response[ErrorResponse | GetInboxStatusResponse200]:
    r""" Get inbound inbox readiness

     Returns one consolidated view of inbound domain readiness,
    webhook/function processing routes, deployed Functions, and
    recent inbound email activity.

    Agents should call this before guiding a user through inbound
    setup. It answers the practical questions \"can I receive mail\",
    \"will anything process that mail\", and \"what should I do next\"
    without forcing clients to stitch together domains, endpoints,
    functions, and emails manually.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | GetInboxStatusResponse200]
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

) -> ErrorResponse | GetInboxStatusResponse200 | None:
    r""" Get inbound inbox readiness

     Returns one consolidated view of inbound domain readiness,
    webhook/function processing routes, deployed Functions, and
    recent inbound email activity.

    Agents should call this before guiding a user through inbound
    setup. It answers the practical questions \"can I receive mail\",
    \"will anything process that mail\", and \"what should I do next\"
    without forcing clients to stitch together domains, endpoints,
    functions, and emails manually.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | GetInboxStatusResponse200
     """


    return sync_detailed(
        client=client,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,

) -> Response[ErrorResponse | GetInboxStatusResponse200]:
    r""" Get inbound inbox readiness

     Returns one consolidated view of inbound domain readiness,
    webhook/function processing routes, deployed Functions, and
    recent inbound email activity.

    Agents should call this before guiding a user through inbound
    setup. It answers the practical questions \"can I receive mail\",
    \"will anything process that mail\", and \"what should I do next\"
    without forcing clients to stitch together domains, endpoints,
    functions, and emails manually.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | GetInboxStatusResponse200]
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

) -> ErrorResponse | GetInboxStatusResponse200 | None:
    r""" Get inbound inbox readiness

     Returns one consolidated view of inbound domain readiness,
    webhook/function processing routes, deployed Functions, and
    recent inbound email activity.

    Agents should call this before guiding a user through inbound
    setup. It answers the practical questions \"can I receive mail\",
    \"will anything process that mail\", and \"what should I do next\"
    without forcing clients to stitch together domains, endpoints,
    functions, and emails manually.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | GetInboxStatusResponse200
     """


    return (await asyncio_detailed(
        client=client,

    )).parsed
