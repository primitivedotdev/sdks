from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.email_notifications_update_email_notification_preferences_input import EmailNotificationsUpdateEmailNotificationPreferencesInput
from ...models.error_response import ErrorResponse
from ...models.update_email_notification_preferences_response_200 import UpdateEmailNotificationPreferencesResponse200
from typing import cast



def _get_kwargs(
    *,
    body: EmailNotificationsUpdateEmailNotificationPreferencesInput,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "put",
        "url": "/email-notification-preferences",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | UpdateEmailNotificationPreferencesResponse200 | None:
    if response.status_code == 200:
        response_200 = UpdateEmailNotificationPreferencesResponse200.from_dict(response.json())



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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | UpdateEmailNotificationPreferencesResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: EmailNotificationsUpdateEmailNotificationPreferencesInput,

) -> Response[ErrorResponse | UpdateEmailNotificationPreferencesResponse200]:
    """ Change my email notification preferences

     Turn one or more kinds on or off for the calling member. Only a kind whose organization mode is
    optional_on or optional_off can be changed: a platform_required kind, one the organization requires,
    and one it turned off are refused with 409 (conflict, details.reason not_member_choice,
    details.org_mode saying which), and nothing is changed. An unknown kind is refused with 400. Answers
    the preferences as they now stand. Each kind lists its label and description, its class, whether it
    needs an entitlement and whether the organization has it, the organization's mode (null for
    platform_required) and the modes it may choose, and whether the calling member gets it and may
    change that.

    Person only: a dashboard session or the person's own OAuth token (the CLI or an app they connected).
    The person's role must hold notifications:manage. API keys, agent connection keys and agents are
    refused.

    Args:
        body (EmailNotificationsUpdateEmailNotificationPreferencesInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | UpdateEmailNotificationPreferencesResponse200]
     """


    kwargs = _get_kwargs(
        body=body,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    *,
    client: AuthenticatedClient | Client,
    body: EmailNotificationsUpdateEmailNotificationPreferencesInput,

) -> ErrorResponse | UpdateEmailNotificationPreferencesResponse200 | None:
    """ Change my email notification preferences

     Turn one or more kinds on or off for the calling member. Only a kind whose organization mode is
    optional_on or optional_off can be changed: a platform_required kind, one the organization requires,
    and one it turned off are refused with 409 (conflict, details.reason not_member_choice,
    details.org_mode saying which), and nothing is changed. An unknown kind is refused with 400. Answers
    the preferences as they now stand. Each kind lists its label and description, its class, whether it
    needs an entitlement and whether the organization has it, the organization's mode (null for
    platform_required) and the modes it may choose, and whether the calling member gets it and may
    change that.

    Person only: a dashboard session or the person's own OAuth token (the CLI or an app they connected).
    The person's role must hold notifications:manage. API keys, agent connection keys and agents are
    refused.

    Args:
        body (EmailNotificationsUpdateEmailNotificationPreferencesInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | UpdateEmailNotificationPreferencesResponse200
     """


    return sync_detailed(
        client=client,
body=body,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: EmailNotificationsUpdateEmailNotificationPreferencesInput,

) -> Response[ErrorResponse | UpdateEmailNotificationPreferencesResponse200]:
    """ Change my email notification preferences

     Turn one or more kinds on or off for the calling member. Only a kind whose organization mode is
    optional_on or optional_off can be changed: a platform_required kind, one the organization requires,
    and one it turned off are refused with 409 (conflict, details.reason not_member_choice,
    details.org_mode saying which), and nothing is changed. An unknown kind is refused with 400. Answers
    the preferences as they now stand. Each kind lists its label and description, its class, whether it
    needs an entitlement and whether the organization has it, the organization's mode (null for
    platform_required) and the modes it may choose, and whether the calling member gets it and may
    change that.

    Person only: a dashboard session or the person's own OAuth token (the CLI or an app they connected).
    The person's role must hold notifications:manage. API keys, agent connection keys and agents are
    refused.

    Args:
        body (EmailNotificationsUpdateEmailNotificationPreferencesInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | UpdateEmailNotificationPreferencesResponse200]
     """


    kwargs = _get_kwargs(
        body=body,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    body: EmailNotificationsUpdateEmailNotificationPreferencesInput,

) -> ErrorResponse | UpdateEmailNotificationPreferencesResponse200 | None:
    """ Change my email notification preferences

     Turn one or more kinds on or off for the calling member. Only a kind whose organization mode is
    optional_on or optional_off can be changed: a platform_required kind, one the organization requires,
    and one it turned off are refused with 409 (conflict, details.reason not_member_choice,
    details.org_mode saying which), and nothing is changed. An unknown kind is refused with 400. Answers
    the preferences as they now stand. Each kind lists its label and description, its class, whether it
    needs an entitlement and whether the organization has it, the organization's mode (null for
    platform_required) and the modes it may choose, and whether the calling member gets it and may
    change that.

    Person only: a dashboard session or the person's own OAuth token (the CLI or an app they connected).
    The person's role must hold notifications:manage. API keys, agent connection keys and agents are
    refused.

    Args:
        body (EmailNotificationsUpdateEmailNotificationPreferencesInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | UpdateEmailNotificationPreferencesResponse200
     """


    return (await asyncio_detailed(
        client=client,
body=body,

    )).parsed
