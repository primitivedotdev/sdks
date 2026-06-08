from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.verify_agent_signup_input import VerifyAgentSignupInput
from ...models.verify_agent_signup_response_200 import VerifyAgentSignupResponse200
from typing import cast



def _get_kwargs(
    *,
    body: VerifyAgentSignupInput,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/agent/signup/verify",
    }

    _kwargs["json"] = body.to_dict()


    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | VerifyAgentSignupResponse200 | None:
    if response.status_code == 200:
        response_200 = VerifyAgentSignupResponse200.from_dict(response.json())



        return response_200

    if response.status_code == 400:
        response_400 = ErrorResponse.from_dict(response.json())



        return response_400

    if response.status_code == 403:
        response_403 = ErrorResponse.from_dict(response.json())



        return response_403

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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | VerifyAgentSignupResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: VerifyAgentSignupInput,

) -> Response[ErrorResponse | VerifyAgentSignupResponse200]:
    """ Verify agent signup and create OAuth tokens

     Verifies the email code for an agent signup session and creates
    the account when needed. When the session was started with a
    `signup_code`, the reserved code is redeemed; sessions started
    without a code skip the redemption step. An org-scoped OAuth
    session for CLI authentication is minted and the raw tokens are
    returned exactly once. For existing users, the optional `org_id`
    selects which accessible workspace should receive the new
    session (no signup-code redemption is performed for existing
    users regardless of how the session was started).

    Args:
        body (VerifyAgentSignupInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | VerifyAgentSignupResponse200]
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
    body: VerifyAgentSignupInput,

) -> ErrorResponse | VerifyAgentSignupResponse200 | None:
    """ Verify agent signup and create OAuth tokens

     Verifies the email code for an agent signup session and creates
    the account when needed. When the session was started with a
    `signup_code`, the reserved code is redeemed; sessions started
    without a code skip the redemption step. An org-scoped OAuth
    session for CLI authentication is minted and the raw tokens are
    returned exactly once. For existing users, the optional `org_id`
    selects which accessible workspace should receive the new
    session (no signup-code redemption is performed for existing
    users regardless of how the session was started).

    Args:
        body (VerifyAgentSignupInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | VerifyAgentSignupResponse200
     """


    return sync_detailed(
        client=client,
body=body,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: VerifyAgentSignupInput,

) -> Response[ErrorResponse | VerifyAgentSignupResponse200]:
    """ Verify agent signup and create OAuth tokens

     Verifies the email code for an agent signup session and creates
    the account when needed. When the session was started with a
    `signup_code`, the reserved code is redeemed; sessions started
    without a code skip the redemption step. An org-scoped OAuth
    session for CLI authentication is minted and the raw tokens are
    returned exactly once. For existing users, the optional `org_id`
    selects which accessible workspace should receive the new
    session (no signup-code redemption is performed for existing
    users regardless of how the session was started).

    Args:
        body (VerifyAgentSignupInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | VerifyAgentSignupResponse200]
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
    body: VerifyAgentSignupInput,

) -> ErrorResponse | VerifyAgentSignupResponse200 | None:
    """ Verify agent signup and create OAuth tokens

     Verifies the email code for an agent signup session and creates
    the account when needed. When the session was started with a
    `signup_code`, the reserved code is redeemed; sessions started
    without a code skip the redemption step. An org-scoped OAuth
    session for CLI authentication is minted and the raw tokens are
    returned exactly once. For existing users, the optional `org_id`
    selects which accessible workspace should receive the new
    session (no signup-code redemption is performed for existing
    users regardless of how the session was started).

    Args:
        body (VerifyAgentSignupInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | VerifyAgentSignupResponse200
     """


    return (await asyncio_detailed(
        client=client,
body=body,

    )).parsed
