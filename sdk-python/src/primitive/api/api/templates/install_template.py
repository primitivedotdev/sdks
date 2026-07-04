from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.install_template_body import InstallTemplateBody
from ...models.install_template_response_201 import InstallTemplateResponse201
from ...types import UNSET, Unset
from typing import cast



def _get_kwargs(
    id: str,
    *,
    body: InstallTemplateBody | Unset = UNSET,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/templates/{id}/install".format(id=quote(str(id), safe=""),),
    }

    
    if not isinstance(body, Unset):
        _kwargs["json"] = body.to_dict()
        headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | InstallTemplateResponse201 | None:
    if response.status_code == 201:
        response_201 = InstallTemplateResponse201.from_dict(response.json())



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

    if response.status_code == 422:
        response_422 = ErrorResponse.from_dict(response.json())



        return response_422

    if response.status_code == 429:
        response_429 = ErrorResponse.from_dict(response.json())



        return response_429

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | InstallTemplateResponse201]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    id: str,
    *,
    client: AuthenticatedClient,
    body: InstallTemplateBody | Unset = UNSET,

) -> Response[ErrorResponse | InstallTemplateResponse201]:
    """ Install a function template

     Start a one-shot deploy of an approved deploy-mode Function template.
    The response returns an install record immediately; poll
    `GET /templates/installs/{id}` for progress.

    Args:
        id (str):
        body (InstallTemplateBody | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | InstallTemplateResponse201]
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
    id: str,
    *,
    client: AuthenticatedClient,
    body: InstallTemplateBody | Unset = UNSET,

) -> ErrorResponse | InstallTemplateResponse201 | None:
    """ Install a function template

     Start a one-shot deploy of an approved deploy-mode Function template.
    The response returns an install record immediately; poll
    `GET /templates/installs/{id}` for progress.

    Args:
        id (str):
        body (InstallTemplateBody | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | InstallTemplateResponse201
     """


    return sync_detailed(
        id=id,
client=client,
body=body,

    ).parsed

async def asyncio_detailed(
    id: str,
    *,
    client: AuthenticatedClient,
    body: InstallTemplateBody | Unset = UNSET,

) -> Response[ErrorResponse | InstallTemplateResponse201]:
    """ Install a function template

     Start a one-shot deploy of an approved deploy-mode Function template.
    The response returns an install record immediately; poll
    `GET /templates/installs/{id}` for progress.

    Args:
        id (str):
        body (InstallTemplateBody | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | InstallTemplateResponse201]
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
    id: str,
    *,
    client: AuthenticatedClient,
    body: InstallTemplateBody | Unset = UNSET,

) -> ErrorResponse | InstallTemplateResponse201 | None:
    """ Install a function template

     Start a one-shot deploy of an approved deploy-mode Function template.
    The response returns an install record immediately; poll
    `GET /templates/installs/{id}` for progress.

    Args:
        id (str):
        body (InstallTemplateBody | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | InstallTemplateResponse201
     """


    return (await asyncio_detailed(
        id=id,
client=client,
body=body,

    )).parsed
