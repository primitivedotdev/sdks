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
    client: AuthenticatedClient,

) -> Response[ErrorResponse | File]:
    """ Download one inbound email attachment

     Pending service release. This contract does not establish live availability.
    Downloads the original bytes of one ordinary email attachment, selected by
    its metadata `index`, not its position in an attachments array. Refresh
    the email detail after `attachment_changed` before choosing an index again.
    Uses bearer authentication only; signed raw-email download tokens are not accepted.
    A paired-agent credential may read only a message addressed to its claimed address.
    Function credentials are denied. Other bearer credentials retain their
    existing email access boundaries. This endpoint serves email bytes only.

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
    client: AuthenticatedClient,

) -> ErrorResponse | File | None:
    """ Download one inbound email attachment

     Pending service release. This contract does not establish live availability.
    Downloads the original bytes of one ordinary email attachment, selected by
    its metadata `index`, not its position in an attachments array. Refresh
    the email detail after `attachment_changed` before choosing an index again.
    Uses bearer authentication only; signed raw-email download tokens are not accepted.
    A paired-agent credential may read only a message addressed to its claimed address.
    Function credentials are denied. Other bearer credentials retain their
    existing email access boundaries. This endpoint serves email bytes only.

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
    client: AuthenticatedClient,

) -> Response[ErrorResponse | File]:
    """ Download one inbound email attachment

     Pending service release. This contract does not establish live availability.
    Downloads the original bytes of one ordinary email attachment, selected by
    its metadata `index`, not its position in an attachments array. Refresh
    the email detail after `attachment_changed` before choosing an index again.
    Uses bearer authentication only; signed raw-email download tokens are not accepted.
    A paired-agent credential may read only a message addressed to its claimed address.
    Function credentials are denied. Other bearer credentials retain their
    existing email access boundaries. This endpoint serves email bytes only.

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
    client: AuthenticatedClient,

) -> ErrorResponse | File | None:
    """ Download one inbound email attachment

     Pending service release. This contract does not establish live availability.
    Downloads the original bytes of one ordinary email attachment, selected by
    its metadata `index`, not its position in an attachments array. Refresh
    the email detail after `attachment_changed` before choosing an index again.
    Uses bearer authentication only; signed raw-email download tokens are not accepted.
    A paired-agent credential may read only a message addressed to its claimed address.
    Function credentials are denied. Other bearer credentials retain their
    existing email access boundaries. This endpoint serves email bytes only.

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
