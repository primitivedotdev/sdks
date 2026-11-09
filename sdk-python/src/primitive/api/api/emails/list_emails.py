from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.email_status import EmailStatus
from ...models.error_response import ErrorResponse
from ...models.list_emails_automated import ListEmailsAutomated
from ...models.list_emails_awaiting import ListEmailsAwaiting
from ...models.list_emails_content_discarded import ListEmailsContentDiscarded
from ...models.list_emails_exclude_fyi import ListEmailsExcludeFyi
from ...models.list_emails_exclude_muted import ListEmailsExcludeMuted
from ...models.list_emails_from_verified import ListEmailsFromVerified
from ...models.list_emails_group import ListEmailsGroup
from ...models.list_emails_include_presence import ListEmailsIncludePresence
from ...models.list_emails_kind import ListEmailsKind
from ...models.list_emails_response_200 import ListEmailsResponse200
from ...models.list_emails_search_case_sensitive import ListEmailsSearchCaseSensitive
from ...models.list_emails_search_negate import ListEmailsSearchNegate
from ...models.list_emails_search_regex import ListEmailsSearchRegex
from ...types import UNSET, Unset
from typing import cast
from uuid import UUID
import datetime



def _get_kwargs(
    *,
    cursor: str | Unset = UNSET,
    limit: int | Unset = 50,
    domain_id: UUID | Unset = UNSET,
    status: EmailStatus | Unset = UNSET,
    search: str | Unset = UNSET,
    date_from: datetime.datetime | Unset = UNSET,
    date_to: datetime.datetime | Unset = UNSET,
    since: str | Unset = UNSET,
    wait: int | Unset = UNSET,
    awaiting: ListEmailsAwaiting | Unset = UNSET,
    automated: ListEmailsAutomated | Unset = UNSET,
    recipient: str | Unset = UNSET,
    exclude_fyi: ListEmailsExcludeFyi | Unset = UNSET,
    from_verified: ListEmailsFromVerified | Unset = UNSET,
    include: str | Unset = UNSET,
    thread_id: UUID | Unset = UNSET,
    exclude_muted: ListEmailsExcludeMuted | Unset = UNSET,
    search_regex: ListEmailsSearchRegex | Unset = UNSET,
    search_case_sensitive: ListEmailsSearchCaseSensitive | Unset = UNSET,
    search_negate: ListEmailsSearchNegate | Unset = UNSET,
    kind: ListEmailsKind | Unset = UNSET,
    content_discarded: ListEmailsContentDiscarded | Unset = UNSET,
    group: ListEmailsGroup | Unset = UNSET,
    include_presence: ListEmailsIncludePresence | Unset = UNSET,

) -> dict[str, Any]:
    

    

    params: dict[str, Any] = {}

    params["cursor"] = cursor

    params["limit"] = limit

    json_domain_id: str | Unset = UNSET
    if not isinstance(domain_id, Unset):
        json_domain_id = str(domain_id)
    params["domain_id"] = json_domain_id

    json_status: str | Unset = UNSET
    if not isinstance(status, Unset):
        json_status = status.value

    params["status"] = json_status

    params["search"] = search

    json_date_from: str | Unset = UNSET
    if not isinstance(date_from, Unset):
        json_date_from = date_from.isoformat()
    params["date_from"] = json_date_from

    json_date_to: str | Unset = UNSET
    if not isinstance(date_to, Unset):
        json_date_to = date_to.isoformat()
    params["date_to"] = json_date_to

    params["since"] = since

    params["wait"] = wait

    json_awaiting: str | Unset = UNSET
    if not isinstance(awaiting, Unset):
        json_awaiting = awaiting.value

    params["awaiting"] = json_awaiting

    json_automated: str | Unset = UNSET
    if not isinstance(automated, Unset):
        json_automated = automated.value

    params["automated"] = json_automated

    params["recipient"] = recipient

    json_exclude_fyi: str | Unset = UNSET
    if not isinstance(exclude_fyi, Unset):
        json_exclude_fyi = exclude_fyi.value

    params["exclude_fyi"] = json_exclude_fyi

    json_from_verified: str | Unset = UNSET
    if not isinstance(from_verified, Unset):
        json_from_verified = from_verified.value

    params["from_verified"] = json_from_verified

    params["include"] = include

    json_thread_id: str | Unset = UNSET
    if not isinstance(thread_id, Unset):
        json_thread_id = str(thread_id)
    params["thread_id"] = json_thread_id

    json_exclude_muted: str | Unset = UNSET
    if not isinstance(exclude_muted, Unset):
        json_exclude_muted = exclude_muted.value

    params["exclude_muted"] = json_exclude_muted

    json_search_regex: str | Unset = UNSET
    if not isinstance(search_regex, Unset):
        json_search_regex = search_regex.value

    params["search_regex"] = json_search_regex

    json_search_case_sensitive: str | Unset = UNSET
    if not isinstance(search_case_sensitive, Unset):
        json_search_case_sensitive = search_case_sensitive.value

    params["search_case_sensitive"] = json_search_case_sensitive

    json_search_negate: str | Unset = UNSET
    if not isinstance(search_negate, Unset):
        json_search_negate = search_negate.value

    params["search_negate"] = json_search_negate

    json_kind: str | Unset = UNSET
    if not isinstance(kind, Unset):
        json_kind = kind.value

    params["kind"] = json_kind

    json_content_discarded: str | Unset = UNSET
    if not isinstance(content_discarded, Unset):
        json_content_discarded = content_discarded.value

    params["content_discarded"] = json_content_discarded

    json_group: str | Unset = UNSET
    if not isinstance(group, Unset):
        json_group = group.value

    params["group"] = json_group

    json_include_presence: str | Unset = UNSET
    if not isinstance(include_presence, Unset):
        json_include_presence = include_presence.value

    params["include_presence"] = json_include_presence


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/emails",
        "params": params,
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | ListEmailsResponse200 | None:
    if response.status_code == 200:
        response_200 = ListEmailsResponse200.from_dict(response.json())



        return response_200

    if response.status_code == 400:
        response_400 = ErrorResponse.from_dict(response.json())



        return response_400

    if response.status_code == 401:
        response_401 = ErrorResponse.from_dict(response.json())



        return response_401

    if response.status_code == 504:
        response_504 = ErrorResponse.from_dict(response.json())



        return response_504

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | ListEmailsResponse200]:
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
    domain_id: UUID | Unset = UNSET,
    status: EmailStatus | Unset = UNSET,
    search: str | Unset = UNSET,
    date_from: datetime.datetime | Unset = UNSET,
    date_to: datetime.datetime | Unset = UNSET,
    since: str | Unset = UNSET,
    wait: int | Unset = UNSET,
    awaiting: ListEmailsAwaiting | Unset = UNSET,
    automated: ListEmailsAutomated | Unset = UNSET,
    recipient: str | Unset = UNSET,
    exclude_fyi: ListEmailsExcludeFyi | Unset = UNSET,
    from_verified: ListEmailsFromVerified | Unset = UNSET,
    include: str | Unset = UNSET,
    thread_id: UUID | Unset = UNSET,
    exclude_muted: ListEmailsExcludeMuted | Unset = UNSET,
    search_regex: ListEmailsSearchRegex | Unset = UNSET,
    search_case_sensitive: ListEmailsSearchCaseSensitive | Unset = UNSET,
    search_negate: ListEmailsSearchNegate | Unset = UNSET,
    kind: ListEmailsKind | Unset = UNSET,
    content_discarded: ListEmailsContentDiscarded | Unset = UNSET,
    group: ListEmailsGroup | Unset = UNSET,
    include_presence: ListEmailsIncludePresence | Unset = UNSET,

) -> Response[ErrorResponse | ListEmailsResponse200]:
    """ List inbound emails

     Returns a paginated list of INBOUND emails received at your
    verified domains. Outbound messages sent via /send-mail are
    not included; this endpoint is the inbox view, not a
    unified send/receive history.

    Supports filtering by domain, status, date range, and
    free-text search across subject, sender, and recipient
    fields.

    For a compact text-table summary of the most recent N
    inbounds (no filters, no cursor pagination), the CLI ships
    `primitive emails:latest` as a one-line-per-email shortcut.
    It's TTY-aware so id columns are full UUIDs when piped, and
    a `--json` flag returns the same envelope this endpoint
    does. Use whichever fits the call site.

    Args:
        cursor (str | Unset):
        limit (int | Unset):  Default: 50.
        domain_id (UUID | Unset):
        status (EmailStatus | Unset): Lifecycle status of an INBOUND email (a row in the `emails`
            table). Distinct from `SentEmailStatus`, which describes
            the OUTBOUND lifecycle (the `sent_emails` table) and uses
            a different vocabulary because the lifecycles differ.
            Possible values:

              - `pending`: the row was inserted at ingestion (mx_main)
                and has not yet completed the spam / filter / auth
                pipeline. Body and parsed fields are present; webhook
                delivery is not yet scheduled. Most rows transition out
                of `pending` within seconds.
              - `accepted`: the inbound passed the policy gates and is
                queued for webhook delivery. The `webhook_status` field
                tracks the separate webhook-delivery lifecycle from
                this point.
              - `completed`: terminal success. Webhook delivery
                attempted and acknowledged by every active endpoint, OR
                no endpoints are configured, so the row is durably
                archived.
              - `rejected`: terminal failure at ingestion (spam, blocked
                sender, filter rule, malformed). The body and metadata
                are stored for auditing but no webhook fires and the
                row is not repliable.

            See also `webhook_status` (separate enum tracking the
            webhook-delivery state machine) and `SentEmailStatus` (the
            outbound vocabulary).
        search (str | Unset):
        date_from (datetime.datetime | Unset):
        date_to (datetime.datetime | Unset):
        since (str | Unset):
        wait (int | Unset):
        awaiting (ListEmailsAwaiting | Unset):
        automated (ListEmailsAutomated | Unset):
        recipient (str | Unset):
        exclude_fyi (ListEmailsExcludeFyi | Unset):
        from_verified (ListEmailsFromVerified | Unset):
        include (str | Unset):  Example: body_text,headers.
        thread_id (UUID | Unset):
        exclude_muted (ListEmailsExcludeMuted | Unset):
        search_regex (ListEmailsSearchRegex | Unset):
        search_case_sensitive (ListEmailsSearchCaseSensitive | Unset):
        search_negate (ListEmailsSearchNegate | Unset):
        kind (ListEmailsKind | Unset):
        content_discarded (ListEmailsContentDiscarded | Unset):
        group (ListEmailsGroup | Unset):
        include_presence (ListEmailsIncludePresence | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ListEmailsResponse200]
     """


    kwargs = _get_kwargs(
        cursor=cursor,
limit=limit,
domain_id=domain_id,
status=status,
search=search,
date_from=date_from,
date_to=date_to,
since=since,
wait=wait,
awaiting=awaiting,
automated=automated,
recipient=recipient,
exclude_fyi=exclude_fyi,
from_verified=from_verified,
include=include,
thread_id=thread_id,
exclude_muted=exclude_muted,
search_regex=search_regex,
search_case_sensitive=search_case_sensitive,
search_negate=search_negate,
kind=kind,
content_discarded=content_discarded,
group=group,
include_presence=include_presence,

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
    domain_id: UUID | Unset = UNSET,
    status: EmailStatus | Unset = UNSET,
    search: str | Unset = UNSET,
    date_from: datetime.datetime | Unset = UNSET,
    date_to: datetime.datetime | Unset = UNSET,
    since: str | Unset = UNSET,
    wait: int | Unset = UNSET,
    awaiting: ListEmailsAwaiting | Unset = UNSET,
    automated: ListEmailsAutomated | Unset = UNSET,
    recipient: str | Unset = UNSET,
    exclude_fyi: ListEmailsExcludeFyi | Unset = UNSET,
    from_verified: ListEmailsFromVerified | Unset = UNSET,
    include: str | Unset = UNSET,
    thread_id: UUID | Unset = UNSET,
    exclude_muted: ListEmailsExcludeMuted | Unset = UNSET,
    search_regex: ListEmailsSearchRegex | Unset = UNSET,
    search_case_sensitive: ListEmailsSearchCaseSensitive | Unset = UNSET,
    search_negate: ListEmailsSearchNegate | Unset = UNSET,
    kind: ListEmailsKind | Unset = UNSET,
    content_discarded: ListEmailsContentDiscarded | Unset = UNSET,
    group: ListEmailsGroup | Unset = UNSET,
    include_presence: ListEmailsIncludePresence | Unset = UNSET,

) -> ErrorResponse | ListEmailsResponse200 | None:
    """ List inbound emails

     Returns a paginated list of INBOUND emails received at your
    verified domains. Outbound messages sent via /send-mail are
    not included; this endpoint is the inbox view, not a
    unified send/receive history.

    Supports filtering by domain, status, date range, and
    free-text search across subject, sender, and recipient
    fields.

    For a compact text-table summary of the most recent N
    inbounds (no filters, no cursor pagination), the CLI ships
    `primitive emails:latest` as a one-line-per-email shortcut.
    It's TTY-aware so id columns are full UUIDs when piped, and
    a `--json` flag returns the same envelope this endpoint
    does. Use whichever fits the call site.

    Args:
        cursor (str | Unset):
        limit (int | Unset):  Default: 50.
        domain_id (UUID | Unset):
        status (EmailStatus | Unset): Lifecycle status of an INBOUND email (a row in the `emails`
            table). Distinct from `SentEmailStatus`, which describes
            the OUTBOUND lifecycle (the `sent_emails` table) and uses
            a different vocabulary because the lifecycles differ.
            Possible values:

              - `pending`: the row was inserted at ingestion (mx_main)
                and has not yet completed the spam / filter / auth
                pipeline. Body and parsed fields are present; webhook
                delivery is not yet scheduled. Most rows transition out
                of `pending` within seconds.
              - `accepted`: the inbound passed the policy gates and is
                queued for webhook delivery. The `webhook_status` field
                tracks the separate webhook-delivery lifecycle from
                this point.
              - `completed`: terminal success. Webhook delivery
                attempted and acknowledged by every active endpoint, OR
                no endpoints are configured, so the row is durably
                archived.
              - `rejected`: terminal failure at ingestion (spam, blocked
                sender, filter rule, malformed). The body and metadata
                are stored for auditing but no webhook fires and the
                row is not repliable.

            See also `webhook_status` (separate enum tracking the
            webhook-delivery state machine) and `SentEmailStatus` (the
            outbound vocabulary).
        search (str | Unset):
        date_from (datetime.datetime | Unset):
        date_to (datetime.datetime | Unset):
        since (str | Unset):
        wait (int | Unset):
        awaiting (ListEmailsAwaiting | Unset):
        automated (ListEmailsAutomated | Unset):
        recipient (str | Unset):
        exclude_fyi (ListEmailsExcludeFyi | Unset):
        from_verified (ListEmailsFromVerified | Unset):
        include (str | Unset):  Example: body_text,headers.
        thread_id (UUID | Unset):
        exclude_muted (ListEmailsExcludeMuted | Unset):
        search_regex (ListEmailsSearchRegex | Unset):
        search_case_sensitive (ListEmailsSearchCaseSensitive | Unset):
        search_negate (ListEmailsSearchNegate | Unset):
        kind (ListEmailsKind | Unset):
        content_discarded (ListEmailsContentDiscarded | Unset):
        group (ListEmailsGroup | Unset):
        include_presence (ListEmailsIncludePresence | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ListEmailsResponse200
     """


    return sync_detailed(
        client=client,
cursor=cursor,
limit=limit,
domain_id=domain_id,
status=status,
search=search,
date_from=date_from,
date_to=date_to,
since=since,
wait=wait,
awaiting=awaiting,
automated=automated,
recipient=recipient,
exclude_fyi=exclude_fyi,
from_verified=from_verified,
include=include,
thread_id=thread_id,
exclude_muted=exclude_muted,
search_regex=search_regex,
search_case_sensitive=search_case_sensitive,
search_negate=search_negate,
kind=kind,
content_discarded=content_discarded,
group=group,
include_presence=include_presence,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    cursor: str | Unset = UNSET,
    limit: int | Unset = 50,
    domain_id: UUID | Unset = UNSET,
    status: EmailStatus | Unset = UNSET,
    search: str | Unset = UNSET,
    date_from: datetime.datetime | Unset = UNSET,
    date_to: datetime.datetime | Unset = UNSET,
    since: str | Unset = UNSET,
    wait: int | Unset = UNSET,
    awaiting: ListEmailsAwaiting | Unset = UNSET,
    automated: ListEmailsAutomated | Unset = UNSET,
    recipient: str | Unset = UNSET,
    exclude_fyi: ListEmailsExcludeFyi | Unset = UNSET,
    from_verified: ListEmailsFromVerified | Unset = UNSET,
    include: str | Unset = UNSET,
    thread_id: UUID | Unset = UNSET,
    exclude_muted: ListEmailsExcludeMuted | Unset = UNSET,
    search_regex: ListEmailsSearchRegex | Unset = UNSET,
    search_case_sensitive: ListEmailsSearchCaseSensitive | Unset = UNSET,
    search_negate: ListEmailsSearchNegate | Unset = UNSET,
    kind: ListEmailsKind | Unset = UNSET,
    content_discarded: ListEmailsContentDiscarded | Unset = UNSET,
    group: ListEmailsGroup | Unset = UNSET,
    include_presence: ListEmailsIncludePresence | Unset = UNSET,

) -> Response[ErrorResponse | ListEmailsResponse200]:
    """ List inbound emails

     Returns a paginated list of INBOUND emails received at your
    verified domains. Outbound messages sent via /send-mail are
    not included; this endpoint is the inbox view, not a
    unified send/receive history.

    Supports filtering by domain, status, date range, and
    free-text search across subject, sender, and recipient
    fields.

    For a compact text-table summary of the most recent N
    inbounds (no filters, no cursor pagination), the CLI ships
    `primitive emails:latest` as a one-line-per-email shortcut.
    It's TTY-aware so id columns are full UUIDs when piped, and
    a `--json` flag returns the same envelope this endpoint
    does. Use whichever fits the call site.

    Args:
        cursor (str | Unset):
        limit (int | Unset):  Default: 50.
        domain_id (UUID | Unset):
        status (EmailStatus | Unset): Lifecycle status of an INBOUND email (a row in the `emails`
            table). Distinct from `SentEmailStatus`, which describes
            the OUTBOUND lifecycle (the `sent_emails` table) and uses
            a different vocabulary because the lifecycles differ.
            Possible values:

              - `pending`: the row was inserted at ingestion (mx_main)
                and has not yet completed the spam / filter / auth
                pipeline. Body and parsed fields are present; webhook
                delivery is not yet scheduled. Most rows transition out
                of `pending` within seconds.
              - `accepted`: the inbound passed the policy gates and is
                queued for webhook delivery. The `webhook_status` field
                tracks the separate webhook-delivery lifecycle from
                this point.
              - `completed`: terminal success. Webhook delivery
                attempted and acknowledged by every active endpoint, OR
                no endpoints are configured, so the row is durably
                archived.
              - `rejected`: terminal failure at ingestion (spam, blocked
                sender, filter rule, malformed). The body and metadata
                are stored for auditing but no webhook fires and the
                row is not repliable.

            See also `webhook_status` (separate enum tracking the
            webhook-delivery state machine) and `SentEmailStatus` (the
            outbound vocabulary).
        search (str | Unset):
        date_from (datetime.datetime | Unset):
        date_to (datetime.datetime | Unset):
        since (str | Unset):
        wait (int | Unset):
        awaiting (ListEmailsAwaiting | Unset):
        automated (ListEmailsAutomated | Unset):
        recipient (str | Unset):
        exclude_fyi (ListEmailsExcludeFyi | Unset):
        from_verified (ListEmailsFromVerified | Unset):
        include (str | Unset):  Example: body_text,headers.
        thread_id (UUID | Unset):
        exclude_muted (ListEmailsExcludeMuted | Unset):
        search_regex (ListEmailsSearchRegex | Unset):
        search_case_sensitive (ListEmailsSearchCaseSensitive | Unset):
        search_negate (ListEmailsSearchNegate | Unset):
        kind (ListEmailsKind | Unset):
        content_discarded (ListEmailsContentDiscarded | Unset):
        group (ListEmailsGroup | Unset):
        include_presence (ListEmailsIncludePresence | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ListEmailsResponse200]
     """


    kwargs = _get_kwargs(
        cursor=cursor,
limit=limit,
domain_id=domain_id,
status=status,
search=search,
date_from=date_from,
date_to=date_to,
since=since,
wait=wait,
awaiting=awaiting,
automated=automated,
recipient=recipient,
exclude_fyi=exclude_fyi,
from_verified=from_verified,
include=include,
thread_id=thread_id,
exclude_muted=exclude_muted,
search_regex=search_regex,
search_case_sensitive=search_case_sensitive,
search_negate=search_negate,
kind=kind,
content_discarded=content_discarded,
group=group,
include_presence=include_presence,

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
    domain_id: UUID | Unset = UNSET,
    status: EmailStatus | Unset = UNSET,
    search: str | Unset = UNSET,
    date_from: datetime.datetime | Unset = UNSET,
    date_to: datetime.datetime | Unset = UNSET,
    since: str | Unset = UNSET,
    wait: int | Unset = UNSET,
    awaiting: ListEmailsAwaiting | Unset = UNSET,
    automated: ListEmailsAutomated | Unset = UNSET,
    recipient: str | Unset = UNSET,
    exclude_fyi: ListEmailsExcludeFyi | Unset = UNSET,
    from_verified: ListEmailsFromVerified | Unset = UNSET,
    include: str | Unset = UNSET,
    thread_id: UUID | Unset = UNSET,
    exclude_muted: ListEmailsExcludeMuted | Unset = UNSET,
    search_regex: ListEmailsSearchRegex | Unset = UNSET,
    search_case_sensitive: ListEmailsSearchCaseSensitive | Unset = UNSET,
    search_negate: ListEmailsSearchNegate | Unset = UNSET,
    kind: ListEmailsKind | Unset = UNSET,
    content_discarded: ListEmailsContentDiscarded | Unset = UNSET,
    group: ListEmailsGroup | Unset = UNSET,
    include_presence: ListEmailsIncludePresence | Unset = UNSET,

) -> ErrorResponse | ListEmailsResponse200 | None:
    """ List inbound emails

     Returns a paginated list of INBOUND emails received at your
    verified domains. Outbound messages sent via /send-mail are
    not included; this endpoint is the inbox view, not a
    unified send/receive history.

    Supports filtering by domain, status, date range, and
    free-text search across subject, sender, and recipient
    fields.

    For a compact text-table summary of the most recent N
    inbounds (no filters, no cursor pagination), the CLI ships
    `primitive emails:latest` as a one-line-per-email shortcut.
    It's TTY-aware so id columns are full UUIDs when piped, and
    a `--json` flag returns the same envelope this endpoint
    does. Use whichever fits the call site.

    Args:
        cursor (str | Unset):
        limit (int | Unset):  Default: 50.
        domain_id (UUID | Unset):
        status (EmailStatus | Unset): Lifecycle status of an INBOUND email (a row in the `emails`
            table). Distinct from `SentEmailStatus`, which describes
            the OUTBOUND lifecycle (the `sent_emails` table) and uses
            a different vocabulary because the lifecycles differ.
            Possible values:

              - `pending`: the row was inserted at ingestion (mx_main)
                and has not yet completed the spam / filter / auth
                pipeline. Body and parsed fields are present; webhook
                delivery is not yet scheduled. Most rows transition out
                of `pending` within seconds.
              - `accepted`: the inbound passed the policy gates and is
                queued for webhook delivery. The `webhook_status` field
                tracks the separate webhook-delivery lifecycle from
                this point.
              - `completed`: terminal success. Webhook delivery
                attempted and acknowledged by every active endpoint, OR
                no endpoints are configured, so the row is durably
                archived.
              - `rejected`: terminal failure at ingestion (spam, blocked
                sender, filter rule, malformed). The body and metadata
                are stored for auditing but no webhook fires and the
                row is not repliable.

            See also `webhook_status` (separate enum tracking the
            webhook-delivery state machine) and `SentEmailStatus` (the
            outbound vocabulary).
        search (str | Unset):
        date_from (datetime.datetime | Unset):
        date_to (datetime.datetime | Unset):
        since (str | Unset):
        wait (int | Unset):
        awaiting (ListEmailsAwaiting | Unset):
        automated (ListEmailsAutomated | Unset):
        recipient (str | Unset):
        exclude_fyi (ListEmailsExcludeFyi | Unset):
        from_verified (ListEmailsFromVerified | Unset):
        include (str | Unset):  Example: body_text,headers.
        thread_id (UUID | Unset):
        exclude_muted (ListEmailsExcludeMuted | Unset):
        search_regex (ListEmailsSearchRegex | Unset):
        search_case_sensitive (ListEmailsSearchCaseSensitive | Unset):
        search_negate (ListEmailsSearchNegate | Unset):
        kind (ListEmailsKind | Unset):
        content_discarded (ListEmailsContentDiscarded | Unset):
        group (ListEmailsGroup | Unset):
        include_presence (ListEmailsIncludePresence | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ListEmailsResponse200
     """


    return (await asyncio_detailed(
        client=client,
cursor=cursor,
limit=limit,
domain_id=domain_id,
status=status,
search=search,
date_from=date_from,
date_to=date_to,
since=since,
wait=wait,
awaiting=awaiting,
automated=automated,
recipient=recipient,
exclude_fyi=exclude_fyi,
from_verified=from_verified,
include=include,
thread_id=thread_id,
exclude_muted=exclude_muted,
search_regex=search_regex,
search_case_sensitive=search_case_sensitive,
search_negate=search_negate,
kind=kind,
content_discarded=content_discarded,
group=group,
include_presence=include_presence,

    )).parsed
