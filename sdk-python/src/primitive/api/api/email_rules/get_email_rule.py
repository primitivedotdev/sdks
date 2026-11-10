from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.get_email_rule_include_sql import GetEmailRuleIncludeSql
from ...models.get_email_rule_response_200 import GetEmailRuleResponse200
from ...types import UNSET, Unset
from typing import cast
from uuid import UUID



def _get_kwargs(
    id: UUID,
    *,
    include_sql: GetEmailRuleIncludeSql | Unset = UNSET,

) -> dict[str, Any]:
    

    

    params: dict[str, Any] = {}

    json_include_sql: str | Unset = UNSET
    if not isinstance(include_sql, Unset):
        json_include_sql = include_sql.value

    params["include_sql"] = json_include_sql


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/email-rules/{id}".format(id=quote(str(id), safe=""),),
        "params": params,
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | GetEmailRuleResponse200 | None:
    if response.status_code == 200:
        response_200 = GetEmailRuleResponse200.from_dict(response.json())



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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | GetEmailRuleResponse200]:
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
    include_sql: GetEmailRuleIncludeSql | Unset = UNSET,

) -> Response[ErrorResponse | GetEmailRuleResponse200]:
    """ Read a rule

     A rule, its scope (evaluation_scope, and scope_selection for a selected rule) and its current
    version. What the scope comes to for its author now is GET /email-rules/{id}/scope. The SQL the
    version renders to is included only when include_sql is true. Needs mail:read, a credential acting
    as a member with their full access (API keys, agent keys and narrowed tokens are refused), and the
    email rules feature on the organization.

    Args:
        id (UUID):
        include_sql (GetEmailRuleIncludeSql | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | GetEmailRuleResponse200]
     """


    kwargs = _get_kwargs(
        id=id,
include_sql=include_sql,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    include_sql: GetEmailRuleIncludeSql | Unset = UNSET,

) -> ErrorResponse | GetEmailRuleResponse200 | None:
    """ Read a rule

     A rule, its scope (evaluation_scope, and scope_selection for a selected rule) and its current
    version. What the scope comes to for its author now is GET /email-rules/{id}/scope. The SQL the
    version renders to is included only when include_sql is true. Needs mail:read, a credential acting
    as a member with their full access (API keys, agent keys and narrowed tokens are refused), and the
    email rules feature on the organization.

    Args:
        id (UUID):
        include_sql (GetEmailRuleIncludeSql | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | GetEmailRuleResponse200
     """


    return sync_detailed(
        id=id,
client=client,
include_sql=include_sql,

    ).parsed

async def asyncio_detailed(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    include_sql: GetEmailRuleIncludeSql | Unset = UNSET,

) -> Response[ErrorResponse | GetEmailRuleResponse200]:
    """ Read a rule

     A rule, its scope (evaluation_scope, and scope_selection for a selected rule) and its current
    version. What the scope comes to for its author now is GET /email-rules/{id}/scope. The SQL the
    version renders to is included only when include_sql is true. Needs mail:read, a credential acting
    as a member with their full access (API keys, agent keys and narrowed tokens are refused), and the
    email rules feature on the organization.

    Args:
        id (UUID):
        include_sql (GetEmailRuleIncludeSql | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | GetEmailRuleResponse200]
     """


    kwargs = _get_kwargs(
        id=id,
include_sql=include_sql,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    include_sql: GetEmailRuleIncludeSql | Unset = UNSET,

) -> ErrorResponse | GetEmailRuleResponse200 | None:
    """ Read a rule

     A rule, its scope (evaluation_scope, and scope_selection for a selected rule) and its current
    version. What the scope comes to for its author now is GET /email-rules/{id}/scope. The SQL the
    version renders to is included only when include_sql is true. Needs mail:read, a credential acting
    as a member with their full access (API keys, agent keys and narrowed tokens are refused), and the
    email rules feature on the organization.

    Args:
        id (UUID):
        include_sql (GetEmailRuleIncludeSql | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | GetEmailRuleResponse200
     """


    return (await asyncio_detailed(
        id=id,
client=client,
include_sql=include_sql,

    )).parsed
