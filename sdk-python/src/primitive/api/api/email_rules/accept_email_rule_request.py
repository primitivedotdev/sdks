from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.accept_email_rule_request_request import AcceptEmailRuleRequestRequest
from ...models.accept_email_rule_request_response_201 import AcceptEmailRuleRequestResponse201
from ...models.error_response import ErrorResponse
from ...types import UNSET, Unset
from typing import cast
from uuid import UUID



def _get_kwargs(
    id: UUID,
    *,
    body: AcceptEmailRuleRequestRequest | Unset = UNSET,
    idempotency_key: str | Unset = UNSET,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}
    if not isinstance(idempotency_key, Unset):
        headers["Idempotency-Key"] = idempotency_key



    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/email-rule-requests/{id}/accept".format(id=quote(str(id), safe=""),),
    }

    
    if not isinstance(body, Unset):
        _kwargs["json"] = body.to_dict()
        headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> AcceptEmailRuleRequestResponse201 | ErrorResponse | None:
    if response.status_code == 201:
        response_201 = AcceptEmailRuleRequestResponse201.from_dict(response.json())



        return response_201

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

    if response.status_code == 503:
        response_503 = ErrorResponse.from_dict(response.json())



        return response_503

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[AcceptEmailRuleRequestResponse201 | ErrorResponse]:
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
    body: AcceptEmailRuleRequestRequest | Unset = UNSET,
    idempotency_key: str | Unset = UNSET,

) -> Response[AcceptEmailRuleRequestResponse201 | ErrorResponse]:
    """ Accept a rule request

     Writes the rule as yours, over your own mailboxes only, turns it on, and shares what it matches from
    now on with the member who asked: each email in full with its attachments, but never raw. It does
    not go back through mail already received. Send no body to accept it as asked, or change it first
    with english and tree together (and an explanation, or the server writes one). Because this gives
    your mail to someone else, it is limited to the dashboard and the Primitive CLI: other OAuth apps
    and agent tokens are refused. Before accepting, test it on your mail: pass the request's tree to
    POST /v1/email-rules/test. To try it on an email that has not arrived, pass the request's tree to
    POST /v1/email-rules/test-sample with one you make up, or have look-alikes written (POST /v1/email-
    rules/look-alikes with request_id); neither stores anything. expectation_samples are kept on the
    rule it writes. Accepting also needs mail:share_own. Needs mail:read, a member's own credential with
    their full access (not an API key, agent key or narrowed token), and the email rules feature.

    Args:
        id (UUID):
        idempotency_key (str | Unset):
        body (AcceptEmailRuleRequestRequest | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[AcceptEmailRuleRequestResponse201 | ErrorResponse]
     """


    kwargs = _get_kwargs(
        id=id,
body=body,
idempotency_key=idempotency_key,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: AcceptEmailRuleRequestRequest | Unset = UNSET,
    idempotency_key: str | Unset = UNSET,

) -> AcceptEmailRuleRequestResponse201 | ErrorResponse | None:
    """ Accept a rule request

     Writes the rule as yours, over your own mailboxes only, turns it on, and shares what it matches from
    now on with the member who asked: each email in full with its attachments, but never raw. It does
    not go back through mail already received. Send no body to accept it as asked, or change it first
    with english and tree together (and an explanation, or the server writes one). Because this gives
    your mail to someone else, it is limited to the dashboard and the Primitive CLI: other OAuth apps
    and agent tokens are refused. Before accepting, test it on your mail: pass the request's tree to
    POST /v1/email-rules/test. To try it on an email that has not arrived, pass the request's tree to
    POST /v1/email-rules/test-sample with one you make up, or have look-alikes written (POST /v1/email-
    rules/look-alikes with request_id); neither stores anything. expectation_samples are kept on the
    rule it writes. Accepting also needs mail:share_own. Needs mail:read, a member's own credential with
    their full access (not an API key, agent key or narrowed token), and the email rules feature.

    Args:
        id (UUID):
        idempotency_key (str | Unset):
        body (AcceptEmailRuleRequestRequest | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        AcceptEmailRuleRequestResponse201 | ErrorResponse
     """


    return sync_detailed(
        id=id,
client=client,
body=body,
idempotency_key=idempotency_key,

    ).parsed

async def asyncio_detailed(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: AcceptEmailRuleRequestRequest | Unset = UNSET,
    idempotency_key: str | Unset = UNSET,

) -> Response[AcceptEmailRuleRequestResponse201 | ErrorResponse]:
    """ Accept a rule request

     Writes the rule as yours, over your own mailboxes only, turns it on, and shares what it matches from
    now on with the member who asked: each email in full with its attachments, but never raw. It does
    not go back through mail already received. Send no body to accept it as asked, or change it first
    with english and tree together (and an explanation, or the server writes one). Because this gives
    your mail to someone else, it is limited to the dashboard and the Primitive CLI: other OAuth apps
    and agent tokens are refused. Before accepting, test it on your mail: pass the request's tree to
    POST /v1/email-rules/test. To try it on an email that has not arrived, pass the request's tree to
    POST /v1/email-rules/test-sample with one you make up, or have look-alikes written (POST /v1/email-
    rules/look-alikes with request_id); neither stores anything. expectation_samples are kept on the
    rule it writes. Accepting also needs mail:share_own. Needs mail:read, a member's own credential with
    their full access (not an API key, agent key or narrowed token), and the email rules feature.

    Args:
        id (UUID):
        idempotency_key (str | Unset):
        body (AcceptEmailRuleRequestRequest | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[AcceptEmailRuleRequestResponse201 | ErrorResponse]
     """


    kwargs = _get_kwargs(
        id=id,
body=body,
idempotency_key=idempotency_key,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    id: UUID,
    *,
    client: AuthenticatedClient | Client,
    body: AcceptEmailRuleRequestRequest | Unset = UNSET,
    idempotency_key: str | Unset = UNSET,

) -> AcceptEmailRuleRequestResponse201 | ErrorResponse | None:
    """ Accept a rule request

     Writes the rule as yours, over your own mailboxes only, turns it on, and shares what it matches from
    now on with the member who asked: each email in full with its attachments, but never raw. It does
    not go back through mail already received. Send no body to accept it as asked, or change it first
    with english and tree together (and an explanation, or the server writes one). Because this gives
    your mail to someone else, it is limited to the dashboard and the Primitive CLI: other OAuth apps
    and agent tokens are refused. Before accepting, test it on your mail: pass the request's tree to
    POST /v1/email-rules/test. To try it on an email that has not arrived, pass the request's tree to
    POST /v1/email-rules/test-sample with one you make up, or have look-alikes written (POST /v1/email-
    rules/look-alikes with request_id); neither stores anything. expectation_samples are kept on the
    rule it writes. Accepting also needs mail:share_own. Needs mail:read, a member's own credential with
    their full access (not an API key, agent key or narrowed token), and the email rules feature.

    Args:
        id (UUID):
        idempotency_key (str | Unset):
        body (AcceptEmailRuleRequestRequest | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        AcceptEmailRuleRequestResponse201 | ErrorResponse
     """


    return (await asyncio_detailed(
        id=id,
client=client,
body=body,
idempotency_key=idempotency_key,

    )).parsed
