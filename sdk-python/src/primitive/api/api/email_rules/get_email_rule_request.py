from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.get_email_rule_request_response_200 import GetEmailRuleRequestResponse200
from typing import cast
from uuid import UUID



def _get_kwargs(
    id: UUID,

) -> dict[str, Any]:
    

    

    

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/email-rule-requests/{id}".format(id=quote(str(id), safe=""),),
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | GetEmailRuleRequestResponse200 | None:
    if response.status_code == 200:
        response_200 = GetEmailRuleRequestResponse200.from_dict(response.json())



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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | GetEmailRuleRequestResponse200]:
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

) -> Response[ErrorResponse | GetEmailRuleRequestResponse200]:
    """ Read a rule request

     A rule request: the rule as proposed, who made it and to whom, and whether each of them is still a
    member. A request is visible to the member who made it, the member it was made to, and the
    organization's owners and admins. If you are the member asked, you can try the rule as proposed
    before answering: pass the request's tree to POST /v1/email-rules/test to test it on mail you have
    received. To try it on an email that has not arrived, pass the request's tree to POST /v1/email-
    rules/test-sample with one you make up, or have look-alikes written (POST /v1/email-rules/look-
    alikes with request_id); neither stores anything. Needs mail:read, the email rules feature, and a
    member's own full-access credential (no API key, agent key or narrowed token).

    Args:
        id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | GetEmailRuleRequestResponse200]
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

) -> ErrorResponse | GetEmailRuleRequestResponse200 | None:
    """ Read a rule request

     A rule request: the rule as proposed, who made it and to whom, and whether each of them is still a
    member. A request is visible to the member who made it, the member it was made to, and the
    organization's owners and admins. If you are the member asked, you can try the rule as proposed
    before answering: pass the request's tree to POST /v1/email-rules/test to test it on mail you have
    received. To try it on an email that has not arrived, pass the request's tree to POST /v1/email-
    rules/test-sample with one you make up, or have look-alikes written (POST /v1/email-rules/look-
    alikes with request_id); neither stores anything. Needs mail:read, the email rules feature, and a
    member's own full-access credential (no API key, agent key or narrowed token).

    Args:
        id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | GetEmailRuleRequestResponse200
     """


    return sync_detailed(
        id=id,
client=client,

    ).parsed

async def asyncio_detailed(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,

) -> Response[ErrorResponse | GetEmailRuleRequestResponse200]:
    """ Read a rule request

     A rule request: the rule as proposed, who made it and to whom, and whether each of them is still a
    member. A request is visible to the member who made it, the member it was made to, and the
    organization's owners and admins. If you are the member asked, you can try the rule as proposed
    before answering: pass the request's tree to POST /v1/email-rules/test to test it on mail you have
    received. To try it on an email that has not arrived, pass the request's tree to POST /v1/email-
    rules/test-sample with one you make up, or have look-alikes written (POST /v1/email-rules/look-
    alikes with request_id); neither stores anything. Needs mail:read, the email rules feature, and a
    member's own full-access credential (no API key, agent key or narrowed token).

    Args:
        id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | GetEmailRuleRequestResponse200]
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

) -> ErrorResponse | GetEmailRuleRequestResponse200 | None:
    """ Read a rule request

     A rule request: the rule as proposed, who made it and to whom, and whether each of them is still a
    member. A request is visible to the member who made it, the member it was made to, and the
    organization's owners and admins. If you are the member asked, you can try the rule as proposed
    before answering: pass the request's tree to POST /v1/email-rules/test to test it on mail you have
    received. To try it on an email that has not arrived, pass the request's tree to POST /v1/email-
    rules/test-sample with one you make up, or have look-alikes written (POST /v1/email-rules/look-
    alikes with request_id); neither stores anything. Needs mail:read, the email rules feature, and a
    member's own full-access credential (no API key, agent key or narrowed token).

    Args:
        id (UUID):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | GetEmailRuleRequestResponse200
     """


    return (await asyncio_detailed(
        id=id,
client=client,

    )).parsed
