from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.start_interaction_request import StartInteractionRequest
from ...models.start_interaction_response_200 import StartInteractionResponse200
from ...types import UNSET, Unset
from typing import cast



def _get_kwargs(
    *,
    body: StartInteractionRequest,
    idempotency_key: str | Unset = UNSET,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}
    if not isinstance(idempotency_key, Unset):
        headers["Idempotency-Key"] = idempotency_key



    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/interactions",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | StartInteractionResponse200 | None:
    if response.status_code == 200:
        response_200 = StartInteractionResponse200.from_dict(response.json())



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

    if response.status_code == 429:
        response_429 = ErrorResponse.from_dict(response.json())



        return response_429

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | StartInteractionResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: StartInteractionRequest,
    idempotency_key: str | Unset = UNSET,

) -> Response[ErrorResponse | StartInteractionResponse200]:
    """ Start an interaction

     Send the first step of a protocol from one of your addresses: a carrier email with the step's
    interaction.json part. The step is validated against the protocol before anything is sent. An
    Idempotency-Key makes a retry return the same interaction without sending again.

    Args:
        idempotency_key (str | Unset):
        body (StartInteractionRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | StartInteractionResponse200]
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
    body: StartInteractionRequest,
    idempotency_key: str | Unset = UNSET,

) -> ErrorResponse | StartInteractionResponse200 | None:
    """ Start an interaction

     Send the first step of a protocol from one of your addresses: a carrier email with the step's
    interaction.json part. The step is validated against the protocol before anything is sent. An
    Idempotency-Key makes a retry return the same interaction without sending again.

    Args:
        idempotency_key (str | Unset):
        body (StartInteractionRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | StartInteractionResponse200
     """


    return sync_detailed(
        client=client,
body=body,
idempotency_key=idempotency_key,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: StartInteractionRequest,
    idempotency_key: str | Unset = UNSET,

) -> Response[ErrorResponse | StartInteractionResponse200]:
    """ Start an interaction

     Send the first step of a protocol from one of your addresses: a carrier email with the step's
    interaction.json part. The step is validated against the protocol before anything is sent. An
    Idempotency-Key makes a retry return the same interaction without sending again.

    Args:
        idempotency_key (str | Unset):
        body (StartInteractionRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | StartInteractionResponse200]
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
    body: StartInteractionRequest,
    idempotency_key: str | Unset = UNSET,

) -> ErrorResponse | StartInteractionResponse200 | None:
    """ Start an interaction

     Send the first step of a protocol from one of your addresses: a carrier email with the step's
    interaction.json part. The step is validated against the protocol before anything is sent. An
    Idempotency-Key makes a retry return the same interaction without sending again.

    Args:
        idempotency_key (str | Unset):
        body (StartInteractionRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | StartInteractionResponse200
     """


    return (await asyncio_detailed(
        client=client,
body=body,
idempotency_key=idempotency_key,

    )).parsed
