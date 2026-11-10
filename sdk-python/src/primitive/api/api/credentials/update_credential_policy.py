from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.credentials_update_credential_policy_input import CredentialsUpdateCredentialPolicyInput
from ...models.error_response import ErrorResponse
from ...models.update_credential_policy_response_200 import UpdateCredentialPolicyResponse200
from typing import cast



def _get_kwargs(
    *,
    body: CredentialsUpdateCredentialPolicyInput,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "patch",
        "url": "/credential-policy",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | UpdateCredentialPolicyResponse200 | None:
    if response.status_code == 200:
        response_200 = UpdateCredentialPolicyResponse200.from_dict(response.json())



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

    if response.status_code == 429:
        response_429 = ErrorResponse.from_dict(response.json())



        return response_429

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | UpdateCredentialPolicyResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: CredentialsUpdateCredentialPolicyInput,

) -> Response[ErrorResponse | UpdateCredentialPolicyResponse200]:
    """ Change the credential policy

     Change one or more policy rules. Admins may only tighten the policy; loosening any rule needs an
    owner. Owners and admins are emailed about every change. Needs the organization's credential
    features to be enabled; while they are not, this answers 404 feature_disabled, with details.feature
    naming the feature. Contact Primitive to turn them on.

    Person only: a dashboard session. The person's role must hold credential_policy:manage. API keys,
    agent connection keys and agents are refused.

    Args:
        body (CredentialsUpdateCredentialPolicyInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | UpdateCredentialPolicyResponse200]
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
    body: CredentialsUpdateCredentialPolicyInput,

) -> ErrorResponse | UpdateCredentialPolicyResponse200 | None:
    """ Change the credential policy

     Change one or more policy rules. Admins may only tighten the policy; loosening any rule needs an
    owner. Owners and admins are emailed about every change. Needs the organization's credential
    features to be enabled; while they are not, this answers 404 feature_disabled, with details.feature
    naming the feature. Contact Primitive to turn them on.

    Person only: a dashboard session. The person's role must hold credential_policy:manage. API keys,
    agent connection keys and agents are refused.

    Args:
        body (CredentialsUpdateCredentialPolicyInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | UpdateCredentialPolicyResponse200
     """


    return sync_detailed(
        client=client,
body=body,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: CredentialsUpdateCredentialPolicyInput,

) -> Response[ErrorResponse | UpdateCredentialPolicyResponse200]:
    """ Change the credential policy

     Change one or more policy rules. Admins may only tighten the policy; loosening any rule needs an
    owner. Owners and admins are emailed about every change. Needs the organization's credential
    features to be enabled; while they are not, this answers 404 feature_disabled, with details.feature
    naming the feature. Contact Primitive to turn them on.

    Person only: a dashboard session. The person's role must hold credential_policy:manage. API keys,
    agent connection keys and agents are refused.

    Args:
        body (CredentialsUpdateCredentialPolicyInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | UpdateCredentialPolicyResponse200]
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
    body: CredentialsUpdateCredentialPolicyInput,

) -> ErrorResponse | UpdateCredentialPolicyResponse200 | None:
    """ Change the credential policy

     Change one or more policy rules. Admins may only tighten the policy; loosening any rule needs an
    owner. Owners and admins are emailed about every change. Needs the organization's credential
    features to be enabled; while they are not, this answers 404 feature_disabled, with details.feature
    naming the feature. Contact Primitive to turn them on.

    Person only: a dashboard session. The person's role must hold credential_policy:manage. API keys,
    agent connection keys and agents are refused.

    Args:
        body (CredentialsUpdateCredentialPolicyInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | UpdateCredentialPolicyResponse200
     """


    return (await asyncio_detailed(
        client=client,
body=body,

    )).parsed
