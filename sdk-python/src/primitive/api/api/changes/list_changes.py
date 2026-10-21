from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.list_changes_expand import ListChangesExpand
from ...models.list_changes_response_200 import ListChangesResponse200
from ...types import UNSET, Unset
from typing import cast



def _get_kwargs(
    *,
    since: str | Unset = UNSET,
    wait: int | Unset = 0,
    limit: int | Unset = 100,
    expand: ListChangesExpand | Unset = UNSET,
    address: str | Unset = UNSET,

) -> dict[str, Any]:
    

    

    params: dict[str, Any] = {}

    params["since"] = since

    params["wait"] = wait

    params["limit"] = limit

    json_expand: str | Unset = UNSET
    if not isinstance(expand, Unset):
        json_expand = expand.value

    params["expand"] = json_expand

    params["address"] = address


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/changes",
        "params": params,
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | ListChangesResponse200 | None:
    if response.status_code == 200:
        response_200 = ListChangesResponse200.from_dict(response.json())



        return response_200

    if response.status_code == 400:
        response_400 = ErrorResponse.from_dict(response.json())



        return response_400

    if response.status_code == 401:
        response_401 = ErrorResponse.from_dict(response.json())



        return response_401

    if response.status_code == 410:
        response_410 = ErrorResponse.from_dict(response.json())



        return response_410

    if response.status_code == 429:
        response_429 = ErrorResponse.from_dict(response.json())



        return response_429

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | ListChangesResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient,
    since: str | Unset = UNSET,
    wait: int | Unset = 0,
    limit: int | Unset = 100,
    expand: ListChangesExpand | Unset = UNSET,
    address: str | Unset = UNSET,

) -> Response[ErrorResponse | ListChangesResponse200]:
    """ Long-poll what changed

     One feed of small invalidations (ids and kinds) for everything an app keeps a snapshot of: inbound
    mail, sent mail, the member's conversation read state, the agent directory and presence, and the
    credential's own access. Non-consumptive and replayable: any number of devices can read the same
    cursor independently.

    Start with `since=start` (or no `since`): it returns an empty page whose `next_cursor` is a
    baseline. Take it BEFORE the initial list reads; every change that commits after it is delivered,
    including ones those reads already reflect. Then call with `since=<next_cursor>&wait=20` in a loop.
    Changes come oldest first in commit order, at least once: a write that commits late is never
    skipped, because positions are assigned at commit.

    Every change is scoped to what this credential's full reads would show: a connected agent sees only
    its own mail, its own sends and sends it provably received; mail held for sender authentication is
    announced only when released; read state reaches only the member it belongs to; agent changes reach
    members and agents allowed to view the network; organization API keys receive no agent changes.
    Function credentials cannot call this.

    Changes are kept 7 days. A cursor answers 410 `cursor_expired` only when changes after it were
    pruned (an idle cursor stays valid); rebuild the snapshots from `since=start`.

    Args:
        since (str | Unset):
        wait (int | Unset):  Default: 0.
        limit (int | Unset):  Default: 100.
        expand (ListChangesExpand | Unset):
        address (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ListChangesResponse200]
     """


    kwargs = _get_kwargs(
        since=since,
wait=wait,
limit=limit,
expand=expand,
address=address,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    *,
    client: AuthenticatedClient,
    since: str | Unset = UNSET,
    wait: int | Unset = 0,
    limit: int | Unset = 100,
    expand: ListChangesExpand | Unset = UNSET,
    address: str | Unset = UNSET,

) -> ErrorResponse | ListChangesResponse200 | None:
    """ Long-poll what changed

     One feed of small invalidations (ids and kinds) for everything an app keeps a snapshot of: inbound
    mail, sent mail, the member's conversation read state, the agent directory and presence, and the
    credential's own access. Non-consumptive and replayable: any number of devices can read the same
    cursor independently.

    Start with `since=start` (or no `since`): it returns an empty page whose `next_cursor` is a
    baseline. Take it BEFORE the initial list reads; every change that commits after it is delivered,
    including ones those reads already reflect. Then call with `since=<next_cursor>&wait=20` in a loop.
    Changes come oldest first in commit order, at least once: a write that commits late is never
    skipped, because positions are assigned at commit.

    Every change is scoped to what this credential's full reads would show: a connected agent sees only
    its own mail, its own sends and sends it provably received; mail held for sender authentication is
    announced only when released; read state reaches only the member it belongs to; agent changes reach
    members and agents allowed to view the network; organization API keys receive no agent changes.
    Function credentials cannot call this.

    Changes are kept 7 days. A cursor answers 410 `cursor_expired` only when changes after it were
    pruned (an idle cursor stays valid); rebuild the snapshots from `since=start`.

    Args:
        since (str | Unset):
        wait (int | Unset):  Default: 0.
        limit (int | Unset):  Default: 100.
        expand (ListChangesExpand | Unset):
        address (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ListChangesResponse200
     """


    return sync_detailed(
        client=client,
since=since,
wait=wait,
limit=limit,
expand=expand,
address=address,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient,
    since: str | Unset = UNSET,
    wait: int | Unset = 0,
    limit: int | Unset = 100,
    expand: ListChangesExpand | Unset = UNSET,
    address: str | Unset = UNSET,

) -> Response[ErrorResponse | ListChangesResponse200]:
    """ Long-poll what changed

     One feed of small invalidations (ids and kinds) for everything an app keeps a snapshot of: inbound
    mail, sent mail, the member's conversation read state, the agent directory and presence, and the
    credential's own access. Non-consumptive and replayable: any number of devices can read the same
    cursor independently.

    Start with `since=start` (or no `since`): it returns an empty page whose `next_cursor` is a
    baseline. Take it BEFORE the initial list reads; every change that commits after it is delivered,
    including ones those reads already reflect. Then call with `since=<next_cursor>&wait=20` in a loop.
    Changes come oldest first in commit order, at least once: a write that commits late is never
    skipped, because positions are assigned at commit.

    Every change is scoped to what this credential's full reads would show: a connected agent sees only
    its own mail, its own sends and sends it provably received; mail held for sender authentication is
    announced only when released; read state reaches only the member it belongs to; agent changes reach
    members and agents allowed to view the network; organization API keys receive no agent changes.
    Function credentials cannot call this.

    Changes are kept 7 days. A cursor answers 410 `cursor_expired` only when changes after it were
    pruned (an idle cursor stays valid); rebuild the snapshots from `since=start`.

    Args:
        since (str | Unset):
        wait (int | Unset):  Default: 0.
        limit (int | Unset):  Default: 100.
        expand (ListChangesExpand | Unset):
        address (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ListChangesResponse200]
     """


    kwargs = _get_kwargs(
        since=since,
wait=wait,
limit=limit,
expand=expand,
address=address,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    *,
    client: AuthenticatedClient,
    since: str | Unset = UNSET,
    wait: int | Unset = 0,
    limit: int | Unset = 100,
    expand: ListChangesExpand | Unset = UNSET,
    address: str | Unset = UNSET,

) -> ErrorResponse | ListChangesResponse200 | None:
    """ Long-poll what changed

     One feed of small invalidations (ids and kinds) for everything an app keeps a snapshot of: inbound
    mail, sent mail, the member's conversation read state, the agent directory and presence, and the
    credential's own access. Non-consumptive and replayable: any number of devices can read the same
    cursor independently.

    Start with `since=start` (or no `since`): it returns an empty page whose `next_cursor` is a
    baseline. Take it BEFORE the initial list reads; every change that commits after it is delivered,
    including ones those reads already reflect. Then call with `since=<next_cursor>&wait=20` in a loop.
    Changes come oldest first in commit order, at least once: a write that commits late is never
    skipped, because positions are assigned at commit.

    Every change is scoped to what this credential's full reads would show: a connected agent sees only
    its own mail, its own sends and sends it provably received; mail held for sender authentication is
    announced only when released; read state reaches only the member it belongs to; agent changes reach
    members and agents allowed to view the network; organization API keys receive no agent changes.
    Function credentials cannot call this.

    Changes are kept 7 days. A cursor answers 410 `cursor_expired` only when changes after it were
    pruned (an idle cursor stays valid); rebuild the snapshots from `since=start`.

    Args:
        since (str | Unset):
        wait (int | Unset):  Default: 0.
        limit (int | Unset):  Default: 100.
        expand (ListChangesExpand | Unset):
        address (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ListChangesResponse200
     """


    return (await asyncio_detailed(
        client=client,
since=since,
wait=wait,
limit=limit,
expand=expand,
address=address,

    )).parsed
