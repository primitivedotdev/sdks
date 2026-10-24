from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.rotate_key_input import RotateKeyInput
from ...models.rotate_key_response_200 import RotateKeyResponse200
from ...types import UNSET, Unset
from typing import cast
from uuid import UUID



def _get_kwargs(
    id: UUID,
    *,
    body: RotateKeyInput | Unset = UNSET,
    primitive_step_up: str | Unset = UNSET,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}
    if not isinstance(primitive_step_up, Unset):
        headers["Primitive-Step-Up"] = primitive_step_up



    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/keys/{id}/rotate".format(id=quote(str(id), safe=""),),
    }

    
    if not isinstance(body, Unset):
        _kwargs["json"] = body.to_dict()
        headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | RotateKeyResponse200 | None:
    if response.status_code == 200:
        response_200 = RotateKeyResponse200.from_dict(response.json())



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

    if response.status_code == 404:
        response_404 = ErrorResponse.from_dict(response.json())



        return response_404

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | RotateKeyResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: RotateKeyInput | Unset = UNSET,
    primitive_step_up: str | Unset = UNSET,

) -> Response[ErrorResponse | RotateKeyResponse200]:
    """ Rotate an API key

     Mints a successor with the same grant, name, expiry and conditions,
    and brings the old key's expiry forward to the end of the overlap
    (default 24 hours; `0` revokes it at once). The new secret is
    returned once. An OAuth token needs a step-up token, as for
    `createKey`.

    Args:
        id (UUID):
        primitive_step_up (str | Unset):
        body (RotateKeyInput | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | RotateKeyResponse200]
     """


    kwargs = _get_kwargs(
        id=id,
body=body,
primitive_step_up=primitive_step_up,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: RotateKeyInput | Unset = UNSET,
    primitive_step_up: str | Unset = UNSET,

) -> ErrorResponse | RotateKeyResponse200 | None:
    """ Rotate an API key

     Mints a successor with the same grant, name, expiry and conditions,
    and brings the old key's expiry forward to the end of the overlap
    (default 24 hours; `0` revokes it at once). The new secret is
    returned once. An OAuth token needs a step-up token, as for
    `createKey`.

    Args:
        id (UUID):
        primitive_step_up (str | Unset):
        body (RotateKeyInput | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | RotateKeyResponse200
     """


    return sync_detailed(
        id=id,
client=client,
body=body,
primitive_step_up=primitive_step_up,

    ).parsed

async def asyncio_detailed(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: RotateKeyInput | Unset = UNSET,
    primitive_step_up: str | Unset = UNSET,

) -> Response[ErrorResponse | RotateKeyResponse200]:
    """ Rotate an API key

     Mints a successor with the same grant, name, expiry and conditions,
    and brings the old key's expiry forward to the end of the overlap
    (default 24 hours; `0` revokes it at once). The new secret is
    returned once. An OAuth token needs a step-up token, as for
    `createKey`.

    Args:
        id (UUID):
        primitive_step_up (str | Unset):
        body (RotateKeyInput | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | RotateKeyResponse200]
     """


    kwargs = _get_kwargs(
        id=id,
body=body,
primitive_step_up=primitive_step_up,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: RotateKeyInput | Unset = UNSET,
    primitive_step_up: str | Unset = UNSET,

) -> ErrorResponse | RotateKeyResponse200 | None:
    """ Rotate an API key

     Mints a successor with the same grant, name, expiry and conditions,
    and brings the old key's expiry forward to the end of the overlap
    (default 24 hours; `0` revokes it at once). The new secret is
    returned once. An OAuth token needs a step-up token, as for
    `createKey`.

    Args:
        id (UUID):
        primitive_step_up (str | Unset):
        body (RotateKeyInput | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | RotateKeyResponse200
     """


    return (await asyncio_detailed(
        id=id,
client=client,
body=body,
primitive_step_up=primitive_step_up,

    )).parsed
