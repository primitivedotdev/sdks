from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.list_organization_invitations_response_200 import ListOrganizationInvitationsResponse200
from ...types import UNSET, Unset
from typing import cast
from uuid import UUID



def _get_kwargs(
    *,
    cursor: UUID | Unset = UNSET,
    limit: int | Unset = 50,

) -> dict[str, Any]:
    

    

    params: dict[str, Any] = {}

    json_cursor: str | Unset = UNSET
    if not isinstance(cursor, Unset):
        json_cursor = str(cursor)
    params["cursor"] = json_cursor

    params["limit"] = limit


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/organization/invitations",
        "params": params,
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | ListOrganizationInvitationsResponse200 | None:
    if response.status_code == 200:
        response_200 = ListOrganizationInvitationsResponse200.from_dict(response.json())



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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | ListOrganizationInvitationsResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    cursor: UUID | Unset = UNSET,
    limit: int | Unset = 50,

) -> Response[ErrorResponse | ListOrganizationInvitationsResponse200]:
    """  Requires a current human organization owner or administrator. Machine credentials are refused.
    Invitations grant the chosen role, Member by default, only after verified acceptance through the
    sign-in or sign-up flow. Other organization memberships and project access are unchanged. Delivery
    accepted means submitted, not inbox delivery. Reuse request_id after an uncertain response.

    Args:
        cursor (UUID | Unset):
        limit (int | Unset):  Default: 50.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ListOrganizationInvitationsResponse200]
     """


    kwargs = _get_kwargs(
        cursor=cursor,
limit=limit,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    *,
    client: AuthenticatedClient | Client,
    cursor: UUID | Unset = UNSET,
    limit: int | Unset = 50,

) -> ErrorResponse | ListOrganizationInvitationsResponse200 | None:
    """  Requires a current human organization owner or administrator. Machine credentials are refused.
    Invitations grant the chosen role, Member by default, only after verified acceptance through the
    sign-in or sign-up flow. Other organization memberships and project access are unchanged. Delivery
    accepted means submitted, not inbox delivery. Reuse request_id after an uncertain response.

    Args:
        cursor (UUID | Unset):
        limit (int | Unset):  Default: 50.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ListOrganizationInvitationsResponse200
     """


    return sync_detailed(
        client=client,
cursor=cursor,
limit=limit,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    cursor: UUID | Unset = UNSET,
    limit: int | Unset = 50,

) -> Response[ErrorResponse | ListOrganizationInvitationsResponse200]:
    """  Requires a current human organization owner or administrator. Machine credentials are refused.
    Invitations grant the chosen role, Member by default, only after verified acceptance through the
    sign-in or sign-up flow. Other organization memberships and project access are unchanged. Delivery
    accepted means submitted, not inbox delivery. Reuse request_id after an uncertain response.

    Args:
        cursor (UUID | Unset):
        limit (int | Unset):  Default: 50.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ListOrganizationInvitationsResponse200]
     """


    kwargs = _get_kwargs(
        cursor=cursor,
limit=limit,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    cursor: UUID | Unset = UNSET,
    limit: int | Unset = 50,

) -> ErrorResponse | ListOrganizationInvitationsResponse200 | None:
    """  Requires a current human organization owner or administrator. Machine credentials are refused.
    Invitations grant the chosen role, Member by default, only after verified acceptance through the
    sign-in or sign-up flow. Other organization memberships and project access are unchanged. Delivery
    accepted means submitted, not inbox delivery. Reuse request_id after an uncertain response.

    Args:
        cursor (UUID | Unset):
        limit (int | Unset):  Default: 50.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ListOrganizationInvitationsResponse200
     """


    return (await asyncio_detailed(
        client=client,
cursor=cursor,
limit=limit,

    )).parsed
