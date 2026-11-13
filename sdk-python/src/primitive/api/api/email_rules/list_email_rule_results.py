from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.list_email_rule_results_response_200 import ListEmailRuleResultsResponse200
from typing import cast
from uuid import UUID



def _get_kwargs(
    id: UUID,

) -> dict[str, Any]:
    

    

    

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/emails/{id}/rule-results".format(id=quote(str(id), safe=""),),
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | ListEmailRuleResultsResponse200 | None:
    if response.status_code == 200:
        response_200 = ListEmailRuleResultsResponse200.from_dict(response.json())



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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | ListEmailRuleResultsResponse200]:
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

) -> Response[ErrorResponse | ListEmailRuleResultsResponse200]:
    """ List every rule's result on an email

     What each rule you can see decided about this email (matched, not matched, or not run), in the words
    of the deciding version. A do_not_share rule that matched it blocks sharing while active; earlier
    shares stay. Only a caller who can read the email gets an answer. classification is every fact the
    classifier read, as rule conditions read it. At most 50 rules are listed, results first; not_listed
    counts the rest. Another member's rule that decided on your own mail is listed read_only (dashboard
    and CLI only), with who receives what it shares (receivers) while it covers you; hidden counts
    deciding rules you cannot see. Whether a rule delivered the email by webhook is not in the rule
    results: on your own mail, rule_deliveries on GET /v1/emails/{id} (primitive emails get <email-id>
    --json) counts each rule's webhook deliveries; on another member's mail, GET
    /v1/webhooks/deliveries?email_id=<email-id> (primitive webhook-deliveries list --email-id <email-
    id>, with webhooks:read) lists them. Needs mail:read, the email rules feature, and a member's own
    full-access credential (no API key, agent key or narrowed token).

    Args:
        id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ListEmailRuleResultsResponse200]
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

) -> ErrorResponse | ListEmailRuleResultsResponse200 | None:
    """ List every rule's result on an email

     What each rule you can see decided about this email (matched, not matched, or not run), in the words
    of the deciding version. A do_not_share rule that matched it blocks sharing while active; earlier
    shares stay. Only a caller who can read the email gets an answer. classification is every fact the
    classifier read, as rule conditions read it. At most 50 rules are listed, results first; not_listed
    counts the rest. Another member's rule that decided on your own mail is listed read_only (dashboard
    and CLI only), with who receives what it shares (receivers) while it covers you; hidden counts
    deciding rules you cannot see. Whether a rule delivered the email by webhook is not in the rule
    results: on your own mail, rule_deliveries on GET /v1/emails/{id} (primitive emails get <email-id>
    --json) counts each rule's webhook deliveries; on another member's mail, GET
    /v1/webhooks/deliveries?email_id=<email-id> (primitive webhook-deliveries list --email-id <email-
    id>, with webhooks:read) lists them. Needs mail:read, the email rules feature, and a member's own
    full-access credential (no API key, agent key or narrowed token).

    Args:
        id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ListEmailRuleResultsResponse200
     """


    return sync_detailed(
        id=id,
client=client,

    ).parsed

async def asyncio_detailed(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,

) -> Response[ErrorResponse | ListEmailRuleResultsResponse200]:
    """ List every rule's result on an email

     What each rule you can see decided about this email (matched, not matched, or not run), in the words
    of the deciding version. A do_not_share rule that matched it blocks sharing while active; earlier
    shares stay. Only a caller who can read the email gets an answer. classification is every fact the
    classifier read, as rule conditions read it. At most 50 rules are listed, results first; not_listed
    counts the rest. Another member's rule that decided on your own mail is listed read_only (dashboard
    and CLI only), with who receives what it shares (receivers) while it covers you; hidden counts
    deciding rules you cannot see. Whether a rule delivered the email by webhook is not in the rule
    results: on your own mail, rule_deliveries on GET /v1/emails/{id} (primitive emails get <email-id>
    --json) counts each rule's webhook deliveries; on another member's mail, GET
    /v1/webhooks/deliveries?email_id=<email-id> (primitive webhook-deliveries list --email-id <email-
    id>, with webhooks:read) lists them. Needs mail:read, the email rules feature, and a member's own
    full-access credential (no API key, agent key or narrowed token).

    Args:
        id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ListEmailRuleResultsResponse200]
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

) -> ErrorResponse | ListEmailRuleResultsResponse200 | None:
    """ List every rule's result on an email

     What each rule you can see decided about this email (matched, not matched, or not run), in the words
    of the deciding version. A do_not_share rule that matched it blocks sharing while active; earlier
    shares stay. Only a caller who can read the email gets an answer. classification is every fact the
    classifier read, as rule conditions read it. At most 50 rules are listed, results first; not_listed
    counts the rest. Another member's rule that decided on your own mail is listed read_only (dashboard
    and CLI only), with who receives what it shares (receivers) while it covers you; hidden counts
    deciding rules you cannot see. Whether a rule delivered the email by webhook is not in the rule
    results: on your own mail, rule_deliveries on GET /v1/emails/{id} (primitive emails get <email-id>
    --json) counts each rule's webhook deliveries; on another member's mail, GET
    /v1/webhooks/deliveries?email_id=<email-id> (primitive webhook-deliveries list --email-id <email-
    id>, with webhooks:read) lists them. Needs mail:read, the email rules feature, and a member's own
    full-access credential (no API key, agent key or narrowed token).

    Args:
        id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ListEmailRuleResultsResponse200
     """


    return (await asyncio_detailed(
        id=id,
client=client,

    )).parsed
