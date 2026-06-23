from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.update_spend_policy_input import UpdateSpendPolicyInput
from ...models.update_spend_policy_response_200 import UpdateSpendPolicyResponse200
from typing import cast



def _get_kwargs(
    *,
    body: UpdateSpendPolicyInput,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "put",
        "url": "/x402/spend-policy",
    }

    _kwargs["json"] = body.to_dict()


    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | UpdateSpendPolicyResponse200 | None:
    if response.status_code == 200:
        response_200 = UpdateSpendPolicyResponse200.from_dict(response.json())



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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | UpdateSpendPolicyResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient,
    body: UpdateSpendPolicyInput,

) -> Response[ErrorResponse | UpdateSpendPolicyResponse200]:
    """ Update your spend policy

     Update your org's spend policy. Applied as a merge: only the fields you
    include change, and omitted fields keep their current value, so a partial
    update can't silently reset the kill-switch. Send an explicit `null` to
    clear a cap. Caps are in token base units.

    Args:
        body (UpdateSpendPolicyInput): Merge update: only the fields you include change; omit a
            field to keep
            its current value; send `null` to clear a cap.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | UpdateSpendPolicyResponse200]
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
    client: AuthenticatedClient,
    body: UpdateSpendPolicyInput,

) -> ErrorResponse | UpdateSpendPolicyResponse200 | None:
    """ Update your spend policy

     Update your org's spend policy. Applied as a merge: only the fields you
    include change, and omitted fields keep their current value, so a partial
    update can't silently reset the kill-switch. Send an explicit `null` to
    clear a cap. Caps are in token base units.

    Args:
        body (UpdateSpendPolicyInput): Merge update: only the fields you include change; omit a
            field to keep
            its current value; send `null` to clear a cap.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | UpdateSpendPolicyResponse200
     """


    return sync_detailed(
        client=client,
body=body,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient,
    body: UpdateSpendPolicyInput,

) -> Response[ErrorResponse | UpdateSpendPolicyResponse200]:
    """ Update your spend policy

     Update your org's spend policy. Applied as a merge: only the fields you
    include change, and omitted fields keep their current value, so a partial
    update can't silently reset the kill-switch. Send an explicit `null` to
    clear a cap. Caps are in token base units.

    Args:
        body (UpdateSpendPolicyInput): Merge update: only the fields you include change; omit a
            field to keep
            its current value; send `null` to clear a cap.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | UpdateSpendPolicyResponse200]
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
    client: AuthenticatedClient,
    body: UpdateSpendPolicyInput,

) -> ErrorResponse | UpdateSpendPolicyResponse200 | None:
    """ Update your spend policy

     Update your org's spend policy. Applied as a merge: only the fields you
    include change, and omitted fields keep their current value, so a partial
    update can't silently reset the kill-switch. Send an explicit `null` to
    clear a cap. Caps are in token base units.

    Args:
        body (UpdateSpendPolicyInput): Merge update: only the fields you include change; omit a
            field to keep
            its current value; send `null` to clear a cap.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | UpdateSpendPolicyResponse200
     """


    return (await asyncio_detailed(
        client=client,
body=body,

    )).parsed
