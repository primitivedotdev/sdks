from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.update_function_input import UpdateFunctionInput
from ...models.update_function_response_200 import UpdateFunctionResponse200
from typing import cast
from uuid import UUID



def _get_kwargs(
    id: UUID,
    *,
    body: UpdateFunctionInput,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "put",
        "url": "/functions/{id}".format(id=quote(str(id), safe=""),),
    }

    _kwargs["json"] = body.to_dict()


    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | UpdateFunctionResponse200 | None:
    if response.status_code == 200:
        response_200 = UpdateFunctionResponse200.from_dict(response.json())



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

    if response.status_code == 502:
        response_502 = ErrorResponse.from_dict(response.json())



        return response_502

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | UpdateFunctionResponse200]:
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
    body: UpdateFunctionInput,

) -> Response[ErrorResponse | UpdateFunctionResponse200]:
    """ Update and redeploy a function

     Replaces the function's source code with the body's `code` and
    triggers a redeploy. Same size limits as `POST /functions`.
    Use this verb to push secret writes into the running handler:
    passing the same `code` re-runs the deploy and refreshes the
    binding set with the latest values from the secrets table.

    On a 502 deploy failure, the previously-deployed code stays
    live; the runtime never serves a half-built bundle. The
    `deploy_error` field on the returned record carries the error
    that came back from the runtime so you can surface it to users
    without polling.

    Args:
        id (UUID):
        body (UpdateFunctionInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | UpdateFunctionResponse200]
     """


    kwargs = _get_kwargs(
        id=id,
body=body,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: UpdateFunctionInput,

) -> ErrorResponse | UpdateFunctionResponse200 | None:
    """ Update and redeploy a function

     Replaces the function's source code with the body's `code` and
    triggers a redeploy. Same size limits as `POST /functions`.
    Use this verb to push secret writes into the running handler:
    passing the same `code` re-runs the deploy and refreshes the
    binding set with the latest values from the secrets table.

    On a 502 deploy failure, the previously-deployed code stays
    live; the runtime never serves a half-built bundle. The
    `deploy_error` field on the returned record carries the error
    that came back from the runtime so you can surface it to users
    without polling.

    Args:
        id (UUID):
        body (UpdateFunctionInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | UpdateFunctionResponse200
     """


    return sync_detailed(
        id=id,
client=client,
body=body,

    ).parsed

async def asyncio_detailed(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: UpdateFunctionInput,

) -> Response[ErrorResponse | UpdateFunctionResponse200]:
    """ Update and redeploy a function

     Replaces the function's source code with the body's `code` and
    triggers a redeploy. Same size limits as `POST /functions`.
    Use this verb to push secret writes into the running handler:
    passing the same `code` re-runs the deploy and refreshes the
    binding set with the latest values from the secrets table.

    On a 502 deploy failure, the previously-deployed code stays
    live; the runtime never serves a half-built bundle. The
    `deploy_error` field on the returned record carries the error
    that came back from the runtime so you can surface it to users
    without polling.

    Args:
        id (UUID):
        body (UpdateFunctionInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | UpdateFunctionResponse200]
     """


    kwargs = _get_kwargs(
        id=id,
body=body,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: UpdateFunctionInput,

) -> ErrorResponse | UpdateFunctionResponse200 | None:
    """ Update and redeploy a function

     Replaces the function's source code with the body's `code` and
    triggers a redeploy. Same size limits as `POST /functions`.
    Use this verb to push secret writes into the running handler:
    passing the same `code` re-runs the deploy and refreshes the
    binding set with the latest values from the secrets table.

    On a 502 deploy failure, the previously-deployed code stays
    live; the runtime never serves a half-built bundle. The
    `deploy_error` field on the returned record carries the error
    that came back from the runtime so you can surface it to users
    without polling.

    Args:
        id (UUID):
        body (UpdateFunctionInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | UpdateFunctionResponse200
     """


    return (await asyncio_detailed(
        id=id,
client=client,
body=body,

    )).parsed
