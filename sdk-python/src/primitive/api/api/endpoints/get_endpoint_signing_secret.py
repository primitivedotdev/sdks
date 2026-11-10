from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.endpoint_signing_secret_response import EndpointSigningSecretResponse
from ...models.error_response import ErrorResponse
from typing import cast
from uuid import UUID



def _get_kwargs(
    id: UUID,

) -> dict[str, Any]:
    

    

    

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/endpoints/{id}/signing-secret".format(id=quote(str(id), safe=""),),
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> EndpointSigningSecretResponse | ErrorResponse | None:
    if response.status_code == 200:
        response_200 = EndpointSigningSecretResponse.from_dict(response.json())



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

    if response.status_code == 500:
        response_500 = ErrorResponse.from_dict(response.json())



        return response_500

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[EndpointSigningSecretResponse | ErrorResponse]:
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

) -> Response[EndpointSigningSecretResponse | ErrorResponse]:
    """ Get a webhook's own signing secret

     The secret deliveries to this webhook are signed with, when it signs with its own (signed_with is
    own_secret). Verify the Primitive-Signature header with it. A webhook a person owns is given its
    secret the first time it is asked for. A webhook that signs with the organization's secret answers
    409 conflict: rotate its signing secret to give it its own. Answered to the person who owns the
    webhook; for a webhook an API key owns, to the key that acts for it and the person who holds that
    key; for one a third-party app or an agent delegate owns, to that app or delegate; and for a webhook
    the organization owns, to a caller who may change it and holds webhook_secret:read.

    Args:
        id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[EndpointSigningSecretResponse | ErrorResponse]
     """


    kwargs = _get_kwargs(
        id=id,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,

) -> EndpointSigningSecretResponse | ErrorResponse | None:
    """ Get a webhook's own signing secret

     The secret deliveries to this webhook are signed with, when it signs with its own (signed_with is
    own_secret). Verify the Primitive-Signature header with it. A webhook a person owns is given its
    secret the first time it is asked for. A webhook that signs with the organization's secret answers
    409 conflict: rotate its signing secret to give it its own. Answered to the person who owns the
    webhook; for a webhook an API key owns, to the key that acts for it and the person who holds that
    key; for one a third-party app or an agent delegate owns, to that app or delegate; and for a webhook
    the organization owns, to a caller who may change it and holds webhook_secret:read.

    Args:
        id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        EndpointSigningSecretResponse | ErrorResponse
     """


    return sync_detailed(
        id=id,
client=client,

    ).parsed

async def asyncio_detailed(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,

) -> Response[EndpointSigningSecretResponse | ErrorResponse]:
    """ Get a webhook's own signing secret

     The secret deliveries to this webhook are signed with, when it signs with its own (signed_with is
    own_secret). Verify the Primitive-Signature header with it. A webhook a person owns is given its
    secret the first time it is asked for. A webhook that signs with the organization's secret answers
    409 conflict: rotate its signing secret to give it its own. Answered to the person who owns the
    webhook; for a webhook an API key owns, to the key that acts for it and the person who holds that
    key; for one a third-party app or an agent delegate owns, to that app or delegate; and for a webhook
    the organization owns, to a caller who may change it and holds webhook_secret:read.

    Args:
        id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[EndpointSigningSecretResponse | ErrorResponse]
     """


    kwargs = _get_kwargs(
        id=id,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,

) -> EndpointSigningSecretResponse | ErrorResponse | None:
    """ Get a webhook's own signing secret

     The secret deliveries to this webhook are signed with, when it signs with its own (signed_with is
    own_secret). Verify the Primitive-Signature header with it. A webhook a person owns is given its
    secret the first time it is asked for. A webhook that signs with the organization's secret answers
    409 conflict: rotate its signing secret to give it its own. Answered to the person who owns the
    webhook; for a webhook an API key owns, to the key that acts for it and the person who holds that
    key; for one a third-party app or an agent delegate owns, to that app or delegate; and for a webhook
    the organization owns, to a caller who may change it and holds webhook_secret:read.

    Args:
        id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        EndpointSigningSecretResponse | ErrorResponse
     """


    return (await asyncio_detailed(
        id=id,
client=client,

    )).parsed
