from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.start_cli_signup_input import StartCliSignupInput
from ...models.start_cli_signup_response_201 import StartCliSignupResponse201
from typing import cast



def _get_kwargs(
    *,
    body: StartCliSignupInput,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/cli/signup/start",
    }

    _kwargs["json"] = body.to_dict()


    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | StartCliSignupResponse201 | None:
    if response.status_code == 201:
        response_201 = StartCliSignupResponse201.from_dict(response.json())



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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | StartCliSignupResponse201]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: StartCliSignupInput,

) -> Response[ErrorResponse | StartCliSignupResponse201]:
    """ Start CLI account signup

     Starts a terminal-native CLI signup. If `signup_code` is supplied
    the API validates and reserves it; if omitted, signup proceeds
    without one (the new org gets the baseline default entitlements
    at bootstrap time). Either way the API creates a pending signup
    session, sends an email verification code, and returns an opaque
    signup token used by the resend and verify steps. This endpoint
    does not require an API key.

    Args:
        body (StartCliSignupInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | StartCliSignupResponse201]
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
    body: StartCliSignupInput,

) -> ErrorResponse | StartCliSignupResponse201 | None:
    """ Start CLI account signup

     Starts a terminal-native CLI signup. If `signup_code` is supplied
    the API validates and reserves it; if omitted, signup proceeds
    without one (the new org gets the baseline default entitlements
    at bootstrap time). Either way the API creates a pending signup
    session, sends an email verification code, and returns an opaque
    signup token used by the resend and verify steps. This endpoint
    does not require an API key.

    Args:
        body (StartCliSignupInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | StartCliSignupResponse201
     """


    return sync_detailed(
        client=client,
body=body,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: StartCliSignupInput,

) -> Response[ErrorResponse | StartCliSignupResponse201]:
    """ Start CLI account signup

     Starts a terminal-native CLI signup. If `signup_code` is supplied
    the API validates and reserves it; if omitted, signup proceeds
    without one (the new org gets the baseline default entitlements
    at bootstrap time). Either way the API creates a pending signup
    session, sends an email verification code, and returns an opaque
    signup token used by the resend and verify steps. This endpoint
    does not require an API key.

    Args:
        body (StartCliSignupInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | StartCliSignupResponse201]
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
    body: StartCliSignupInput,

) -> ErrorResponse | StartCliSignupResponse201 | None:
    """ Start CLI account signup

     Starts a terminal-native CLI signup. If `signup_code` is supplied
    the API validates and reserves it; if omitted, signup proceeds
    without one (the new org gets the baseline default entitlements
    at bootstrap time). Either way the API creates a pending signup
    session, sends an email verification code, and returns an opaque
    signup token used by the resend and verify steps. This endpoint
    does not require an API key.

    Args:
        body (StartCliSignupInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | StartCliSignupResponse201
     """


    return (await asyncio_detailed(
        client=client,
body=body,

    )).parsed
