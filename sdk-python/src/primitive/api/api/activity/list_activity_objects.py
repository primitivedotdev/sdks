from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.list_activity_objects_relation import ListActivityObjectsRelation
from ...models.list_activity_objects_response_200 import ListActivityObjectsResponse200
from ...models.list_activity_objects_state import ListActivityObjectsState
from ...types import UNSET, Unset
from typing import cast



def _get_kwargs(
    *,
    relation: ListActivityObjectsRelation | Unset = ListActivityObjectsRelation.CREATED,
    kind: str | Unset = UNSET,
    state: ListActivityObjectsState | Unset = ListActivityObjectsState.ALL,
    limit: int | Unset = 50,
    cursor: str | Unset = UNSET,

) -> dict[str, Any]:
    

    

    params: dict[str, Any] = {}

    json_relation: str | Unset = UNSET
    if not isinstance(relation, Unset):
        json_relation = relation.value

    params["relation"] = json_relation

    params["kind"] = kind

    json_state: str | Unset = UNSET
    if not isinstance(state, Unset):
        json_state = state.value

    params["state"] = json_state

    params["limit"] = limit

    params["cursor"] = cursor


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/activity/objects",
        "params": params,
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | ListActivityObjectsResponse200 | None:
    if response.status_code == 200:
        response_200 = ListActivityObjectsResponse200.from_dict(response.json())



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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | ListActivityObjectsResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    relation: ListActivityObjectsRelation | Unset = ListActivityObjectsRelation.CREATED,
    kind: str | Unset = UNSET,
    state: ListActivityObjectsState | Unset = ListActivityObjectsState.ALL,
    limit: int | Unset = 50,
    cursor: str | Unset = UNSET,

) -> Response[ErrorResponse | ListActivityObjectsResponse200]:
    """ List what you created, or what you were asked

     The objects the caller created, newest first, each with where it stands now, including ones since
    disabled, deleted or revoked where the object keeps a row: Functions, endpoints, Function triggers,
    pull subscriptions, recipient routes, filters, wake schedules, repeating sends and scheduled sends.
    An API key, an app or an agent sees what it created itself; a webhook given to an API key lists
    under that key. A person (a dashboard session, or their own Primitive CLI or app login) sees what
    they created through any credential of theirs, each item naming it, and also their API keys,
    personal agents, email rules, rule requests and objections to rules over their mail (objections only
    on the dashboard or the Primitive CLI). Each kind is listed only if the caller could list it through
    that kind's own route; a kind it could not is named in withheld, with no count. Ids, names and
    states only: never a webhook URL or mail content. Needs activity:read_self. With relation=asked it
    lists instead what other members asked of the person, open or answered: the rule requests made to
    them, and the objections to rules they wrote, under their current membership, each naming the member
    who asked or objected in created_through. A key, an app or an agent has none, and gets both kinds in
    withheld. With relation=concerning it lists instead what other members did that concerns the
    person's own mail: each time a rule started covering one of their mailboxes, saved a new version, or
    changed who receives its matches while covering it, named as the rule was then, naming its author in
    created_through, under their current membership; only on the dashboard or the Primitive CLI. A key,
    an app or an agent has none, and gets email_rule_coverage in withheld. A notice never reads as
    ended. Notices are written by a periodic job and can lag: until the notices record a rule starting
    to cover you, the first page lists that rule as pending (pending_complete says whether that check
    finished), and as_of says about when the notices last looked. For what covers you now, read GET
    /email-rules/covering-me.

    Args:
        relation (ListActivityObjectsRelation | Unset): created (the default): what you created.
            asked: what other members asked of you, open or answered: rule requests made to you, and
            objections to rules you wrote; kind may then name only email_rule_request and
            email_rule_objection. concerning: what other members did that concerns your own mail: an
            active rule that started covering one of your mailboxes, saved a new version, or changed
            who receives its matches while covering it (email_rule_coverage, the only kind it takes).
            A rule in draft or observe is not told of; GET /v1/email-rules/covering-me lists it. asked
            and concerning are for a person's own view only. Default:
            ListActivityObjectsRelation.CREATED.
        kind (str | Unset):
        state (ListActivityObjectsState | Unset):  Default: ListActivityObjectsState.ALL.
        limit (int | Unset):  Default: 50.
        cursor (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ListActivityObjectsResponse200]
     """


    kwargs = _get_kwargs(
        relation=relation,
kind=kind,
state=state,
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
    relation: ListActivityObjectsRelation | Unset = ListActivityObjectsRelation.CREATED,
    kind: str | Unset = UNSET,
    state: ListActivityObjectsState | Unset = ListActivityObjectsState.ALL,
    limit: int | Unset = 50,
    cursor: str | Unset = UNSET,

) -> ErrorResponse | ListActivityObjectsResponse200 | None:
    """ List what you created, or what you were asked

     The objects the caller created, newest first, each with where it stands now, including ones since
    disabled, deleted or revoked where the object keeps a row: Functions, endpoints, Function triggers,
    pull subscriptions, recipient routes, filters, wake schedules, repeating sends and scheduled sends.
    An API key, an app or an agent sees what it created itself; a webhook given to an API key lists
    under that key. A person (a dashboard session, or their own Primitive CLI or app login) sees what
    they created through any credential of theirs, each item naming it, and also their API keys,
    personal agents, email rules, rule requests and objections to rules over their mail (objections only
    on the dashboard or the Primitive CLI). Each kind is listed only if the caller could list it through
    that kind's own route; a kind it could not is named in withheld, with no count. Ids, names and
    states only: never a webhook URL or mail content. Needs activity:read_self. With relation=asked it
    lists instead what other members asked of the person, open or answered: the rule requests made to
    them, and the objections to rules they wrote, under their current membership, each naming the member
    who asked or objected in created_through. A key, an app or an agent has none, and gets both kinds in
    withheld. With relation=concerning it lists instead what other members did that concerns the
    person's own mail: each time a rule started covering one of their mailboxes, saved a new version, or
    changed who receives its matches while covering it, named as the rule was then, naming its author in
    created_through, under their current membership; only on the dashboard or the Primitive CLI. A key,
    an app or an agent has none, and gets email_rule_coverage in withheld. A notice never reads as
    ended. Notices are written by a periodic job and can lag: until the notices record a rule starting
    to cover you, the first page lists that rule as pending (pending_complete says whether that check
    finished), and as_of says about when the notices last looked. For what covers you now, read GET
    /email-rules/covering-me.

    Args:
        relation (ListActivityObjectsRelation | Unset): created (the default): what you created.
            asked: what other members asked of you, open or answered: rule requests made to you, and
            objections to rules you wrote; kind may then name only email_rule_request and
            email_rule_objection. concerning: what other members did that concerns your own mail: an
            active rule that started covering one of your mailboxes, saved a new version, or changed
            who receives its matches while covering it (email_rule_coverage, the only kind it takes).
            A rule in draft or observe is not told of; GET /v1/email-rules/covering-me lists it. asked
            and concerning are for a person's own view only. Default:
            ListActivityObjectsRelation.CREATED.
        kind (str | Unset):
        state (ListActivityObjectsState | Unset):  Default: ListActivityObjectsState.ALL.
        limit (int | Unset):  Default: 50.
        cursor (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ListActivityObjectsResponse200
     """


    return sync_detailed(
        client=client,
relation=relation,
kind=kind,
state=state,
limit=limit,
cursor=cursor,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    relation: ListActivityObjectsRelation | Unset = ListActivityObjectsRelation.CREATED,
    kind: str | Unset = UNSET,
    state: ListActivityObjectsState | Unset = ListActivityObjectsState.ALL,
    limit: int | Unset = 50,
    cursor: str | Unset = UNSET,

) -> Response[ErrorResponse | ListActivityObjectsResponse200]:
    """ List what you created, or what you were asked

     The objects the caller created, newest first, each with where it stands now, including ones since
    disabled, deleted or revoked where the object keeps a row: Functions, endpoints, Function triggers,
    pull subscriptions, recipient routes, filters, wake schedules, repeating sends and scheduled sends.
    An API key, an app or an agent sees what it created itself; a webhook given to an API key lists
    under that key. A person (a dashboard session, or their own Primitive CLI or app login) sees what
    they created through any credential of theirs, each item naming it, and also their API keys,
    personal agents, email rules, rule requests and objections to rules over their mail (objections only
    on the dashboard or the Primitive CLI). Each kind is listed only if the caller could list it through
    that kind's own route; a kind it could not is named in withheld, with no count. Ids, names and
    states only: never a webhook URL or mail content. Needs activity:read_self. With relation=asked it
    lists instead what other members asked of the person, open or answered: the rule requests made to
    them, and the objections to rules they wrote, under their current membership, each naming the member
    who asked or objected in created_through. A key, an app or an agent has none, and gets both kinds in
    withheld. With relation=concerning it lists instead what other members did that concerns the
    person's own mail: each time a rule started covering one of their mailboxes, saved a new version, or
    changed who receives its matches while covering it, named as the rule was then, naming its author in
    created_through, under their current membership; only on the dashboard or the Primitive CLI. A key,
    an app or an agent has none, and gets email_rule_coverage in withheld. A notice never reads as
    ended. Notices are written by a periodic job and can lag: until the notices record a rule starting
    to cover you, the first page lists that rule as pending (pending_complete says whether that check
    finished), and as_of says about when the notices last looked. For what covers you now, read GET
    /email-rules/covering-me.

    Args:
        relation (ListActivityObjectsRelation | Unset): created (the default): what you created.
            asked: what other members asked of you, open or answered: rule requests made to you, and
            objections to rules you wrote; kind may then name only email_rule_request and
            email_rule_objection. concerning: what other members did that concerns your own mail: an
            active rule that started covering one of your mailboxes, saved a new version, or changed
            who receives its matches while covering it (email_rule_coverage, the only kind it takes).
            A rule in draft or observe is not told of; GET /v1/email-rules/covering-me lists it. asked
            and concerning are for a person's own view only. Default:
            ListActivityObjectsRelation.CREATED.
        kind (str | Unset):
        state (ListActivityObjectsState | Unset):  Default: ListActivityObjectsState.ALL.
        limit (int | Unset):  Default: 50.
        cursor (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ListActivityObjectsResponse200]
     """


    kwargs = _get_kwargs(
        relation=relation,
kind=kind,
state=state,
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
    relation: ListActivityObjectsRelation | Unset = ListActivityObjectsRelation.CREATED,
    kind: str | Unset = UNSET,
    state: ListActivityObjectsState | Unset = ListActivityObjectsState.ALL,
    limit: int | Unset = 50,
    cursor: str | Unset = UNSET,

) -> ErrorResponse | ListActivityObjectsResponse200 | None:
    """ List what you created, or what you were asked

     The objects the caller created, newest first, each with where it stands now, including ones since
    disabled, deleted or revoked where the object keeps a row: Functions, endpoints, Function triggers,
    pull subscriptions, recipient routes, filters, wake schedules, repeating sends and scheduled sends.
    An API key, an app or an agent sees what it created itself; a webhook given to an API key lists
    under that key. A person (a dashboard session, or their own Primitive CLI or app login) sees what
    they created through any credential of theirs, each item naming it, and also their API keys,
    personal agents, email rules, rule requests and objections to rules over their mail (objections only
    on the dashboard or the Primitive CLI). Each kind is listed only if the caller could list it through
    that kind's own route; a kind it could not is named in withheld, with no count. Ids, names and
    states only: never a webhook URL or mail content. Needs activity:read_self. With relation=asked it
    lists instead what other members asked of the person, open or answered: the rule requests made to
    them, and the objections to rules they wrote, under their current membership, each naming the member
    who asked or objected in created_through. A key, an app or an agent has none, and gets both kinds in
    withheld. With relation=concerning it lists instead what other members did that concerns the
    person's own mail: each time a rule started covering one of their mailboxes, saved a new version, or
    changed who receives its matches while covering it, named as the rule was then, naming its author in
    created_through, under their current membership; only on the dashboard or the Primitive CLI. A key,
    an app or an agent has none, and gets email_rule_coverage in withheld. A notice never reads as
    ended. Notices are written by a periodic job and can lag: until the notices record a rule starting
    to cover you, the first page lists that rule as pending (pending_complete says whether that check
    finished), and as_of says about when the notices last looked. For what covers you now, read GET
    /email-rules/covering-me.

    Args:
        relation (ListActivityObjectsRelation | Unset): created (the default): what you created.
            asked: what other members asked of you, open or answered: rule requests made to you, and
            objections to rules you wrote; kind may then name only email_rule_request and
            email_rule_objection. concerning: what other members did that concerns your own mail: an
            active rule that started covering one of your mailboxes, saved a new version, or changed
            who receives its matches while covering it (email_rule_coverage, the only kind it takes).
            A rule in draft or observe is not told of; GET /v1/email-rules/covering-me lists it. asked
            and concerning are for a person's own view only. Default:
            ListActivityObjectsRelation.CREATED.
        kind (str | Unset):
        state (ListActivityObjectsState | Unset):  Default: ListActivityObjectsState.ALL.
        limit (int | Unset):  Default: 50.
        cursor (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ListActivityObjectsResponse200
     """


    return (await asyncio_detailed(
        client=client,
relation=relation,
kind=kind,
state=state,
limit=limit,
cursor=cursor,

    )).parsed
