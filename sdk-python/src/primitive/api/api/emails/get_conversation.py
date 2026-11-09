from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.get_conversation_response_200 import GetConversationResponse200
from ...models.get_conversation_text import GetConversationText
from ...types import UNSET, Unset
from typing import cast
from uuid import UUID



def _get_kwargs(
    id: UUID,
    *,
    since: str | Unset = UNSET,
    around: UUID | Unset = UNSET,
    before: str | Unset = UNSET,
    after: str | Unset = UNSET,
    limit: int | Unset = 25,
    text: GetConversationText | Unset = UNSET,

) -> dict[str, Any]:
    

    

    params: dict[str, Any] = {}

    params["since"] = since

    json_around: str | Unset = UNSET
    if not isinstance(around, Unset):
        json_around = str(around)
    params["around"] = json_around

    params["before"] = before

    params["after"] = after

    params["limit"] = limit

    json_text: str | Unset = UNSET
    if not isinstance(text, Unset):
        json_text = text.value

    params["text"] = json_text


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/emails/{id}/conversation".format(id=quote(str(id), safe=""),),
        "params": params,
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | GetConversationResponse200 | None:
    if response.status_code == 200:
        response_200 = GetConversationResponse200.from_dict(response.json())



        return response_200

    if response.status_code == 400:
        response_400 = ErrorResponse.from_dict(response.json())



        return response_400

    if response.status_code == 401:
        response_401 = ErrorResponse.from_dict(response.json())



        return response_401

    if response.status_code == 404:
        response_404 = ErrorResponse.from_dict(response.json())



        return response_404

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | GetConversationResponse200]:
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
    since: str | Unset = UNSET,
    around: UUID | Unset = UNSET,
    before: str | Unset = UNSET,
    after: str | Unset = UNSET,
    limit: int | Unset = 25,
    text: GetConversationText | Unset = UNSET,

) -> Response[ErrorResponse | GetConversationResponse200]:
    """ Get the conversation an email belongs to

     Returns the full conversation the given inbound email belongs
    to, as ordered, ready-to-prompt turns WITH bodies. It resolves
    the thread from the email and returns every message oldest-first,
    so an agent that received an email can pass `messages` straight
    to a chat model in one call instead of walking `/threads/{id}`
    plus `/emails/{id}` and `/sent-emails/{id}` per message.

    Each message carries a `direction` (`inbound` | `outbound`) and a
    derived `role`: `inbound` -> `user`, `outbound` -> `assistant`
    (your own prior replies). The role mapping assumes the caller
    owns the outbound side, which is the agent-reply case this exists
    for. If the email has no thread yet (a brand-new message), the
    conversation is just that one message as a single user turn.

    The message list is capped; check `truncated` to detect when
    older messages were omitted. Consecutive same-role turns are not
    merged here; that normalization is model-specific and left to the
    caller.

    Pass `since` for an incremental read. `since=start` returns the
    full conversation plus a `cursor`. Sending that `cursor` back as
    `since` returns only the messages created or changed after it,
    oldest first, with the same per-message shape, and a new
    `cursor`. Without `since` the response carries no `cursor` and
    no per-message `status`.

    To read an older part of a long conversation, such as the message a search result names, pass
    `around` with that message's id: the response is a window of messages around it with `before_cursor`
    and `after_cursor` to page older and newer. On these window reads `{id}` may be a sent email id as
    well as an inbound email id.

    Args:
        id (UUID):
        since (str | Unset):
        around (UUID | Unset):
        before (str | Unset):
        after (str | Unset):
        limit (int | Unset):  Default: 25.
        text (GetConversationText | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | GetConversationResponse200]
     """


    kwargs = _get_kwargs(
        id=id,
since=since,
around=around,
before=before,
after=after,
limit=limit,
text=text,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    since: str | Unset = UNSET,
    around: UUID | Unset = UNSET,
    before: str | Unset = UNSET,
    after: str | Unset = UNSET,
    limit: int | Unset = 25,
    text: GetConversationText | Unset = UNSET,

) -> ErrorResponse | GetConversationResponse200 | None:
    """ Get the conversation an email belongs to

     Returns the full conversation the given inbound email belongs
    to, as ordered, ready-to-prompt turns WITH bodies. It resolves
    the thread from the email and returns every message oldest-first,
    so an agent that received an email can pass `messages` straight
    to a chat model in one call instead of walking `/threads/{id}`
    plus `/emails/{id}` and `/sent-emails/{id}` per message.

    Each message carries a `direction` (`inbound` | `outbound`) and a
    derived `role`: `inbound` -> `user`, `outbound` -> `assistant`
    (your own prior replies). The role mapping assumes the caller
    owns the outbound side, which is the agent-reply case this exists
    for. If the email has no thread yet (a brand-new message), the
    conversation is just that one message as a single user turn.

    The message list is capped; check `truncated` to detect when
    older messages were omitted. Consecutive same-role turns are not
    merged here; that normalization is model-specific and left to the
    caller.

    Pass `since` for an incremental read. `since=start` returns the
    full conversation plus a `cursor`. Sending that `cursor` back as
    `since` returns only the messages created or changed after it,
    oldest first, with the same per-message shape, and a new
    `cursor`. Without `since` the response carries no `cursor` and
    no per-message `status`.

    To read an older part of a long conversation, such as the message a search result names, pass
    `around` with that message's id: the response is a window of messages around it with `before_cursor`
    and `after_cursor` to page older and newer. On these window reads `{id}` may be a sent email id as
    well as an inbound email id.

    Args:
        id (UUID):
        since (str | Unset):
        around (UUID | Unset):
        before (str | Unset):
        after (str | Unset):
        limit (int | Unset):  Default: 25.
        text (GetConversationText | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | GetConversationResponse200
     """


    return sync_detailed(
        id=id,
client=client,
since=since,
around=around,
before=before,
after=after,
limit=limit,
text=text,

    ).parsed

async def asyncio_detailed(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    since: str | Unset = UNSET,
    around: UUID | Unset = UNSET,
    before: str | Unset = UNSET,
    after: str | Unset = UNSET,
    limit: int | Unset = 25,
    text: GetConversationText | Unset = UNSET,

) -> Response[ErrorResponse | GetConversationResponse200]:
    """ Get the conversation an email belongs to

     Returns the full conversation the given inbound email belongs
    to, as ordered, ready-to-prompt turns WITH bodies. It resolves
    the thread from the email and returns every message oldest-first,
    so an agent that received an email can pass `messages` straight
    to a chat model in one call instead of walking `/threads/{id}`
    plus `/emails/{id}` and `/sent-emails/{id}` per message.

    Each message carries a `direction` (`inbound` | `outbound`) and a
    derived `role`: `inbound` -> `user`, `outbound` -> `assistant`
    (your own prior replies). The role mapping assumes the caller
    owns the outbound side, which is the agent-reply case this exists
    for. If the email has no thread yet (a brand-new message), the
    conversation is just that one message as a single user turn.

    The message list is capped; check `truncated` to detect when
    older messages were omitted. Consecutive same-role turns are not
    merged here; that normalization is model-specific and left to the
    caller.

    Pass `since` for an incremental read. `since=start` returns the
    full conversation plus a `cursor`. Sending that `cursor` back as
    `since` returns only the messages created or changed after it,
    oldest first, with the same per-message shape, and a new
    `cursor`. Without `since` the response carries no `cursor` and
    no per-message `status`.

    To read an older part of a long conversation, such as the message a search result names, pass
    `around` with that message's id: the response is a window of messages around it with `before_cursor`
    and `after_cursor` to page older and newer. On these window reads `{id}` may be a sent email id as
    well as an inbound email id.

    Args:
        id (UUID):
        since (str | Unset):
        around (UUID | Unset):
        before (str | Unset):
        after (str | Unset):
        limit (int | Unset):  Default: 25.
        text (GetConversationText | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | GetConversationResponse200]
     """


    kwargs = _get_kwargs(
        id=id,
since=since,
around=around,
before=before,
after=after,
limit=limit,
text=text,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    since: str | Unset = UNSET,
    around: UUID | Unset = UNSET,
    before: str | Unset = UNSET,
    after: str | Unset = UNSET,
    limit: int | Unset = 25,
    text: GetConversationText | Unset = UNSET,

) -> ErrorResponse | GetConversationResponse200 | None:
    """ Get the conversation an email belongs to

     Returns the full conversation the given inbound email belongs
    to, as ordered, ready-to-prompt turns WITH bodies. It resolves
    the thread from the email and returns every message oldest-first,
    so an agent that received an email can pass `messages` straight
    to a chat model in one call instead of walking `/threads/{id}`
    plus `/emails/{id}` and `/sent-emails/{id}` per message.

    Each message carries a `direction` (`inbound` | `outbound`) and a
    derived `role`: `inbound` -> `user`, `outbound` -> `assistant`
    (your own prior replies). The role mapping assumes the caller
    owns the outbound side, which is the agent-reply case this exists
    for. If the email has no thread yet (a brand-new message), the
    conversation is just that one message as a single user turn.

    The message list is capped; check `truncated` to detect when
    older messages were omitted. Consecutive same-role turns are not
    merged here; that normalization is model-specific and left to the
    caller.

    Pass `since` for an incremental read. `since=start` returns the
    full conversation plus a `cursor`. Sending that `cursor` back as
    `since` returns only the messages created or changed after it,
    oldest first, with the same per-message shape, and a new
    `cursor`. Without `since` the response carries no `cursor` and
    no per-message `status`.

    To read an older part of a long conversation, such as the message a search result names, pass
    `around` with that message's id: the response is a window of messages around it with `before_cursor`
    and `after_cursor` to page older and newer. On these window reads `{id}` may be a sent email id as
    well as an inbound email id.

    Args:
        id (UUID):
        since (str | Unset):
        around (UUID | Unset):
        before (str | Unset):
        after (str | Unset):
        limit (int | Unset):  Default: 25.
        text (GetConversationText | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | GetConversationResponse200
     """


    return (await asyncio_detailed(
        id=id,
client=client,
since=since,
around=around,
before=before,
after=after,
limit=limit,
text=text,

    )).parsed
