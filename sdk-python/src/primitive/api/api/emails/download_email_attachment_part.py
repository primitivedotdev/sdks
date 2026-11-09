from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...types import File, FileTypes
from io import BytesIO
from typing import cast
from uuid import UUID



def _get_kwargs(
    id: UUID,
    part_index: int,

) -> dict[str, Any]:






    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/emails/{id}/attachments/{part_index}".format(id=quote(str(id), safe=""),part_index=quote(str(part_index), safe=""),),
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | File | None:
    if response.status_code == 200:
        response_200 = File(
             payload = BytesIO(response.content)
        )



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

    if response.status_code == 410:
        response_410 = ErrorResponse.from_dict(response.json())



        return response_410

    if response.status_code == 413:
        response_413 = ErrorResponse.from_dict(response.json())



        return response_413

    if response.status_code == 429:
        response_429 = ErrorResponse.from_dict(response.json())



        return response_429

    if response.status_code == 502:
        response_502 = ErrorResponse.from_dict(response.json())



        return response_502

    if response.status_code == 503:
        response_503 = ErrorResponse.from_dict(response.json())



        return response_503

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | File]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    id: UUID,
    part_index: int,
    *,
    client: AuthenticatedClient | Client,

) -> Response[ErrorResponse | File]:
    """ Download one received email attachment

     Returns the original decoded bytes of one retained attachment. Authenticate with an organization API
    key, an authorized organization OAuth token, or an address-bound agent connection key. Connected
    agents can read only their own inbound recipient attachments. Function credentials and download
    query tokens are not supported. Duplicate filenames are distinguished by part_index. The part limit
    is 31457280 bytes; the complete archive must fit 67108864 compressed and decoded bytes and 1024
    entries including metadata. Metadata headers are limited to 16384 bytes each and 262144 bytes total;
    resolved archive paths are limited to 4096 UTF-8 bytes. Preparation has a 15-second deadline. A
    small part in an oversized archive can exceed these limits. This does not parse interactions or
    certify sender identity. Discarded content is unavailable.

    Args:
        id (UUID):
        part_index (int):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | File]
     """


    kwargs = _get_kwargs(
        id=id,
part_index=part_index,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    id: UUID,
    part_index: int,
    *,
    client: AuthenticatedClient | Client,

) -> ErrorResponse | File | None:
    """ Download one received email attachment

     Returns the original decoded bytes of one retained attachment. Authenticate with an organization API
    key, an authorized organization OAuth token, or an address-bound agent connection key. Connected
    agents can read only their own inbound recipient attachments. Function credentials and download
    query tokens are not supported. Duplicate filenames are distinguished by part_index. The part limit
    is 31457280 bytes; the complete archive must fit 67108864 compressed and decoded bytes and 1024
    entries including metadata. Metadata headers are limited to 16384 bytes each and 262144 bytes total;
    resolved archive paths are limited to 4096 UTF-8 bytes. Preparation has a 15-second deadline. A
    small part in an oversized archive can exceed these limits. This does not parse interactions or
    certify sender identity. Discarded content is unavailable.

    Args:
        id (UUID):
        part_index (int):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | File
     """


    return sync_detailed(
        id=id,
part_index=part_index,
client=client,

    ).parsed

async def asyncio_detailed(
    id: UUID,
    part_index: int,
    *,
    client: AuthenticatedClient | Client,

) -> Response[ErrorResponse | File]:
    """ Download one received email attachment

     Returns the original decoded bytes of one retained attachment. Authenticate with an organization API
    key, an authorized organization OAuth token, or an address-bound agent connection key. Connected
    agents can read only their own inbound recipient attachments. Function credentials and download
    query tokens are not supported. Duplicate filenames are distinguished by part_index. The part limit
    is 31457280 bytes; the complete archive must fit 67108864 compressed and decoded bytes and 1024
    entries including metadata. Metadata headers are limited to 16384 bytes each and 262144 bytes total;
    resolved archive paths are limited to 4096 UTF-8 bytes. Preparation has a 15-second deadline. A
    small part in an oversized archive can exceed these limits. This does not parse interactions or
    certify sender identity. Discarded content is unavailable.

    Args:
        id (UUID):
        part_index (int):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | File]
     """


    kwargs = _get_kwargs(
        id=id,
part_index=part_index,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    id: UUID,
    part_index: int,
    *,
    client: AuthenticatedClient | Client,

) -> ErrorResponse | File | None:
    """ Download one received email attachment

     Returns the original decoded bytes of one retained attachment. Authenticate with an organization API
    key, an authorized organization OAuth token, or an address-bound agent connection key. Connected
    agents can read only their own inbound recipient attachments. Function credentials and download
    query tokens are not supported. Duplicate filenames are distinguished by part_index. The part limit
    is 31457280 bytes; the complete archive must fit 67108864 compressed and decoded bytes and 1024
    entries including metadata. Metadata headers are limited to 16384 bytes each and 262144 bytes total;
    resolved archive paths are limited to 4096 UTF-8 bytes. Preparation has a 15-second deadline. A
    small part in an oversized archive can exceed these limits. This does not parse interactions or
    certify sender identity. Discarded content is unavailable.

    Args:
        id (UUID):
        part_index (int):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | File
     """


    return (await asyncio_detailed(
        id=id,
part_index=part_index,
client=client,

    )).parsed
