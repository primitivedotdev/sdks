from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.list_email_rule_versions_response_200 import ListEmailRuleVersionsResponse200
from typing import cast
from uuid import UUID



def _get_kwargs(
    id: UUID,
    *,
    versions: str,

) -> dict[str, Any]:
    

    

    params: dict[str, Any] = {}

    params["versions"] = versions


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/email-rules/{id}/versions".format(id=quote(str(id), safe=""),),
        "params": params,
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | ListEmailRuleVersionsResponse200 | None:
    if response.status_code == 200:
        response_200 = ListEmailRuleVersionsResponse200.from_dict(response.json())



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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | ListEmailRuleVersionsResponse200]:
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
    versions: str,

) -> Response[ErrorResponse | ListEmailRuleVersionsResponse200]:
    """ Read versions of a rule

     The named versions of a rule, as they were written: what each one's conditions and questions were,
    so a decision can be read against the version that made it. Numbers that are not versions of the
    rule are left out. Needs mail:read, a credential acting as a member with their full access (API
    keys, agent keys and narrowed tokens are refused), and the email rules feature on the organization.

    Args:
        id (UUID):
        versions (str): The version numbers to read, comma-separated.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ListEmailRuleVersionsResponse200]
     """


    kwargs = _get_kwargs(
        id=id,
versions=versions,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    versions: str,

) -> ErrorResponse | ListEmailRuleVersionsResponse200 | None:
    """ Read versions of a rule

     The named versions of a rule, as they were written: what each one's conditions and questions were,
    so a decision can be read against the version that made it. Numbers that are not versions of the
    rule are left out. Needs mail:read, a credential acting as a member with their full access (API
    keys, agent keys and narrowed tokens are refused), and the email rules feature on the organization.

    Args:
        id (UUID):
        versions (str): The version numbers to read, comma-separated.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ListEmailRuleVersionsResponse200
     """


    return sync_detailed(
        id=id,
client=client,
versions=versions,

    ).parsed

async def asyncio_detailed(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    versions: str,

) -> Response[ErrorResponse | ListEmailRuleVersionsResponse200]:
    """ Read versions of a rule

     The named versions of a rule, as they were written: what each one's conditions and questions were,
    so a decision can be read against the version that made it. Numbers that are not versions of the
    rule are left out. Needs mail:read, a credential acting as a member with their full access (API
    keys, agent keys and narrowed tokens are refused), and the email rules feature on the organization.

    Args:
        id (UUID):
        versions (str): The version numbers to read, comma-separated.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ListEmailRuleVersionsResponse200]
     """


    kwargs = _get_kwargs(
        id=id,
versions=versions,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    versions: str,

) -> ErrorResponse | ListEmailRuleVersionsResponse200 | None:
    """ Read versions of a rule

     The named versions of a rule, as they were written: what each one's conditions and questions were,
    so a decision can be read against the version that made it. Numbers that are not versions of the
    rule are left out. Needs mail:read, a credential acting as a member with their full access (API
    keys, agent keys and narrowed tokens are refused), and the email rules feature on the organization.

    Args:
        id (UUID):
        versions (str): The version numbers to read, comma-separated.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ListEmailRuleVersionsResponse200
     """


    return (await asyncio_detailed(
        id=id,
client=client,
versions=versions,

    )).parsed
