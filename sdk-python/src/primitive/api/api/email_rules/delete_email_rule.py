from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.delete_email_rule_response_200 import DeleteEmailRuleResponse200
from ...models.error_response import ErrorResponse
from typing import cast
from uuid import UUID



def _get_kwargs(
    id: UUID,

) -> dict[str, Any]:
    

    

    

    _kwargs: dict[str, Any] = {
        "method": "delete",
        "url": "/email-rules/{id}".format(id=quote(str(id), safe=""),),
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> DeleteEmailRuleResponse200 | ErrorResponse | None:
    if response.status_code == 200:
        response_200 = DeleteEmailRuleResponse200.from_dict(response.json())



        return response_200

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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[DeleteEmailRuleResponse200 | ErrorResponse]:
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

) -> Response[DeleteEmailRuleResponse200 | ErrorResponse]:
    """ Delete a rule

     Deletes a rule with its versions, its decisions and the access it granted. A share of it ends
    (end_reason rule_deleted), and the member who shared can still list what it handed over. The answer
    lists the shares it ended (ended_shares) and the unrevoked keys that still list it, which now read
    nothing through it (keys, other_keys; left out when they could not be read). The author or a reader
    of all the organization's mail may delete it; while it is shared, only the author or someone who
    manages members from the dashboard. Needs mail:read, a member's own credential with their full
    access (not an API key, agent key or narrowed token), and the email rules feature.

    Args:
        id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[DeleteEmailRuleResponse200 | ErrorResponse]
     """


    kwargs = _get_kwargs(
        id=id,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,

) -> DeleteEmailRuleResponse200 | ErrorResponse | None:
    """ Delete a rule

     Deletes a rule with its versions, its decisions and the access it granted. A share of it ends
    (end_reason rule_deleted), and the member who shared can still list what it handed over. The answer
    lists the shares it ended (ended_shares) and the unrevoked keys that still list it, which now read
    nothing through it (keys, other_keys; left out when they could not be read). The author or a reader
    of all the organization's mail may delete it; while it is shared, only the author or someone who
    manages members from the dashboard. Needs mail:read, a member's own credential with their full
    access (not an API key, agent key or narrowed token), and the email rules feature.

    Args:
        id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        DeleteEmailRuleResponse200 | ErrorResponse
     """


    return sync_detailed(
        id=id,
client=client,

    ).parsed

async def asyncio_detailed(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,

) -> Response[DeleteEmailRuleResponse200 | ErrorResponse]:
    """ Delete a rule

     Deletes a rule with its versions, its decisions and the access it granted. A share of it ends
    (end_reason rule_deleted), and the member who shared can still list what it handed over. The answer
    lists the shares it ended (ended_shares) and the unrevoked keys that still list it, which now read
    nothing through it (keys, other_keys; left out when they could not be read). The author or a reader
    of all the organization's mail may delete it; while it is shared, only the author or someone who
    manages members from the dashboard. Needs mail:read, a member's own credential with their full
    access (not an API key, agent key or narrowed token), and the email rules feature.

    Args:
        id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[DeleteEmailRuleResponse200 | ErrorResponse]
     """


    kwargs = _get_kwargs(
        id=id,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,

) -> DeleteEmailRuleResponse200 | ErrorResponse | None:
    """ Delete a rule

     Deletes a rule with its versions, its decisions and the access it granted. A share of it ends
    (end_reason rule_deleted), and the member who shared can still list what it handed over. The answer
    lists the shares it ended (ended_shares) and the unrevoked keys that still list it, which now read
    nothing through it (keys, other_keys; left out when they could not be read). The author or a reader
    of all the organization's mail may delete it; while it is shared, only the author or someone who
    manages members from the dashboard. Needs mail:read, a member's own credential with their full
    access (not an API key, agent key or narrowed token), and the email rules feature.

    Args:
        id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        DeleteEmailRuleResponse200 | ErrorResponse
     """


    return (await asyncio_detailed(
        id=id,
client=client,

    )).parsed
