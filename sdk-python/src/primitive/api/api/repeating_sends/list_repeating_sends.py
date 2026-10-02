from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.list_repeating_sends_response_200 import ListRepeatingSendsResponse200
from ...models.repeating_send_status import RepeatingSendStatus
from ...types import UNSET, Unset
from typing import cast



def _get_kwargs(
    *,
    to: str | Unset = UNSET,
    status: RepeatingSendStatus | Unset = UNSET,

) -> dict[str, Any]:
    

    

    params: dict[str, Any] = {}

    params["to"] = to

    json_status: str | Unset = UNSET
    if not isinstance(status, Unset):
        json_status = status.value

    params["status"] = json_status


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/repeating-sends",
        "params": params,
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | ListRepeatingSendsResponse200 | None:
    if response.status_code == 200:
        response_200 = ListRepeatingSendsResponse200.from_dict(response.json())



        return response_200

    if response.status_code == 401:
        response_401 = ErrorResponse.from_dict(response.json())



        return response_401

    if response.status_code == 403:
        response_403 = ErrorResponse.from_dict(response.json())



        return response_403

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | ListRepeatingSendsResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    to: str | Unset = UNSET,
    status: RepeatingSendStatus | Unset = UNSET,

) -> Response[ErrorResponse | ListRepeatingSendsResponse200]:
    """ List repeating sends

     Repeating sends you created, newest first. A repeat is visible to the
    member who created it, or to any organization API key or member for
    repeats created with an organization API key. Agent credentials get
    403.

    Args:
        to (str | Unset):
        status (RepeatingSendStatus | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ListRepeatingSendsResponse200]
     """


    kwargs = _get_kwargs(
        to=to,
status=status,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    *,
    client: AuthenticatedClient | Client,
    to: str | Unset = UNSET,
    status: RepeatingSendStatus | Unset = UNSET,

) -> ErrorResponse | ListRepeatingSendsResponse200 | None:
    """ List repeating sends

     Repeating sends you created, newest first. A repeat is visible to the
    member who created it, or to any organization API key or member for
    repeats created with an organization API key. Agent credentials get
    403.

    Args:
        to (str | Unset):
        status (RepeatingSendStatus | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ListRepeatingSendsResponse200
     """


    return sync_detailed(
        client=client,
to=to,
status=status,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    to: str | Unset = UNSET,
    status: RepeatingSendStatus | Unset = UNSET,

) -> Response[ErrorResponse | ListRepeatingSendsResponse200]:
    """ List repeating sends

     Repeating sends you created, newest first. A repeat is visible to the
    member who created it, or to any organization API key or member for
    repeats created with an organization API key. Agent credentials get
    403.

    Args:
        to (str | Unset):
        status (RepeatingSendStatus | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ListRepeatingSendsResponse200]
     """


    kwargs = _get_kwargs(
        to=to,
status=status,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    to: str | Unset = UNSET,
    status: RepeatingSendStatus | Unset = UNSET,

) -> ErrorResponse | ListRepeatingSendsResponse200 | None:
    """ List repeating sends

     Repeating sends you created, newest first. A repeat is visible to the
    member who created it, or to any organization API key or member for
    repeats created with an organization API key. Agent credentials get
    403.

    Args:
        to (str | Unset):
        status (RepeatingSendStatus | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ListRepeatingSendsResponse200
     """


    return (await asyncio_detailed(
        client=client,
to=to,
status=status,

    )).parsed
