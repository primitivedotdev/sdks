from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.list_wake_authorizations_response_200 import ListWakeAuthorizationsResponse200
from ...types import UNSET, Unset
from typing import cast
from uuid import UUID



def _get_kwargs(
    *,
    recipient_endpoint_id: UUID | Unset = UNSET,

) -> dict[str, Any]:
    

    

    params: dict[str, Any] = {}

    json_recipient_endpoint_id: str | Unset = UNSET
    if not isinstance(recipient_endpoint_id, Unset):
        json_recipient_endpoint_id = str(recipient_endpoint_id)
    params["recipient_endpoint_id"] = json_recipient_endpoint_id


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/wake/authorizations",
        "params": params,
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | ListWakeAuthorizationsResponse200 | None:
    if response.status_code == 200:
        response_200 = ListWakeAuthorizationsResponse200.from_dict(response.json())



        return response_200

    if response.status_code == 400:
        response_400 = ErrorResponse.from_dict(response.json())



        return response_400

    if response.status_code == 401:
        response_401 = ErrorResponse.from_dict(response.json())



        return response_401

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | ListWakeAuthorizationsResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    recipient_endpoint_id: UUID | Unset = UNSET,

) -> Response[ErrorResponse | ListWakeAuthorizationsResponse200]:
    """ List wake authorizations

     Returns the per-target allowlist grants that authorize which senders may
    wake a function. Optionally filter by the target endpoint.

    Args:
        recipient_endpoint_id (UUID | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ListWakeAuthorizationsResponse200]
     """


    kwargs = _get_kwargs(
        recipient_endpoint_id=recipient_endpoint_id,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    *,
    client: AuthenticatedClient | Client,
    recipient_endpoint_id: UUID | Unset = UNSET,

) -> ErrorResponse | ListWakeAuthorizationsResponse200 | None:
    """ List wake authorizations

     Returns the per-target allowlist grants that authorize which senders may
    wake a function. Optionally filter by the target endpoint.

    Args:
        recipient_endpoint_id (UUID | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ListWakeAuthorizationsResponse200
     """


    return sync_detailed(
        client=client,
recipient_endpoint_id=recipient_endpoint_id,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    recipient_endpoint_id: UUID | Unset = UNSET,

) -> Response[ErrorResponse | ListWakeAuthorizationsResponse200]:
    """ List wake authorizations

     Returns the per-target allowlist grants that authorize which senders may
    wake a function. Optionally filter by the target endpoint.

    Args:
        recipient_endpoint_id (UUID | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ListWakeAuthorizationsResponse200]
     """


    kwargs = _get_kwargs(
        recipient_endpoint_id=recipient_endpoint_id,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    recipient_endpoint_id: UUID | Unset = UNSET,

) -> ErrorResponse | ListWakeAuthorizationsResponse200 | None:
    """ List wake authorizations

     Returns the per-target allowlist grants that authorize which senders may
    wake a function. Optionally filter by the target endpoint.

    Args:
        recipient_endpoint_id (UUID | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ListWakeAuthorizationsResponse200
     """


    return (await asyncio_detailed(
        client=client,
recipient_endpoint_id=recipient_endpoint_id,

    )).parsed
