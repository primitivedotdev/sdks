from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.repeat_stop_input import RepeatStopInput
from ...models.stop_repeating_send_response_200 import StopRepeatingSendResponse200
from ...types import UNSET, Unset
from typing import cast
from uuid import UUID



def _get_kwargs(
    id: UUID,
    *,
    body: RepeatStopInput | Unset = UNSET,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/emails/{id}/repeat-stop".format(id=quote(str(id), safe=""),),
    }

    
    if not isinstance(body, Unset):
        _kwargs["json"] = body.to_dict()
        headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | StopRepeatingSendResponse200 | None:
    if response.status_code == 200:
        response_200 = StopRepeatingSendResponse200.from_dict(response.json())



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

    if response.status_code == 422:
        response_422 = ErrorResponse.from_dict(response.json())



        return response_422

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | StopRepeatingSendResponse200]:
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
    body: RepeatStopInput | Unset = UNSET,

) -> Response[ErrorResponse | StopRepeatingSendResponse200]:
    """ Stop the repeat behind a received message

     Called by the recipient of a repeating send: the connected agent's own
    credential for an agent address, or the signed-in member whose personal
    address it is. `id` is the caller's received copy of any message of the
    repeat. Stops the repeat when it lets the recipient stop it, cancels the
    pending message, and replies once in the thread with a
    `repeat.stop/1` interaction so the sender sees it. A repeat call returns
    the same result without a second reply.

    Args:
        id (UUID):
        body (RepeatStopInput | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | StopRepeatingSendResponse200]
     """


    kwargs = _get_kwargs(
        id=id,
body=body,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: RepeatStopInput | Unset = UNSET,

) -> ErrorResponse | StopRepeatingSendResponse200 | None:
    """ Stop the repeat behind a received message

     Called by the recipient of a repeating send: the connected agent's own
    credential for an agent address, or the signed-in member whose personal
    address it is. `id` is the caller's received copy of any message of the
    repeat. Stops the repeat when it lets the recipient stop it, cancels the
    pending message, and replies once in the thread with a
    `repeat.stop/1` interaction so the sender sees it. A repeat call returns
    the same result without a second reply.

    Args:
        id (UUID):
        body (RepeatStopInput | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | StopRepeatingSendResponse200
     """


    return sync_detailed(
        id=id,
client=client,
body=body,

    ).parsed

async def asyncio_detailed(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: RepeatStopInput | Unset = UNSET,

) -> Response[ErrorResponse | StopRepeatingSendResponse200]:
    """ Stop the repeat behind a received message

     Called by the recipient of a repeating send: the connected agent's own
    credential for an agent address, or the signed-in member whose personal
    address it is. `id` is the caller's received copy of any message of the
    repeat. Stops the repeat when it lets the recipient stop it, cancels the
    pending message, and replies once in the thread with a
    `repeat.stop/1` interaction so the sender sees it. A repeat call returns
    the same result without a second reply.

    Args:
        id (UUID):
        body (RepeatStopInput | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | StopRepeatingSendResponse200]
     """


    kwargs = _get_kwargs(
        id=id,
body=body,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: RepeatStopInput | Unset = UNSET,

) -> ErrorResponse | StopRepeatingSendResponse200 | None:
    """ Stop the repeat behind a received message

     Called by the recipient of a repeating send: the connected agent's own
    credential for an agent address, or the signed-in member whose personal
    address it is. `id` is the caller's received copy of any message of the
    repeat. Stops the repeat when it lets the recipient stop it, cancels the
    pending message, and replies once in the thread with a
    `repeat.stop/1` interaction so the sender sees it. A repeat call returns
    the same result without a second reply.

    Args:
        id (UUID):
        body (RepeatStopInput | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | StopRepeatingSendResponse200
     """


    return (await asyncio_detailed(
        id=id,
client=client,
body=body,

    )).parsed
