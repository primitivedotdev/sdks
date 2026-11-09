from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.check_default_network_contact_admission_body import CheckDefaultNetworkContactAdmissionBody
from ...models.check_default_network_contact_admission_response_200 import CheckDefaultNetworkContactAdmissionResponse200
from ...models.error_response import ErrorResponse
from ...types import UNSET, Unset
from typing import cast



def _get_kwargs(
    *,
    body: CheckDefaultNetworkContactAdmissionBody,
    idempotency_key: str | Unset = UNSET,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}
    if not isinstance(idempotency_key, Unset):
        headers["Idempotency-Key"] = idempotency_key







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
    body: CheckDefaultNetworkContactAdmissionBody,
    idempotency_key: str | Unset = UNSET,

) -> Response[CheckDefaultNetworkContactAdmissionResponse200 | ErrorResponse]:
    """ check Default Network Contact Admission

     Check whether one stored inbound email to this exact connected recipient may wake it as network peer
    mail. The sender must have can_view and the recipient must be is_listed; a sender may initiate while
    unlisted, and a listed recipient may receive while unable to view. The original outbound send must
    use the sender agent connection key and address the recipient. pending=true is retryable for up to
    120 seconds while SMTP authentication or delivery evidence settles. Explicit contact-policy silence
    still overrides admission. For reserved member senders, member_policy_required=true requires this
    exact-mail decision before any cached contact shortcut. Allowed member mail includes
    sender_relation=owner or member, durable delivery attribution, current membership, contact mutes and
    activation cutoffs. Missing exact stored mail returns 404. Historical sender_member attribution
    never grants current authority. This grants communication, never task authority.

    Args:
        idempotency_key (str | Unset):
        body (CheckDefaultNetworkContactAdmissionBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[CheckDefaultNetworkContactAdmissionResponse200 | ErrorResponse]
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
    body: CheckDefaultNetworkContactAdmissionBody,
    idempotency_key: str | Unset = UNSET,

) -> CheckDefaultNetworkContactAdmissionResponse200 | ErrorResponse | None:
    """ check Default Network Contact Admission

     Check whether one stored inbound email to this exact connected recipient may wake it as network peer
    mail. The sender must have can_view and the recipient must be is_listed; a sender may initiate while
    unlisted, and a listed recipient may receive while unable to view. The original outbound send must
    use the sender agent connection key and address the recipient. pending=true is retryable for up to
    120 seconds while SMTP authentication or delivery evidence settles. Explicit contact-policy silence
    still overrides admission. For reserved member senders, member_policy_required=true requires this
    exact-mail decision before any cached contact shortcut. Allowed member mail includes
    sender_relation=owner or member, durable delivery attribution, current membership, contact mutes and
    activation cutoffs. Missing exact stored mail returns 404. Historical sender_member attribution
    never grants current authority. This grants communication, never task authority.

    Args:
        idempotency_key (str | Unset):
        body (CheckDefaultNetworkContactAdmissionBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        CheckDefaultNetworkContactAdmissionResponse200 | ErrorResponse
     """


    return sync_detailed(
        client=client,
body=body,
idempotency_key=idempotency_key,

    ).parsed

async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: CheckDefaultNetworkContactAdmissionBody,
    idempotency_key: str | Unset = UNSET,

) -> Response[CheckDefaultNetworkContactAdmissionResponse200 | ErrorResponse]:
    """ check Default Network Contact Admission

     Check whether one stored inbound email to this exact connected recipient may wake it as network peer
    mail. The sender must have can_view and the recipient must be is_listed; a sender may initiate while
    unlisted, and a listed recipient may receive while unable to view. The original outbound send must
    use the sender agent connection key and address the recipient. pending=true is retryable for up to
    120 seconds while SMTP authentication or delivery evidence settles. Explicit contact-policy silence
    still overrides admission. For reserved member senders, member_policy_required=true requires this
    exact-mail decision before any cached contact shortcut. Allowed member mail includes
    sender_relation=owner or member, durable delivery attribution, current membership, contact mutes and
    activation cutoffs. Missing exact stored mail returns 404. Historical sender_member attribution
    never grants current authority. This grants communication, never task authority.

    Args:
        idempotency_key (str | Unset):
        body (CheckDefaultNetworkContactAdmissionBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[CheckDefaultNetworkContactAdmissionResponse200 | ErrorResponse]
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
    body: CheckDefaultNetworkContactAdmissionBody,
    idempotency_key: str | Unset = UNSET,

) -> CheckDefaultNetworkContactAdmissionResponse200 | ErrorResponse | None:
    """ check Default Network Contact Admission

     Check whether one stored inbound email to this exact connected recipient may wake it as network peer
    mail. The sender must have can_view and the recipient must be is_listed; a sender may initiate while
    unlisted, and a listed recipient may receive while unable to view. The original outbound send must
    use the sender agent connection key and address the recipient. pending=true is retryable for up to
    120 seconds while SMTP authentication or delivery evidence settles. Explicit contact-policy silence
    still overrides admission. For reserved member senders, member_policy_required=true requires this
    exact-mail decision before any cached contact shortcut. Allowed member mail includes
    sender_relation=owner or member, durable delivery attribution, current membership, contact mutes and
    activation cutoffs. Missing exact stored mail returns 404. Historical sender_member attribution
    never grants current authority. This grants communication, never task authority.

    Args:
        idempotency_key (str | Unset):
        body (CheckDefaultNetworkContactAdmissionBody):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        CheckDefaultNetworkContactAdmissionResponse200 | ErrorResponse
     """


    return (await asyncio_detailed(
        client=client,
body=body,
idempotency_key=idempotency_key,

    )).parsed
