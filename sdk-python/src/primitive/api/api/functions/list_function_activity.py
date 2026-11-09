from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.list_function_activity_response_200 import ListFunctionActivityResponse200
from ...models.list_function_activity_type import ListFunctionActivityType
from ...types import UNSET, Unset
from typing import cast
from uuid import UUID



def _get_kwargs(
    id: UUID,
    *,
    cursor: str | Unset = UNSET,
    limit: int | Unset = UNSET,
    delivery_id: str | Unset = UNSET,
    email_id: UUID | Unset = UNSET,
    type_: ListFunctionActivityType | Unset = UNSET,

) -> dict[str, Any]:
    

    

    params: dict[str, Any] = {}

    params["cursor"] = cursor

    params["limit"] = limit

    params["delivery_id"] = delivery_id

    json_email_id: str | Unset = UNSET
    if not isinstance(email_id, Unset):
        json_email_id = str(email_id)
    params["email_id"] = json_email_id

    json_type_: str | Unset = UNSET
    if not isinstance(type_, Unset):
        json_type_ = type_.value

    params["type"] = json_type_


    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}


    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/functions/{id}/activity".format(id=quote(str(id), safe=""),),
        "params": params,
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | ListFunctionActivityResponse200 | None:
    if response.status_code == 200:
        response_200 = ListFunctionActivityResponse200.from_dict(response.json())



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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | ListFunctionActivityResponse200]:
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
    cursor: str | Unset = UNSET,
    limit: int | Unset = UNSET,
    delivery_id: str | Unset = UNSET,
    email_id: UUID | Unset = UNSET,
    type_: ListFunctionActivityType | Unset = UNSET,

) -> Response[ErrorResponse | ListFunctionActivityResponse200]:
    """ List mail a function sent

     The sends and replies the function made, newest first, each linked to the delivery and email that
    triggered it. Filter by delivery, email or type.

    Args:
        id (UUID):
        cursor (str | Unset):
        limit (int | Unset):
        delivery_id (str | Unset):
        email_id (UUID | Unset):
        type_ (ListFunctionActivityType | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ListFunctionActivityResponse200]
     """


    kwargs = _get_kwargs(
        id=id,
cursor=cursor,
limit=limit,
delivery_id=delivery_id,
email_id=email_id,
type_=type_,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    cursor: str | Unset = UNSET,
    limit: int | Unset = UNSET,
    delivery_id: str | Unset = UNSET,
    email_id: UUID | Unset = UNSET,
    type_: ListFunctionActivityType | Unset = UNSET,

) -> ErrorResponse | ListFunctionActivityResponse200 | None:
    """ List mail a function sent

     The sends and replies the function made, newest first, each linked to the delivery and email that
    triggered it. Filter by delivery, email or type.

    Args:
        id (UUID):
        cursor (str | Unset):
        limit (int | Unset):
        delivery_id (str | Unset):
        email_id (UUID | Unset):
        type_ (ListFunctionActivityType | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ListFunctionActivityResponse200
     """


    return sync_detailed(
        id=id,
client=client,
cursor=cursor,
limit=limit,
delivery_id=delivery_id,
email_id=email_id,
type_=type_,

    ).parsed

async def asyncio_detailed(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    cursor: str | Unset = UNSET,
    limit: int | Unset = UNSET,
    delivery_id: str | Unset = UNSET,
    email_id: UUID | Unset = UNSET,
    type_: ListFunctionActivityType | Unset = UNSET,

) -> Response[ErrorResponse | ListFunctionActivityResponse200]:
    """ List mail a function sent

     The sends and replies the function made, newest first, each linked to the delivery and email that
    triggered it. Filter by delivery, email or type.

    Args:
        id (UUID):
        cursor (str | Unset):
        limit (int | Unset):
        delivery_id (str | Unset):
        email_id (UUID | Unset):
        type_ (ListFunctionActivityType | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ListFunctionActivityResponse200]
     """


    kwargs = _get_kwargs(
        id=id,
cursor=cursor,
limit=limit,
delivery_id=delivery_id,
email_id=email_id,
type_=type_,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    cursor: str | Unset = UNSET,
    limit: int | Unset = UNSET,
    delivery_id: str | Unset = UNSET,
    email_id: UUID | Unset = UNSET,
    type_: ListFunctionActivityType | Unset = UNSET,

) -> ErrorResponse | ListFunctionActivityResponse200 | None:
    """ List mail a function sent

     The sends and replies the function made, newest first, each linked to the delivery and email that
    triggered it. Filter by delivery, email or type.

    Args:
        id (UUID):
        cursor (str | Unset):
        limit (int | Unset):
        delivery_id (str | Unset):
        email_id (UUID | Unset):
        type_ (ListFunctionActivityType | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ListFunctionActivityResponse200
     """


    return (await asyncio_detailed(
        id=id,
client=client,
cursor=cursor,
limit=limit,
delivery_id=delivery_id,
email_id=email_id,
type_=type_,

    )).parsed
