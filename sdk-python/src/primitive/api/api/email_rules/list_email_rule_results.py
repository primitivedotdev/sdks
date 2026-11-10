from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.list_email_rule_results_response_200 import ListEmailRuleResultsResponse200
from typing import cast
from uuid import UUID



def _get_kwargs(
    id: UUID,

) -> dict[str, Any]:
    

    

    

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/emails/{id}/rule-results".format(id=quote(str(id), safe=""),),
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | ListEmailRuleResultsResponse200 | None:
    if response.status_code == 200:
        response_200 = ListEmailRuleResultsResponse200.from_dict(response.json())



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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | ListEmailRuleResultsResponse200]:
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

) -> Response[ErrorResponse | ListEmailRuleResultsResponse200]:
    """ List every rule's result on an email

     Every rule you can see and what it decided about this email (matched, not matched, or not run, with
    what is known), in the words of the version that decided. A matched do_not_share rule keeps rules
    from sharing the email while it is active; what was shared before then stays shared. Only a caller
    who can read the email gets an answer. classification is what the classifier read from the email,
    every fact as rule conditions read it, so you can see why a rule did or did not match. At most 50
    rules are listed, those with a result first; hidden counts the rest. Needs mail:read, a member's own
    credential with their full access (not an API key, agent key or narrowed token), and the email rules
    feature.

    Args:
        id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ListEmailRuleResultsResponse200]
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

) -> ErrorResponse | ListEmailRuleResultsResponse200 | None:
    """ List every rule's result on an email

     Every rule you can see and what it decided about this email (matched, not matched, or not run, with
    what is known), in the words of the version that decided. A matched do_not_share rule keeps rules
    from sharing the email while it is active; what was shared before then stays shared. Only a caller
    who can read the email gets an answer. classification is what the classifier read from the email,
    every fact as rule conditions read it, so you can see why a rule did or did not match. At most 50
    rules are listed, those with a result first; hidden counts the rest. Needs mail:read, a member's own
    credential with their full access (not an API key, agent key or narrowed token), and the email rules
    feature.

    Args:
        id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ListEmailRuleResultsResponse200
     """


    return sync_detailed(
        id=id,
client=client,

    ).parsed

async def asyncio_detailed(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,

) -> Response[ErrorResponse | ListEmailRuleResultsResponse200]:
    """ List every rule's result on an email

     Every rule you can see and what it decided about this email (matched, not matched, or not run, with
    what is known), in the words of the version that decided. A matched do_not_share rule keeps rules
    from sharing the email while it is active; what was shared before then stays shared. Only a caller
    who can read the email gets an answer. classification is what the classifier read from the email,
    every fact as rule conditions read it, so you can see why a rule did or did not match. At most 50
    rules are listed, those with a result first; hidden counts the rest. Needs mail:read, a member's own
    credential with their full access (not an API key, agent key or narrowed token), and the email rules
    feature.

    Args:
        id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ListEmailRuleResultsResponse200]
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

) -> ErrorResponse | ListEmailRuleResultsResponse200 | None:
    """ List every rule's result on an email

     Every rule you can see and what it decided about this email (matched, not matched, or not run, with
    what is known), in the words of the version that decided. A matched do_not_share rule keeps rules
    from sharing the email while it is active; what was shared before then stays shared. Only a caller
    who can read the email gets an answer. classification is what the classifier read from the email,
    every fact as rule conditions read it, so you can see why a rule did or did not match. At most 50
    rules are listed, those with a result first; hidden counts the rest. Needs mail:read, a member's own
    credential with their full access (not an API key, agent key or narrowed token), and the email rules
    feature.

    Args:
        id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ListEmailRuleResultsResponse200
     """


    return (await asyncio_detailed(
        id=id,
client=client,

    )).parsed
