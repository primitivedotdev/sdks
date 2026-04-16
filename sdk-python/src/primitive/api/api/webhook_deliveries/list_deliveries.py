from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.list_deliveries_response_200 import ListDeliveriesResponse200
from ...models.list_deliveries_status import ListDeliveriesStatus
from ...types import UNSET, Unset
from dateutil.parser import isoparse
from typing import cast
from uuid import UUID
import datetime



def _get_kwargs(
    *,
    cursor: str | Unset = UNSET,
    limit: int | Unset = 50,
    email_id: UUID | Unset = UNSET,
    status: ListDeliveriesStatus | Unset = UNSET,
    date_from: datetime.datetime | Unset = UNSET,
    date_to: datetime.datetime | Unset = UNSET,

) -> dict[str, Any]:
    

    

    params: dict[str, Any] = {}

    params["cursor"] = cursor

    params["limit"] = limit

    json_email_id: str | Unset = UNSET
    if not isinstance(email_id, Unset):
        json_email_id = str(email_id)
    params["email_id"] = json_email_id

    json_status: str | Unset = UNSET
    if not isinstance(status, Unset):
        json_status = status.value

    params["status"] = json_status

    json_date_from: str | Unset = UNSET
    if not isinstance(date_from, Unset):
        json_date_from = date_from.isoformat()
    params["date_from"] = json_date_from

    json_date_to: str | Unset = UNSET
    if not isinstance(date_to, Unset):
        json_date_to = date_to.isoformat()
    params["date_to"] = json_date_to


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/webhooks/deliveries",
        "params": params,
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | ListDeliveriesResponse200 | None:
    if response.status_code == 200:
        response_200 = ListDeliveriesResponse200.from_dict(response.json())



        return response_200

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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | ListDeliveriesResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    cursor: str | Unset = UNSET,
    limit: int | Unset = 50,
    email_id: UUID | Unset = UNSET,
    status: ListDeliveriesStatus | Unset = UNSET,
    date_from: datetime.datetime | Unset = UNSET,
    date_to: datetime.datetime | Unset = UNSET,

) -> Response[ErrorResponse | ListDeliveriesResponse200]:
    """ List webhook deliveries

     Returns a paginated list of webhook delivery attempts. Each delivery
    includes a nested `email` object with sender, recipient, and subject.

    Args:
        cursor (str | Unset):
        limit (int | Unset):  Default: 50.
        email_id (UUID | Unset):
        status (ListDeliveriesStatus | Unset):
        date_from (datetime.datetime | Unset):
        date_to (datetime.datetime | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ListDeliveriesResponse200]
     """


    kwargs = _get_kwargs(
        cursor=cursor,
limit=limit,
email_id=email_id,
status=status,
date_from=date_from,
date_to=date_to,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    *,
    client: AuthenticatedClient | Client,
    cursor: str | Unset = UNSET,
    limit: int | Unset = 50,
    email_id: UUID | Unset = UNSET,
    status: ListDeliveriesStatus | Unset = UNSET,
    date_from: datetime.datetime | Unset = UNSET,
    date_to: datetime.datetime | Unset = UNSET,

) -> ErrorResponse | ListDeliveriesResponse200 | None:
    """ List webhook deliveries

     Returns a paginated list of webhook delivery attempts. Each delivery
    includes a nested `email` object with sender, recipient, and subject.

    Args:
        cursor (str | Unset):
        limit (int | Unset):  Default: 50.
        email_id (UUID | Unset):
        status (ListDeliveriesStatus | Unset):
        date_from (datetime.datetime | Unset):
        date_to (datetime.datetime | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ListDeliveriesResponse200
     """


    return sync_detailed(
        client=client,
cursor=cursor,
limit=limit,
email_id=email_id,
status=status,
date_from=date_from,
date_to=date_to,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    cursor: str | Unset = UNSET,
    limit: int | Unset = 50,
    email_id: UUID | Unset = UNSET,
    status: ListDeliveriesStatus | Unset = UNSET,
    date_from: datetime.datetime | Unset = UNSET,
    date_to: datetime.datetime | Unset = UNSET,

) -> Response[ErrorResponse | ListDeliveriesResponse200]:
    """ List webhook deliveries

     Returns a paginated list of webhook delivery attempts. Each delivery
    includes a nested `email` object with sender, recipient, and subject.

    Args:
        cursor (str | Unset):
        limit (int | Unset):  Default: 50.
        email_id (UUID | Unset):
        status (ListDeliveriesStatus | Unset):
        date_from (datetime.datetime | Unset):
        date_to (datetime.datetime | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ListDeliveriesResponse200]
     """


    kwargs = _get_kwargs(
        cursor=cursor,
limit=limit,
email_id=email_id,
status=status,
date_from=date_from,
date_to=date_to,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    cursor: str | Unset = UNSET,
    limit: int | Unset = 50,
    email_id: UUID | Unset = UNSET,
    status: ListDeliveriesStatus | Unset = UNSET,
    date_from: datetime.datetime | Unset = UNSET,
    date_to: datetime.datetime | Unset = UNSET,

) -> ErrorResponse | ListDeliveriesResponse200 | None:
    """ List webhook deliveries

     Returns a paginated list of webhook delivery attempts. Each delivery
    includes a nested `email` object with sender, recipient, and subject.

    Args:
        cursor (str | Unset):
        limit (int | Unset):  Default: 50.
        email_id (UUID | Unset):
        status (ListDeliveriesStatus | Unset):
        date_from (datetime.datetime | Unset):
        date_to (datetime.datetime | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ListDeliveriesResponse200
     """


    return (await asyncio_detailed(
        client=client,
cursor=cursor,
limit=limit,
email_id=email_id,
status=status,
date_from=date_from,
date_to=date_to,

    )).parsed
