from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.reaffirm_function_runtime_key_request import ReaffirmFunctionRuntimeKeyRequest
from ...models.reaffirm_function_runtime_key_response_200 import ReaffirmFunctionRuntimeKeyResponse200
from ...types import UNSET, Unset
from typing import cast
from uuid import UUID



def _get_kwargs(
    id: UUID,
    *,
    body: ReaffirmFunctionRuntimeKeyRequest | Unset = UNSET,
    idempotency_key: str | Unset = UNSET,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}
    if not isinstance(idempotency_key, Unset):
        headers["Idempotency-Key"] = idempotency_key



    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/functions/{id}/runtime-key/reaffirm".format(id=quote(str(id), safe=""),),
    }

    
    if not isinstance(body, Unset):
        _kwargs["json"] = body.to_dict()
        headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | ReaffirmFunctionRuntimeKeyResponse200 | None:
    if response.status_code == 200:
        response_200 = ReaffirmFunctionRuntimeKeyResponse200.from_dict(response.json())



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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | ReaffirmFunctionRuntimeKeyResponse200]:
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
    body: ReaffirmFunctionRuntimeKeyRequest | Unset = UNSET,
    idempotency_key: str | Unset = UNSET,

) -> Response[ErrorResponse | ReaffirmFunctionRuntimeKeyResponse200]:
    """ Reaffirm a suspended function

     Lift the suspensions the caller may decide on the function's key (for example one left by a member
    removal or a grant reduction) and redeploy it. key_suspension_reasons lists any that remain. A
    function transferred to a new owner while it was stopped is not redeployed: lifting that stop places
    the transfer's own stop (transfer_stop_placed), which a redeploy lifts, or a further reaffirm by
    someone who covers its key that names it in the body (suspended_at and suspended_by 'transfer'):
    that reaffirm accepts the code the previous owner deployed. The body may name any stop the caller
    saw; a stop that is not the function's stop now lifts nothing.

    Args:
        id (UUID):
        idempotency_key (str | Unset):
        body (ReaffirmFunctionRuntimeKeyRequest | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ReaffirmFunctionRuntimeKeyResponse200]
     """


    kwargs = _get_kwargs(
        id=id,
body=body,
idempotency_key=idempotency_key,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: ReaffirmFunctionRuntimeKeyRequest | Unset = UNSET,
    idempotency_key: str | Unset = UNSET,

) -> ErrorResponse | ReaffirmFunctionRuntimeKeyResponse200 | None:
    """ Reaffirm a suspended function

     Lift the suspensions the caller may decide on the function's key (for example one left by a member
    removal or a grant reduction) and redeploy it. key_suspension_reasons lists any that remain. A
    function transferred to a new owner while it was stopped is not redeployed: lifting that stop places
    the transfer's own stop (transfer_stop_placed), which a redeploy lifts, or a further reaffirm by
    someone who covers its key that names it in the body (suspended_at and suspended_by 'transfer'):
    that reaffirm accepts the code the previous owner deployed. The body may name any stop the caller
    saw; a stop that is not the function's stop now lifts nothing.

    Args:
        id (UUID):
        idempotency_key (str | Unset):
        body (ReaffirmFunctionRuntimeKeyRequest | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ReaffirmFunctionRuntimeKeyResponse200
     """


    return sync_detailed(
        id=id,
client=client,
body=body,
idempotency_key=idempotency_key,

    ).parsed

async def asyncio_detailed(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: ReaffirmFunctionRuntimeKeyRequest | Unset = UNSET,
    idempotency_key: str | Unset = UNSET,

) -> Response[ErrorResponse | ReaffirmFunctionRuntimeKeyResponse200]:
    """ Reaffirm a suspended function

     Lift the suspensions the caller may decide on the function's key (for example one left by a member
    removal or a grant reduction) and redeploy it. key_suspension_reasons lists any that remain. A
    function transferred to a new owner while it was stopped is not redeployed: lifting that stop places
    the transfer's own stop (transfer_stop_placed), which a redeploy lifts, or a further reaffirm by
    someone who covers its key that names it in the body (suspended_at and suspended_by 'transfer'):
    that reaffirm accepts the code the previous owner deployed. The body may name any stop the caller
    saw; a stop that is not the function's stop now lifts nothing.

    Args:
        id (UUID):
        idempotency_key (str | Unset):
        body (ReaffirmFunctionRuntimeKeyRequest | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ReaffirmFunctionRuntimeKeyResponse200]
     """


    kwargs = _get_kwargs(
        id=id,
body=body,
idempotency_key=idempotency_key,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: ReaffirmFunctionRuntimeKeyRequest | Unset = UNSET,
    idempotency_key: str | Unset = UNSET,

) -> ErrorResponse | ReaffirmFunctionRuntimeKeyResponse200 | None:
    """ Reaffirm a suspended function

     Lift the suspensions the caller may decide on the function's key (for example one left by a member
    removal or a grant reduction) and redeploy it. key_suspension_reasons lists any that remain. A
    function transferred to a new owner while it was stopped is not redeployed: lifting that stop places
    the transfer's own stop (transfer_stop_placed), which a redeploy lifts, or a further reaffirm by
    someone who covers its key that names it in the body (suspended_at and suspended_by 'transfer'):
    that reaffirm accepts the code the previous owner deployed. The body may name any stop the caller
    saw; a stop that is not the function's stop now lifts nothing.

    Args:
        id (UUID):
        idempotency_key (str | Unset):
        body (ReaffirmFunctionRuntimeKeyRequest | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ReaffirmFunctionRuntimeKeyResponse200
     """


    return (await asyncio_detailed(
        id=id,
client=client,
body=body,
idempotency_key=idempotency_key,

    )).parsed
