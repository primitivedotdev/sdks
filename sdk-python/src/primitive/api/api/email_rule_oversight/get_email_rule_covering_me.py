from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.get_email_rule_covering_me_response_200 import GetEmailRuleCoveringMeResponse200
from typing import cast
from uuid import UUID



def _get_kwargs(
    id: UUID,

) -> dict[str, Any]:
    

    

    

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/email-rules/covering-me/{id}".format(id=quote(str(id), safe=""),),
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | GetEmailRuleCoveringMeResponse200 | None:
    if response.status_code == 200:
        response_200 = GetEmailRuleCoveringMeResponse200.from_dict(response.json())



        return response_200

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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | GetEmailRuleCoveringMeResponse200]:
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

) -> Response[ErrorResponse | GetEmailRuleCoveringMeResponse200]:
    """ Get a rule over your mail

     One rule that covers one of your own mailboxes, read-only, with its current version; or one that no
    longer does but decided on mail at your own mailbox (covers_now false), shown as the version that
    last decided on your mail, without its current name. You see its name, wording, current tree, state,
    kind and author, and which of your own mailboxes it reaches. Its wording and tree are shown as
    written, so they can name other addresses (a condition on who an email is from or to). While it
    covers you, you also see who receives what it matches (receivers): how many API keys, webhooks and
    shares, the member each belongs to (or the organization), and the sites the webhooks deliver to. You
    do not see which keys, webhooks or shares they are (no ids, names, prefixes, or URLs beyond the
    site), the other inboxes and domains its scope names, or its saved expectations. Needs mail:read,
    the email rules feature, and a member's own full-access credential (no API key, agent key or
    narrowed token). Only on your own dashboard session or the Primitive CLI.

    Args:
        id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | GetEmailRuleCoveringMeResponse200]
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

) -> ErrorResponse | GetEmailRuleCoveringMeResponse200 | None:
    """ Get a rule over your mail

     One rule that covers one of your own mailboxes, read-only, with its current version; or one that no
    longer does but decided on mail at your own mailbox (covers_now false), shown as the version that
    last decided on your mail, without its current name. You see its name, wording, current tree, state,
    kind and author, and which of your own mailboxes it reaches. Its wording and tree are shown as
    written, so they can name other addresses (a condition on who an email is from or to). While it
    covers you, you also see who receives what it matches (receivers): how many API keys, webhooks and
    shares, the member each belongs to (or the organization), and the sites the webhooks deliver to. You
    do not see which keys, webhooks or shares they are (no ids, names, prefixes, or URLs beyond the
    site), the other inboxes and domains its scope names, or its saved expectations. Needs mail:read,
    the email rules feature, and a member's own full-access credential (no API key, agent key or
    narrowed token). Only on your own dashboard session or the Primitive CLI.

    Args:
        id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | GetEmailRuleCoveringMeResponse200
     """


    return sync_detailed(
        id=id,
client=client,

    ).parsed

async def asyncio_detailed(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,

) -> Response[ErrorResponse | GetEmailRuleCoveringMeResponse200]:
    """ Get a rule over your mail

     One rule that covers one of your own mailboxes, read-only, with its current version; or one that no
    longer does but decided on mail at your own mailbox (covers_now false), shown as the version that
    last decided on your mail, without its current name. You see its name, wording, current tree, state,
    kind and author, and which of your own mailboxes it reaches. Its wording and tree are shown as
    written, so they can name other addresses (a condition on who an email is from or to). While it
    covers you, you also see who receives what it matches (receivers): how many API keys, webhooks and
    shares, the member each belongs to (or the organization), and the sites the webhooks deliver to. You
    do not see which keys, webhooks or shares they are (no ids, names, prefixes, or URLs beyond the
    site), the other inboxes and domains its scope names, or its saved expectations. Needs mail:read,
    the email rules feature, and a member's own full-access credential (no API key, agent key or
    narrowed token). Only on your own dashboard session or the Primitive CLI.

    Args:
        id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | GetEmailRuleCoveringMeResponse200]
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

) -> ErrorResponse | GetEmailRuleCoveringMeResponse200 | None:
    """ Get a rule over your mail

     One rule that covers one of your own mailboxes, read-only, with its current version; or one that no
    longer does but decided on mail at your own mailbox (covers_now false), shown as the version that
    last decided on your mail, without its current name. You see its name, wording, current tree, state,
    kind and author, and which of your own mailboxes it reaches. Its wording and tree are shown as
    written, so they can name other addresses (a condition on who an email is from or to). While it
    covers you, you also see who receives what it matches (receivers): how many API keys, webhooks and
    shares, the member each belongs to (or the organization), and the sites the webhooks deliver to. You
    do not see which keys, webhooks or shares they are (no ids, names, prefixes, or URLs beyond the
    site), the other inboxes and domains its scope names, or its saved expectations. Needs mail:read,
    the email rules feature, and a member's own full-access credential (no API key, agent key or
    narrowed token). Only on your own dashboard session or the Primitive CLI.

    Args:
        id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | GetEmailRuleCoveringMeResponse200
     """


    return (await asyncio_detailed(
        id=id,
client=client,

    )).parsed
