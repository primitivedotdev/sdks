from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.test_email_rule_on_sample_request import TestEmailRuleOnSampleRequest
from ...models.test_email_rule_on_sample_response_200 import TestEmailRuleOnSampleResponse200
from ...types import UNSET, Unset
from typing import cast



def _get_kwargs(
    *,
    body: TestEmailRuleOnSampleRequest,
    idempotency_key: str | Unset = UNSET,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}
    if not isinstance(idempotency_key, Unset):
        headers["Idempotency-Key"] = idempotency_key



    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/email-rules/test-sample",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | TestEmailRuleOnSampleResponse200 | None:
    if response.status_code == 200:
        response_200 = TestEmailRuleOnSampleResponse200.from_dict(response.json())



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

    if response.status_code == 429:
        response_429 = ErrorResponse.from_dict(response.json())



        return response_429

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | TestEmailRuleOnSampleResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: TestEmailRuleOnSampleRequest,
    idempotency_key: str | Unset = UNSET,

) -> Response[ErrorResponse | TestEmailRuleOnSampleResponse200]:
    """ Test a rule against a made-up email

     Reports what a rule would decide for an email you describe (sender, recipients, subject, plain text,
    attachment types and file names; optionally automated, from a mailing list, and a spam score),
    classified and decided as received mail would be. A rule reading a spam score you gave none for
    decides on none (unset_columns). Nothing is stored. Test an unsaved tree or a saved rule by rule_id.
    The answer includes what the classifier read. Needs mail:read, the email rules feature, and a
    member's own full-access credential (no API key, agent key or narrowed token).

    Args:
        idempotency_key (str | Unset):
        body (TestEmailRuleOnSampleRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | TestEmailRuleOnSampleResponse200]
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
    body: TestEmailRuleOnSampleRequest,
    idempotency_key: str | Unset = UNSET,

) -> ErrorResponse | TestEmailRuleOnSampleResponse200 | None:
    """ Test a rule against a made-up email

     Reports what a rule would decide for an email you describe (sender, recipients, subject, plain text,
    attachment types and file names; optionally automated, from a mailing list, and a spam score),
    classified and decided as received mail would be. A rule reading a spam score you gave none for
    decides on none (unset_columns). Nothing is stored. Test an unsaved tree or a saved rule by rule_id.
    The answer includes what the classifier read. Needs mail:read, the email rules feature, and a
    member's own full-access credential (no API key, agent key or narrowed token).

    Args:
        idempotency_key (str | Unset):
        body (TestEmailRuleOnSampleRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | TestEmailRuleOnSampleResponse200
     """


    return sync_detailed(
        client=client,
body=body,
idempotency_key=idempotency_key,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: TestEmailRuleOnSampleRequest,
    idempotency_key: str | Unset = UNSET,

) -> Response[ErrorResponse | TestEmailRuleOnSampleResponse200]:
    """ Test a rule against a made-up email

     Reports what a rule would decide for an email you describe (sender, recipients, subject, plain text,
    attachment types and file names; optionally automated, from a mailing list, and a spam score),
    classified and decided as received mail would be. A rule reading a spam score you gave none for
    decides on none (unset_columns). Nothing is stored. Test an unsaved tree or a saved rule by rule_id.
    The answer includes what the classifier read. Needs mail:read, the email rules feature, and a
    member's own full-access credential (no API key, agent key or narrowed token).

    Args:
        idempotency_key (str | Unset):
        body (TestEmailRuleOnSampleRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | TestEmailRuleOnSampleResponse200]
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
    body: TestEmailRuleOnSampleRequest,
    idempotency_key: str | Unset = UNSET,

) -> ErrorResponse | TestEmailRuleOnSampleResponse200 | None:
    """ Test a rule against a made-up email

     Reports what a rule would decide for an email you describe (sender, recipients, subject, plain text,
    attachment types and file names; optionally automated, from a mailing list, and a spam score),
    classified and decided as received mail would be. A rule reading a spam score you gave none for
    decides on none (unset_columns). Nothing is stored. Test an unsaved tree or a saved rule by rule_id.
    The answer includes what the classifier read. Needs mail:read, the email rules feature, and a
    member's own full-access credential (no API key, agent key or narrowed token).

    Args:
        idempotency_key (str | Unset):
        body (TestEmailRuleOnSampleRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | TestEmailRuleOnSampleResponse200
     """


    return (await asyncio_detailed(
        client=client,
body=body,
idempotency_key=idempotency_key,

    )).parsed
