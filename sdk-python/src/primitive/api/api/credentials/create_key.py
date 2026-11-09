from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.create_key_response_201 import CreateKeyResponse201
from ...models.credentials_create_key_input import CredentialsCreateKeyInput
from ...models.error_response import ErrorResponse
from ...types import UNSET, Unset
from typing import cast



def _get_kwargs(
    *,
    body: CredentialsCreateKeyInput,
    idempotency_key: str | Unset = UNSET,
    primitive_not_after: str | Unset = UNSET,
    primitive_step_up: str | Unset = UNSET,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}
    if not isinstance(idempotency_key, Unset):
        headers["Idempotency-Key"] = idempotency_key

    if not isinstance(primitive_not_after, Unset):
        headers["Primitive-Not-After"] = primitive_not_after

    if not isinstance(primitive_step_up, Unset):
        headers["Primitive-Step-Up"] = primitive_step_up



    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/keys",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> CreateKeyResponse201 | ErrorResponse | None:
    if response.status_code == 201:
        response_201 = CreateKeyResponse201.from_dict(response.json())



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

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[CreateKeyResponse201 | ErrorResponse]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: CredentialsCreateKeyInput,
    idempotency_key: str | Unset = UNSET,
    primitive_not_after: str | Unset = UNSET,
    primitive_step_up: str | Unset = UNSET,

) -> Response[CreateKeyResponse201 | ErrorResponse]:
    """ Create an API key

     Create an API key, super admin or narrowed to a preset or a custom permission set, optionally with
    an expiry and conditions. The secret is returned once. A key never holds more than the person
    creating it; the credential policy decides who may create which keys. grant is required: a request
    without it is refused (400 validation_error, details.reason grant_required), never treated as super
    admin. A custom key must say which mail it reaches: the addresses and domains it lists
    (grant.addresses, grant.domains), or every mailbox in the organization with grant.mail_scope "org",
    which cannot be combined with them; one that says neither is refused (400 validation_error,
    details.reason mail_scope_required). Super admin, Send only and Read only reach every mailbox by
    definition. members:read is only for an org-wide custom key: naming it with grant.addresses or
    grant.domains is refused (400). Owners and admins are emailed about every super admin key. Send an
    Idempotency-Key to retry safely: a second create by the same person under the same key makes no
    second key and is refused (409 idempotency_key_reused) with the first key's id in
    error.details.key_id, so a caller whose first answer was lost can revoke that key. The onboarding
    field is for the dashboard only. The Primitive CLI's token is refused, even with a step-up: keys are
    created in the dashboard or by an app the person connected. While the organization's keys API is not
    enabled, this answers 404 feature_disabled, except that a dashboard session may still create a super
    admin key (the dashboard's own create).

    Person only: a dashboard session, or the person's own OAuth token with a step-up token for purpose
    `keys.create` in the Primitive-Step-Up header. Without one an OAuth token is answered 403
    step_up_required, whose details carry the dashboard URL that issues it (or 403 grant_forbidden when
    the person's role could not do it anyway). The person's role must hold keys:manage. API keys and
    agent connection keys are refused. An agent acting for the person is refused unless it carries a
    step-up token the person issued in the dashboard.

    Args:
        idempotency_key (str | Unset):
        primitive_not_after (str | Unset):
        primitive_step_up (str | Unset):
        body (CredentialsCreateKeyInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[CreateKeyResponse201 | ErrorResponse]
     """


    kwargs = _get_kwargs(
        body=body,
idempotency_key=idempotency_key,
primitive_not_after=primitive_not_after,
primitive_step_up=primitive_step_up,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    *,
    client: AuthenticatedClient | Client,
    body: CredentialsCreateKeyInput,
    idempotency_key: str | Unset = UNSET,
    primitive_not_after: str | Unset = UNSET,
    primitive_step_up: str | Unset = UNSET,

) -> CreateKeyResponse201 | ErrorResponse | None:
    """ Create an API key

     Create an API key, super admin or narrowed to a preset or a custom permission set, optionally with
    an expiry and conditions. The secret is returned once. A key never holds more than the person
    creating it; the credential policy decides who may create which keys. grant is required: a request
    without it is refused (400 validation_error, details.reason grant_required), never treated as super
    admin. A custom key must say which mail it reaches: the addresses and domains it lists
    (grant.addresses, grant.domains), or every mailbox in the organization with grant.mail_scope "org",
    which cannot be combined with them; one that says neither is refused (400 validation_error,
    details.reason mail_scope_required). Super admin, Send only and Read only reach every mailbox by
    definition. members:read is only for an org-wide custom key: naming it with grant.addresses or
    grant.domains is refused (400). Owners and admins are emailed about every super admin key. Send an
    Idempotency-Key to retry safely: a second create by the same person under the same key makes no
    second key and is refused (409 idempotency_key_reused) with the first key's id in
    error.details.key_id, so a caller whose first answer was lost can revoke that key. The onboarding
    field is for the dashboard only. The Primitive CLI's token is refused, even with a step-up: keys are
    created in the dashboard or by an app the person connected. While the organization's keys API is not
    enabled, this answers 404 feature_disabled, except that a dashboard session may still create a super
    admin key (the dashboard's own create).

    Person only: a dashboard session, or the person's own OAuth token with a step-up token for purpose
    `keys.create` in the Primitive-Step-Up header. Without one an OAuth token is answered 403
    step_up_required, whose details carry the dashboard URL that issues it (or 403 grant_forbidden when
    the person's role could not do it anyway). The person's role must hold keys:manage. API keys and
    agent connection keys are refused. An agent acting for the person is refused unless it carries a
    step-up token the person issued in the dashboard.

    Args:
        idempotency_key (str | Unset):
        primitive_not_after (str | Unset):
        primitive_step_up (str | Unset):
        body (CredentialsCreateKeyInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        CreateKeyResponse201 | ErrorResponse
     """


    return sync_detailed(
        client=client,
body=body,
idempotency_key=idempotency_key,
primitive_not_after=primitive_not_after,
primitive_step_up=primitive_step_up,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: CredentialsCreateKeyInput,
    idempotency_key: str | Unset = UNSET,
    primitive_not_after: str | Unset = UNSET,
    primitive_step_up: str | Unset = UNSET,

) -> Response[CreateKeyResponse201 | ErrorResponse]:
    """ Create an API key

     Create an API key, super admin or narrowed to a preset or a custom permission set, optionally with
    an expiry and conditions. The secret is returned once. A key never holds more than the person
    creating it; the credential policy decides who may create which keys. grant is required: a request
    without it is refused (400 validation_error, details.reason grant_required), never treated as super
    admin. A custom key must say which mail it reaches: the addresses and domains it lists
    (grant.addresses, grant.domains), or every mailbox in the organization with grant.mail_scope "org",
    which cannot be combined with them; one that says neither is refused (400 validation_error,
    details.reason mail_scope_required). Super admin, Send only and Read only reach every mailbox by
    definition. members:read is only for an org-wide custom key: naming it with grant.addresses or
    grant.domains is refused (400). Owners and admins are emailed about every super admin key. Send an
    Idempotency-Key to retry safely: a second create by the same person under the same key makes no
    second key and is refused (409 idempotency_key_reused) with the first key's id in
    error.details.key_id, so a caller whose first answer was lost can revoke that key. The onboarding
    field is for the dashboard only. The Primitive CLI's token is refused, even with a step-up: keys are
    created in the dashboard or by an app the person connected. While the organization's keys API is not
    enabled, this answers 404 feature_disabled, except that a dashboard session may still create a super
    admin key (the dashboard's own create).

    Person only: a dashboard session, or the person's own OAuth token with a step-up token for purpose
    `keys.create` in the Primitive-Step-Up header. Without one an OAuth token is answered 403
    step_up_required, whose details carry the dashboard URL that issues it (or 403 grant_forbidden when
    the person's role could not do it anyway). The person's role must hold keys:manage. API keys and
    agent connection keys are refused. An agent acting for the person is refused unless it carries a
    step-up token the person issued in the dashboard.

    Args:
        idempotency_key (str | Unset):
        primitive_not_after (str | Unset):
        primitive_step_up (str | Unset):
        body (CredentialsCreateKeyInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[CreateKeyResponse201 | ErrorResponse]
     """


    kwargs = _get_kwargs(
        body=body,
idempotency_key=idempotency_key,
primitive_not_after=primitive_not_after,
primitive_step_up=primitive_step_up,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    body: CredentialsCreateKeyInput,
    idempotency_key: str | Unset = UNSET,
    primitive_not_after: str | Unset = UNSET,
    primitive_step_up: str | Unset = UNSET,

) -> CreateKeyResponse201 | ErrorResponse | None:
    """ Create an API key

     Create an API key, super admin or narrowed to a preset or a custom permission set, optionally with
    an expiry and conditions. The secret is returned once. A key never holds more than the person
    creating it; the credential policy decides who may create which keys. grant is required: a request
    without it is refused (400 validation_error, details.reason grant_required), never treated as super
    admin. A custom key must say which mail it reaches: the addresses and domains it lists
    (grant.addresses, grant.domains), or every mailbox in the organization with grant.mail_scope "org",
    which cannot be combined with them; one that says neither is refused (400 validation_error,
    details.reason mail_scope_required). Super admin, Send only and Read only reach every mailbox by
    definition. members:read is only for an org-wide custom key: naming it with grant.addresses or
    grant.domains is refused (400). Owners and admins are emailed about every super admin key. Send an
    Idempotency-Key to retry safely: a second create by the same person under the same key makes no
    second key and is refused (409 idempotency_key_reused) with the first key's id in
    error.details.key_id, so a caller whose first answer was lost can revoke that key. The onboarding
    field is for the dashboard only. The Primitive CLI's token is refused, even with a step-up: keys are
    created in the dashboard or by an app the person connected. While the organization's keys API is not
    enabled, this answers 404 feature_disabled, except that a dashboard session may still create a super
    admin key (the dashboard's own create).

    Person only: a dashboard session, or the person's own OAuth token with a step-up token for purpose
    `keys.create` in the Primitive-Step-Up header. Without one an OAuth token is answered 403
    step_up_required, whose details carry the dashboard URL that issues it (or 403 grant_forbidden when
    the person's role could not do it anyway). The person's role must hold keys:manage. API keys and
    agent connection keys are refused. An agent acting for the person is refused unless it carries a
    step-up token the person issued in the dashboard.

    Args:
        idempotency_key (str | Unset):
        primitive_not_after (str | Unset):
        primitive_step_up (str | Unset):
        body (CredentialsCreateKeyInput):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        CreateKeyResponse201 | ErrorResponse
     """


    return (await asyncio_detailed(
        client=client,
body=body,
idempotency_key=idempotency_key,
primitive_not_after=primitive_not_after,
primitive_step_up=primitive_step_up,

    )).parsed
