from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.start_cli_login_input import StartCliLoginInput
from ...models.start_cli_login_response_201 import StartCliLoginResponse201
from ...types import UNSET, Unset
from typing import cast



def _get_kwargs(
    *,
    body: StartCliLoginInput | Unset = UNSET,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/cli/login/start",
    }

    
    if not isinstance(body, Unset):
        _kwargs["json"] = body.to_dict()


    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | StartCliLoginResponse201 | None:
    if response.status_code == 201:
        response_201 = StartCliLoginResponse201.from_dict(response.json())



        return response_201

    if response.status_code == 400:
        response_400 = ErrorResponse.from_dict(response.json())



        return response_400

    if response.status_code == 429:
        response_429 = ErrorResponse.from_dict(response.json())



        return response_429

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | StartCliLoginResponse201]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: StartCliLoginInput | Unset = UNSET,

) -> Response[ErrorResponse | StartCliLoginResponse201]:
    """ Start CLI browser login

     Starts a browser-assisted CLI login session. The response includes a
    device code for polling and a user code that the user approves in the
    browser. This endpoint does not require an API key.

    Args:
        body (StartCliLoginInput | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | StartCliLoginResponse201]
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
    body: StartCliLoginInput | Unset = UNSET,

) -> ErrorResponse | StartCliLoginResponse201 | None:
    """ Start CLI browser login

     Starts a browser-assisted CLI login session. The response includes a
    device code for polling and a user code that the user approves in the
    browser. This endpoint does not require an API key.

    Args:
        body (StartCliLoginInput | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | StartCliLoginResponse201
     """


    return sync_detailed(
        client=client,
body=body,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: StartCliLoginInput | Unset = UNSET,

) -> Response[ErrorResponse | StartCliLoginResponse201]:
    """ Start CLI browser login

     Starts a browser-assisted CLI login session. The response includes a
    device code for polling and a user code that the user approves in the
    browser. This endpoint does not require an API key.

    Args:
        body (StartCliLoginInput | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | StartCliLoginResponse201]
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
    body: StartCliLoginInput | Unset = UNSET,

) -> ErrorResponse | StartCliLoginResponse201 | None:
    """ Start CLI browser login

     Starts a browser-assisted CLI login session. The response includes a
    device code for polling and a user code that the user approves in the
    browser. This endpoint does not require an API key.

    Args:
        body (StartCliLoginInput | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | StartCliLoginResponse201
     """


    return (await asyncio_detailed(
        client=client,
body=body,

    )).parsed
