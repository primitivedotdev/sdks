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
    *,
    filename: str,

) -> dict[str, Any]:




    params: dict[str, Any] = {}

    params["filename"] = filename


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/emails/{id}/attachments".format(id=quote(str(id), safe=""),),
        "params": params,
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
    *,
    client: AuthenticatedClient,
    filename: str,

) -> Response[ErrorResponse | File]:
    """ Download one received email attachment by filename

     Returns the same bytes as downloadEmailAttachmentPart, selecting the attachment by its exact
    filename. The path form `/emails/{id}/attachments/{filename}` also works for any name that is not
    digits only, which that form reads as a part_index. When several attachments share the filename the
    response is 409 attachment_name_ambiguous with every matching part_index, and nothing is returned.
    Authenticate with an organization API key, an authorized organization OAuth token, or an address-
    bound agent connection key. A connected agent reads only mail received at its own address. Function
    credentials are not supported. Discarded content is unavailable.

    Args:
        id (UUID):
        filename (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | File]
     """


    kwargs = _get_kwargs(
        id=id,
filename=filename,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    id: UUID,
    *,
    client: AuthenticatedClient,
    filename: str,

) -> ErrorResponse | File | None:
    """ Download one received email attachment by filename

     Returns the same bytes as downloadEmailAttachmentPart, selecting the attachment by its exact
    filename. The path form `/emails/{id}/attachments/{filename}` also works for any name that is not
    digits only, which that form reads as a part_index. When several attachments share the filename the
    response is 409 attachment_name_ambiguous with every matching part_index, and nothing is returned.
    Authenticate with an organization API key, an authorized organization OAuth token, or an address-
    bound agent connection key. A connected agent reads only mail received at its own address. Function
    credentials are not supported. Discarded content is unavailable.

    Args:
        id (UUID):
        filename (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | File
     """


    return sync_detailed(
        id=id,
client=client,
filename=filename,

    ).parsed

async def asyncio_detailed(
    id: UUID,
    *,
    client: AuthenticatedClient,
    filename: str,

) -> Response[ErrorResponse | File]:
    """ Download one received email attachment by filename

     Returns the same bytes as downloadEmailAttachmentPart, selecting the attachment by its exact
    filename. The path form `/emails/{id}/attachments/{filename}` also works for any name that is not
    digits only, which that form reads as a part_index. When several attachments share the filename the
    response is 409 attachment_name_ambiguous with every matching part_index, and nothing is returned.
    Authenticate with an organization API key, an authorized organization OAuth token, or an address-
    bound agent connection key. A connected agent reads only mail received at its own address. Function
    credentials are not supported. Discarded content is unavailable.

    Args:
        id (UUID):
        filename (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | File]
     """


    kwargs = _get_kwargs(
        id=id,
filename=filename,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    id: UUID,
    *,
    client: AuthenticatedClient,
    filename: str,

) -> ErrorResponse | File | None:
    """ Download one received email attachment by filename

     Returns the same bytes as downloadEmailAttachmentPart, selecting the attachment by its exact
    filename. The path form `/emails/{id}/attachments/{filename}` also works for any name that is not
    digits only, which that form reads as a part_index. When several attachments share the filename the
    response is 409 attachment_name_ambiguous with every matching part_index, and nothing is returned.
    Authenticate with an organization API key, an authorized organization OAuth token, or an address-
    bound agent connection key. A connected agent reads only mail received at its own address. Function
    credentials are not supported. Discarded content is unavailable.

    Args:
        id (UUID):
        filename (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | File
     """


    return (await asyncio_detailed(
        id=id,
client=client,
filename=filename,

    )).parsed
