from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.create_key_input import CreateKeyInput
from ...models.create_key_response_201 import CreateKeyResponse201
from ...models.error_response import ErrorResponse
from ...types import UNSET, Unset
from typing import cast



def _get_kwargs(
    *,
    body: CreateKeyInput,
    primitive_step_up: str | Unset = UNSET,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}
    if not isinstance(primitive_step_up, Unset):
        headers["Primitive-Step-Up"] = primitive_step_up



    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/keys",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> CreateKeyResponse201 | ErrorResponse | None:
    if response.status_code == 201:
        response_201 = CreateKeyResponse201.from_dict(response.json())



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

    if response.status_code == 404:
        response_404 = ErrorResponse.from_dict(response.json())



        return response_404

    if response.status_code == 409:
        response_409 = ErrorResponse.from_dict(response.json())



        return response_409

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[CreateKeyResponse201 | ErrorResponse]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: CreateKeyInput,
    primitive_step_up: str | Unset = UNSET,

) -> Response[CreateKeyResponse201 | ErrorResponse]:
    """ Create an API key

     Creates an organization API key with a preset or a custom grant, an
    optional expiry and optional conditions. The secret is returned once,
    in `key`. A person's session may call this directly. An OAuth token
    (such as a CLI login) needs a single-use step-up token from the
    dashboard in the `Primitive-Step-Up` header; without one the answer
    is `403 step_up_required` with `details.step_up_url`. A grant the
    caller may not give, or one the server does not offer, answers
    `409 grant_not_available` with a `reason`.

    Args:
        primitive_step_up (str | Unset):
        body (CreateKeyInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[CreateKeyResponse201 | ErrorResponse]
     """


    kwargs = _get_kwargs(
        body=body,
primitive_step_up=primitive_step_up,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    *,
    client: AuthenticatedClient | Client,
    body: CreateKeyInput,
    primitive_step_up: str | Unset = UNSET,

) -> CreateKeyResponse201 | ErrorResponse | None:
    """ Create an API key

     Creates an organization API key with a preset or a custom grant, an
    optional expiry and optional conditions. The secret is returned once,
    in `key`. A person's session may call this directly. An OAuth token
    (such as a CLI login) needs a single-use step-up token from the
    dashboard in the `Primitive-Step-Up` header; without one the answer
    is `403 step_up_required` with `details.step_up_url`. A grant the
    caller may not give, or one the server does not offer, answers
    `409 grant_not_available` with a `reason`.

    Args:
        primitive_step_up (str | Unset):
        body (CreateKeyInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        CreateKeyResponse201 | ErrorResponse
     """


    return sync_detailed(
        client=client,
body=body,
primitive_step_up=primitive_step_up,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: CreateKeyInput,
    primitive_step_up: str | Unset = UNSET,

) -> Response[CreateKeyResponse201 | ErrorResponse]:
    """ Create an API key

     Creates an organization API key with a preset or a custom grant, an
    optional expiry and optional conditions. The secret is returned once,
    in `key`. A person's session may call this directly. An OAuth token
    (such as a CLI login) needs a single-use step-up token from the
    dashboard in the `Primitive-Step-Up` header; without one the answer
    is `403 step_up_required` with `details.step_up_url`. A grant the
    caller may not give, or one the server does not offer, answers
    `409 grant_not_available` with a `reason`.

    Args:
        primitive_step_up (str | Unset):
        body (CreateKeyInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[CreateKeyResponse201 | ErrorResponse]
     """


    kwargs = _get_kwargs(
        body=body,
primitive_step_up=primitive_step_up,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    body: CreateKeyInput,
    primitive_step_up: str | Unset = UNSET,

) -> CreateKeyResponse201 | ErrorResponse | None:
    """ Create an API key

     Creates an organization API key with a preset or a custom grant, an
    optional expiry and optional conditions. The secret is returned once,
    in `key`. A person's session may call this directly. An OAuth token
    (such as a CLI login) needs a single-use step-up token from the
    dashboard in the `Primitive-Step-Up` header; without one the answer
    is `403 step_up_required` with `details.step_up_url`. A grant the
    caller may not give, or one the server does not offer, answers
    `409 grant_not_available` with a `reason`.

    Args:
        primitive_step_up (str | Unset):
        body (CreateKeyInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        CreateKeyResponse201 | ErrorResponse
     """


    return (await asyncio_detailed(
        client=client,
body=body,
primitive_step_up=primitive_step_up,

    )).parsed
