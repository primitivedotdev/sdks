from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.test_endpoint_rules_input import TestEndpointRulesInput
from ...models.test_endpoint_rules_response_200 import TestEndpointRulesResponse200
from typing import cast
from uuid import UUID



def _get_kwargs(
    id: UUID,
    *,
    body: TestEndpointRulesInput,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/endpoints/{id}/rules/test".format(id=quote(str(id), safe=""),),
    }

    _kwargs["json"] = body.to_dict()


    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | TestEndpointRulesResponse200 | None:
    if response.status_code == 200:
        response_200 = TestEndpointRulesResponse200.from_dict(response.json())



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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | TestEndpointRulesResponse200]:
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
    body: TestEndpointRulesInput,

) -> Response[ErrorResponse | TestEndpointRulesResponse200]:
    """ Dry-run endpoint rules against a received email

     Evaluates the endpoint's filtering rules against an
    already-received email WITHOUT delivering anything. The same
    shared matcher the live delivery paths use produces the
    verdict, so the response explains exactly why a webhook fired
    or was suppressed for that message.

    When delivery would be suppressed, `rule` names the failing
    rule and `reason` carries a human-readable explanation; both
    are null when the message matches. `evaluated` echoes the
    message metadata the matcher compared (size, attachments, and
    the authenticated From identity versus the raw envelope
    sender), so a surprising verdict can be traced to its inputs.

    Two independent gates are surfaced separately:
    `subscribed_to_event` reports the endpoint's event-type
    subscription (checked before message matching), and
    `rules_valid` reports whether the stored rules blob parsed at
    all. Delivery fails OPEN on an invalid blob (the message is
    delivered as if unfiltered), so `rules_valid: false` exposes a
    misconfiguration that is otherwise silent.

    Args:
        id (UUID):
        body (TestEndpointRulesInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | TestEndpointRulesResponse200]
     """


    kwargs = _get_kwargs(
        id=id,
body=body,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: TestEndpointRulesInput,

) -> ErrorResponse | TestEndpointRulesResponse200 | None:
    """ Dry-run endpoint rules against a received email

     Evaluates the endpoint's filtering rules against an
    already-received email WITHOUT delivering anything. The same
    shared matcher the live delivery paths use produces the
    verdict, so the response explains exactly why a webhook fired
    or was suppressed for that message.

    When delivery would be suppressed, `rule` names the failing
    rule and `reason` carries a human-readable explanation; both
    are null when the message matches. `evaluated` echoes the
    message metadata the matcher compared (size, attachments, and
    the authenticated From identity versus the raw envelope
    sender), so a surprising verdict can be traced to its inputs.

    Two independent gates are surfaced separately:
    `subscribed_to_event` reports the endpoint's event-type
    subscription (checked before message matching), and
    `rules_valid` reports whether the stored rules blob parsed at
    all. Delivery fails OPEN on an invalid blob (the message is
    delivered as if unfiltered), so `rules_valid: false` exposes a
    misconfiguration that is otherwise silent.

    Args:
        id (UUID):
        body (TestEndpointRulesInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | TestEndpointRulesResponse200
     """


    return sync_detailed(
        id=id,
client=client,
body=body,

    ).parsed

async def asyncio_detailed(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: TestEndpointRulesInput,

) -> Response[ErrorResponse | TestEndpointRulesResponse200]:
    """ Dry-run endpoint rules against a received email

     Evaluates the endpoint's filtering rules against an
    already-received email WITHOUT delivering anything. The same
    shared matcher the live delivery paths use produces the
    verdict, so the response explains exactly why a webhook fired
    or was suppressed for that message.

    When delivery would be suppressed, `rule` names the failing
    rule and `reason` carries a human-readable explanation; both
    are null when the message matches. `evaluated` echoes the
    message metadata the matcher compared (size, attachments, and
    the authenticated From identity versus the raw envelope
    sender), so a surprising verdict can be traced to its inputs.

    Two independent gates are surfaced separately:
    `subscribed_to_event` reports the endpoint's event-type
    subscription (checked before message matching), and
    `rules_valid` reports whether the stored rules blob parsed at
    all. Delivery fails OPEN on an invalid blob (the message is
    delivered as if unfiltered), so `rules_valid: false` exposes a
    misconfiguration that is otherwise silent.

    Args:
        id (UUID):
        body (TestEndpointRulesInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | TestEndpointRulesResponse200]
     """


    kwargs = _get_kwargs(
        id=id,
body=body,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: TestEndpointRulesInput,

) -> ErrorResponse | TestEndpointRulesResponse200 | None:
    """ Dry-run endpoint rules against a received email

     Evaluates the endpoint's filtering rules against an
    already-received email WITHOUT delivering anything. The same
    shared matcher the live delivery paths use produces the
    verdict, so the response explains exactly why a webhook fired
    or was suppressed for that message.

    When delivery would be suppressed, `rule` names the failing
    rule and `reason` carries a human-readable explanation; both
    are null when the message matches. `evaluated` echoes the
    message metadata the matcher compared (size, attachments, and
    the authenticated From identity versus the raw envelope
    sender), so a surprising verdict can be traced to its inputs.

    Two independent gates are surfaced separately:
    `subscribed_to_event` reports the endpoint's event-type
    subscription (checked before message matching), and
    `rules_valid` reports whether the stored rules blob parsed at
    all. Delivery fails OPEN on an invalid blob (the message is
    delivered as if unfiltered), so `rules_valid: false` exposes a
    misconfiguration that is otherwise silent.

    Args:
        id (UUID):
        body (TestEndpointRulesInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | TestEndpointRulesResponse200
     """


    return (await asyncio_detailed(
        id=id,
client=client,
body=body,

    )).parsed
