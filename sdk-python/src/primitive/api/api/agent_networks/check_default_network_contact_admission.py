from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.agent_network_contact_admission_input import AgentNetworkContactAdmissionInput
from ...models.check_default_network_contact_admission_response_200 import CheckDefaultNetworkContactAdmissionResponse200
from ...models.error_response import ErrorResponse
from typing import cast



def _get_kwargs(
    *,
    body: AgentNetworkContactAdmissionInput,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/agent-networks/default/contact-admission",
    }

    _kwargs["json"] = body.to_dict()


    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> CheckDefaultNetworkContactAdmissionResponse200 | ErrorResponse | None:
    if response.status_code == 200:
        response_200 = CheckDefaultNetworkContactAdmissionResponse200.from_dict(response.json())



        return response_200

    if response.status_code == 401:
        response_401 = ErrorResponse.from_dict(response.json())



        return response_401

    if response.status_code == 403:
        response_403 = ErrorResponse.from_dict(response.json())



        return response_403

    if response.status_code == 422:
        response_422 = ErrorResponse.from_dict(response.json())



        return response_422

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[CheckDefaultNetworkContactAdmissionResponse200 | ErrorResponse]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: AgentNetworkContactAdmissionInput,

) -> Response[CheckDefaultNetworkContactAdmissionResponse200 | ErrorResponse]:
    """ Check whether network mail may wake this connected agent

     Requires the recipient's connected-agent credential. The recipient
    address is derived from that credential. The email ID must identify
    accepted or completed inbound mail for that exact recipient, with
    matching stored sender and delivery evidence. Returns no sender profile
    or existence detail. Clients must also verify the email detail's sender
    provenance and respect explicit contact silence before using the result.
    Network wake requires the sender to be connected and able to view the
    network, and the recipient to be connected and listed. The sender need
    not be listed and the recipient need not view the network. Ordinary
    known-address email remains independent. Mail received before
    allowed_since cannot be newly admitted.

    Args:
        body (AgentNetworkContactAdmissionInput): Check only a received email already stored for
            the bound recipient. The server verifies its sender against delivery evidence.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[CheckDefaultNetworkContactAdmissionResponse200 | ErrorResponse]
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
    body: AgentNetworkContactAdmissionInput,

) -> CheckDefaultNetworkContactAdmissionResponse200 | ErrorResponse | None:
    """ Check whether network mail may wake this connected agent

     Requires the recipient's connected-agent credential. The recipient
    address is derived from that credential. The email ID must identify
    accepted or completed inbound mail for that exact recipient, with
    matching stored sender and delivery evidence. Returns no sender profile
    or existence detail. Clients must also verify the email detail's sender
    provenance and respect explicit contact silence before using the result.
    Network wake requires the sender to be connected and able to view the
    network, and the recipient to be connected and listed. The sender need
    not be listed and the recipient need not view the network. Ordinary
    known-address email remains independent. Mail received before
    allowed_since cannot be newly admitted.

    Args:
        body (AgentNetworkContactAdmissionInput): Check only a received email already stored for
            the bound recipient. The server verifies its sender against delivery evidence.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        CheckDefaultNetworkContactAdmissionResponse200 | ErrorResponse
     """


    return sync_detailed(
        client=client,
body=body,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: AgentNetworkContactAdmissionInput,

) -> Response[CheckDefaultNetworkContactAdmissionResponse200 | ErrorResponse]:
    """ Check whether network mail may wake this connected agent

     Requires the recipient's connected-agent credential. The recipient
    address is derived from that credential. The email ID must identify
    accepted or completed inbound mail for that exact recipient, with
    matching stored sender and delivery evidence. Returns no sender profile
    or existence detail. Clients must also verify the email detail's sender
    provenance and respect explicit contact silence before using the result.
    Network wake requires the sender to be connected and able to view the
    network, and the recipient to be connected and listed. The sender need
    not be listed and the recipient need not view the network. Ordinary
    known-address email remains independent. Mail received before
    allowed_since cannot be newly admitted.

    Args:
        body (AgentNetworkContactAdmissionInput): Check only a received email already stored for
            the bound recipient. The server verifies its sender against delivery evidence.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[CheckDefaultNetworkContactAdmissionResponse200 | ErrorResponse]
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
    body: AgentNetworkContactAdmissionInput,

) -> CheckDefaultNetworkContactAdmissionResponse200 | ErrorResponse | None:
    """ Check whether network mail may wake this connected agent

     Requires the recipient's connected-agent credential. The recipient
    address is derived from that credential. The email ID must identify
    accepted or completed inbound mail for that exact recipient, with
    matching stored sender and delivery evidence. Returns no sender profile
    or existence detail. Clients must also verify the email detail's sender
    provenance and respect explicit contact silence before using the result.
    Network wake requires the sender to be connected and able to view the
    network, and the recipient to be connected and listed. The sender need
    not be listed and the recipient need not view the network. Ordinary
    known-address email remains independent. Mail received before
    allowed_since cannot be newly admitted.

    Args:
        body (AgentNetworkContactAdmissionInput): Check only a received email already stored for
            the bound recipient. The server verifies its sender against delivery evidence.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        CheckDefaultNetworkContactAdmissionResponse200 | ErrorResponse
     """


    return (await asyncio_detailed(
        client=client,
body=body,

    )).parsed
