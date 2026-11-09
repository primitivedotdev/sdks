from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.check_sendability_request import CheckSendabilityRequest
from ...models.check_sendability_response_200 import CheckSendabilityResponse200
from ...models.error_response import ErrorResponse
from ...types import UNSET, Unset
from typing import cast



def _get_kwargs(
    *,
    body: CheckSendabilityRequest,
    idempotency_key: str | Unset = UNSET,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}
    if not isinstance(idempotency_key, Unset):
        headers["Idempotency-Key"] = idempotency_key



    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/sendability",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> CheckSendabilityResponse200 | ErrorResponse | None:
    if response.status_code == 200:
        response_200 = CheckSendabilityResponse200.from_dict(response.json())



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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[CheckSendabilityResponse200 | ErrorResponse]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: CheckSendabilityRequest,
    idempotency_key: str | Unset = UNSET,

) -> Response[CheckSendabilityResponse200 | ErrorResponse]:
    """ Check whether a send would be allowed

     Answer whether the caller could send to the given recipient (from the given address, if any) without
    sending anything. summary explains a refusal in plain words.

    Args:
        idempotency_key (str | Unset):
        body (CheckSendabilityRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[CheckSendabilityResponse200 | ErrorResponse]
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
    body: CheckSendabilityRequest,
    idempotency_key: str | Unset = UNSET,

) -> CheckSendabilityResponse200 | ErrorResponse | None:
    """ Check whether a send would be allowed

     Answer whether the caller could send to the given recipient (from the given address, if any) without
    sending anything. summary explains a refusal in plain words.

    Args:
        idempotency_key (str | Unset):
        body (CheckSendabilityRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        CheckSendabilityResponse200 | ErrorResponse
     """


    return sync_detailed(
        client=client,
body=body,
idempotency_key=idempotency_key,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: CheckSendabilityRequest,
    idempotency_key: str | Unset = UNSET,

) -> Response[CheckSendabilityResponse200 | ErrorResponse]:
    """ Check whether a send would be allowed

     Answer whether the caller could send to the given recipient (from the given address, if any) without
    sending anything. summary explains a refusal in plain words.

    Args:
        idempotency_key (str | Unset):
        body (CheckSendabilityRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[CheckSendabilityResponse200 | ErrorResponse]
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
    body: CheckSendabilityRequest,
    idempotency_key: str | Unset = UNSET,

) -> CheckSendabilityResponse200 | ErrorResponse | None:
    """ Check whether a send would be allowed

     Answer whether the caller could send to the given recipient (from the given address, if any) without
    sending anything. summary explains a refusal in plain words.

    Args:
        idempotency_key (str | Unset):
        body (CheckSendabilityRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        CheckSendabilityResponse200 | ErrorResponse
     """


    return (await asyncio_detailed(
        client=client,
body=body,
idempotency_key=idempotency_key,

    )).parsed
