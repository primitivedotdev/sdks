from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.resend_cli_signup_verification_input import ResendCliSignupVerificationInput
from ...models.resend_cli_signup_verification_response_200 import ResendCliSignupVerificationResponse200
from typing import cast



def _get_kwargs(
    *,
    body: ResendCliSignupVerificationInput,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/cli/signup/resend",
    }

    _kwargs["json"] = body.to_dict()


    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | ResendCliSignupVerificationResponse200 | None:
    if response.status_code == 200:
        response_200 = ResendCliSignupVerificationResponse200.from_dict(response.json())



        return response_200

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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | ResendCliSignupVerificationResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: ResendCliSignupVerificationInput,

) -> Response[ErrorResponse | ResendCliSignupVerificationResponse200]:
    """ Resend CLI signup verification code

     Sends a new email verification code for a pending CLI signup session.
    This endpoint does not require an API key.

    Args:
        body (ResendCliSignupVerificationInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ResendCliSignupVerificationResponse200]
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
    body: ResendCliSignupVerificationInput,

) -> ErrorResponse | ResendCliSignupVerificationResponse200 | None:
    """ Resend CLI signup verification code

     Sends a new email verification code for a pending CLI signup session.
    This endpoint does not require an API key.

    Args:
        body (ResendCliSignupVerificationInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ResendCliSignupVerificationResponse200
     """


    return sync_detailed(
        client=client,
body=body,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: ResendCliSignupVerificationInput,

) -> Response[ErrorResponse | ResendCliSignupVerificationResponse200]:
    """ Resend CLI signup verification code

     Sends a new email verification code for a pending CLI signup session.
    This endpoint does not require an API key.

    Args:
        body (ResendCliSignupVerificationInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ResendCliSignupVerificationResponse200]
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
    body: ResendCliSignupVerificationInput,

) -> ErrorResponse | ResendCliSignupVerificationResponse200 | None:
    """ Resend CLI signup verification code

     Sends a new email verification code for a pending CLI signup session.
    This endpoint does not require an API key.

    Args:
        body (ResendCliSignupVerificationInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ResendCliSignupVerificationResponse200
     """


    return (await asyncio_detailed(
        client=client,
body=body,

    )).parsed
