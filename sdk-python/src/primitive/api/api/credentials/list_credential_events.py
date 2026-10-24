from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.list_credential_events_response_200 import ListCredentialEventsResponse200
from ...types import UNSET, Unset
from typing import cast
from uuid import UUID
import datetime



def _get_kwargs(
    *,
    cursor: str | Unset = UNSET,
    limit: int | Unset = UNSET,
    actor_id: UUID | Unset = UNSET,
    credential_id: UUID | Unset = UNSET,
    event_type: str | Unset = UNSET,
    since: datetime.datetime | Unset = UNSET,
    until: datetime.datetime | Unset = UNSET,

) -> dict[str, Any]:
    

    

    params: dict[str, Any] = {}

    params["cursor"] = cursor

    params["limit"] = limit

    json_actor_id: str | Unset = UNSET
    if not isinstance(actor_id, Unset):
        json_actor_id = str(actor_id)
    params["actor_id"] = json_actor_id

    json_credential_id: str | Unset = UNSET
    if not isinstance(credential_id, Unset):
        json_credential_id = str(credential_id)
    params["credential_id"] = json_credential_id

    params["event_type"] = event_type

    json_since: str | Unset = UNSET
    if not isinstance(since, Unset):
        json_since = since.isoformat()
    params["since"] = json_since

    json_until: str | Unset = UNSET
    if not isinstance(until, Unset):
        json_until = until.isoformat()
    params["until"] = json_until


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/credential-events",
        "params": params,
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | ListCredentialEventsResponse200 | None:
    if response.status_code == 200:
        response_200 = ListCredentialEventsResponse200.from_dict(response.json())



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

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | ListCredentialEventsResponse200]:
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
    limit: int | Unset = UNSET,
    actor_id: UUID | Unset = UNSET,
    credential_id: UUID | Unset = UNSET,
    event_type: str | Unset = UNSET,
    since: datetime.datetime | Unset = UNSET,
    until: datetime.datetime | Unset = UNSET,

) -> Response[ErrorResponse | ListCredentialEventsResponse200]:
    """ List credential audit events

     The credential audit trail, newest first, paged with `cursor`.
    Filter by actor, credential, event type and time. Available to an
    owner or admin in a person's session.

    Args:
        cursor (str | Unset):
        limit (int | Unset):
        actor_id (UUID | Unset):
        credential_id (UUID | Unset):
        event_type (str | Unset):
        since (datetime.datetime | Unset):
        until (datetime.datetime | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ListCredentialEventsResponse200]
     """


    kwargs = _get_kwargs(
        cursor=cursor,
limit=limit,
actor_id=actor_id,
credential_id=credential_id,
event_type=event_type,
since=since,
until=until,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    *,
    client: AuthenticatedClient | Client,
    cursor: str | Unset = UNSET,
    limit: int | Unset = UNSET,
    actor_id: UUID | Unset = UNSET,
    credential_id: UUID | Unset = UNSET,
    event_type: str | Unset = UNSET,
    since: datetime.datetime | Unset = UNSET,
    until: datetime.datetime | Unset = UNSET,

) -> ErrorResponse | ListCredentialEventsResponse200 | None:
    """ List credential audit events

     The credential audit trail, newest first, paged with `cursor`.
    Filter by actor, credential, event type and time. Available to an
    owner or admin in a person's session.

    Args:
        cursor (str | Unset):
        limit (int | Unset):
        actor_id (UUID | Unset):
        credential_id (UUID | Unset):
        event_type (str | Unset):
        since (datetime.datetime | Unset):
        until (datetime.datetime | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ListCredentialEventsResponse200
     """


    return sync_detailed(
        client=client,
cursor=cursor,
limit=limit,
actor_id=actor_id,
credential_id=credential_id,
event_type=event_type,
since=since,
until=until,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    cursor: str | Unset = UNSET,
    limit: int | Unset = UNSET,
    actor_id: UUID | Unset = UNSET,
    credential_id: UUID | Unset = UNSET,
    event_type: str | Unset = UNSET,
    since: datetime.datetime | Unset = UNSET,
    until: datetime.datetime | Unset = UNSET,

) -> Response[ErrorResponse | ListCredentialEventsResponse200]:
    """ List credential audit events

     The credential audit trail, newest first, paged with `cursor`.
    Filter by actor, credential, event type and time. Available to an
    owner or admin in a person's session.

    Args:
        cursor (str | Unset):
        limit (int | Unset):
        actor_id (UUID | Unset):
        credential_id (UUID | Unset):
        event_type (str | Unset):
        since (datetime.datetime | Unset):
        until (datetime.datetime | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ListCredentialEventsResponse200]
     """


    kwargs = _get_kwargs(
        cursor=cursor,
limit=limit,
actor_id=actor_id,
credential_id=credential_id,
event_type=event_type,
since=since,
until=until,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    cursor: str | Unset = UNSET,
    limit: int | Unset = UNSET,
    actor_id: UUID | Unset = UNSET,
    credential_id: UUID | Unset = UNSET,
    event_type: str | Unset = UNSET,
    since: datetime.datetime | Unset = UNSET,
    until: datetime.datetime | Unset = UNSET,

) -> ErrorResponse | ListCredentialEventsResponse200 | None:
    """ List credential audit events

     The credential audit trail, newest first, paged with `cursor`.
    Filter by actor, credential, event type and time. Available to an
    owner or admin in a person's session.

    Args:
        cursor (str | Unset):
        limit (int | Unset):
        actor_id (UUID | Unset):
        credential_id (UUID | Unset):
        event_type (str | Unset):
        since (datetime.datetime | Unset):
        until (datetime.datetime | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ListCredentialEventsResponse200
     """


    return (await asyncio_detailed(
        client=client,
cursor=cursor,
limit=limit,
actor_id=actor_id,
credential_id=credential_id,
event_type=event_type,
since=since,
until=until,

    )).parsed
