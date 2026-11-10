from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.update_email_rule_request import UpdateEmailRuleRequest
from ...models.update_email_rule_response_200 import UpdateEmailRuleResponse200
from typing import cast
from uuid import UUID



def _get_kwargs(
    id: UUID,
    *,
    body: UpdateEmailRuleRequest,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "patch",
        "url": "/email-rules/{id}".format(id=quote(str(id), safe=""),),
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | UpdateEmailRuleResponse200 | None:
    if response.status_code == 200:
        response_200 = UpdateEmailRuleResponse200.from_dict(response.json())



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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | UpdateEmailRuleResponse200]:
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
    body: UpdateEmailRuleRequest,

) -> Response[ErrorResponse | UpdateEmailRuleResponse200]:
    """ Change a rule

     Renames the rule, saves a new version (english, tree and explanation together; earlier versions are
    kept unchanged), changes its state (draft, disabled; observe; or active) or changes whose mail it
    runs over (evaluation_scope, with scope_selection when selected). Only the rule's author may rename
    it, add a version, change its scope or move it to observe or active; anyone else who can see it may
    only disable it (state draft), and while it is shared with another member only if they manage
    members from the dashboard. Omit evaluation_scope to keep the current scope. A scope change saves a
    new version with the same conditions; what was granted stays. A shared rule keeps its scope. Needs
    mail:read, a credential acting as a member with their full access (API keys, agent keys and narrowed
    tokens are refused), and the email rules feature on the organization.

    Args:
        id (UUID):
        body (UpdateEmailRuleRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | UpdateEmailRuleResponse200]
     """


    kwargs = _get_kwargs(
        id=id,
body=body,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: UpdateEmailRuleRequest,

) -> ErrorResponse | UpdateEmailRuleResponse200 | None:
    """ Change a rule

     Renames the rule, saves a new version (english, tree and explanation together; earlier versions are
    kept unchanged), changes its state (draft, disabled; observe; or active) or changes whose mail it
    runs over (evaluation_scope, with scope_selection when selected). Only the rule's author may rename
    it, add a version, change its scope or move it to observe or active; anyone else who can see it may
    only disable it (state draft), and while it is shared with another member only if they manage
    members from the dashboard. Omit evaluation_scope to keep the current scope. A scope change saves a
    new version with the same conditions; what was granted stays. A shared rule keeps its scope. Needs
    mail:read, a credential acting as a member with their full access (API keys, agent keys and narrowed
    tokens are refused), and the email rules feature on the organization.

    Args:
        id (UUID):
        body (UpdateEmailRuleRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | UpdateEmailRuleResponse200
     """


    return sync_detailed(
        id=id,
client=client,
body=body,

    ).parsed

async def asyncio_detailed(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: UpdateEmailRuleRequest,

) -> Response[ErrorResponse | UpdateEmailRuleResponse200]:
    """ Change a rule

     Renames the rule, saves a new version (english, tree and explanation together; earlier versions are
    kept unchanged), changes its state (draft, disabled; observe; or active) or changes whose mail it
    runs over (evaluation_scope, with scope_selection when selected). Only the rule's author may rename
    it, add a version, change its scope or move it to observe or active; anyone else who can see it may
    only disable it (state draft), and while it is shared with another member only if they manage
    members from the dashboard. Omit evaluation_scope to keep the current scope. A scope change saves a
    new version with the same conditions; what was granted stays. A shared rule keeps its scope. Needs
    mail:read, a credential acting as a member with their full access (API keys, agent keys and narrowed
    tokens are refused), and the email rules feature on the organization.

    Args:
        id (UUID):
        body (UpdateEmailRuleRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | UpdateEmailRuleResponse200]
     """


    kwargs = _get_kwargs(
        id=id,
body=body,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: UpdateEmailRuleRequest,

) -> ErrorResponse | UpdateEmailRuleResponse200 | None:
    """ Change a rule

     Renames the rule, saves a new version (english, tree and explanation together; earlier versions are
    kept unchanged), changes its state (draft, disabled; observe; or active) or changes whose mail it
    runs over (evaluation_scope, with scope_selection when selected). Only the rule's author may rename
    it, add a version, change its scope or move it to observe or active; anyone else who can see it may
    only disable it (state draft), and while it is shared with another member only if they manage
    members from the dashboard. Omit evaluation_scope to keep the current scope. A scope change saves a
    new version with the same conditions; what was granted stays. A shared rule keeps its scope. Needs
    mail:read, a credential acting as a member with their full access (API keys, agent keys and narrowed
    tokens are refused), and the email rules feature on the organization.

    Args:
        id (UUID):
        body (UpdateEmailRuleRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | UpdateEmailRuleResponse200
     """


    return (await asyncio_detailed(
        id=id,
client=client,
body=body,

    )).parsed
