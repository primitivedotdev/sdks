from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.get_access_mode_response_200 import GetAccessModeResponse200
from typing import cast



def _get_kwargs(
    
) -> dict[str, Any]:
    

    

    

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/access-mode",
    }


    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | GetAccessModeResponse200 | None:
    if response.status_code == 200:
        response_200 = GetAccessModeResponse200.from_dict(response.json())



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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | GetAccessModeResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,

) -> Response[ErrorResponse | GetAccessModeResponse200]:
    """ Get the mailbox access mode

     Whole-org or delegated mailbox access. Holders of roles:assign also get the preview of a switch
    (every item that needs a decision, each with the decision_options it takes, worded for what the
    switch does) and the decisions made, plus notices: member and group domain entries that delegated
    mode keeps off personal mailboxes, each with how many it leaves out. Notices are informational,
    never decided, and never hold the switch (notices_truncated past 500, notices_unavailable when they
    could not be read). In whole-org mode it also lists narrowed_agents: every live agent connection the
    switch narrows to an own-address key (personal agents of members, and shared agents), informational
    in the same way (narrowed_agents_truncated past 500, narrowed_agents_unavailable when they could not
    be read). Needs members:read (owners, admins, members and roles that grant it); API keys are
    refused.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | GetAccessModeResponse200]
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

) -> ErrorResponse | GetAccessModeResponse200 | None:
    """ Get the mailbox access mode

     Whole-org or delegated mailbox access. Holders of roles:assign also get the preview of a switch
    (every item that needs a decision, each with the decision_options it takes, worded for what the
    switch does) and the decisions made, plus notices: member and group domain entries that delegated
    mode keeps off personal mailboxes, each with how many it leaves out. Notices are informational,
    never decided, and never hold the switch (notices_truncated past 500, notices_unavailable when they
    could not be read). In whole-org mode it also lists narrowed_agents: every live agent connection the
    switch narrows to an own-address key (personal agents of members, and shared agents), informational
    in the same way (narrowed_agents_truncated past 500, narrowed_agents_unavailable when they could not
    be read). Needs members:read (owners, admins, members and roles that grant it); API keys are
    refused.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | GetAccessModeResponse200
     """


    return sync_detailed(
        client=client,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,

) -> Response[ErrorResponse | GetAccessModeResponse200]:
    """ Get the mailbox access mode

     Whole-org or delegated mailbox access. Holders of roles:assign also get the preview of a switch
    (every item that needs a decision, each with the decision_options it takes, worded for what the
    switch does) and the decisions made, plus notices: member and group domain entries that delegated
    mode keeps off personal mailboxes, each with how many it leaves out. Notices are informational,
    never decided, and never hold the switch (notices_truncated past 500, notices_unavailable when they
    could not be read). In whole-org mode it also lists narrowed_agents: every live agent connection the
    switch narrows to an own-address key (personal agents of members, and shared agents), informational
    in the same way (narrowed_agents_truncated past 500, narrowed_agents_unavailable when they could not
    be read). Needs members:read (owners, admins, members and roles that grant it); API keys are
    refused.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | GetAccessModeResponse200]
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

) -> ErrorResponse | GetAccessModeResponse200 | None:
    """ Get the mailbox access mode

     Whole-org or delegated mailbox access. Holders of roles:assign also get the preview of a switch
    (every item that needs a decision, each with the decision_options it takes, worded for what the
    switch does) and the decisions made, plus notices: member and group domain entries that delegated
    mode keeps off personal mailboxes, each with how many it leaves out. Notices are informational,
    never decided, and never hold the switch (notices_truncated past 500, notices_unavailable when they
    could not be read). In whole-org mode it also lists narrowed_agents: every live agent connection the
    switch narrows to an own-address key (personal agents of members, and shared agents), informational
    in the same way (narrowed_agents_truncated past 500, narrowed_agents_unavailable when they could not
    be read). Needs members:read (owners, admins, members and roles that grant it); API keys are
    refused.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | GetAccessModeResponse200
     """


    return (await asyncio_detailed(
        client=client,

    )).parsed
