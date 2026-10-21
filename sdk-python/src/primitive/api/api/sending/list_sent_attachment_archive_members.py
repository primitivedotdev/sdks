from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.list_sent_attachment_archive_members_response_200 import ListSentAttachmentArchiveMembersResponse200
from typing import cast
from uuid import UUID



def _get_kwargs(
    id: UUID,
    attachment: str,

) -> dict[str, Any]:
    

    

    

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/sent-emails/{id}/attachments/{attachment}/members".format(id=quote(str(id), safe=""),attachment=quote(str(attachment), safe=""),),
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | ListSentAttachmentArchiveMembersResponse200 | None:
    if response.status_code == 200:
        response_200 = ListSentAttachmentArchiveMembersResponse200.from_dict(response.json())



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

    if response.status_code == 422:
        response_422 = ErrorResponse.from_dict(response.json())



        return response_422

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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | ListSentAttachmentArchiveMembersResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    id: UUID,
    attachment: str,
    *,
    client: AuthenticatedClient,

) -> Response[ErrorResponse | ListSentAttachmentArchiveMembersResponse200]:
    """ List the files inside a sent zip or tar attachment

     Lists the regular files inside a zip, tar or tar.gz attachment with each one's path, decoded size
    and SHA-256. The format is detected from the content. Unsafe paths refuse the whole archive, and
    resource limits bound the work (see the 413 and 422 responses). Authenticate with an organization
    API key, an authorized organization OAuth token, or an address-bound agent connection key. A
    connected agent reads only mail sent from its own address. Function credentials are not supported.
    Discarded content is unavailable.

    Args:
        id (UUID):
        attachment (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ListSentAttachmentArchiveMembersResponse200]
     """


    kwargs = _get_kwargs(
        id=id,
attachment=attachment,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    id: UUID,
    attachment: str,
    *,
    client: AuthenticatedClient,

) -> ErrorResponse | ListSentAttachmentArchiveMembersResponse200 | None:
    """ List the files inside a sent zip or tar attachment

     Lists the regular files inside a zip, tar or tar.gz attachment with each one's path, decoded size
    and SHA-256. The format is detected from the content. Unsafe paths refuse the whole archive, and
    resource limits bound the work (see the 413 and 422 responses). Authenticate with an organization
    API key, an authorized organization OAuth token, or an address-bound agent connection key. A
    connected agent reads only mail sent from its own address. Function credentials are not supported.
    Discarded content is unavailable.

    Args:
        id (UUID):
        attachment (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ListSentAttachmentArchiveMembersResponse200
     """


    return sync_detailed(
        id=id,
attachment=attachment,
client=client,

    ).parsed

async def asyncio_detailed(
    id: UUID,
    attachment: str,
    *,
    client: AuthenticatedClient,

) -> Response[ErrorResponse | ListSentAttachmentArchiveMembersResponse200]:
    """ List the files inside a sent zip or tar attachment

     Lists the regular files inside a zip, tar or tar.gz attachment with each one's path, decoded size
    and SHA-256. The format is detected from the content. Unsafe paths refuse the whole archive, and
    resource limits bound the work (see the 413 and 422 responses). Authenticate with an organization
    API key, an authorized organization OAuth token, or an address-bound agent connection key. A
    connected agent reads only mail sent from its own address. Function credentials are not supported.
    Discarded content is unavailable.

    Args:
        id (UUID):
        attachment (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ListSentAttachmentArchiveMembersResponse200]
     """


    kwargs = _get_kwargs(
        id=id,
attachment=attachment,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    id: UUID,
    attachment: str,
    *,
    client: AuthenticatedClient,

) -> ErrorResponse | ListSentAttachmentArchiveMembersResponse200 | None:
    """ List the files inside a sent zip or tar attachment

     Lists the regular files inside a zip, tar or tar.gz attachment with each one's path, decoded size
    and SHA-256. The format is detected from the content. Unsafe paths refuse the whole archive, and
    resource limits bound the work (see the 413 and 422 responses). Authenticate with an organization
    API key, an authorized organization OAuth token, or an address-bound agent connection key. A
    connected agent reads only mail sent from its own address. Function credentials are not supported.
    Discarded content is unavailable.

    Args:
        id (UUID):
        attachment (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ListSentAttachmentArchiveMembersResponse200
     """


    return (await asyncio_detailed(
        id=id,
attachment=attachment,
client=client,

    )).parsed
