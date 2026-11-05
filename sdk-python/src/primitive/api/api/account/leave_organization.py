from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.leave_organization_response_200 import LeaveOrganizationResponse200
from ...types import UNSET, Unset
from typing import cast



def _get_kwargs(
    *,
    primitive_step_up: str | Unset = UNSET,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}
    if not isinstance(primitive_step_up, Unset):
        headers["Primitive-Step-Up"] = primitive_step_up



    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/organization/leave",
    }


    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | LeaveOrganizationResponse200 | None:
    if response.status_code == 200:
        response_200 = LeaveOrganizationResponse200.from_dict(response.json())



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

    if response.status_code == 409:
        response_409 = ErrorResponse.from_dict(response.json())



        return response_409

    if response.status_code == 500:
        response_500 = ErrorResponse.from_dict(response.json())



        return response_500

    if response.status_code == 503:
        response_503 = ErrorResponse.from_dict(response.json())



        return response_503

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | LeaveOrganizationResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    primitive_step_up: str | Unset = UNSET,

) -> Response[ErrorResponse | LeaveOrganizationResponse200]:
    """ Leave the organization

     Removes the calling person from the organization. Leaving is final.

    Only a person can leave. API keys are refused. A request made with
    the person's CLI or app sign-in must carry a confirmation token in
    the `Primitive-Step-Up` header; without one the response is a 403
    with code `step_up_required` and `details.step_up_url`, the
    dashboard page where the person confirms and gets the token.

    The only owner of an organization cannot leave it (409,
    `last_owner`); make someone else an owner first.

    Args:
        primitive_step_up (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | LeaveOrganizationResponse200]
     """


    kwargs = _get_kwargs(
        primitive_step_up=primitive_step_up,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    *,
    client: AuthenticatedClient | Client,
    primitive_step_up: str | Unset = UNSET,

) -> ErrorResponse | LeaveOrganizationResponse200 | None:
    """ Leave the organization

     Removes the calling person from the organization. Leaving is final.

    Only a person can leave. API keys are refused. A request made with
    the person's CLI or app sign-in must carry a confirmation token in
    the `Primitive-Step-Up` header; without one the response is a 403
    with code `step_up_required` and `details.step_up_url`, the
    dashboard page where the person confirms and gets the token.

    The only owner of an organization cannot leave it (409,
    `last_owner`); make someone else an owner first.

    Args:
        primitive_step_up (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | LeaveOrganizationResponse200
     """


    return sync_detailed(
        client=client,
primitive_step_up=primitive_step_up,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    primitive_step_up: str | Unset = UNSET,

) -> Response[ErrorResponse | LeaveOrganizationResponse200]:
    """ Leave the organization

     Removes the calling person from the organization. Leaving is final.

    Only a person can leave. API keys are refused. A request made with
    the person's CLI or app sign-in must carry a confirmation token in
    the `Primitive-Step-Up` header; without one the response is a 403
    with code `step_up_required` and `details.step_up_url`, the
    dashboard page where the person confirms and gets the token.

    The only owner of an organization cannot leave it (409,
    `last_owner`); make someone else an owner first.

    Args:
        primitive_step_up (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | LeaveOrganizationResponse200]
     """


    kwargs = _get_kwargs(
        primitive_step_up=primitive_step_up,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    primitive_step_up: str | Unset = UNSET,

) -> ErrorResponse | LeaveOrganizationResponse200 | None:
    """ Leave the organization

     Removes the calling person from the organization. Leaving is final.

    Only a person can leave. API keys are refused. A request made with
    the person's CLI or app sign-in must carry a confirmation token in
    the `Primitive-Step-Up` header; without one the response is a 403
    with code `step_up_required` and `details.step_up_url`, the
    dashboard page where the person confirms and gets the token.

    The only owner of an organization cannot leave it (409,
    `last_owner`); make someone else an owner first.

    Args:
        primitive_step_up (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | LeaveOrganizationResponse200
     """


    return (await asyncio_detailed(
        client=client,
primitive_step_up=primitive_step_up,

    )).parsed
