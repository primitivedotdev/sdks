from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.start_agent_claim_input import StartAgentClaimInput
from ...models.start_agent_claim_response_200 import StartAgentClaimResponse200
from typing import cast



def _get_kwargs(
    *,
    body: StartAgentClaimInput,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/agent/claim/start",
    }

    _kwargs["json"] = body.to_dict()


    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | StartAgentClaimResponse200 | None:
    if response.status_code == 200:
        response_200 = StartAgentClaimResponse200.from_dict(response.json())



        return response_200

    if response.status_code == 400:
        response_400 = ErrorResponse.from_dict(response.json())



        return response_400

    if response.status_code == 401:
        response_401 = ErrorResponse.from_dict(response.json())



        return response_401

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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | StartAgentClaimResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: StartAgentClaimInput,

) -> Response[ErrorResponse | StartAgentClaimResponse200]:
    """ Start an agent account email claim

     Begins upgrading an emailless `agent` account into a full `developer`
    account by confirming an email address. Authenticated by the agent's own
    API key (the org is taken from the credential). Sends a verification
    code to the supplied email and returns the claim session id plus resend
    timing. Submit the code to `/agent/claim/verify` to complete the
    upgrade. Confirming an email that already belongs to a Primitive account
    is rejected.

    Args:
        body (StartAgentClaimInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | StartAgentClaimResponse200]
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
    body: StartAgentClaimInput,

) -> ErrorResponse | StartAgentClaimResponse200 | None:
    """ Start an agent account email claim

     Begins upgrading an emailless `agent` account into a full `developer`
    account by confirming an email address. Authenticated by the agent's own
    API key (the org is taken from the credential). Sends a verification
    code to the supplied email and returns the claim session id plus resend
    timing. Submit the code to `/agent/claim/verify` to complete the
    upgrade. Confirming an email that already belongs to a Primitive account
    is rejected.

    Args:
        body (StartAgentClaimInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | StartAgentClaimResponse200
     """


    return sync_detailed(
        client=client,
body=body,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: StartAgentClaimInput,

) -> Response[ErrorResponse | StartAgentClaimResponse200]:
    """ Start an agent account email claim

     Begins upgrading an emailless `agent` account into a full `developer`
    account by confirming an email address. Authenticated by the agent's own
    API key (the org is taken from the credential). Sends a verification
    code to the supplied email and returns the claim session id plus resend
    timing. Submit the code to `/agent/claim/verify` to complete the
    upgrade. Confirming an email that already belongs to a Primitive account
    is rejected.

    Args:
        body (StartAgentClaimInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | StartAgentClaimResponse200]
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
    body: StartAgentClaimInput,

) -> ErrorResponse | StartAgentClaimResponse200 | None:
    """ Start an agent account email claim

     Begins upgrading an emailless `agent` account into a full `developer`
    account by confirming an email address. Authenticated by the agent's own
    API key (the org is taken from the credential). Sends a verification
    code to the supplied email and returns the claim session id plus resend
    timing. Submit the code to `/agent/claim/verify` to complete the
    upgrade. Confirming an email that already belongs to a Primitive account
    is rejected.

    Args:
        body (StartAgentClaimInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | StartAgentClaimResponse200
     """


    return (await asyncio_detailed(
        client=client,
body=body,

    )).parsed
