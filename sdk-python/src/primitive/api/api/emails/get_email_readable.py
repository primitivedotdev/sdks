from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.get_email_readable_response_200 import GetEmailReadableResponse200
from ...types import UNSET, Unset
from typing import cast
from uuid import UUID



def _get_kwargs(
    id: UUID,
    *,
    max_chars: int | Unset = 16000,
    offset: int | Unset = 0,
    links: str | Unset = UNSET,

) -> dict[str, Any]:
    

    

    params: dict[str, Any] = {}

    params["max_chars"] = max_chars

    params["offset"] = offset

    params["links"] = links


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/emails/{id}/readable".format(id=quote(str(id), safe=""),),
        "params": params,
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | GetEmailReadableResponse200 | None:
    if response.status_code == 200:
        response_200 = GetEmailReadableResponse200.from_dict(response.json())



        return response_200

    if response.status_code == 400:
        response_400 = ErrorResponse.from_dict(response.json())



        return response_400

    if response.status_code == 401:
        response_401 = ErrorResponse.from_dict(response.json())



        return response_401

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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | GetEmailReadableResponse200]:
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
    max_chars: int | Unset = 16000,
    offset: int | Unset = 0,
    links: str | Unset = UNSET,

) -> Response[ErrorResponse | GetEmailReadableResponse200]:
    """ Read what an inbound email says

     Returns an inbound email as text a person or a model can read: the words of the message in reading
    order, without markup, hidden content, link targets or the quoted history below a reply. For a
    marketing email this can be a hundred times smaller than the record from `GET /emails/{id}`, which
    you still need for the stored bodies, headers, authentication results or delivery state.

    Each link is a `[n]` marker beside its label. `link_count` says how many there are; ask for targets
    with `links`.

    A long body comes in pages of at most `max_chars` characters, ending on a line break where one is in
    reach. When `body_next_offset` is not null, send it as `offset` to read on.

    The access rules of `GET /emails/{id}` apply. When content is withheld (for example a sender your
    filter blocked), the identifying fields are returned with an empty `body_text` and a `body_source`
    of `none`.

    Args:
        id (UUID):
        max_chars (int | Unset):  Default: 16000.
        offset (int | Unset):  Default: 0.
        links (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | GetEmailReadableResponse200]
     """


    kwargs = _get_kwargs(
        id=id,
max_chars=max_chars,
offset=offset,
links=links,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    max_chars: int | Unset = 16000,
    offset: int | Unset = 0,
    links: str | Unset = UNSET,

) -> ErrorResponse | GetEmailReadableResponse200 | None:
    """ Read what an inbound email says

     Returns an inbound email as text a person or a model can read: the words of the message in reading
    order, without markup, hidden content, link targets or the quoted history below a reply. For a
    marketing email this can be a hundred times smaller than the record from `GET /emails/{id}`, which
    you still need for the stored bodies, headers, authentication results or delivery state.

    Each link is a `[n]` marker beside its label. `link_count` says how many there are; ask for targets
    with `links`.

    A long body comes in pages of at most `max_chars` characters, ending on a line break where one is in
    reach. When `body_next_offset` is not null, send it as `offset` to read on.

    The access rules of `GET /emails/{id}` apply. When content is withheld (for example a sender your
    filter blocked), the identifying fields are returned with an empty `body_text` and a `body_source`
    of `none`.

    Args:
        id (UUID):
        max_chars (int | Unset):  Default: 16000.
        offset (int | Unset):  Default: 0.
        links (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | GetEmailReadableResponse200
     """


    return sync_detailed(
        id=id,
client=client,
max_chars=max_chars,
offset=offset,
links=links,

    ).parsed

async def asyncio_detailed(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    max_chars: int | Unset = 16000,
    offset: int | Unset = 0,
    links: str | Unset = UNSET,

) -> Response[ErrorResponse | GetEmailReadableResponse200]:
    """ Read what an inbound email says

     Returns an inbound email as text a person or a model can read: the words of the message in reading
    order, without markup, hidden content, link targets or the quoted history below a reply. For a
    marketing email this can be a hundred times smaller than the record from `GET /emails/{id}`, which
    you still need for the stored bodies, headers, authentication results or delivery state.

    Each link is a `[n]` marker beside its label. `link_count` says how many there are; ask for targets
    with `links`.

    A long body comes in pages of at most `max_chars` characters, ending on a line break where one is in
    reach. When `body_next_offset` is not null, send it as `offset` to read on.

    The access rules of `GET /emails/{id}` apply. When content is withheld (for example a sender your
    filter blocked), the identifying fields are returned with an empty `body_text` and a `body_source`
    of `none`.

    Args:
        id (UUID):
        max_chars (int | Unset):  Default: 16000.
        offset (int | Unset):  Default: 0.
        links (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | GetEmailReadableResponse200]
     """


    kwargs = _get_kwargs(
        id=id,
max_chars=max_chars,
offset=offset,
links=links,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    max_chars: int | Unset = 16000,
    offset: int | Unset = 0,
    links: str | Unset = UNSET,

) -> ErrorResponse | GetEmailReadableResponse200 | None:
    """ Read what an inbound email says

     Returns an inbound email as text a person or a model can read: the words of the message in reading
    order, without markup, hidden content, link targets or the quoted history below a reply. For a
    marketing email this can be a hundred times smaller than the record from `GET /emails/{id}`, which
    you still need for the stored bodies, headers, authentication results or delivery state.

    Each link is a `[n]` marker beside its label. `link_count` says how many there are; ask for targets
    with `links`.

    A long body comes in pages of at most `max_chars` characters, ending on a line break where one is in
    reach. When `body_next_offset` is not null, send it as `offset` to read on.

    The access rules of `GET /emails/{id}` apply. When content is withheld (for example a sender your
    filter blocked), the identifying fields are returned with an empty `body_text` and a `body_source`
    of `none`.

    Args:
        id (UUID):
        max_chars (int | Unset):  Default: 16000.
        offset (int | Unset):  Default: 0.
        links (str | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | GetEmailReadableResponse200
     """


    return (await asyncio_detailed(
        id=id,
client=client,
max_chars=max_chars,
offset=offset,
links=links,

    )).parsed
