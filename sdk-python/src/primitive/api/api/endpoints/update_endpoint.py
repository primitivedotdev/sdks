from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.update_endpoint_input import UpdateEndpointInput
from ...models.update_endpoint_response_200 import UpdateEndpointResponse200
from ...types import UNSET, Unset
from typing import cast
from uuid import UUID



def _get_kwargs(
    id: UUID,
    *,
    body: UpdateEndpointInput,
    primitive_step_up: str | Unset = UNSET,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}
    if not isinstance(primitive_step_up, Unset):
        headers["Primitive-Step-Up"] = primitive_step_up



    

    

    _kwargs: dict[str, Any] = {
        "method": "patch",
        "url": "/endpoints/{id}".format(id=quote(str(id), safe=""),),
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | UpdateEndpointResponse200 | None:
    if response.status_code == 200:
        response_200 = UpdateEndpointResponse200.from_dict(response.json())



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

    if response.status_code == 503:
        response_503 = ErrorResponse.from_dict(response.json())



        return response_503

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | UpdateEndpointResponse200]:
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
    body: UpdateEndpointInput,
    primitive_step_up: str | Unset = UNSET,

) -> Response[ErrorResponse | UpdateEndpointResponse200]:
    """ Update a webhook endpoint

     Updates an active webhook endpoint. Changing the URL keeps the endpoint: its id, recipient routes,
    signing secret, delivery history and any deliveries still owed to it stay with it, and owed
    deliveries go to the new URL. Another active endpoint at the new URL is refused.


    Pull destinations cannot be assigned a URL, function or recipient-routing domain. Existing endpoint
    deletion disconnects the destination; creating a new destination does not backfill historical
    events.

    Giving a webhook the organization does not own to a different key (owner_key_id), or a key's webhook
    back to the organization (owner_key_id null), turns it off unless the request also sets enabled: its
    URL was chosen under its previous owner. It then reads enabled false with disabled_reason
    owner_changed, and turning it on or giving it a new URL starts it again. A key that carries on for
    the owning key through rotation (its successor, at any depth up to 16 rotations) is not a different
    key: the webhook stays as it was, with the same signing secret. That does not hold when the owning
    key was made from a key a transfer moved or rotated away, or from one that has since been deleted:
    no successor carries on for it. The answer's warnings name each such change
    (turned_off_owner_changed, turned_on_new_url), so a client can say so.

    Args:
        id (UUID):
        primitive_step_up (str | Unset):
        body (UpdateEndpointInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | UpdateEndpointResponse200]
     """


    kwargs = _get_kwargs(
        id=id,
body=body,
primitive_step_up=primitive_step_up,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: UpdateEndpointInput,
    primitive_step_up: str | Unset = UNSET,

) -> ErrorResponse | UpdateEndpointResponse200 | None:
    """ Update a webhook endpoint

     Updates an active webhook endpoint. Changing the URL keeps the endpoint: its id, recipient routes,
    signing secret, delivery history and any deliveries still owed to it stay with it, and owed
    deliveries go to the new URL. Another active endpoint at the new URL is refused.


    Pull destinations cannot be assigned a URL, function or recipient-routing domain. Existing endpoint
    deletion disconnects the destination; creating a new destination does not backfill historical
    events.

    Giving a webhook the organization does not own to a different key (owner_key_id), or a key's webhook
    back to the organization (owner_key_id null), turns it off unless the request also sets enabled: its
    URL was chosen under its previous owner. It then reads enabled false with disabled_reason
    owner_changed, and turning it on or giving it a new URL starts it again. A key that carries on for
    the owning key through rotation (its successor, at any depth up to 16 rotations) is not a different
    key: the webhook stays as it was, with the same signing secret. That does not hold when the owning
    key was made from a key a transfer moved or rotated away, or from one that has since been deleted:
    no successor carries on for it. The answer's warnings name each such change
    (turned_off_owner_changed, turned_on_new_url), so a client can say so.

    Args:
        id (UUID):
        primitive_step_up (str | Unset):
        body (UpdateEndpointInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | UpdateEndpointResponse200
     """


    return sync_detailed(
        id=id,
client=client,
body=body,
primitive_step_up=primitive_step_up,

    ).parsed

async def asyncio_detailed(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: UpdateEndpointInput,
    primitive_step_up: str | Unset = UNSET,

) -> Response[ErrorResponse | UpdateEndpointResponse200]:
    """ Update a webhook endpoint

     Updates an active webhook endpoint. Changing the URL keeps the endpoint: its id, recipient routes,
    signing secret, delivery history and any deliveries still owed to it stay with it, and owed
    deliveries go to the new URL. Another active endpoint at the new URL is refused.


    Pull destinations cannot be assigned a URL, function or recipient-routing domain. Existing endpoint
    deletion disconnects the destination; creating a new destination does not backfill historical
    events.

    Giving a webhook the organization does not own to a different key (owner_key_id), or a key's webhook
    back to the organization (owner_key_id null), turns it off unless the request also sets enabled: its
    URL was chosen under its previous owner. It then reads enabled false with disabled_reason
    owner_changed, and turning it on or giving it a new URL starts it again. A key that carries on for
    the owning key through rotation (its successor, at any depth up to 16 rotations) is not a different
    key: the webhook stays as it was, with the same signing secret. That does not hold when the owning
    key was made from a key a transfer moved or rotated away, or from one that has since been deleted:
    no successor carries on for it. The answer's warnings name each such change
    (turned_off_owner_changed, turned_on_new_url), so a client can say so.

    Args:
        id (UUID):
        primitive_step_up (str | Unset):
        body (UpdateEndpointInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | UpdateEndpointResponse200]
     """


    kwargs = _get_kwargs(
        id=id,
body=body,
primitive_step_up=primitive_step_up,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: UpdateEndpointInput,
    primitive_step_up: str | Unset = UNSET,

) -> ErrorResponse | UpdateEndpointResponse200 | None:
    """ Update a webhook endpoint

     Updates an active webhook endpoint. Changing the URL keeps the endpoint: its id, recipient routes,
    signing secret, delivery history and any deliveries still owed to it stay with it, and owed
    deliveries go to the new URL. Another active endpoint at the new URL is refused.


    Pull destinations cannot be assigned a URL, function or recipient-routing domain. Existing endpoint
    deletion disconnects the destination; creating a new destination does not backfill historical
    events.

    Giving a webhook the organization does not own to a different key (owner_key_id), or a key's webhook
    back to the organization (owner_key_id null), turns it off unless the request also sets enabled: its
    URL was chosen under its previous owner. It then reads enabled false with disabled_reason
    owner_changed, and turning it on or giving it a new URL starts it again. A key that carries on for
    the owning key through rotation (its successor, at any depth up to 16 rotations) is not a different
    key: the webhook stays as it was, with the same signing secret. That does not hold when the owning
    key was made from a key a transfer moved or rotated away, or from one that has since been deleted:
    no successor carries on for it. The answer's warnings name each such change
    (turned_off_owner_changed, turned_on_new_url), so a client can say so.

    Args:
        id (UUID):
        primitive_step_up (str | Unset):
        body (UpdateEndpointInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | UpdateEndpointResponse200
     """


    return (await asyncio_detailed(
        id=id,
client=client,
body=body,
primitive_step_up=primitive_step_up,

    )).parsed
