from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.email_status import EmailStatus
from ...models.error_response import ErrorResponse
from ...models.search_emails_has_attachment import SearchEmailsHasAttachment
from ...models.search_emails_include_facets import SearchEmailsIncludeFacets
from ...models.search_emails_response_200 import SearchEmailsResponse200
from ...models.search_emails_snippet import SearchEmailsSnippet
from ...models.search_emails_sort import SearchEmailsSort
from ...types import UNSET, Unset
from dateutil.parser import isoparse
from typing import cast
from uuid import UUID
import datetime



def _get_kwargs(
    *,
    q: str | Unset = UNSET,
    from_: str | Unset = UNSET,
    to: str | Unset = UNSET,
    subject: str | Unset = UNSET,
    body: str | Unset = UNSET,
    domain_id: UUID | Unset = UNSET,
    status: EmailStatus | Unset = UNSET,
    date_from: datetime.datetime | Unset = UNSET,
    date_to: datetime.datetime | Unset = UNSET,
    has_attachment: SearchEmailsHasAttachment | Unset = UNSET,
    spam_score_lt: float | Unset = UNSET,
    spam_score_gte: float | Unset = UNSET,
    sort: SearchEmailsSort | Unset = UNSET,
    cursor: str | Unset = UNSET,
    limit: int | Unset = 50,
    snippet: SearchEmailsSnippet | Unset = SearchEmailsSnippet.TRUE,
    include_facets: SearchEmailsIncludeFacets | Unset = SearchEmailsIncludeFacets.TRUE,

) -> dict[str, Any]:
    

    

    params: dict[str, Any] = {}

    params["q"] = q

    params["from"] = from_

    params["to"] = to

    params["subject"] = subject

    params["body"] = body

    json_domain_id: str | Unset = UNSET
    if not isinstance(domain_id, Unset):
        json_domain_id = str(domain_id)
    params["domain_id"] = json_domain_id

    json_status: str | Unset = UNSET
    if not isinstance(status, Unset):
        json_status = status.value

    params["status"] = json_status

    json_date_from: str | Unset = UNSET
    if not isinstance(date_from, Unset):
        json_date_from = date_from.isoformat()
    params["date_from"] = json_date_from

    json_date_to: str | Unset = UNSET
    if not isinstance(date_to, Unset):
        json_date_to = date_to.isoformat()
    params["date_to"] = json_date_to

    json_has_attachment: str | Unset = UNSET
    if not isinstance(has_attachment, Unset):
        json_has_attachment = has_attachment.value

    params["has_attachment"] = json_has_attachment

    params["spam_score_lt"] = spam_score_lt

    params["spam_score_gte"] = spam_score_gte

    json_sort: str | Unset = UNSET
    if not isinstance(sort, Unset):
        json_sort = sort.value

    params["sort"] = json_sort

    params["cursor"] = cursor

    params["limit"] = limit

    json_snippet: str | Unset = UNSET
    if not isinstance(snippet, Unset):
        json_snippet = snippet.value

    params["snippet"] = json_snippet

    json_include_facets: str | Unset = UNSET
    if not isinstance(include_facets, Unset):
        json_include_facets = include_facets.value

    params["include_facets"] = json_include_facets


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/emails/search",
        "params": params,
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | SearchEmailsResponse200 | None:
    if response.status_code == 200:
        response_200 = SearchEmailsResponse200.from_dict(response.json())



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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | SearchEmailsResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    q: str | Unset = UNSET,
    from_: str | Unset = UNSET,
    to: str | Unset = UNSET,
    subject: str | Unset = UNSET,
    body: str | Unset = UNSET,
    domain_id: UUID | Unset = UNSET,
    status: EmailStatus | Unset = UNSET,
    date_from: datetime.datetime | Unset = UNSET,
    date_to: datetime.datetime | Unset = UNSET,
    has_attachment: SearchEmailsHasAttachment | Unset = UNSET,
    spam_score_lt: float | Unset = UNSET,
    spam_score_gte: float | Unset = UNSET,
    sort: SearchEmailsSort | Unset = UNSET,
    cursor: str | Unset = UNSET,
    limit: int | Unset = 50,
    snippet: SearchEmailsSnippet | Unset = SearchEmailsSnippet.TRUE,
    include_facets: SearchEmailsIncludeFacets | Unset = SearchEmailsIncludeFacets.TRUE,

) -> Response[ErrorResponse | SearchEmailsResponse200]:
    """ Search inbound emails

     Searches inbound emails with structured filters and optional
    full-text matching across parsed email fields. This endpoint is
    optimized for filtered inbox views and CLI polling workflows:
    callers that only need new accepted mail can pass
    `sort=received_at_asc`, `snippet=false`, `include_facets=false`,
    and a `date_from` timestamp.

    `q`, `subject`, and `body` use the same English full-text index
    as the web inbox search. Structured filters such as `from`, `to`,
    `domain_id`, status, attachment presence, and spam score bounds
    are combined with the text query.

    Args:
        q (str | Unset):
        from_ (str | Unset):
        to (str | Unset):
        subject (str | Unset):
        body (str | Unset):
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
        date_from (datetime.datetime | Unset):
        date_to (datetime.datetime | Unset):
        has_attachment (SearchEmailsHasAttachment | Unset):
        spam_score_lt (float | Unset):
        spam_score_gte (float | Unset):
        sort (SearchEmailsSort | Unset):
        cursor (str | Unset):
        limit (int | Unset):  Default: 50.
        snippet (SearchEmailsSnippet | Unset):  Default: SearchEmailsSnippet.TRUE.
        include_facets (SearchEmailsIncludeFacets | Unset):  Default:
            SearchEmailsIncludeFacets.TRUE.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | SearchEmailsResponse200]
     """


    kwargs = _get_kwargs(
        q=q,
from_=from_,
to=to,
subject=subject,
body=body,
domain_id=domain_id,
status=status,
date_from=date_from,
date_to=date_to,
has_attachment=has_attachment,
spam_score_lt=spam_score_lt,
spam_score_gte=spam_score_gte,
sort=sort,
cursor=cursor,
limit=limit,
snippet=snippet,
include_facets=include_facets,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    *,
    client: AuthenticatedClient | Client,
    q: str | Unset = UNSET,
    from_: str | Unset = UNSET,
    to: str | Unset = UNSET,
    subject: str | Unset = UNSET,
    body: str | Unset = UNSET,
    domain_id: UUID | Unset = UNSET,
    status: EmailStatus | Unset = UNSET,
    date_from: datetime.datetime | Unset = UNSET,
    date_to: datetime.datetime | Unset = UNSET,
    has_attachment: SearchEmailsHasAttachment | Unset = UNSET,
    spam_score_lt: float | Unset = UNSET,
    spam_score_gte: float | Unset = UNSET,
    sort: SearchEmailsSort | Unset = UNSET,
    cursor: str | Unset = UNSET,
    limit: int | Unset = 50,
    snippet: SearchEmailsSnippet | Unset = SearchEmailsSnippet.TRUE,
    include_facets: SearchEmailsIncludeFacets | Unset = SearchEmailsIncludeFacets.TRUE,

) -> ErrorResponse | SearchEmailsResponse200 | None:
    """ Search inbound emails

     Searches inbound emails with structured filters and optional
    full-text matching across parsed email fields. This endpoint is
    optimized for filtered inbox views and CLI polling workflows:
    callers that only need new accepted mail can pass
    `sort=received_at_asc`, `snippet=false`, `include_facets=false`,
    and a `date_from` timestamp.

    `q`, `subject`, and `body` use the same English full-text index
    as the web inbox search. Structured filters such as `from`, `to`,
    `domain_id`, status, attachment presence, and spam score bounds
    are combined with the text query.

    Args:
        q (str | Unset):
        from_ (str | Unset):
        to (str | Unset):
        subject (str | Unset):
        body (str | Unset):
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
        date_from (datetime.datetime | Unset):
        date_to (datetime.datetime | Unset):
        has_attachment (SearchEmailsHasAttachment | Unset):
        spam_score_lt (float | Unset):
        spam_score_gte (float | Unset):
        sort (SearchEmailsSort | Unset):
        cursor (str | Unset):
        limit (int | Unset):  Default: 50.
        snippet (SearchEmailsSnippet | Unset):  Default: SearchEmailsSnippet.TRUE.
        include_facets (SearchEmailsIncludeFacets | Unset):  Default:
            SearchEmailsIncludeFacets.TRUE.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | SearchEmailsResponse200
     """


    return sync_detailed(
        client=client,
q=q,
from_=from_,
to=to,
subject=subject,
body=body,
domain_id=domain_id,
status=status,
date_from=date_from,
date_to=date_to,
has_attachment=has_attachment,
spam_score_lt=spam_score_lt,
spam_score_gte=spam_score_gte,
sort=sort,
cursor=cursor,
limit=limit,
snippet=snippet,
include_facets=include_facets,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    q: str | Unset = UNSET,
    from_: str | Unset = UNSET,
    to: str | Unset = UNSET,
    subject: str | Unset = UNSET,
    body: str | Unset = UNSET,
    domain_id: UUID | Unset = UNSET,
    status: EmailStatus | Unset = UNSET,
    date_from: datetime.datetime | Unset = UNSET,
    date_to: datetime.datetime | Unset = UNSET,
    has_attachment: SearchEmailsHasAttachment | Unset = UNSET,
    spam_score_lt: float | Unset = UNSET,
    spam_score_gte: float | Unset = UNSET,
    sort: SearchEmailsSort | Unset = UNSET,
    cursor: str | Unset = UNSET,
    limit: int | Unset = 50,
    snippet: SearchEmailsSnippet | Unset = SearchEmailsSnippet.TRUE,
    include_facets: SearchEmailsIncludeFacets | Unset = SearchEmailsIncludeFacets.TRUE,

) -> Response[ErrorResponse | SearchEmailsResponse200]:
    """ Search inbound emails

     Searches inbound emails with structured filters and optional
    full-text matching across parsed email fields. This endpoint is
    optimized for filtered inbox views and CLI polling workflows:
    callers that only need new accepted mail can pass
    `sort=received_at_asc`, `snippet=false`, `include_facets=false`,
    and a `date_from` timestamp.

    `q`, `subject`, and `body` use the same English full-text index
    as the web inbox search. Structured filters such as `from`, `to`,
    `domain_id`, status, attachment presence, and spam score bounds
    are combined with the text query.

    Args:
        q (str | Unset):
        from_ (str | Unset):
        to (str | Unset):
        subject (str | Unset):
        body (str | Unset):
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
        date_from (datetime.datetime | Unset):
        date_to (datetime.datetime | Unset):
        has_attachment (SearchEmailsHasAttachment | Unset):
        spam_score_lt (float | Unset):
        spam_score_gte (float | Unset):
        sort (SearchEmailsSort | Unset):
        cursor (str | Unset):
        limit (int | Unset):  Default: 50.
        snippet (SearchEmailsSnippet | Unset):  Default: SearchEmailsSnippet.TRUE.
        include_facets (SearchEmailsIncludeFacets | Unset):  Default:
            SearchEmailsIncludeFacets.TRUE.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | SearchEmailsResponse200]
     """


    kwargs = _get_kwargs(
        q=q,
from_=from_,
to=to,
subject=subject,
body=body,
domain_id=domain_id,
status=status,
date_from=date_from,
date_to=date_to,
has_attachment=has_attachment,
spam_score_lt=spam_score_lt,
spam_score_gte=spam_score_gte,
sort=sort,
cursor=cursor,
limit=limit,
snippet=snippet,
include_facets=include_facets,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    q: str | Unset = UNSET,
    from_: str | Unset = UNSET,
    to: str | Unset = UNSET,
    subject: str | Unset = UNSET,
    body: str | Unset = UNSET,
    domain_id: UUID | Unset = UNSET,
    status: EmailStatus | Unset = UNSET,
    date_from: datetime.datetime | Unset = UNSET,
    date_to: datetime.datetime | Unset = UNSET,
    has_attachment: SearchEmailsHasAttachment | Unset = UNSET,
    spam_score_lt: float | Unset = UNSET,
    spam_score_gte: float | Unset = UNSET,
    sort: SearchEmailsSort | Unset = UNSET,
    cursor: str | Unset = UNSET,
    limit: int | Unset = 50,
    snippet: SearchEmailsSnippet | Unset = SearchEmailsSnippet.TRUE,
    include_facets: SearchEmailsIncludeFacets | Unset = SearchEmailsIncludeFacets.TRUE,

) -> ErrorResponse | SearchEmailsResponse200 | None:
    """ Search inbound emails

     Searches inbound emails with structured filters and optional
    full-text matching across parsed email fields. This endpoint is
    optimized for filtered inbox views and CLI polling workflows:
    callers that only need new accepted mail can pass
    `sort=received_at_asc`, `snippet=false`, `include_facets=false`,
    and a `date_from` timestamp.

    `q`, `subject`, and `body` use the same English full-text index
    as the web inbox search. Structured filters such as `from`, `to`,
    `domain_id`, status, attachment presence, and spam score bounds
    are combined with the text query.

    Args:
        q (str | Unset):
        from_ (str | Unset):
        to (str | Unset):
        subject (str | Unset):
        body (str | Unset):
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
        date_from (datetime.datetime | Unset):
        date_to (datetime.datetime | Unset):
        has_attachment (SearchEmailsHasAttachment | Unset):
        spam_score_lt (float | Unset):
        spam_score_gte (float | Unset):
        sort (SearchEmailsSort | Unset):
        cursor (str | Unset):
        limit (int | Unset):  Default: 50.
        snippet (SearchEmailsSnippet | Unset):  Default: SearchEmailsSnippet.TRUE.
        include_facets (SearchEmailsIncludeFacets | Unset):  Default:
            SearchEmailsIncludeFacets.TRUE.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | SearchEmailsResponse200
     """


    return (await asyncio_detailed(
        client=client,
q=q,
from_=from_,
to=to,
subject=subject,
body=body,
domain_id=domain_id,
status=status,
date_from=date_from,
date_to=date_to,
has_attachment=has_attachment,
spam_score_lt=spam_score_lt,
spam_score_gte=spam_score_gte,
sort=sort,
cursor=cursor,
limit=limit,
snippet=snippet,
include_facets=include_facets,

    )).parsed
