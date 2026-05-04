from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.list_sent_emails_response_200 import ListSentEmailsResponse200
from ...models.sent_email_status import SentEmailStatus
from ...types import UNSET, Unset
from dateutil.parser import isoparse
from typing import cast
from uuid import UUID
import datetime



def _get_kwargs(
    *,
    cursor: str | Unset = UNSET,
    limit: int | Unset = 50,
    status: SentEmailStatus | Unset = UNSET,
    request_id: UUID | Unset = UNSET,
    idempotency_key: str | Unset = UNSET,
    date_from: datetime.datetime | Unset = UNSET,
    date_to: datetime.datetime | Unset = UNSET,

) -> dict[str, Any]:
    

    

    params: dict[str, Any] = {}

    params["cursor"] = cursor

    params["limit"] = limit

    json_status: str | Unset = UNSET
    if not isinstance(status, Unset):
        json_status = status.value

    params["status"] = json_status

    json_request_id: str | Unset = UNSET
    if not isinstance(request_id, Unset):
        json_request_id = str(request_id)
    params["request_id"] = json_request_id

    params["idempotency_key"] = idempotency_key

    json_date_from: str | Unset = UNSET
    if not isinstance(date_from, Unset):
        json_date_from = date_from.isoformat()
    params["date_from"] = json_date_from

    json_date_to: str | Unset = UNSET
    if not isinstance(date_to, Unset):
        json_date_to = date_to.isoformat()
    params["date_to"] = json_date_to


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/sent-emails",
        "params": params,
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | ListSentEmailsResponse200 | None:
    if response.status_code == 200:
        response_200 = ListSentEmailsResponse200.from_dict(response.json())



        return response_200

    if response.status_code == 400:
        response_400 = ErrorResponse.from_dict(response.json())



        return response_400

    if response.status_code == 401:
        response_401 = ErrorResponse.from_dict(response.json())



        return response_401

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | ListSentEmailsResponse200]:
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
    limit: int | Unset = 50,
    status: SentEmailStatus | Unset = UNSET,
    request_id: UUID | Unset = UNSET,
    idempotency_key: str | Unset = UNSET,
    date_from: datetime.datetime | Unset = UNSET,
    date_to: datetime.datetime | Unset = UNSET,

) -> Response[ErrorResponse | ListSentEmailsResponse200]:
    """ List outbound sent emails

     Returns a paginated list of OUTBOUND emails the caller's
    org has sent via /send-mail (and /emails/{id}/reply, which
    forwards through /send-mail). Includes every recorded
    attempt, including gate-denied attempts that the agent
    never called and rows still in `queued` state.

    For inbound mail received at your verified domains, see
    /emails. There is no unified send/receive history endpoint;
    the two surfaces are intentionally separate because the
    underlying tables, statuses, and lifecycle differ.

    Email bodies (`body_text`, `body_html`) are NOT included on
    list rows so a 50-row page can't balloon into a multi-MB
    response when sends are near the 5MB body cap. Use
    /sent-emails/{id} to fetch a single row with bodies, or
    cross-reference by `client_idempotency_key` if the caller
    already has the body locally.

    Args:
        cursor (str | Unset):
        limit (int | Unset):  Default: 50.
        status (SentEmailStatus | Unset): Lifecycle status of a sent_emails row. Possible values:

              - `queued`: pre-call INSERT; the outbound agent has not
                yet replied.
              - `submitted_to_agent`: agent accepted; `queue_id` is set.
              - `agent_failed`: agent rejected; `error_code` and
                `error_message` carry the reason.
              - `gate_denied`: a recipient-scope gate denied the send;
                the agent was never called. The `gates` array carries
                the denial detail. /send-mail returns 403 in this case
                so callers see the denial synchronously; /sent-emails
                additionally records the row for historical lookup,
                which is when this status appears in a listing.
              - `unknown`: terminal indeterminate; the on-box log
                poller couldn't classify the receiver's response.
              - `delivered` / `bounced` / `deferred` / `wait_timeout`:
                terminal delivery outcomes (see DeliveryStatus).
        request_id (UUID | Unset):
        idempotency_key (str | Unset):
        date_from (datetime.datetime | Unset):
        date_to (datetime.datetime | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ListSentEmailsResponse200]
     """


    kwargs = _get_kwargs(
        cursor=cursor,
limit=limit,
status=status,
request_id=request_id,
idempotency_key=idempotency_key,
date_from=date_from,
date_to=date_to,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    *,
    client: AuthenticatedClient | Client,
    cursor: str | Unset = UNSET,
    limit: int | Unset = 50,
    status: SentEmailStatus | Unset = UNSET,
    request_id: UUID | Unset = UNSET,
    idempotency_key: str | Unset = UNSET,
    date_from: datetime.datetime | Unset = UNSET,
    date_to: datetime.datetime | Unset = UNSET,

) -> ErrorResponse | ListSentEmailsResponse200 | None:
    """ List outbound sent emails

     Returns a paginated list of OUTBOUND emails the caller's
    org has sent via /send-mail (and /emails/{id}/reply, which
    forwards through /send-mail). Includes every recorded
    attempt, including gate-denied attempts that the agent
    never called and rows still in `queued` state.

    For inbound mail received at your verified domains, see
    /emails. There is no unified send/receive history endpoint;
    the two surfaces are intentionally separate because the
    underlying tables, statuses, and lifecycle differ.

    Email bodies (`body_text`, `body_html`) are NOT included on
    list rows so a 50-row page can't balloon into a multi-MB
    response when sends are near the 5MB body cap. Use
    /sent-emails/{id} to fetch a single row with bodies, or
    cross-reference by `client_idempotency_key` if the caller
    already has the body locally.

    Args:
        cursor (str | Unset):
        limit (int | Unset):  Default: 50.
        status (SentEmailStatus | Unset): Lifecycle status of a sent_emails row. Possible values:

              - `queued`: pre-call INSERT; the outbound agent has not
                yet replied.
              - `submitted_to_agent`: agent accepted; `queue_id` is set.
              - `agent_failed`: agent rejected; `error_code` and
                `error_message` carry the reason.
              - `gate_denied`: a recipient-scope gate denied the send;
                the agent was never called. The `gates` array carries
                the denial detail. /send-mail returns 403 in this case
                so callers see the denial synchronously; /sent-emails
                additionally records the row for historical lookup,
                which is when this status appears in a listing.
              - `unknown`: terminal indeterminate; the on-box log
                poller couldn't classify the receiver's response.
              - `delivered` / `bounced` / `deferred` / `wait_timeout`:
                terminal delivery outcomes (see DeliveryStatus).
        request_id (UUID | Unset):
        idempotency_key (str | Unset):
        date_from (datetime.datetime | Unset):
        date_to (datetime.datetime | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ListSentEmailsResponse200
     """


    return sync_detailed(
        client=client,
cursor=cursor,
limit=limit,
status=status,
request_id=request_id,
idempotency_key=idempotency_key,
date_from=date_from,
date_to=date_to,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    cursor: str | Unset = UNSET,
    limit: int | Unset = 50,
    status: SentEmailStatus | Unset = UNSET,
    request_id: UUID | Unset = UNSET,
    idempotency_key: str | Unset = UNSET,
    date_from: datetime.datetime | Unset = UNSET,
    date_to: datetime.datetime | Unset = UNSET,

) -> Response[ErrorResponse | ListSentEmailsResponse200]:
    """ List outbound sent emails

     Returns a paginated list of OUTBOUND emails the caller's
    org has sent via /send-mail (and /emails/{id}/reply, which
    forwards through /send-mail). Includes every recorded
    attempt, including gate-denied attempts that the agent
    never called and rows still in `queued` state.

    For inbound mail received at your verified domains, see
    /emails. There is no unified send/receive history endpoint;
    the two surfaces are intentionally separate because the
    underlying tables, statuses, and lifecycle differ.

    Email bodies (`body_text`, `body_html`) are NOT included on
    list rows so a 50-row page can't balloon into a multi-MB
    response when sends are near the 5MB body cap. Use
    /sent-emails/{id} to fetch a single row with bodies, or
    cross-reference by `client_idempotency_key` if the caller
    already has the body locally.

    Args:
        cursor (str | Unset):
        limit (int | Unset):  Default: 50.
        status (SentEmailStatus | Unset): Lifecycle status of a sent_emails row. Possible values:

              - `queued`: pre-call INSERT; the outbound agent has not
                yet replied.
              - `submitted_to_agent`: agent accepted; `queue_id` is set.
              - `agent_failed`: agent rejected; `error_code` and
                `error_message` carry the reason.
              - `gate_denied`: a recipient-scope gate denied the send;
                the agent was never called. The `gates` array carries
                the denial detail. /send-mail returns 403 in this case
                so callers see the denial synchronously; /sent-emails
                additionally records the row for historical lookup,
                which is when this status appears in a listing.
              - `unknown`: terminal indeterminate; the on-box log
                poller couldn't classify the receiver's response.
              - `delivered` / `bounced` / `deferred` / `wait_timeout`:
                terminal delivery outcomes (see DeliveryStatus).
        request_id (UUID | Unset):
        idempotency_key (str | Unset):
        date_from (datetime.datetime | Unset):
        date_to (datetime.datetime | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ListSentEmailsResponse200]
     """


    kwargs = _get_kwargs(
        cursor=cursor,
limit=limit,
status=status,
request_id=request_id,
idempotency_key=idempotency_key,
date_from=date_from,
date_to=date_to,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    cursor: str | Unset = UNSET,
    limit: int | Unset = 50,
    status: SentEmailStatus | Unset = UNSET,
    request_id: UUID | Unset = UNSET,
    idempotency_key: str | Unset = UNSET,
    date_from: datetime.datetime | Unset = UNSET,
    date_to: datetime.datetime | Unset = UNSET,

) -> ErrorResponse | ListSentEmailsResponse200 | None:
    """ List outbound sent emails

     Returns a paginated list of OUTBOUND emails the caller's
    org has sent via /send-mail (and /emails/{id}/reply, which
    forwards through /send-mail). Includes every recorded
    attempt, including gate-denied attempts that the agent
    never called and rows still in `queued` state.

    For inbound mail received at your verified domains, see
    /emails. There is no unified send/receive history endpoint;
    the two surfaces are intentionally separate because the
    underlying tables, statuses, and lifecycle differ.

    Email bodies (`body_text`, `body_html`) are NOT included on
    list rows so a 50-row page can't balloon into a multi-MB
    response when sends are near the 5MB body cap. Use
    /sent-emails/{id} to fetch a single row with bodies, or
    cross-reference by `client_idempotency_key` if the caller
    already has the body locally.

    Args:
        cursor (str | Unset):
        limit (int | Unset):  Default: 50.
        status (SentEmailStatus | Unset): Lifecycle status of a sent_emails row. Possible values:

              - `queued`: pre-call INSERT; the outbound agent has not
                yet replied.
              - `submitted_to_agent`: agent accepted; `queue_id` is set.
              - `agent_failed`: agent rejected; `error_code` and
                `error_message` carry the reason.
              - `gate_denied`: a recipient-scope gate denied the send;
                the agent was never called. The `gates` array carries
                the denial detail. /send-mail returns 403 in this case
                so callers see the denial synchronously; /sent-emails
                additionally records the row for historical lookup,
                which is when this status appears in a listing.
              - `unknown`: terminal indeterminate; the on-box log
                poller couldn't classify the receiver's response.
              - `delivered` / `bounced` / `deferred` / `wait_timeout`:
                terminal delivery outcomes (see DeliveryStatus).
        request_id (UUID | Unset):
        idempotency_key (str | Unset):
        date_from (datetime.datetime | Unset):
        date_to (datetime.datetime | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ListSentEmailsResponse200
     """


    return (await asyncio_detailed(
        client=client,
cursor=cursor,
limit=limit,
status=status,
request_id=request_id,
idempotency_key=idempotency_key,
date_from=date_from,
date_to=date_to,

    )).parsed
