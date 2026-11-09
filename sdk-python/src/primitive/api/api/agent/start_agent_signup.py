from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.start_agent_signup_input import StartAgentSignupInput
from ...models.start_agent_signup_response_201 import StartAgentSignupResponse201
from ...types import UNSET, Unset
from typing import cast



def _get_kwargs(
    *,
    body: StartAgentSignupInput,
    idempotency_key: str | Unset = UNSET,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}
    if not isinstance(idempotency_key, Unset):
        headers["Idempotency-Key"] = idempotency_key



    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/agent/signup/start",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | StartAgentSignupResponse201 | None:
    if response.status_code == 201:
        response_201 = StartAgentSignupResponse201.from_dict(response.json())



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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | StartAgentSignupResponse201]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: StartAgentSignupInput,
    idempotency_key: str | Unset = UNSET,

) -> Response[ErrorResponse | StartAgentSignupResponse201]:
    """ Start agent account signup

     Starts an agent-native signup session. The API creates a pending
    signup session, sends an email verification code, and returns an opaque
    signup token used by the resend and verify steps. This endpoint
    does not require an API key.

    Args:
        idempotency_key (str | Unset):
        body (StartAgentSignupInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | StartAgentSignupResponse201]
     """


    kwargs = _get_kwargs(
        body=body,
idempotency_key=idempotency_key,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    *,
    client: AuthenticatedClient | Client,
    body: StartAgentSignupInput,
    idempotency_key: str | Unset = UNSET,

) -> ErrorResponse | StartAgentSignupResponse201 | None:
    """ Start agent account signup

     Starts an agent-native signup session. The API creates a pending
    signup session, sends an email verification code, and returns an opaque
    signup token used by the resend and verify steps. This endpoint
    does not require an API key.

    Args:
        idempotency_key (str | Unset):
        body (StartAgentSignupInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | StartAgentSignupResponse201
     """


    return sync_detailed(
        client=client,
body=body,
idempotency_key=idempotency_key,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: StartAgentSignupInput,
    idempotency_key: str | Unset = UNSET,

) -> Response[ErrorResponse | StartAgentSignupResponse201]:
    """ Start agent account signup

     Starts an agent-native signup session. The API creates a pending
    signup session, sends an email verification code, and returns an opaque
    signup token used by the resend and verify steps. This endpoint
    does not require an API key.

    Args:
        idempotency_key (str | Unset):
        body (StartAgentSignupInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | StartAgentSignupResponse201]
     """


    kwargs = _get_kwargs(
        body=body,
idempotency_key=idempotency_key,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    body: StartAgentSignupInput,
    idempotency_key: str | Unset = UNSET,

) -> ErrorResponse | StartAgentSignupResponse201 | None:
    """ Start agent account signup

     Starts an agent-native signup session. The API creates a pending
    signup session, sends an email verification code, and returns an opaque
    signup token used by the resend and verify steps. This endpoint
    does not require an API key.

    Args:
        idempotency_key (str | Unset):
        body (StartAgentSignupInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | StartAgentSignupResponse201
     """


    return (await asyncio_detailed(
        client=client,
body=body,
idempotency_key=idempotency_key,

    )).parsed
