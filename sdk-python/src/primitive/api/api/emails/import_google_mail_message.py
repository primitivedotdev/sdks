from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.error_response import ErrorResponse
from ...models.import_google_mail_message_request import ImportGoogleMailMessageRequest
from ...models.import_google_mail_message_response_200 import ImportGoogleMailMessageResponse200
from ...types import UNSET, Unset
from typing import cast



def _get_kwargs(
    *,
    body: ImportGoogleMailMessageRequest,
    x_primitive_google_access_token: str,
    idempotency_key: str | Unset = UNSET,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}
    headers["X-Primitive-Google-Access-Token"] = x_primitive_google_access_token

    if not isinstance(idempotency_key, Unset):
        headers["Idempotency-Key"] = idempotency_key



    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/mail-imports/google/messages",
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> ErrorResponse | ImportGoogleMailMessageResponse200 | None:
    if response.status_code == 200:
        response_200 = ImportGoogleMailMessageResponse200.from_dict(response.json())



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

    if response.status_code == 409:
        response_409 = ErrorResponse.from_dict(response.json())



        return response_409

    if response.status_code == 422:
        response_422 = ErrorResponse.from_dict(response.json())



        return response_422

    if response.status_code == 429:
        response_429 = ErrorResponse.from_dict(response.json())



        return response_429

    if response.status_code == 502:
        response_502 = ErrorResponse.from_dict(response.json())



        return response_502

    if response.status_code == 503:
        response_503 = ErrorResponse.from_dict(response.json())



        return response_503

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[ErrorResponse | ImportGoogleMailMessageResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: ImportGoogleMailMessageRequest,
    x_primitive_google_access_token: str,
    idempotency_key: str | Unset = UNSET,

) -> Response[ErrorResponse | ImportGoogleMailMessageResponse200]:
    """ Import one historical Google Workspace message

     Requires the organization email_import entitlement, granted by staff. Only the configured current
    owner, using a full personal session or verified first-party CLI, may import into the configured
    primary mailbox. Primitive verifies the transient provider token and fetches RAW content itself. No
    raw uploads or client provenance are accepted. Sent, draft, spam and trash messages are skipped.
    Historical mail appears in normal history without live delivery effects. An indeterminate response
    requires retrying the same provider ID. User provider credentials are never stored or queued.

    Args:
        x_primitive_google_access_token (str):
        idempotency_key (str | Unset):
        body (ImportGoogleMailMessageRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ImportGoogleMailMessageResponse200]
     """


    kwargs = _get_kwargs(
        body=body,
x_primitive_google_access_token=x_primitive_google_access_token,
idempotency_key=idempotency_key,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    *,
    client: AuthenticatedClient | Client,
    body: ImportGoogleMailMessageRequest,
    x_primitive_google_access_token: str,
    idempotency_key: str | Unset = UNSET,

) -> ErrorResponse | ImportGoogleMailMessageResponse200 | None:
    """ Import one historical Google Workspace message

     Requires the organization email_import entitlement, granted by staff. Only the configured current
    owner, using a full personal session or verified first-party CLI, may import into the configured
    primary mailbox. Primitive verifies the transient provider token and fetches RAW content itself. No
    raw uploads or client provenance are accepted. Sent, draft, spam and trash messages are skipped.
    Historical mail appears in normal history without live delivery effects. An indeterminate response
    requires retrying the same provider ID. User provider credentials are never stored or queued.

    Args:
        x_primitive_google_access_token (str):
        idempotency_key (str | Unset):
        body (ImportGoogleMailMessageRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ImportGoogleMailMessageResponse200
     """


    return sync_detailed(
        client=client,
body=body,
x_primitive_google_access_token=x_primitive_google_access_token,
idempotency_key=idempotency_key,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: ImportGoogleMailMessageRequest,
    x_primitive_google_access_token: str,
    idempotency_key: str | Unset = UNSET,

) -> Response[ErrorResponse | ImportGoogleMailMessageResponse200]:
    """ Import one historical Google Workspace message

     Requires the organization email_import entitlement, granted by staff. Only the configured current
    owner, using a full personal session or verified first-party CLI, may import into the configured
    primary mailbox. Primitive verifies the transient provider token and fetches RAW content itself. No
    raw uploads or client provenance are accepted. Sent, draft, spam and trash messages are skipped.
    Historical mail appears in normal history without live delivery effects. An indeterminate response
    requires retrying the same provider ID. User provider credentials are never stored or queued.

    Args:
        x_primitive_google_access_token (str):
        idempotency_key (str | Unset):
        body (ImportGoogleMailMessageRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[ErrorResponse | ImportGoogleMailMessageResponse200]
     """


    kwargs = _get_kwargs(
        body=body,
x_primitive_google_access_token=x_primitive_google_access_token,
idempotency_key=idempotency_key,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    body: ImportGoogleMailMessageRequest,
    x_primitive_google_access_token: str,
    idempotency_key: str | Unset = UNSET,

) -> ErrorResponse | ImportGoogleMailMessageResponse200 | None:
    """ Import one historical Google Workspace message

     Requires the organization email_import entitlement, granted by staff. Only the configured current
    owner, using a full personal session or verified first-party CLI, may import into the configured
    primary mailbox. Primitive verifies the transient provider token and fetches RAW content itself. No
    raw uploads or client provenance are accepted. Sent, draft, spam and trash messages are skipped.
    Historical mail appears in normal history without live delivery effects. An indeterminate response
    requires retrying the same provider ID. User provider credentials are never stored or queued.

    Args:
        x_primitive_google_access_token (str):
        idempotency_key (str | Unset):
        body (ImportGoogleMailMessageRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        ErrorResponse | ImportGoogleMailMessageResponse200
     """


    return (await asyncio_detailed(
        client=client,
body=body,
x_primitive_google_access_token=x_primitive_google_access_token,
idempotency_key=idempotency_key,

    )).parsed
