from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.generate_look_alikes_request import GenerateLookAlikesRequest
from ...models.generate_look_alikes_response_200 import GenerateLookAlikesResponse200
from ...types import UNSET, Unset
from typing import cast



def _get_kwargs(
    *,
    body: GenerateLookAlikesRequest,
    idempotency_key: str | Unset = UNSET,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}
    if not isinstance(idempotency_key, Unset):
        headers["Idempotency-Key"] = idempotency_key



    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/email-rules/look-alikes",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | GenerateLookAlikesResponse200 | None:
    if response.status_code == 200:
        response_200 = GenerateLookAlikesResponse200.from_dict(response.json())



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

    if response.status_code == 422:
        response_422 = ErrorResponse.from_dict(response.json())



        return response_422

    if response.status_code == 429:
        response_429 = ErrorResponse.from_dict(response.json())



        return response_429

    if response.status_code == 503:
        response_503 = ErrorResponse.from_dict(response.json())



        return response_503

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | GenerateLookAlikesResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: GenerateLookAlikesRequest,
    idempotency_key: str | Unset = UNSET,

) -> Response[ErrorResponse | GenerateLookAlikesResponse200]:
    """ Write look-alike emails a rule should or should not match

     Writes made-up emails that come close to what a grant rule describes, and reports what the rule
    decides for each, as test-sample would. Most should not match (expected no_match): business near
    misses from its senders and topic (kind other: an all-clear, a reply with nothing new, a related
    document, another subject) and private mail (a personal medical bill, pay for named people, a
    personal purchase, personal banking or tax). By default a third, rounded down, are near cases it
    should match (expected match, kind other). failed means the rule decided one against expected.
    Nothing is stored and no mail is read. Keep them, with their expected, with add_expectation_samples,
    or for a request with the accept's expectation_samples. Limited to 20 an hour per member. Needs
    mail:read, a member's own credential with their full access (not an API key, agent key or narrowed
    token), and the email rules feature.

    Args:
        idempotency_key (str | Unset):
        body (GenerateLookAlikesRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | GenerateLookAlikesResponse200]
     """


    kwargs = _get_kwargs(
        body=body,
idempotency_key=idempotency_key,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    *,
    client: AuthenticatedClient | Client,
    body: GenerateLookAlikesRequest,
    idempotency_key: str | Unset = UNSET,

) -> ErrorResponse | GenerateLookAlikesResponse200 | None:
    """ Write look-alike emails a rule should or should not match

     Writes made-up emails that come close to what a grant rule describes, and reports what the rule
    decides for each, as test-sample would. Most should not match (expected no_match): business near
    misses from its senders and topic (kind other: an all-clear, a reply with nothing new, a related
    document, another subject) and private mail (a personal medical bill, pay for named people, a
    personal purchase, personal banking or tax). By default a third, rounded down, are near cases it
    should match (expected match, kind other). failed means the rule decided one against expected.
    Nothing is stored and no mail is read. Keep them, with their expected, with add_expectation_samples,
    or for a request with the accept's expectation_samples. Limited to 20 an hour per member. Needs
    mail:read, a member's own credential with their full access (not an API key, agent key or narrowed
    token), and the email rules feature.

    Args:
        idempotency_key (str | Unset):
        body (GenerateLookAlikesRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | GenerateLookAlikesResponse200
     """


    return sync_detailed(
        client=client,
body=body,
idempotency_key=idempotency_key,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: GenerateLookAlikesRequest,
    idempotency_key: str | Unset = UNSET,

) -> Response[ErrorResponse | GenerateLookAlikesResponse200]:
    """ Write look-alike emails a rule should or should not match

     Writes made-up emails that come close to what a grant rule describes, and reports what the rule
    decides for each, as test-sample would. Most should not match (expected no_match): business near
    misses from its senders and topic (kind other: an all-clear, a reply with nothing new, a related
    document, another subject) and private mail (a personal medical bill, pay for named people, a
    personal purchase, personal banking or tax). By default a third, rounded down, are near cases it
    should match (expected match, kind other). failed means the rule decided one against expected.
    Nothing is stored and no mail is read. Keep them, with their expected, with add_expectation_samples,
    or for a request with the accept's expectation_samples. Limited to 20 an hour per member. Needs
    mail:read, a member's own credential with their full access (not an API key, agent key or narrowed
    token), and the email rules feature.

    Args:
        idempotency_key (str | Unset):
        body (GenerateLookAlikesRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | GenerateLookAlikesResponse200]
     """


    kwargs = _get_kwargs(
        body=body,
idempotency_key=idempotency_key,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    body: GenerateLookAlikesRequest,
    idempotency_key: str | Unset = UNSET,

) -> ErrorResponse | GenerateLookAlikesResponse200 | None:
    """ Write look-alike emails a rule should or should not match

     Writes made-up emails that come close to what a grant rule describes, and reports what the rule
    decides for each, as test-sample would. Most should not match (expected no_match): business near
    misses from its senders and topic (kind other: an all-clear, a reply with nothing new, a related
    document, another subject) and private mail (a personal medical bill, pay for named people, a
    personal purchase, personal banking or tax). By default a third, rounded down, are near cases it
    should match (expected match, kind other). failed means the rule decided one against expected.
    Nothing is stored and no mail is read. Keep them, with their expected, with add_expectation_samples,
    or for a request with the accept's expectation_samples. Limited to 20 an hour per member. Needs
    mail:read, a member's own credential with their full access (not an API key, agent key or narrowed
    token), and the email rules feature.

    Args:
        idempotency_key (str | Unset):
        body (GenerateLookAlikesRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | GenerateLookAlikesResponse200
     """


    return (await asyncio_detailed(
        client=client,
body=body,
idempotency_key=idempotency_key,

    )).parsed
