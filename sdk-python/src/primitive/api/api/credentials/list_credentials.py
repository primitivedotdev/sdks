from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.list_credentials_kind import ListCredentialsKind
from ...models.list_credentials_response_200 import ListCredentialsResponse200
from ...types import UNSET, Unset
from typing import cast



def _get_kwargs(
    *,
    kind: ListCredentialsKind | Unset = UNSET,

) -> dict[str, Any]:
    

    

    params: dict[str, Any] = {}

    json_kind: str | Unset = UNSET
    if not isinstance(kind, Unset):
        json_kind = kind.value

    params["kind"] = json_kind


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/credentials",
        "params": params,
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | ListCredentialsResponse200 | None:
    if response.status_code == 200:
        response_200 = ListCredentialsResponse200.from_dict(response.json())



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

    if response.status_code == 429:
        response_429 = ErrorResponse.from_dict(response.json())



        return response_429

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | ListCredentialsResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    kind: ListCredentialsKind | Unset = UNSET,

) -> Response[ErrorResponse | ListCredentialsResponse200]:
    """ List every credential

     Every credential that can act in the organization: API keys, Function keys, agent connection keys,
    connected apps (OAuth), agent delegates and, where enabled, CLI logins. Secrets are never returned.
    Filter with kind. Needs the organization's credential features to be enabled; while they are not,
    this answers 404 feature_disabled, with details.feature naming the feature. Only Primitive turns
    these on.

    Person only: a dashboard session. The person's role must hold credentials:read. API keys, agent
    connection keys and agents are refused.

    Args:
        kind (ListCredentialsKind | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ListCredentialsResponse200]
     """


    kwargs = _get_kwargs(
        kind=kind,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    *,
    client: AuthenticatedClient | Client,
    kind: ListCredentialsKind | Unset = UNSET,

) -> ErrorResponse | ListCredentialsResponse200 | None:
    """ List every credential

     Every credential that can act in the organization: API keys, Function keys, agent connection keys,
    connected apps (OAuth), agent delegates and, where enabled, CLI logins. Secrets are never returned.
    Filter with kind. Needs the organization's credential features to be enabled; while they are not,
    this answers 404 feature_disabled, with details.feature naming the feature. Only Primitive turns
    these on.

    Person only: a dashboard session. The person's role must hold credentials:read. API keys, agent
    connection keys and agents are refused.

    Args:
        kind (ListCredentialsKind | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ListCredentialsResponse200
     """


    return sync_detailed(
        client=client,
kind=kind,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    kind: ListCredentialsKind | Unset = UNSET,

) -> Response[ErrorResponse | ListCredentialsResponse200]:
    """ List every credential

     Every credential that can act in the organization: API keys, Function keys, agent connection keys,
    connected apps (OAuth), agent delegates and, where enabled, CLI logins. Secrets are never returned.
    Filter with kind. Needs the organization's credential features to be enabled; while they are not,
    this answers 404 feature_disabled, with details.feature naming the feature. Only Primitive turns
    these on.

    Person only: a dashboard session. The person's role must hold credentials:read. API keys, agent
    connection keys and agents are refused.

    Args:
        kind (ListCredentialsKind | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ListCredentialsResponse200]
     """


    kwargs = _get_kwargs(
        kind=kind,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    kind: ListCredentialsKind | Unset = UNSET,

) -> ErrorResponse | ListCredentialsResponse200 | None:
    """ List every credential

     Every credential that can act in the organization: API keys, Function keys, agent connection keys,
    connected apps (OAuth), agent delegates and, where enabled, CLI logins. Secrets are never returned.
    Filter with kind. Needs the organization's credential features to be enabled; while they are not,
    this answers 404 feature_disabled, with details.feature naming the feature. Only Primitive turns
    these on.

    Person only: a dashboard session. The person's role must hold credentials:read. API keys, agent
    connection keys and agents are refused.

    Args:
        kind (ListCredentialsKind | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ListCredentialsResponse200
     """


    return (await asyncio_detailed(
        client=client,
kind=kind,

    )).parsed
