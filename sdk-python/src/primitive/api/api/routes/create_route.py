from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.create_route_input import CreateRouteInput
from ...models.create_route_response_201 import CreateRouteResponse201
from ...models.error_response import ErrorResponse
from ...types import UNSET, Unset
from typing import cast



def _get_kwargs(
    *,
    body: CreateRouteInput,
    idempotency_key: str | Unset = UNSET,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}
    if not isinstance(idempotency_key, Unset):
        headers["Idempotency-Key"] = idempotency_key



    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/routes",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> CreateRouteResponse201 | ErrorResponse | None:
    if response.status_code == 201:
        response_201 = CreateRouteResponse201.from_dict(response.json())



        return response_201

    if response.status_code == 400:
        response_400 = ErrorResponse.from_dict(response.json())



        return response_400

    if response.status_code == 401:
        response_401 = ErrorResponse.from_dict(response.json())



        return response_401

    if response.status_code == 403:
        response_403 = ErrorResponse.from_dict(response.json())



        return response_403

    if response.status_code == 409:
        response_409 = ErrorResponse.from_dict(response.json())



        return response_409

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[CreateRouteResponse201 | ErrorResponse]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: CreateRouteInput,
    idempotency_key: str | Unset = UNSET,

) -> Response[CreateRouteResponse201 | ErrorResponse]:
    """ Create a recipient route

     Binds a recipient pattern to a destination. Provide exactly one of
    `endpoint_id` (an existing endpoint) or `function_id`. With `function_id`,
    a dedicated route-target endpoint is minted for that function in the same
    transaction, enabling per-address function routing (e.g.
    `alice@acme.com -> functionA`).

    A route that could never deliver is refused: an exact pattern that the endpoint's owner may not
    receive, or that the route's own owner may not act on, answers 400 validation_error with
    details.reason endpoint_owner_access or route_owner_access and details.recipient. A wildcard or
    regex route to an owned endpoint is written, with warnings saying it delivers only what the owner
    may receive. A route written disabled is judged when it is turned on.

    Args:
        idempotency_key (str | Unset):
        body (CreateRouteInput): Provide exactly one of `endpoint_id` or `function_id`. With
            `function_id`,
            a route-target endpoint is minted for that function and the route is bound
            to it in one transaction.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[CreateRouteResponse201 | ErrorResponse]
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
    body: CreateRouteInput,
    idempotency_key: str | Unset = UNSET,

) -> CreateRouteResponse201 | ErrorResponse | None:
    """ Create a recipient route

     Binds a recipient pattern to a destination. Provide exactly one of
    `endpoint_id` (an existing endpoint) or `function_id`. With `function_id`,
    a dedicated route-target endpoint is minted for that function in the same
    transaction, enabling per-address function routing (e.g.
    `alice@acme.com -> functionA`).

    A route that could never deliver is refused: an exact pattern that the endpoint's owner may not
    receive, or that the route's own owner may not act on, answers 400 validation_error with
    details.reason endpoint_owner_access or route_owner_access and details.recipient. A wildcard or
    regex route to an owned endpoint is written, with warnings saying it delivers only what the owner
    may receive. A route written disabled is judged when it is turned on.

    Args:
        idempotency_key (str | Unset):
        body (CreateRouteInput): Provide exactly one of `endpoint_id` or `function_id`. With
            `function_id`,
            a route-target endpoint is minted for that function and the route is bound
            to it in one transaction.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        CreateRouteResponse201 | ErrorResponse
     """


    return sync_detailed(
        client=client,
body=body,
idempotency_key=idempotency_key,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: CreateRouteInput,
    idempotency_key: str | Unset = UNSET,

) -> Response[CreateRouteResponse201 | ErrorResponse]:
    """ Create a recipient route

     Binds a recipient pattern to a destination. Provide exactly one of
    `endpoint_id` (an existing endpoint) or `function_id`. With `function_id`,
    a dedicated route-target endpoint is minted for that function in the same
    transaction, enabling per-address function routing (e.g.
    `alice@acme.com -> functionA`).

    A route that could never deliver is refused: an exact pattern that the endpoint's owner may not
    receive, or that the route's own owner may not act on, answers 400 validation_error with
    details.reason endpoint_owner_access or route_owner_access and details.recipient. A wildcard or
    regex route to an owned endpoint is written, with warnings saying it delivers only what the owner
    may receive. A route written disabled is judged when it is turned on.

    Args:
        idempotency_key (str | Unset):
        body (CreateRouteInput): Provide exactly one of `endpoint_id` or `function_id`. With
            `function_id`,
            a route-target endpoint is minted for that function and the route is bound
            to it in one transaction.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[CreateRouteResponse201 | ErrorResponse]
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
    body: CreateRouteInput,
    idempotency_key: str | Unset = UNSET,

) -> CreateRouteResponse201 | ErrorResponse | None:
    """ Create a recipient route

     Binds a recipient pattern to a destination. Provide exactly one of
    `endpoint_id` (an existing endpoint) or `function_id`. With `function_id`,
    a dedicated route-target endpoint is minted for that function in the same
    transaction, enabling per-address function routing (e.g.
    `alice@acme.com -> functionA`).

    A route that could never deliver is refused: an exact pattern that the endpoint's owner may not
    receive, or that the route's own owner may not act on, answers 400 validation_error with
    details.reason endpoint_owner_access or route_owner_access and details.recipient. A wildcard or
    regex route to an owned endpoint is written, with warnings saying it delivers only what the owner
    may receive. A route written disabled is judged when it is turned on.

    Args:
        idempotency_key (str | Unset):
        body (CreateRouteInput): Provide exactly one of `endpoint_id` or `function_id`. With
            `function_id`,
            a route-target endpoint is minted for that function and the route is bound
            to it in one transaction.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        CreateRouteResponse201 | ErrorResponse
     """


    return (await asyncio_detailed(
        client=client,
body=body,
idempotency_key=idempotency_key,

    )).parsed
