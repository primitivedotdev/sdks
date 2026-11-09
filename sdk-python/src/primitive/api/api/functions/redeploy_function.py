from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.redeploy_function_response_200 import RedeployFunctionResponse200
from ...types import UNSET, Unset
from typing import cast
from uuid import UUID



def _get_kwargs(
    id: UUID,
    *,
    idempotency_key: str | Unset = UNSET,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}
    if not isinstance(idempotency_key, Unset):
        headers["Idempotency-Key"] = idempotency_key



    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/functions/{id}/redeploy".format(id=quote(str(id), safe=""),),
    }


    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | RedeployFunctionResponse200 | None:
    if response.status_code == 200:
        response_200 = RedeployFunctionResponse200.from_dict(response.json())



        return response_200

    if response.status_code == 401:
        response_401 = ErrorResponse.from_dict(response.json())



        return response_401

    if response.status_code == 403:
        response_403 = ErrorResponse.from_dict(response.json())



        return response_403

    if response.status_code == 404:
        response_404 = ErrorResponse.from_dict(response.json())



        return response_404

    if response.status_code == 424:
        response_424 = ErrorResponse.from_dict(response.json())



        return response_424

    if response.status_code == 429:
        response_429 = ErrorResponse.from_dict(response.json())



        return response_429

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | RedeployFunctionResponse200]:
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
    idempotency_key: str | Unset = UNSET,

) -> Response[ErrorResponse | RedeployFunctionResponse200]:
    """ Redeploy a function's stored code

     Push the function's stored source again as a new deployment, for example after changing its secrets
    or runtime key. Takes no body: to ship new code, use updateFunction. A body carrying code is refused
    rather than ignored.

    Args:
        id (UUID):
        idempotency_key (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | RedeployFunctionResponse200]
     """


    kwargs = _get_kwargs(
        id=id,
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
    idempotency_key: str | Unset = UNSET,

) -> ErrorResponse | RedeployFunctionResponse200 | None:
    """ Redeploy a function's stored code

     Push the function's stored source again as a new deployment, for example after changing its secrets
    or runtime key. Takes no body: to ship new code, use updateFunction. A body carrying code is refused
    rather than ignored.

    Args:
        id (UUID):
        idempotency_key (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | RedeployFunctionResponse200
     """


    return sync_detailed(
        id=id,
client=client,
idempotency_key=idempotency_key,

    ).parsed

async def asyncio_detailed(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    idempotency_key: str | Unset = UNSET,

) -> Response[ErrorResponse | RedeployFunctionResponse200]:
    """ Redeploy a function's stored code

     Push the function's stored source again as a new deployment, for example after changing its secrets
    or runtime key. Takes no body: to ship new code, use updateFunction. A body carrying code is refused
    rather than ignored.

    Args:
        id (UUID):
        idempotency_key (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | RedeployFunctionResponse200]
     """


    kwargs = _get_kwargs(
        id=id,
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
    idempotency_key: str | Unset = UNSET,

) -> ErrorResponse | RedeployFunctionResponse200 | None:
    """ Redeploy a function's stored code

     Push the function's stored source again as a new deployment, for example after changing its secrets
    or runtime key. Takes no body: to ship new code, use updateFunction. A body carrying code is refused
    rather than ignored.

    Args:
        id (UUID):
        idempotency_key (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | RedeployFunctionResponse200
     """


    return (await asyncio_detailed(
        id=id,
client=client,
idempotency_key=idempotency_key,

    )).parsed
