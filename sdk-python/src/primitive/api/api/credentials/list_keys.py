from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.list_keys_include_revoked import ListKeysIncludeRevoked
from ...models.list_keys_response_200 import ListKeysResponse200
from ...types import UNSET, Unset
from typing import cast



def _get_kwargs(
    *,
    cursor: str | Unset = UNSET,
    include_revoked: ListKeysIncludeRevoked | Unset = UNSET,

) -> dict[str, Any]:
    

    

    params: dict[str, Any] = {}

    params["cursor"] = cursor

    json_include_revoked: str | Unset = UNSET
    if not isinstance(include_revoked, Unset):
        json_include_revoked = include_revoked.value

    params["include_revoked"] = json_include_revoked


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/keys",
        "params": params,
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | ListKeysResponse200 | None:
    if response.status_code == 200:
        response_200 = ListKeysResponse200.from_dict(response.json())



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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | ListKeysResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    cursor: str | Unset = UNSET,
    include_revoked: ListKeysIncludeRevoked | Unset = UNSET,

) -> Response[ErrorResponse | ListKeysResponse200]:
    """ List API keys

     Key metadata, never a secret: name, prefix, grant, creator, last use, expiry, suspension and whether
    each key works now (status). Revoked keys are left out unless include_revoked is true, which lists
    them too with status revoked, revoked_at and revoked_by, under the same access rules as keys that
    work. A grant's mail_scope.depth is raw only when the key holds mail.raw:read and its scope lists an
    address or a domain, otherwise content. A rule the key lists that reads nothing any more (a deleted
    rule, or a share that ended) is listed under grant.mail_scope.ended_rules, each with its id and
    reason (rule_deleted or share_ended), and not under rules. The person needs access to the whole
    organization's mail. Needs the organization's credential features to be enabled; while they are not,
    this answers 404 feature_disabled, with details.feature naming the feature. Contact Primitive to
    turn them on.

    Person only: a dashboard session or the person's own Primitive CLI token; no other OAuth app. The
    person's role must hold keys:read. API keys, agent connection keys and agents are refused.

    Args:
        cursor (str | Unset):
        include_revoked (ListKeysIncludeRevoked | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ListKeysResponse200]
     """


    kwargs = _get_kwargs(
        cursor=cursor,
include_revoked=include_revoked,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    *,
    client: AuthenticatedClient | Client,
    cursor: str | Unset = UNSET,
    include_revoked: ListKeysIncludeRevoked | Unset = UNSET,

) -> ErrorResponse | ListKeysResponse200 | None:
    """ List API keys

     Key metadata, never a secret: name, prefix, grant, creator, last use, expiry, suspension and whether
    each key works now (status). Revoked keys are left out unless include_revoked is true, which lists
    them too with status revoked, revoked_at and revoked_by, under the same access rules as keys that
    work. A grant's mail_scope.depth is raw only when the key holds mail.raw:read and its scope lists an
    address or a domain, otherwise content. A rule the key lists that reads nothing any more (a deleted
    rule, or a share that ended) is listed under grant.mail_scope.ended_rules, each with its id and
    reason (rule_deleted or share_ended), and not under rules. The person needs access to the whole
    organization's mail. Needs the organization's credential features to be enabled; while they are not,
    this answers 404 feature_disabled, with details.feature naming the feature. Contact Primitive to
    turn them on.

    Person only: a dashboard session or the person's own Primitive CLI token; no other OAuth app. The
    person's role must hold keys:read. API keys, agent connection keys and agents are refused.

    Args:
        cursor (str | Unset):
        include_revoked (ListKeysIncludeRevoked | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ListKeysResponse200
     """


    return sync_detailed(
        client=client,
cursor=cursor,
include_revoked=include_revoked,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    cursor: str | Unset = UNSET,
    include_revoked: ListKeysIncludeRevoked | Unset = UNSET,

) -> Response[ErrorResponse | ListKeysResponse200]:
    """ List API keys

     Key metadata, never a secret: name, prefix, grant, creator, last use, expiry, suspension and whether
    each key works now (status). Revoked keys are left out unless include_revoked is true, which lists
    them too with status revoked, revoked_at and revoked_by, under the same access rules as keys that
    work. A grant's mail_scope.depth is raw only when the key holds mail.raw:read and its scope lists an
    address or a domain, otherwise content. A rule the key lists that reads nothing any more (a deleted
    rule, or a share that ended) is listed under grant.mail_scope.ended_rules, each with its id and
    reason (rule_deleted or share_ended), and not under rules. The person needs access to the whole
    organization's mail. Needs the organization's credential features to be enabled; while they are not,
    this answers 404 feature_disabled, with details.feature naming the feature. Contact Primitive to
    turn them on.

    Person only: a dashboard session or the person's own Primitive CLI token; no other OAuth app. The
    person's role must hold keys:read. API keys, agent connection keys and agents are refused.

    Args:
        cursor (str | Unset):
        include_revoked (ListKeysIncludeRevoked | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ListKeysResponse200]
     """


    kwargs = _get_kwargs(
        cursor=cursor,
include_revoked=include_revoked,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    cursor: str | Unset = UNSET,
    include_revoked: ListKeysIncludeRevoked | Unset = UNSET,

) -> ErrorResponse | ListKeysResponse200 | None:
    """ List API keys

     Key metadata, never a secret: name, prefix, grant, creator, last use, expiry, suspension and whether
    each key works now (status). Revoked keys are left out unless include_revoked is true, which lists
    them too with status revoked, revoked_at and revoked_by, under the same access rules as keys that
    work. A grant's mail_scope.depth is raw only when the key holds mail.raw:read and its scope lists an
    address or a domain, otherwise content. A rule the key lists that reads nothing any more (a deleted
    rule, or a share that ended) is listed under grant.mail_scope.ended_rules, each with its id and
    reason (rule_deleted or share_ended), and not under rules. The person needs access to the whole
    organization's mail. Needs the organization's credential features to be enabled; while they are not,
    this answers 404 feature_disabled, with details.feature naming the feature. Contact Primitive to
    turn them on.

    Person only: a dashboard session or the person's own Primitive CLI token; no other OAuth app. The
    person's role must hold keys:read. API keys, agent connection keys and agents are refused.

    Args:
        cursor (str | Unset):
        include_revoked (ListKeysIncludeRevoked | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ListKeysResponse200
     """


    return (await asyncio_detailed(
        client=client,
cursor=cursor,
include_revoked=include_revoked,

    )).parsed
