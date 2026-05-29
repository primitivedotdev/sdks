from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.semantic_search_input import SemanticSearchInput
from ...models.semantic_search_response_200 import SemanticSearchResponse200
from typing import cast



def _get_kwargs(
    *,
    body: SemanticSearchInput,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/semantic-search",
    }

    _kwargs["json"] = body.to_dict()


    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | SemanticSearchResponse200 | None:
    if response.status_code == 200:
        response_200 = SemanticSearchResponse200.from_dict(response.json())



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

    if response.status_code == 429:
        response_429 = ErrorResponse.from_dict(response.json())



        return response_429

    if response.status_code == 500:
        response_500 = ErrorResponse.from_dict(response.json())



        return response_500

    if response.status_code == 503:
        response_503 = ErrorResponse.from_dict(response.json())



        return response_503

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | SemanticSearchResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: SemanticSearchInput,

) -> Response[ErrorResponse | SemanticSearchResponse200]:
    """ Semantic search across received and sent mail

     Ranked search across both received and sent mail. The `mode`
    field selects the ranking strategy:

    - `keyword`: lexical full-text matching only (no embeddings).
    - `semantic`: meaning-based matching using vector embeddings.
    - `hybrid` (default): blends the semantic and keyword signals.

    Results are ordered by a relevance `score`. Every row reports the
    fields it matched (`matched_fields`), a match-centered excerpt per
    field (`snippets`), and a `score_breakdown` whose components account
    for the `score`. Page through results by passing the prior
    response's `meta.cursor` back as `cursor`.

    Requires the Pro plan and the `semantic_search_enabled`
    entitlement; callers without them receive `403`.

    Host routing: this operation is served only by the search host
    (`https://api.primitive.dev/v1`). The typed SDKs route it there
    automatically.

    Args:
        body (SemanticSearchInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | SemanticSearchResponse200]
     """


    kwargs = _get_kwargs(
        body=body,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    *,
    client: AuthenticatedClient | Client,
    body: SemanticSearchInput,

) -> ErrorResponse | SemanticSearchResponse200 | None:
    """ Semantic search across received and sent mail

     Ranked search across both received and sent mail. The `mode`
    field selects the ranking strategy:

    - `keyword`: lexical full-text matching only (no embeddings).
    - `semantic`: meaning-based matching using vector embeddings.
    - `hybrid` (default): blends the semantic and keyword signals.

    Results are ordered by a relevance `score`. Every row reports the
    fields it matched (`matched_fields`), a match-centered excerpt per
    field (`snippets`), and a `score_breakdown` whose components account
    for the `score`. Page through results by passing the prior
    response's `meta.cursor` back as `cursor`.

    Requires the Pro plan and the `semantic_search_enabled`
    entitlement; callers without them receive `403`.

    Host routing: this operation is served only by the search host
    (`https://api.primitive.dev/v1`). The typed SDKs route it there
    automatically.

    Args:
        body (SemanticSearchInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | SemanticSearchResponse200
     """


    return sync_detailed(
        client=client,
body=body,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: SemanticSearchInput,

) -> Response[ErrorResponse | SemanticSearchResponse200]:
    """ Semantic search across received and sent mail

     Ranked search across both received and sent mail. The `mode`
    field selects the ranking strategy:

    - `keyword`: lexical full-text matching only (no embeddings).
    - `semantic`: meaning-based matching using vector embeddings.
    - `hybrid` (default): blends the semantic and keyword signals.

    Results are ordered by a relevance `score`. Every row reports the
    fields it matched (`matched_fields`), a match-centered excerpt per
    field (`snippets`), and a `score_breakdown` whose components account
    for the `score`. Page through results by passing the prior
    response's `meta.cursor` back as `cursor`.

    Requires the Pro plan and the `semantic_search_enabled`
    entitlement; callers without them receive `403`.

    Host routing: this operation is served only by the search host
    (`https://api.primitive.dev/v1`). The typed SDKs route it there
    automatically.

    Args:
        body (SemanticSearchInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | SemanticSearchResponse200]
     """


    kwargs = _get_kwargs(
        body=body,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    body: SemanticSearchInput,

) -> ErrorResponse | SemanticSearchResponse200 | None:
    """ Semantic search across received and sent mail

     Ranked search across both received and sent mail. The `mode`
    field selects the ranking strategy:

    - `keyword`: lexical full-text matching only (no embeddings).
    - `semantic`: meaning-based matching using vector embeddings.
    - `hybrid` (default): blends the semantic and keyword signals.

    Results are ordered by a relevance `score`. Every row reports the
    fields it matched (`matched_fields`), a match-centered excerpt per
    field (`snippets`), and a `score_breakdown` whose components account
    for the `score`. Page through results by passing the prior
    response's `meta.cursor` back as `cursor`.

    Requires the Pro plan and the `semantic_search_enabled`
    entitlement; callers without them receive `403`.

    Host routing: this operation is served only by the search host
    (`https://api.primitive.dev/v1`). The typed SDKs route it there
    automatically.

    Args:
        body (SemanticSearchInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | SemanticSearchResponse200
     """


    return (await asyncio_detailed(
        client=client,
body=body,

    )).parsed
