from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.list_email_rule_versions_covering_me_response_200 import ListEmailRuleVersionsCoveringMeResponse200
from ...types import UNSET, Unset
from typing import cast
from uuid import UUID



def _get_kwargs(
    id: UUID,
    *,
    limit: int | Unset = UNSET,
    cursor: str | Unset = UNSET,
    versions: str | Unset = UNSET,

) -> dict[str, Any]:
    

    

    params: dict[str, Any] = {}

    params["limit"] = limit

    params["cursor"] = cursor

    params["versions"] = versions


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/email-rules/covering-me/{id}/versions".format(id=quote(str(id), safe=""),),
        "params": params,
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | ListEmailRuleVersionsCoveringMeResponse200 | None:
    if response.status_code == 200:
        response_200 = ListEmailRuleVersionsCoveringMeResponse200.from_dict(response.json())



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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | ListEmailRuleVersionsCoveringMeResponse200]:
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
    limit: int | Unset = UNSET,
    cursor: str | Unset = UNSET,
    versions: str | Unset = UNSET,

) -> Response[ErrorResponse | ListEmailRuleVersionsCoveringMeResponse200]:
    """ Read versions of a rule over your mail

     The versions of a rule that covers one of your own mailboxes now that applied to your mail: its
    current version and each earlier one that decided on mail at your own mailboxes, so a decision can
    be read in the words of the version that made it. Each has what the covering view shows of a
    version: its wording, tree, explanation and assumptions. A version that did neither is not listed.
    Without versions, newest first, a page at a time (meta.cursor); with versions, only those named that
    are listed, oldest first. Needs mail:read, the email rules feature, and a member's own full-access
    credential (no API key, agent key or narrowed token). Only on your own dashboard session or the
    Primitive CLI.

    Args:
        id (UUID):
        limit (int | Unset):
        cursor (str | Unset):
        versions (str | Unset): Read only these version numbers, comma-separated. Without it, the
            versions listed, newest first, a page at a time.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ListEmailRuleVersionsCoveringMeResponse200]
     """


    kwargs = _get_kwargs(
        id=id,
limit=limit,
cursor=cursor,
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
    limit: int | Unset = UNSET,
    cursor: str | Unset = UNSET,
    versions: str | Unset = UNSET,

) -> ErrorResponse | ListEmailRuleVersionsCoveringMeResponse200 | None:
    """ Read versions of a rule over your mail

     The versions of a rule that covers one of your own mailboxes now that applied to your mail: its
    current version and each earlier one that decided on mail at your own mailboxes, so a decision can
    be read in the words of the version that made it. Each has what the covering view shows of a
    version: its wording, tree, explanation and assumptions. A version that did neither is not listed.
    Without versions, newest first, a page at a time (meta.cursor); with versions, only those named that
    are listed, oldest first. Needs mail:read, the email rules feature, and a member's own full-access
    credential (no API key, agent key or narrowed token). Only on your own dashboard session or the
    Primitive CLI.

    Args:
        id (UUID):
        limit (int | Unset):
        cursor (str | Unset):
        versions (str | Unset): Read only these version numbers, comma-separated. Without it, the
            versions listed, newest first, a page at a time.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ListEmailRuleVersionsCoveringMeResponse200
     """


    return sync_detailed(
        id=id,
client=client,
limit=limit,
cursor=cursor,
versions=versions,

    ).parsed

async def asyncio_detailed(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    limit: int | Unset = UNSET,
    cursor: str | Unset = UNSET,
    versions: str | Unset = UNSET,

) -> Response[ErrorResponse | ListEmailRuleVersionsCoveringMeResponse200]:
    """ Read versions of a rule over your mail

     The versions of a rule that covers one of your own mailboxes now that applied to your mail: its
    current version and each earlier one that decided on mail at your own mailboxes, so a decision can
    be read in the words of the version that made it. Each has what the covering view shows of a
    version: its wording, tree, explanation and assumptions. A version that did neither is not listed.
    Without versions, newest first, a page at a time (meta.cursor); with versions, only those named that
    are listed, oldest first. Needs mail:read, the email rules feature, and a member's own full-access
    credential (no API key, agent key or narrowed token). Only on your own dashboard session or the
    Primitive CLI.

    Args:
        id (UUID):
        limit (int | Unset):
        cursor (str | Unset):
        versions (str | Unset): Read only these version numbers, comma-separated. Without it, the
            versions listed, newest first, a page at a time.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ListEmailRuleVersionsCoveringMeResponse200]
     """


    kwargs = _get_kwargs(
        id=id,
limit=limit,
cursor=cursor,
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
    limit: int | Unset = UNSET,
    cursor: str | Unset = UNSET,
    versions: str | Unset = UNSET,

) -> ErrorResponse | ListEmailRuleVersionsCoveringMeResponse200 | None:
    """ Read versions of a rule over your mail

     The versions of a rule that covers one of your own mailboxes now that applied to your mail: its
    current version and each earlier one that decided on mail at your own mailboxes, so a decision can
    be read in the words of the version that made it. Each has what the covering view shows of a
    version: its wording, tree, explanation and assumptions. A version that did neither is not listed.
    Without versions, newest first, a page at a time (meta.cursor); with versions, only those named that
    are listed, oldest first. Needs mail:read, the email rules feature, and a member's own full-access
    credential (no API key, agent key or narrowed token). Only on your own dashboard session or the
    Primitive CLI.

    Args:
        id (UUID):
        limit (int | Unset):
        cursor (str | Unset):
        versions (str | Unset): Read only these version numbers, comma-separated. Without it, the
            versions listed, newest first, a page at a time.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ListEmailRuleVersionsCoveringMeResponse200
     """


    return (await asyncio_detailed(
        id=id,
client=client,
limit=limit,
cursor=cursor,
versions=versions,

    )).parsed
