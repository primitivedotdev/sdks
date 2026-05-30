from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.function_route_body import FunctionRouteBody
from ...models.set_function_route_response_200 import SetFunctionRouteResponse200
from typing import cast
from uuid import UUID



def _get_kwargs(
    id: UUID,
    *,
    body: FunctionRouteBody,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "put",
        "url": "/functions/{id}/route".format(id=quote(str(id), safe=""),),
    }

    _kwargs["json"] = body.to_dict()


    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | SetFunctionRouteResponse200 | None:
    if response.status_code == 200:
        response_200 = SetFunctionRouteResponse200.from_dict(response.json())



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

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | SetFunctionRouteResponse200]:
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
    body: FunctionRouteBody,

) -> Response[ErrorResponse | SetFunctionRouteResponse200]:
    """ Bind a route to a function

     Binds inbound mail to this function. The route target is either
    a specific verified domain (scoped) or the org's fallback (any
    active domain with no scoped binding). If another function is
    already bound at the target, returns a `conflict` envelope
    describing the holder; re-issue with `takeover: true` to
    deactivate that prior binding and install this one.

    Args:
        id (UUID):
        body (FunctionRouteBody): Target for a route binding. Either a specific verified domain
            (scoped) or the org-wide fallback. Pass `takeover: true` to
            deactivate any conflicting binding before installing this one.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | SetFunctionRouteResponse200]
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
    body: FunctionRouteBody,

) -> ErrorResponse | SetFunctionRouteResponse200 | None:
    """ Bind a route to a function

     Binds inbound mail to this function. The route target is either
    a specific verified domain (scoped) or the org's fallback (any
    active domain with no scoped binding). If another function is
    already bound at the target, returns a `conflict` envelope
    describing the holder; re-issue with `takeover: true` to
    deactivate that prior binding and install this one.

    Args:
        id (UUID):
        body (FunctionRouteBody): Target for a route binding. Either a specific verified domain
            (scoped) or the org-wide fallback. Pass `takeover: true` to
            deactivate any conflicting binding before installing this one.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | SetFunctionRouteResponse200
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
    body: FunctionRouteBody,

) -> Response[ErrorResponse | SetFunctionRouteResponse200]:
    """ Bind a route to a function

     Binds inbound mail to this function. The route target is either
    a specific verified domain (scoped) or the org's fallback (any
    active domain with no scoped binding). If another function is
    already bound at the target, returns a `conflict` envelope
    describing the holder; re-issue with `takeover: true` to
    deactivate that prior binding and install this one.

    Args:
        id (UUID):
        body (FunctionRouteBody): Target for a route binding. Either a specific verified domain
            (scoped) or the org-wide fallback. Pass `takeover: true` to
            deactivate any conflicting binding before installing this one.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | SetFunctionRouteResponse200]
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
    body: FunctionRouteBody,

) -> ErrorResponse | SetFunctionRouteResponse200 | None:
    """ Bind a route to a function

     Binds inbound mail to this function. The route target is either
    a specific verified domain (scoped) or the org's fallback (any
    active domain with no scoped binding). If another function is
    already bound at the target, returns a `conflict` envelope
    describing the holder; re-issue with `takeover: true` to
    deactivate that prior binding and install this one.

    Args:
        id (UUID):
        body (FunctionRouteBody): Target for a route binding. Either a specific verified domain
            (scoped) or the org-wide fallback. Pass `takeover: true` to
            deactivate any conflicting binding before installing this one.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | SetFunctionRouteResponse200
     """


    return (await asyncio_detailed(
        id=id,
client=client,
body=body,

    )).parsed
