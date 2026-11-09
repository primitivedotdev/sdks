from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...types import File, FileTypes
from ...types import UNSET, Unset
from io import BytesIO
from typing import cast
from uuid import UUID



def _get_kwargs(
    id: UUID,
    *,
    token: str | Unset = UNSET,

) -> dict[str, Any]:




    params: dict[str, Any] = {}

    params["token"] = token


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/sent-emails/{id}/attachments.tar.gz".format(id=quote(str(id), safe=""),),
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

    if response.status_code == 429:
        response_429 = ErrorResponse.from_dict(response.json())



        return response_429

    if response.status_code == 500:
        response_500 = ErrorResponse.from_dict(response.json())



        return response_500

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
    token: str | Unset = UNSET,

) -> Response[ErrorResponse | File]:
    """ Download sent email attachments

     Downloads retained inline attachments as a gzip-compressed tar archive. Authenticate with an
    organization API key, an authorized organization OAuth token, or a signed sent-attachment download
    token. An address-bound agent connection key reads only the archives of mail sent from its own
    address. Function credentials are not permitted. Archive member names match attachments[].tar_path
    in sent-email detail. Legacy sends may have no archive; offloaded payload files are not included.
    Discarded content cannot be downloaded.

    Args:
        id (UUID):
        token (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | File]
     """


    kwargs = _get_kwargs(
        id=id,
token=token,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    id: UUID,
    *,
    client: AuthenticatedClient,
    token: str | Unset = UNSET,

) -> ErrorResponse | File | None:
    """ Download sent email attachments

     Downloads retained inline attachments as a gzip-compressed tar archive. Authenticate with an
    organization API key, an authorized organization OAuth token, or a signed sent-attachment download
    token. An address-bound agent connection key reads only the archives of mail sent from its own
    address. Function credentials are not permitted. Archive member names match attachments[].tar_path
    in sent-email detail. Legacy sends may have no archive; offloaded payload files are not included.
    Discarded content cannot be downloaded.

    Args:
        id (UUID):
        token (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | File
     """


    return sync_detailed(
        id=id,
client=client,
token=token,

    ).parsed

async def asyncio_detailed(
    id: UUID,
    *,
    client: AuthenticatedClient,
    token: str | Unset = UNSET,

) -> Response[ErrorResponse | File]:
    """ Download sent email attachments

     Downloads retained inline attachments as a gzip-compressed tar archive. Authenticate with an
    organization API key, an authorized organization OAuth token, or a signed sent-attachment download
    token. An address-bound agent connection key reads only the archives of mail sent from its own
    address. Function credentials are not permitted. Archive member names match attachments[].tar_path
    in sent-email detail. Legacy sends may have no archive; offloaded payload files are not included.
    Discarded content cannot be downloaded.

    Args:
        id (UUID):
        token (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | File]
     """


    kwargs = _get_kwargs(
        id=id,
token=token,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    id: UUID,
    *,
    client: AuthenticatedClient,
    token: str | Unset = UNSET,

) -> ErrorResponse | File | None:
    """ Download sent email attachments

     Downloads retained inline attachments as a gzip-compressed tar archive. Authenticate with an
    organization API key, an authorized organization OAuth token, or a signed sent-attachment download
    token. An address-bound agent connection key reads only the archives of mail sent from its own
    address. Function credentials are not permitted. Archive member names match attachments[].tar_path
    in sent-email detail. Legacy sends may have no archive; offloaded payload files are not included.
    Discarded content cannot be downloaded.

    Args:
        id (UUID):
        token (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | File
     """


    return (await asyncio_detailed(
        id=id,
client=client,
token=token,

    )).parsed
