from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.list_suspensions_include_decided import ListSuspensionsIncludeDecided
from ...models.list_suspensions_response_200 import ListSuspensionsResponse200
from ...types import UNSET, Unset
from typing import cast



def _get_kwargs(
    *,
    include_decided: ListSuspensionsIncludeDecided | Unset = UNSET,
    primitive_step_up: str | Unset = UNSET,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}
    if not isinstance(primitive_step_up, Unset):
        headers["Primitive-Step-Up"] = primitive_step_up



    

    params: dict[str, Any] = {}

    json_include_decided: str | Unset = UNSET
    if not isinstance(include_decided, Unset):
        json_include_decided = include_decided.value

    params["include_decided"] = json_include_decided


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/access-suspensions",
        "params": params,
    }


    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | ListSuspensionsResponse200 | None:
    if response.status_code == 200:
        response_200 = ListSuspensionsResponse200.from_dict(response.json())



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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | ListSuspensionsResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    include_decided: ListSuspensionsIncludeDecided | Unset = UNSET,
    primitive_step_up: str | Unset = UNSET,

) -> Response[ErrorResponse | ListSuspensionsResponse200]:
    """ List suspended and flagged access

     Items a removal or a narrowed role left suspended or flagged for a decision. Person only: a
    dashboard session, or the person's own OAuth or CLI token with a session step-up of purpose
    `suspensions.read` (the person confirms at the step_up_url a 403 step_up_required answer carries,
    which names this client, then send the token in the Primitive-Step-Up header; the token works only
    with the client it was confirmed for). Needs members:manage. API keys are refused.

    Args:
        include_decided (ListSuspensionsIncludeDecided | Unset):
        primitive_step_up (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ListSuspensionsResponse200]
     """


    kwargs = _get_kwargs(
        include_decided=include_decided,
primitive_step_up=primitive_step_up,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    *,
    client: AuthenticatedClient | Client,
    include_decided: ListSuspensionsIncludeDecided | Unset = UNSET,
    primitive_step_up: str | Unset = UNSET,

) -> ErrorResponse | ListSuspensionsResponse200 | None:
    """ List suspended and flagged access

     Items a removal or a narrowed role left suspended or flagged for a decision. Person only: a
    dashboard session, or the person's own OAuth or CLI token with a session step-up of purpose
    `suspensions.read` (the person confirms at the step_up_url a 403 step_up_required answer carries,
    which names this client, then send the token in the Primitive-Step-Up header; the token works only
    with the client it was confirmed for). Needs members:manage. API keys are refused.

    Args:
        include_decided (ListSuspensionsIncludeDecided | Unset):
        primitive_step_up (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ListSuspensionsResponse200
     """


    return sync_detailed(
        client=client,
include_decided=include_decided,
primitive_step_up=primitive_step_up,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    include_decided: ListSuspensionsIncludeDecided | Unset = UNSET,
    primitive_step_up: str | Unset = UNSET,

) -> Response[ErrorResponse | ListSuspensionsResponse200]:
    """ List suspended and flagged access

     Items a removal or a narrowed role left suspended or flagged for a decision. Person only: a
    dashboard session, or the person's own OAuth or CLI token with a session step-up of purpose
    `suspensions.read` (the person confirms at the step_up_url a 403 step_up_required answer carries,
    which names this client, then send the token in the Primitive-Step-Up header; the token works only
    with the client it was confirmed for). Needs members:manage. API keys are refused.

    Args:
        include_decided (ListSuspensionsIncludeDecided | Unset):
        primitive_step_up (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ListSuspensionsResponse200]
     """


    kwargs = _get_kwargs(
        include_decided=include_decided,
primitive_step_up=primitive_step_up,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    include_decided: ListSuspensionsIncludeDecided | Unset = UNSET,
    primitive_step_up: str | Unset = UNSET,

) -> ErrorResponse | ListSuspensionsResponse200 | None:
    """ List suspended and flagged access

     Items a removal or a narrowed role left suspended or flagged for a decision. Person only: a
    dashboard session, or the person's own OAuth or CLI token with a session step-up of purpose
    `suspensions.read` (the person confirms at the step_up_url a 403 step_up_required answer carries,
    which names this client, then send the token in the Primitive-Step-Up header; the token works only
    with the client it was confirmed for). Needs members:manage. API keys are refused.

    Args:
        include_decided (ListSuspensionsIncludeDecided | Unset):
        primitive_step_up (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ListSuspensionsResponse200
     """


    return (await asyncio_detailed(
        client=client,
include_decided=include_decided,
primitive_step_up=primitive_step_up,

    )).parsed
