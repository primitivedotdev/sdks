from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.list_organization_people_response_200 import ListOrganizationPeopleResponse200
from ...types import UNSET, Unset
from typing import cast
from uuid import UUID



def _get_kwargs(
    *,
    cursor: UUID | Unset = UNSET,
    limit: int | Unset = 50,
    query: str | Unset = UNSET,

) -> dict[str, Any]:
    

    

    params: dict[str, Any] = {}

    json_cursor: str | Unset = UNSET
    if not isinstance(cursor, Unset):
        json_cursor = str(cursor)
    params["cursor"] = json_cursor

    params["limit"] = limit

    params["query"] = query


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/organization/members",
        "params": params,
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | ListOrganizationPeopleResponse200 | None:
    if response.status_code == 200:
        response_200 = ListOrganizationPeopleResponse200.from_dict(response.json())



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

    if response.status_code == 503:
        response_503 = ErrorResponse.from_dict(response.json())



        return response_503

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | ListOrganizationPeopleResponse200]:
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
    query: str | Unset = UNSET,

) -> Response[ErrorResponse | ListOrganizationPeopleResponse200]:
    """  Requires a current human organization membership, or an org-wide API key: a super admin key, or a
    custom key with no addresses or domains whose grant holds members:read. A key lists members as the
    person it belongs to, at that person's live grant, and only while that person still holds
    members:read. Narrowed, Function and connected keys are refused. No local paths or existing
    conversation history are shared.

    Args:
        cursor (UUID | Unset):
        limit (int | Unset):  Default: 50.
        query (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ListOrganizationPeopleResponse200]
     """


    kwargs = _get_kwargs(
        cursor=cursor,
limit=limit,
query=query,

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
    query: str | Unset = UNSET,

) -> ErrorResponse | ListOrganizationPeopleResponse200 | None:
    """  Requires a current human organization membership, or an org-wide API key: a super admin key, or a
    custom key with no addresses or domains whose grant holds members:read. A key lists members as the
    person it belongs to, at that person's live grant, and only while that person still holds
    members:read. Narrowed, Function and connected keys are refused. No local paths or existing
    conversation history are shared.

    Args:
        cursor (UUID | Unset):
        limit (int | Unset):  Default: 50.
        query (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ListOrganizationPeopleResponse200
     """


    return sync_detailed(
        client=client,
cursor=cursor,
limit=limit,
query=query,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    cursor: UUID | Unset = UNSET,
    limit: int | Unset = 50,
    query: str | Unset = UNSET,

) -> Response[ErrorResponse | ListOrganizationPeopleResponse200]:
    """  Requires a current human organization membership, or an org-wide API key: a super admin key, or a
    custom key with no addresses or domains whose grant holds members:read. A key lists members as the
    person it belongs to, at that person's live grant, and only while that person still holds
    members:read. Narrowed, Function and connected keys are refused. No local paths or existing
    conversation history are shared.

    Args:
        cursor (UUID | Unset):
        limit (int | Unset):  Default: 50.
        query (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ListOrganizationPeopleResponse200]
     """


    kwargs = _get_kwargs(
        cursor=cursor,
limit=limit,
query=query,

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
    query: str | Unset = UNSET,

) -> ErrorResponse | ListOrganizationPeopleResponse200 | None:
    """  Requires a current human organization membership, or an org-wide API key: a super admin key, or a
    custom key with no addresses or domains whose grant holds members:read. A key lists members as the
    person it belongs to, at that person's live grant, and only while that person still holds
    members:read. Narrowed, Function and connected keys are refused. No local paths or existing
    conversation history are shared.

    Args:
        cursor (UUID | Unset):
        limit (int | Unset):  Default: 50.
        query (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ListOrganizationPeopleResponse200
     """


    return (await asyncio_detailed(
        client=client,
cursor=cursor,
limit=limit,
query=query,

    )).parsed
