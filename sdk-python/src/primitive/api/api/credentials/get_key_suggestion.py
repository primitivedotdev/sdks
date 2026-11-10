from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.get_key_suggestion_response_200 import GetKeySuggestionResponse200
from typing import cast
from uuid import UUID



def _get_kwargs(
    id: UUID,

) -> dict[str, Any]:
    

    

    

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/keys/{id}/suggestion".format(id=quote(str(id), safe=""),),
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | GetKeySuggestionResponse200 | None:
    if response.status_code == 200:
        response_200 = GetKeySuggestionResponse200.from_dict(response.json())



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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | GetKeySuggestionResponse200]:
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

) -> Response[ErrorResponse | GetKeySuggestionResponse200]:
    """ Suggest a least-privilege grant for a key

     The permissions a key used over the last 30 days, as a custom grant that would have served every
    successful call (also as builder areas), the narrowest mail scope its calls support (depth is
    deprecated: raw when it downloaded raw MIME, otherwise content) (the mailboxes of the messages it
    named and sent, with notes on what the request log cannot account for), and whether it is unused.
    Calls to routes only the super admin key can use (groups and mailbox access) derive no permission,
    since a custom key is refused there; super_admin_only_calls counts them. usage gives the same window
    anonymized: successful and failed requests per UTC day, the routes called by their declared template
    (never the called path) with the permission each needed, and how many mailboxes the key read and
    sent from (counts only, and only for a person with access to the whole organization's mail). Nothing
    is applied: narrowing is a change to the key (PATCH /v1/keys/:id). Needs the organization's
    credential features to be enabled; while they are not, this answers 404 feature_disabled, with
    details.feature naming the feature. Contact Primitive to turn them on.

    Person only: a dashboard session. The person's role must hold credentials:read. API keys, agent
    connection keys and agents are refused.

    Args:
        id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | GetKeySuggestionResponse200]
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

) -> ErrorResponse | GetKeySuggestionResponse200 | None:
    """ Suggest a least-privilege grant for a key

     The permissions a key used over the last 30 days, as a custom grant that would have served every
    successful call (also as builder areas), the narrowest mail scope its calls support (depth is
    deprecated: raw when it downloaded raw MIME, otherwise content) (the mailboxes of the messages it
    named and sent, with notes on what the request log cannot account for), and whether it is unused.
    Calls to routes only the super admin key can use (groups and mailbox access) derive no permission,
    since a custom key is refused there; super_admin_only_calls counts them. usage gives the same window
    anonymized: successful and failed requests per UTC day, the routes called by their declared template
    (never the called path) with the permission each needed, and how many mailboxes the key read and
    sent from (counts only, and only for a person with access to the whole organization's mail). Nothing
    is applied: narrowing is a change to the key (PATCH /v1/keys/:id). Needs the organization's
    credential features to be enabled; while they are not, this answers 404 feature_disabled, with
    details.feature naming the feature. Contact Primitive to turn them on.

    Person only: a dashboard session. The person's role must hold credentials:read. API keys, agent
    connection keys and agents are refused.

    Args:
        id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | GetKeySuggestionResponse200
     """


    return sync_detailed(
        id=id,
client=client,

    ).parsed

async def asyncio_detailed(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,

) -> Response[ErrorResponse | GetKeySuggestionResponse200]:
    """ Suggest a least-privilege grant for a key

     The permissions a key used over the last 30 days, as a custom grant that would have served every
    successful call (also as builder areas), the narrowest mail scope its calls support (depth is
    deprecated: raw when it downloaded raw MIME, otherwise content) (the mailboxes of the messages it
    named and sent, with notes on what the request log cannot account for), and whether it is unused.
    Calls to routes only the super admin key can use (groups and mailbox access) derive no permission,
    since a custom key is refused there; super_admin_only_calls counts them. usage gives the same window
    anonymized: successful and failed requests per UTC day, the routes called by their declared template
    (never the called path) with the permission each needed, and how many mailboxes the key read and
    sent from (counts only, and only for a person with access to the whole organization's mail). Nothing
    is applied: narrowing is a change to the key (PATCH /v1/keys/:id). Needs the organization's
    credential features to be enabled; while they are not, this answers 404 feature_disabled, with
    details.feature naming the feature. Contact Primitive to turn them on.

    Person only: a dashboard session. The person's role must hold credentials:read. API keys, agent
    connection keys and agents are refused.

    Args:
        id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | GetKeySuggestionResponse200]
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

) -> ErrorResponse | GetKeySuggestionResponse200 | None:
    """ Suggest a least-privilege grant for a key

     The permissions a key used over the last 30 days, as a custom grant that would have served every
    successful call (also as builder areas), the narrowest mail scope its calls support (depth is
    deprecated: raw when it downloaded raw MIME, otherwise content) (the mailboxes of the messages it
    named and sent, with notes on what the request log cannot account for), and whether it is unused.
    Calls to routes only the super admin key can use (groups and mailbox access) derive no permission,
    since a custom key is refused there; super_admin_only_calls counts them. usage gives the same window
    anonymized: successful and failed requests per UTC day, the routes called by their declared template
    (never the called path) with the permission each needed, and how many mailboxes the key read and
    sent from (counts only, and only for a person with access to the whole organization's mail). Nothing
    is applied: narrowing is a change to the key (PATCH /v1/keys/:id). Needs the organization's
    credential features to be enabled; while they are not, this answers 404 feature_disabled, with
    details.feature naming the feature. Contact Primitive to turn them on.

    Person only: a dashboard session. The person's role must hold credentials:read. API keys, agent
    connection keys and agents are refused.

    Args:
        id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | GetKeySuggestionResponse200
     """


    return (await asyncio_detailed(
        id=id,
client=client,

    )).parsed
