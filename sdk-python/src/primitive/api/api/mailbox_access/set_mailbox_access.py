from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.set_mailbox_access_request import SetMailboxAccessRequest
from ...models.set_mailbox_access_response_200 import SetMailboxAccessResponse200
from ...types import UNSET, Unset
from typing import cast



def _get_kwargs(
    address: str,
    *,
    body: SetMailboxAccessRequest,
    primitive_step_up: str | Unset = UNSET,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}
    if not isinstance(primitive_step_up, Unset):
        headers["Primitive-Step-Up"] = primitive_step_up



    

    

    _kwargs: dict[str, Any] = {
        "method": "put",
        "url": "/mailboxes/{address}/access".format(address=quote(str(address), safe=""),),
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | SetMailboxAccessResponse200 | None:
    if response.status_code == 200:
        response_200 = SetMailboxAccessResponse200.from_dict(response.json())



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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | SetMailboxAccessResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    address: str,
    *,
    client: AuthenticatedClient | Client,
    body: SetMailboxAccessRequest,
    primitive_step_up: str | Unset = UNSET,

) -> Response[ErrorResponse | SetMailboxAccessResponse200]:
    """ Replace a mailbox's access

     Replaces the whole access list of one mailbox address, or of a domain (`@example.com` or the bare
    domain). Needs delegations:manage: a dashboard session, the person's own Primitive CLI, or an org-
    wide API key, which acts for the person it belongs to and works only while that person is still an
    owner or admin holding the permission. Any other OAuth app answers `step_up_required` until the
    person confirms in the dashboard and the request carries the Primitive-Step-Up header. Narrowed,
    Function and connected keys are refused. Nobody grants access beyond their own (rule 1): each added
    or widened entry must be within the caller's own mail access and permissions; an API key never gives
    access to a member's personal mailbox. Every change is recorded in the credential audit log.

    Args:
        address (str):
        primitive_step_up (str | Unset):
        body (SetMailboxAccessRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | SetMailboxAccessResponse200]
     """


    kwargs = _get_kwargs(
        address=address,
body=body,
primitive_step_up=primitive_step_up,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    address: str,
    *,
    client: AuthenticatedClient | Client,
    body: SetMailboxAccessRequest,
    primitive_step_up: str | Unset = UNSET,

) -> ErrorResponse | SetMailboxAccessResponse200 | None:
    """ Replace a mailbox's access

     Replaces the whole access list of one mailbox address, or of a domain (`@example.com` or the bare
    domain). Needs delegations:manage: a dashboard session, the person's own Primitive CLI, or an org-
    wide API key, which acts for the person it belongs to and works only while that person is still an
    owner or admin holding the permission. Any other OAuth app answers `step_up_required` until the
    person confirms in the dashboard and the request carries the Primitive-Step-Up header. Narrowed,
    Function and connected keys are refused. Nobody grants access beyond their own (rule 1): each added
    or widened entry must be within the caller's own mail access and permissions; an API key never gives
    access to a member's personal mailbox. Every change is recorded in the credential audit log.

    Args:
        address (str):
        primitive_step_up (str | Unset):
        body (SetMailboxAccessRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | SetMailboxAccessResponse200
     """


    return sync_detailed(
        address=address,
client=client,
body=body,
primitive_step_up=primitive_step_up,

    ).parsed

async def asyncio_detailed(
    address: str,
    *,
    client: AuthenticatedClient | Client,
    body: SetMailboxAccessRequest,
    primitive_step_up: str | Unset = UNSET,

) -> Response[ErrorResponse | SetMailboxAccessResponse200]:
    """ Replace a mailbox's access

     Replaces the whole access list of one mailbox address, or of a domain (`@example.com` or the bare
    domain). Needs delegations:manage: a dashboard session, the person's own Primitive CLI, or an org-
    wide API key, which acts for the person it belongs to and works only while that person is still an
    owner or admin holding the permission. Any other OAuth app answers `step_up_required` until the
    person confirms in the dashboard and the request carries the Primitive-Step-Up header. Narrowed,
    Function and connected keys are refused. Nobody grants access beyond their own (rule 1): each added
    or widened entry must be within the caller's own mail access and permissions; an API key never gives
    access to a member's personal mailbox. Every change is recorded in the credential audit log.

    Args:
        address (str):
        primitive_step_up (str | Unset):
        body (SetMailboxAccessRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | SetMailboxAccessResponse200]
     """


    kwargs = _get_kwargs(
        address=address,
body=body,
primitive_step_up=primitive_step_up,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    address: str,
    *,
    client: AuthenticatedClient | Client,
    body: SetMailboxAccessRequest,
    primitive_step_up: str | Unset = UNSET,

) -> ErrorResponse | SetMailboxAccessResponse200 | None:
    """ Replace a mailbox's access

     Replaces the whole access list of one mailbox address, or of a domain (`@example.com` or the bare
    domain). Needs delegations:manage: a dashboard session, the person's own Primitive CLI, or an org-
    wide API key, which acts for the person it belongs to and works only while that person is still an
    owner or admin holding the permission. Any other OAuth app answers `step_up_required` until the
    person confirms in the dashboard and the request carries the Primitive-Step-Up header. Narrowed,
    Function and connected keys are refused. Nobody grants access beyond their own (rule 1): each added
    or widened entry must be within the caller's own mail access and permissions; an API key never gives
    access to a member's personal mailbox. Every change is recorded in the credential audit log.

    Args:
        address (str):
        primitive_step_up (str | Unset):
        body (SetMailboxAccessRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | SetMailboxAccessResponse200
     """


    return (await asyncio_detailed(
        address=address,
client=client,
body=body,
primitive_step_up=primitive_step_up,

    )).parsed
