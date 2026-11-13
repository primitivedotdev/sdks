from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.get_email_rule_vocabulary_response_200 import GetEmailRuleVocabularyResponse200
from typing import cast



def _get_kwargs(
    
) -> dict[str, Any]:
    

    

    

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/email-rules/vocabulary",
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | GetEmailRuleVocabularyResponse200 | None:
    if response.status_code == 200:
        response_200 = GetEmailRuleVocabularyResponse200.from_dict(response.json())



        return response_200

    if response.status_code == 401:
        response_401 = ErrorResponse.from_dict(response.json())



        return response_401

    if response.status_code == 403:
        response_403 = ErrorResponse.from_dict(response.json())



        return response_403

    if response.status_code == 429:
        response_429 = ErrorResponse.from_dict(response.json())



        return response_429

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | GetEmailRuleVocabularyResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,

) -> Response[ErrorResponse | GetEmailRuleVocabularyResponse200]:
    """ Read the column catalog

     What a rule tree you write yourself can say: each column of the current vocabulary with its type,
    source, meaning, operators and the value each takes, options, and whether it takes min_confidence;
    and the tree's limits, its stored size included. Built from the checks a saved or tested tree must
    pass. A tree is {version: tree_version, vocabulary: version, when, questions}. Needs mail:read, the
    email rules feature, and a member's own full-access credential (no API key, agent key or narrowed
    token).

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | GetEmailRuleVocabularyResponse200]
     """


    kwargs = _get_kwargs(
        
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    *,
    client: AuthenticatedClient | Client,

) -> ErrorResponse | GetEmailRuleVocabularyResponse200 | None:
    """ Read the column catalog

     What a rule tree you write yourself can say: each column of the current vocabulary with its type,
    source, meaning, operators and the value each takes, options, and whether it takes min_confidence;
    and the tree's limits, its stored size included. Built from the checks a saved or tested tree must
    pass. A tree is {version: tree_version, vocabulary: version, when, questions}. Needs mail:read, the
    email rules feature, and a member's own full-access credential (no API key, agent key or narrowed
    token).

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | GetEmailRuleVocabularyResponse200
     """


    return sync_detailed(
        client=client,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,

) -> Response[ErrorResponse | GetEmailRuleVocabularyResponse200]:
    """ Read the column catalog

     What a rule tree you write yourself can say: each column of the current vocabulary with its type,
    source, meaning, operators and the value each takes, options, and whether it takes min_confidence;
    and the tree's limits, its stored size included. Built from the checks a saved or tested tree must
    pass. A tree is {version: tree_version, vocabulary: version, when, questions}. Needs mail:read, the
    email rules feature, and a member's own full-access credential (no API key, agent key or narrowed
    token).

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | GetEmailRuleVocabularyResponse200]
     """


    kwargs = _get_kwargs(
        
    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    *,
    client: AuthenticatedClient | Client,

) -> ErrorResponse | GetEmailRuleVocabularyResponse200 | None:
    """ Read the column catalog

     What a rule tree you write yourself can say: each column of the current vocabulary with its type,
    source, meaning, operators and the value each takes, options, and whether it takes min_confidence;
    and the tree's limits, its stored size included. Built from the checks a saved or tested tree must
    pass. A tree is {version: tree_version, vocabulary: version, when, questions}. Needs mail:read, the
    email rules feature, and a member's own full-access credential (no API key, agent key or narrowed
    token).

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | GetEmailRuleVocabularyResponse200
     """


    return (await asyncio_detailed(
        client=client,

    )).parsed
