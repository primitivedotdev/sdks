from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.org_settings_update_search_settings_input import OrgSettingsUpdateSearchSettingsInput
from ...models.update_search_settings_response_200 import UpdateSearchSettingsResponse200
from ...types import UNSET, Unset
from typing import cast



def _get_kwargs(
    *,
    body: OrgSettingsUpdateSearchSettingsInput,
    primitive_step_up: str | Unset = UNSET,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}
    if not isinstance(primitive_step_up, Unset):
        headers["Primitive-Step-Up"] = primitive_step_up



    

    

    _kwargs: dict[str, Any] = {
        "method": "put",
        "url": "/search-settings",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | UpdateSearchSettingsResponse200 | None:
    if response.status_code == 200:
        response_200 = UpdateSearchSettingsResponse200.from_dict(response.json())



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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | UpdateSearchSettingsResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: OrgSettingsUpdateSearchSettingsInput,
    primitive_step_up: str | Unset = UNSET,

) -> Response[ErrorResponse | UpdateSearchSettingsResponse200]:
    """ Change the semantic search setting

     Consent to, or withdraw consent from, semantic search. Consenting sends the organization's mail
    content to an embedding provider, so it is a person's decision. Turning it on is refused with 409
    under HIPAA mode (hipaa_mode), without a paid plan (plan_required) or while it is not available to
    the organization (not_available). Turning it off is always allowed.

    Person only: a dashboard session, or the person's own OAuth token with a step-up token for purpose
    `org_settings.write` in the Primitive-Step-Up header. Without one an OAuth token is answered 403
    step_up_required, whose details carry the dashboard URL that issues it (or 403 grant_forbidden when
    the person's role could not do it anyway). The person's role must hold search_settings:manage. API
    keys and agent connection keys are refused. An agent acting for the person is refused unless it
    carries a step-up token the person issued in the dashboard.

    Args:
        primitive_step_up (str | Unset):
        body (OrgSettingsUpdateSearchSettingsInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | UpdateSearchSettingsResponse200]
     """


    kwargs = _get_kwargs(
        body=body,
primitive_step_up=primitive_step_up,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    *,
    client: AuthenticatedClient | Client,
    body: OrgSettingsUpdateSearchSettingsInput,
    primitive_step_up: str | Unset = UNSET,

) -> ErrorResponse | UpdateSearchSettingsResponse200 | None:
    """ Change the semantic search setting

     Consent to, or withdraw consent from, semantic search. Consenting sends the organization's mail
    content to an embedding provider, so it is a person's decision. Turning it on is refused with 409
    under HIPAA mode (hipaa_mode), without a paid plan (plan_required) or while it is not available to
    the organization (not_available). Turning it off is always allowed.

    Person only: a dashboard session, or the person's own OAuth token with a step-up token for purpose
    `org_settings.write` in the Primitive-Step-Up header. Without one an OAuth token is answered 403
    step_up_required, whose details carry the dashboard URL that issues it (or 403 grant_forbidden when
    the person's role could not do it anyway). The person's role must hold search_settings:manage. API
    keys and agent connection keys are refused. An agent acting for the person is refused unless it
    carries a step-up token the person issued in the dashboard.

    Args:
        primitive_step_up (str | Unset):
        body (OrgSettingsUpdateSearchSettingsInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | UpdateSearchSettingsResponse200
     """


    return sync_detailed(
        client=client,
body=body,
primitive_step_up=primitive_step_up,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: OrgSettingsUpdateSearchSettingsInput,
    primitive_step_up: str | Unset = UNSET,

) -> Response[ErrorResponse | UpdateSearchSettingsResponse200]:
    """ Change the semantic search setting

     Consent to, or withdraw consent from, semantic search. Consenting sends the organization's mail
    content to an embedding provider, so it is a person's decision. Turning it on is refused with 409
    under HIPAA mode (hipaa_mode), without a paid plan (plan_required) or while it is not available to
    the organization (not_available). Turning it off is always allowed.

    Person only: a dashboard session, or the person's own OAuth token with a step-up token for purpose
    `org_settings.write` in the Primitive-Step-Up header. Without one an OAuth token is answered 403
    step_up_required, whose details carry the dashboard URL that issues it (or 403 grant_forbidden when
    the person's role could not do it anyway). The person's role must hold search_settings:manage. API
    keys and agent connection keys are refused. An agent acting for the person is refused unless it
    carries a step-up token the person issued in the dashboard.

    Args:
        primitive_step_up (str | Unset):
        body (OrgSettingsUpdateSearchSettingsInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | UpdateSearchSettingsResponse200]
     """


    kwargs = _get_kwargs(
        body=body,
primitive_step_up=primitive_step_up,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    body: OrgSettingsUpdateSearchSettingsInput,
    primitive_step_up: str | Unset = UNSET,

) -> ErrorResponse | UpdateSearchSettingsResponse200 | None:
    """ Change the semantic search setting

     Consent to, or withdraw consent from, semantic search. Consenting sends the organization's mail
    content to an embedding provider, so it is a person's decision. Turning it on is refused with 409
    under HIPAA mode (hipaa_mode), without a paid plan (plan_required) or while it is not available to
    the organization (not_available). Turning it off is always allowed.

    Person only: a dashboard session, or the person's own OAuth token with a step-up token for purpose
    `org_settings.write` in the Primitive-Step-Up header. Without one an OAuth token is answered 403
    step_up_required, whose details carry the dashboard URL that issues it (or 403 grant_forbidden when
    the person's role could not do it anyway). The person's role must hold search_settings:manage. API
    keys and agent connection keys are refused. An agent acting for the person is refused unless it
    carries a step-up token the person issued in the dashboard.

    Args:
        primitive_step_up (str | Unset):
        body (OrgSettingsUpdateSearchSettingsInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | UpdateSearchSettingsResponse200
     """


    return (await asyncio_detailed(
        client=client,
body=body,
primitive_step_up=primitive_step_up,

    )).parsed
