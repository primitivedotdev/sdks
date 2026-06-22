from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.set_org_secret_input import SetOrgSecretInput
from ...models.set_org_secret_response_200 import SetOrgSecretResponse200
from ...models.set_org_secret_response_201 import SetOrgSecretResponse201
from typing import cast



def _get_kwargs(
    key: str,
    *,
    body: SetOrgSecretInput,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "put",
        "url": "/org/secrets/{key}".format(key=quote(str(key), safe=""),),
    }

    _kwargs["json"] = body.to_dict()


    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | SetOrgSecretResponse200 | SetOrgSecretResponse201 | None:
    if response.status_code == 200:
        response_200 = SetOrgSecretResponse200.from_dict(response.json())



        return response_200

    if response.status_code == 201:
        response_201 = SetOrgSecretResponse201.from_dict(response.json())



        return response_201

    if response.status_code == 400:
        response_400 = ErrorResponse.from_dict(response.json())



        return response_400

    if response.status_code == 401:
        response_401 = ErrorResponse.from_dict(response.json())



        return response_401

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | SetOrgSecretResponse200 | SetOrgSecretResponse201]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    key: str,
    *,
    client: AuthenticatedClient | Client,
    body: SetOrgSecretInput,

) -> Response[ErrorResponse | SetOrgSecretResponse200 | SetOrgSecretResponse201]:
    """ Set an org secret by key

     Path-keyed companion to `POST /org/secrets`. Idempotent:
    returns 201 the first time the key is set, 200 on subsequent
    updates. Same validation and write-only guarantees as POST.

    Args:
        key (str):
        body (SetOrgSecretInput): Body for PUT /org/secrets/{key}. Key comes from the path.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | SetOrgSecretResponse200 | SetOrgSecretResponse201]
     """


    kwargs = _get_kwargs(
        key=key,
body=body,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    key: str,
    *,
    client: AuthenticatedClient | Client,
    body: SetOrgSecretInput,

) -> ErrorResponse | SetOrgSecretResponse200 | SetOrgSecretResponse201 | None:
    """ Set an org secret by key

     Path-keyed companion to `POST /org/secrets`. Idempotent:
    returns 201 the first time the key is set, 200 on subsequent
    updates. Same validation and write-only guarantees as POST.

    Args:
        key (str):
        body (SetOrgSecretInput): Body for PUT /org/secrets/{key}. Key comes from the path.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | SetOrgSecretResponse200 | SetOrgSecretResponse201
     """


    return sync_detailed(
        key=key,
client=client,
body=body,

    ).parsed

async def asyncio_detailed(
    key: str,
    *,
    client: AuthenticatedClient | Client,
    body: SetOrgSecretInput,

) -> Response[ErrorResponse | SetOrgSecretResponse200 | SetOrgSecretResponse201]:
    """ Set an org secret by key

     Path-keyed companion to `POST /org/secrets`. Idempotent:
    returns 201 the first time the key is set, 200 on subsequent
    updates. Same validation and write-only guarantees as POST.

    Args:
        key (str):
        body (SetOrgSecretInput): Body for PUT /org/secrets/{key}. Key comes from the path.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | SetOrgSecretResponse200 | SetOrgSecretResponse201]
     """


    kwargs = _get_kwargs(
        key=key,
body=body,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    key: str,
    *,
    client: AuthenticatedClient | Client,
    body: SetOrgSecretInput,

) -> ErrorResponse | SetOrgSecretResponse200 | SetOrgSecretResponse201 | None:
    """ Set an org secret by key

     Path-keyed companion to `POST /org/secrets`. Idempotent:
    returns 201 the first time the key is set, 200 on subsequent
    updates. Same validation and write-only guarantees as POST.

    Args:
        key (str):
        body (SetOrgSecretInput): Body for PUT /org/secrets/{key}. Key comes from the path.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | SetOrgSecretResponse200 | SetOrgSecretResponse201
     """


    return (await asyncio_detailed(
        key=key,
client=client,
body=body,

    )).parsed
