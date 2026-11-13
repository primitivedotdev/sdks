from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.list_email_rules_covering_me_response_200 import ListEmailRulesCoveringMeResponse200
from ...types import UNSET, Unset
from typing import cast



def _get_kwargs(
    *,
    limit: int | Unset = 50,
    cursor: str | Unset = UNSET,

) -> dict[str, Any]:
    

    

    params: dict[str, Any] = {}

    params["limit"] = limit

    params["cursor"] = cursor


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/email-rules/covering-me",
        "params": params,
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | ListEmailRulesCoveringMeResponse200 | None:
    if response.status_code == 200:
        response_200 = ListEmailRulesCoveringMeResponse200.from_dict(response.json())



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

    if response.status_code == 429:
        response_429 = ErrorResponse.from_dict(response.json())



        return response_429

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | ListEmailRulesCoveringMeResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    limit: int | Unset = 50,
    cursor: str | Unset = UNSET,

) -> Response[ErrorResponse | ListEmailRulesCoveringMeResponse200]:
    """ List the rules over your mail

     Every email rule that covers one of your own mailboxes now, yours included, newest first, in any
    state. A rule covers you when the scope it runs with now reaches one of your own mailboxes (your
    member mailbox, or a personal agent's address): one whose author reads all your mail (author scope,
    for an author who reads the organization's mail or holds an access entry for your mailbox), or one
    that names your mailbox or its domain (selected). Another member's own_mailboxes rule never covers
    you. You see its name, wording, current tree, state, kind and author, and which of your own
    mailboxes it reaches. Its wording and tree are shown as written, so they can name other addresses (a
    condition on who an email is from or to). While it covers you, you also see who receives what it
    matches (receivers): how many API keys, webhooks and shares, the member each belongs to (or the
    organization), and the sites the webhooks deliver to. You do not see which keys, webhooks or shares
    they are (no ids, names, prefixes, or URLs beyond the site), the other inboxes and domains its scope
    names, or its saved expectations. A page can hold fewer rules than limit, or none, and still carry a
    cursor (one request reads a bounded number of rules): keep reading until meta.cursor is null. Needs
    mail:read, the email rules feature, and a member's own full-access credential (no API key, agent key
    or narrowed token). Only on your own dashboard session or the Primitive CLI.

    Args:
        limit (int | Unset):  Default: 50.
        cursor (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ListEmailRulesCoveringMeResponse200]
     """


    kwargs = _get_kwargs(
        limit=limit,
cursor=cursor,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    *,
    client: AuthenticatedClient | Client,
    limit: int | Unset = 50,
    cursor: str | Unset = UNSET,

) -> ErrorResponse | ListEmailRulesCoveringMeResponse200 | None:
    """ List the rules over your mail

     Every email rule that covers one of your own mailboxes now, yours included, newest first, in any
    state. A rule covers you when the scope it runs with now reaches one of your own mailboxes (your
    member mailbox, or a personal agent's address): one whose author reads all your mail (author scope,
    for an author who reads the organization's mail or holds an access entry for your mailbox), or one
    that names your mailbox or its domain (selected). Another member's own_mailboxes rule never covers
    you. You see its name, wording, current tree, state, kind and author, and which of your own
    mailboxes it reaches. Its wording and tree are shown as written, so they can name other addresses (a
    condition on who an email is from or to). While it covers you, you also see who receives what it
    matches (receivers): how many API keys, webhooks and shares, the member each belongs to (or the
    organization), and the sites the webhooks deliver to. You do not see which keys, webhooks or shares
    they are (no ids, names, prefixes, or URLs beyond the site), the other inboxes and domains its scope
    names, or its saved expectations. A page can hold fewer rules than limit, or none, and still carry a
    cursor (one request reads a bounded number of rules): keep reading until meta.cursor is null. Needs
    mail:read, the email rules feature, and a member's own full-access credential (no API key, agent key
    or narrowed token). Only on your own dashboard session or the Primitive CLI.

    Args:
        limit (int | Unset):  Default: 50.
        cursor (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ListEmailRulesCoveringMeResponse200
     """


    return sync_detailed(
        client=client,
limit=limit,
cursor=cursor,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    limit: int | Unset = 50,
    cursor: str | Unset = UNSET,

) -> Response[ErrorResponse | ListEmailRulesCoveringMeResponse200]:
    """ List the rules over your mail

     Every email rule that covers one of your own mailboxes now, yours included, newest first, in any
    state. A rule covers you when the scope it runs with now reaches one of your own mailboxes (your
    member mailbox, or a personal agent's address): one whose author reads all your mail (author scope,
    for an author who reads the organization's mail or holds an access entry for your mailbox), or one
    that names your mailbox or its domain (selected). Another member's own_mailboxes rule never covers
    you. You see its name, wording, current tree, state, kind and author, and which of your own
    mailboxes it reaches. Its wording and tree are shown as written, so they can name other addresses (a
    condition on who an email is from or to). While it covers you, you also see who receives what it
    matches (receivers): how many API keys, webhooks and shares, the member each belongs to (or the
    organization), and the sites the webhooks deliver to. You do not see which keys, webhooks or shares
    they are (no ids, names, prefixes, or URLs beyond the site), the other inboxes and domains its scope
    names, or its saved expectations. A page can hold fewer rules than limit, or none, and still carry a
    cursor (one request reads a bounded number of rules): keep reading until meta.cursor is null. Needs
    mail:read, the email rules feature, and a member's own full-access credential (no API key, agent key
    or narrowed token). Only on your own dashboard session or the Primitive CLI.

    Args:
        limit (int | Unset):  Default: 50.
        cursor (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ListEmailRulesCoveringMeResponse200]
     """


    kwargs = _get_kwargs(
        limit=limit,
cursor=cursor,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    limit: int | Unset = 50,
    cursor: str | Unset = UNSET,

) -> ErrorResponse | ListEmailRulesCoveringMeResponse200 | None:
    """ List the rules over your mail

     Every email rule that covers one of your own mailboxes now, yours included, newest first, in any
    state. A rule covers you when the scope it runs with now reaches one of your own mailboxes (your
    member mailbox, or a personal agent's address): one whose author reads all your mail (author scope,
    for an author who reads the organization's mail or holds an access entry for your mailbox), or one
    that names your mailbox or its domain (selected). Another member's own_mailboxes rule never covers
    you. You see its name, wording, current tree, state, kind and author, and which of your own
    mailboxes it reaches. Its wording and tree are shown as written, so they can name other addresses (a
    condition on who an email is from or to). While it covers you, you also see who receives what it
    matches (receivers): how many API keys, webhooks and shares, the member each belongs to (or the
    organization), and the sites the webhooks deliver to. You do not see which keys, webhooks or shares
    they are (no ids, names, prefixes, or URLs beyond the site), the other inboxes and domains its scope
    names, or its saved expectations. A page can hold fewer rules than limit, or none, and still carry a
    cursor (one request reads a bounded number of rules): keep reading until meta.cursor is null. Needs
    mail:read, the email rules feature, and a member's own full-access credential (no API key, agent key
    or narrowed token). Only on your own dashboard session or the Primitive CLI.

    Args:
        limit (int | Unset):  Default: 50.
        cursor (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ListEmailRulesCoveringMeResponse200
     """


    return (await asyncio_detailed(
        client=client,
limit=limit,
cursor=cursor,

    )).parsed
