from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.get_agent_contact_policy_response_200 import GetAgentContactPolicyResponse200
from typing import cast



def _get_kwargs(
    agent_address: str,

) -> dict[str, Any]:
    

    

    

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/agent-contact-policy/{agent_address}".format(agent_address=quote(str(agent_address), safe=""),),
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | GetAgentContactPolicyResponse200 | None:
    if response.status_code == 200:
        response_200 = GetAgentContactPolicyResponse200.from_dict(response.json())



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

    if response.status_code == 409:
        response_409 = ErrorResponse.from_dict(response.json())



        return response_409

    if response.status_code == 429:
        response_429 = ErrorResponse.from_dict(response.json())



        return response_429

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | GetAgentContactPolicyResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    agent_address: str,
    *,
    client: AuthenticatedClient,

) -> Response[ErrorResponse | GetAgentContactPolicyResponse200]:
    """ Read agent contact policy

     Receiver-side email notification admission preferences; never task, tool, code execution or account
    authority. Rules take effect only in receivers implementing this current contact-policy contract.
    Older receivers may continue their previous exact-contact notifications until updated. Ordinary
    email delivery, storage, webhooks and explicit reply waits remain independent of these preferences.
    Organization owners/admins using session, OAuth or signed dashboard credentials may read/write
    policies. Connected credentials may only GET their own agent composite; they cannot write either
    policy. Function and signed capability credentials are not granted access. Rules are unordered.
    Exact membership notify:false always silences. Next use matching agent rules, otherwise matching
    organization rules; silence wins ties within that scope. If neither scope matches, existing exact
    membership notify:true allows using its own activation metadata; otherwise only enabled contact-
    request intake is allowed. Owner policy silence therefore cannot be bypassed by a connected agent
    adding a notify:true membership. Patterns are canonical lowercase bare mailboxes, *@example.com,
    research-*@example.com or *@*.example.com. Only a terminal local-part * and a leading whole domain-
    label *. are supported; subdomain patterns exclude the apex and require a literal multi-label
    suffix. No regular expressions, question marks, universal domains or wildcard TLDs. Domain-only UI
    input must be converted to *@domain. PUT fully replaces up to 100 rules and the request-intake
    option using exactly one CAS precondition. Duplicate pattern/effect pairs are rejected. if_absent
    returns an identical existing document, otherwise 409. A missing document reads as empty rules, null
    version/timestamps, false request intake for the organization and null (inherit) for the agent.
    Reset overrides with empty rules and null request intake. Allow rules preserve server activation
    metadata while retained unchanged; removing/recreating or changing a rule to allow resets it.
    Request intake defaults off; agent null inherits the organization. No-op writes preserve versions.
    Agent composite effective_version changes with either policy document, connection identity,
    generation or successful claim; effective_since is the latest policy mutation, connection creation
    or successful claim. Reclaiming a connection invalidates prior admission snapshots and starts a
    fresh rule/request cutoff; routine heartbeats do not. Rule/request admissions require received_at >=
    both the selected activation time and effective_since. Consequently even unrelated policy edits
    suppress queued older rule/request admissions, without deleting email history or affecting explicit
    reply waits. Exact membership fallback retains its own notify_since and generation but must still
    recheck current policy denies and effective_version. Before dispatch, receivers must recheck the
    current composite version and applicable activation generation and membership; stop new admissions
    when policy is unavailable or older than 30 seconds. Snapshot fields explain scope and matched rules
    locally; the API does not execute tasks or dispatch notifications.

    Args:
        agent_address (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | GetAgentContactPolicyResponse200]
     """


    kwargs = _get_kwargs(
        agent_address=agent_address,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    agent_address: str,
    *,
    client: AuthenticatedClient,

) -> ErrorResponse | GetAgentContactPolicyResponse200 | None:
    """ Read agent contact policy

     Receiver-side email notification admission preferences; never task, tool, code execution or account
    authority. Rules take effect only in receivers implementing this current contact-policy contract.
    Older receivers may continue their previous exact-contact notifications until updated. Ordinary
    email delivery, storage, webhooks and explicit reply waits remain independent of these preferences.
    Organization owners/admins using session, OAuth or signed dashboard credentials may read/write
    policies. Connected credentials may only GET their own agent composite; they cannot write either
    policy. Function and signed capability credentials are not granted access. Rules are unordered.
    Exact membership notify:false always silences. Next use matching agent rules, otherwise matching
    organization rules; silence wins ties within that scope. If neither scope matches, existing exact
    membership notify:true allows using its own activation metadata; otherwise only enabled contact-
    request intake is allowed. Owner policy silence therefore cannot be bypassed by a connected agent
    adding a notify:true membership. Patterns are canonical lowercase bare mailboxes, *@example.com,
    research-*@example.com or *@*.example.com. Only a terminal local-part * and a leading whole domain-
    label *. are supported; subdomain patterns exclude the apex and require a literal multi-label
    suffix. No regular expressions, question marks, universal domains or wildcard TLDs. Domain-only UI
    input must be converted to *@domain. PUT fully replaces up to 100 rules and the request-intake
    option using exactly one CAS precondition. Duplicate pattern/effect pairs are rejected. if_absent
    returns an identical existing document, otherwise 409. A missing document reads as empty rules, null
    version/timestamps, false request intake for the organization and null (inherit) for the agent.
    Reset overrides with empty rules and null request intake. Allow rules preserve server activation
    metadata while retained unchanged; removing/recreating or changing a rule to allow resets it.
    Request intake defaults off; agent null inherits the organization. No-op writes preserve versions.
    Agent composite effective_version changes with either policy document, connection identity,
    generation or successful claim; effective_since is the latest policy mutation, connection creation
    or successful claim. Reclaiming a connection invalidates prior admission snapshots and starts a
    fresh rule/request cutoff; routine heartbeats do not. Rule/request admissions require received_at >=
    both the selected activation time and effective_since. Consequently even unrelated policy edits
    suppress queued older rule/request admissions, without deleting email history or affecting explicit
    reply waits. Exact membership fallback retains its own notify_since and generation but must still
    recheck current policy denies and effective_version. Before dispatch, receivers must recheck the
    current composite version and applicable activation generation and membership; stop new admissions
    when policy is unavailable or older than 30 seconds. Snapshot fields explain scope and matched rules
    locally; the API does not execute tasks or dispatch notifications.

    Args:
        agent_address (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | GetAgentContactPolicyResponse200
     """


    return sync_detailed(
        agent_address=agent_address,
client=client,

    ).parsed

async def asyncio_detailed(
    agent_address: str,
    *,
    client: AuthenticatedClient,

) -> Response[ErrorResponse | GetAgentContactPolicyResponse200]:
    """ Read agent contact policy

     Receiver-side email notification admission preferences; never task, tool, code execution or account
    authority. Rules take effect only in receivers implementing this current contact-policy contract.
    Older receivers may continue their previous exact-contact notifications until updated. Ordinary
    email delivery, storage, webhooks and explicit reply waits remain independent of these preferences.
    Organization owners/admins using session, OAuth or signed dashboard credentials may read/write
    policies. Connected credentials may only GET their own agent composite; they cannot write either
    policy. Function and signed capability credentials are not granted access. Rules are unordered.
    Exact membership notify:false always silences. Next use matching agent rules, otherwise matching
    organization rules; silence wins ties within that scope. If neither scope matches, existing exact
    membership notify:true allows using its own activation metadata; otherwise only enabled contact-
    request intake is allowed. Owner policy silence therefore cannot be bypassed by a connected agent
    adding a notify:true membership. Patterns are canonical lowercase bare mailboxes, *@example.com,
    research-*@example.com or *@*.example.com. Only a terminal local-part * and a leading whole domain-
    label *. are supported; subdomain patterns exclude the apex and require a literal multi-label
    suffix. No regular expressions, question marks, universal domains or wildcard TLDs. Domain-only UI
    input must be converted to *@domain. PUT fully replaces up to 100 rules and the request-intake
    option using exactly one CAS precondition. Duplicate pattern/effect pairs are rejected. if_absent
    returns an identical existing document, otherwise 409. A missing document reads as empty rules, null
    version/timestamps, false request intake for the organization and null (inherit) for the agent.
    Reset overrides with empty rules and null request intake. Allow rules preserve server activation
    metadata while retained unchanged; removing/recreating or changing a rule to allow resets it.
    Request intake defaults off; agent null inherits the organization. No-op writes preserve versions.
    Agent composite effective_version changes with either policy document, connection identity,
    generation or successful claim; effective_since is the latest policy mutation, connection creation
    or successful claim. Reclaiming a connection invalidates prior admission snapshots and starts a
    fresh rule/request cutoff; routine heartbeats do not. Rule/request admissions require received_at >=
    both the selected activation time and effective_since. Consequently even unrelated policy edits
    suppress queued older rule/request admissions, without deleting email history or affecting explicit
    reply waits. Exact membership fallback retains its own notify_since and generation but must still
    recheck current policy denies and effective_version. Before dispatch, receivers must recheck the
    current composite version and applicable activation generation and membership; stop new admissions
    when policy is unavailable or older than 30 seconds. Snapshot fields explain scope and matched rules
    locally; the API does not execute tasks or dispatch notifications.

    Args:
        agent_address (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | GetAgentContactPolicyResponse200]
     """


    kwargs = _get_kwargs(
        agent_address=agent_address,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    agent_address: str,
    *,
    client: AuthenticatedClient,

) -> ErrorResponse | GetAgentContactPolicyResponse200 | None:
    """ Read agent contact policy

     Receiver-side email notification admission preferences; never task, tool, code execution or account
    authority. Rules take effect only in receivers implementing this current contact-policy contract.
    Older receivers may continue their previous exact-contact notifications until updated. Ordinary
    email delivery, storage, webhooks and explicit reply waits remain independent of these preferences.
    Organization owners/admins using session, OAuth or signed dashboard credentials may read/write
    policies. Connected credentials may only GET their own agent composite; they cannot write either
    policy. Function and signed capability credentials are not granted access. Rules are unordered.
    Exact membership notify:false always silences. Next use matching agent rules, otherwise matching
    organization rules; silence wins ties within that scope. If neither scope matches, existing exact
    membership notify:true allows using its own activation metadata; otherwise only enabled contact-
    request intake is allowed. Owner policy silence therefore cannot be bypassed by a connected agent
    adding a notify:true membership. Patterns are canonical lowercase bare mailboxes, *@example.com,
    research-*@example.com or *@*.example.com. Only a terminal local-part * and a leading whole domain-
    label *. are supported; subdomain patterns exclude the apex and require a literal multi-label
    suffix. No regular expressions, question marks, universal domains or wildcard TLDs. Domain-only UI
    input must be converted to *@domain. PUT fully replaces up to 100 rules and the request-intake
    option using exactly one CAS precondition. Duplicate pattern/effect pairs are rejected. if_absent
    returns an identical existing document, otherwise 409. A missing document reads as empty rules, null
    version/timestamps, false request intake for the organization and null (inherit) for the agent.
    Reset overrides with empty rules and null request intake. Allow rules preserve server activation
    metadata while retained unchanged; removing/recreating or changing a rule to allow resets it.
    Request intake defaults off; agent null inherits the organization. No-op writes preserve versions.
    Agent composite effective_version changes with either policy document, connection identity,
    generation or successful claim; effective_since is the latest policy mutation, connection creation
    or successful claim. Reclaiming a connection invalidates prior admission snapshots and starts a
    fresh rule/request cutoff; routine heartbeats do not. Rule/request admissions require received_at >=
    both the selected activation time and effective_since. Consequently even unrelated policy edits
    suppress queued older rule/request admissions, without deleting email history or affecting explicit
    reply waits. Exact membership fallback retains its own notify_since and generation but must still
    recheck current policy denies and effective_version. Before dispatch, receivers must recheck the
    current composite version and applicable activation generation and membership; stop new admissions
    when policy is unavailable or older than 30 seconds. Snapshot fields explain scope and matched rules
    locally; the API does not execute tasks or dispatch notifications.

    Args:
        agent_address (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | GetAgentContactPolicyResponse200
     """


    return (await asyncio_detailed(
        agent_address=agent_address,
client=client,

    )).parsed
