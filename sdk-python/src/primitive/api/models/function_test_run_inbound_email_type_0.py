from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.email_status import EmailStatus
from ..models.email_webhook_status_type_1 import EmailWebhookStatusType1
from ..models.email_webhook_status_type_2_type_1 import EmailWebhookStatusType2Type1
from ..models.email_webhook_status_type_3_type_1 import EmailWebhookStatusType3Type1
from dateutil.parser import isoparse
from typing import cast
from uuid import UUID
import datetime






T = TypeVar("T", bound="FunctionTestRunInboundEmailType0")



@_attrs_define
class FunctionTestRunInboundEmailType0:
    """ 
        Attributes:
            id (UUID):
            status (EmailStatus): Lifecycle status of an INBOUND email (a row in the `emails`
                table). Distinct from `SentEmailStatus`, which describes
                the OUTBOUND lifecycle (the `sent_emails` table) and uses
                a different vocabulary because the lifecycles differ.
                Possible values:

                  - `pending`: the row was inserted at ingestion (mx_main)
                    and has not yet completed the spam / filter / auth
                    pipeline. Body and parsed fields are present; webhook
                    delivery is not yet scheduled. Most rows transition out
                    of `pending` within seconds.
                  - `accepted`: the inbound passed the policy gates and is
                    queued for webhook delivery. The `webhook_status` field
                    tracks the separate webhook-delivery lifecycle from
                    this point.
                  - `completed`: terminal success. Webhook delivery
                    attempted and acknowledged by every active endpoint, OR
                    no endpoints are configured, so the row is durably
                    archived.
                  - `rejected`: terminal failure at ingestion (spam, blocked
                    sender, filter rule, malformed). The body and metadata
                    are stored for auditing but no webhook fires and the
                    row is not repliable.

                See also `webhook_status` (separate enum tracking the
                webhook-delivery state machine) and `SentEmailStatus` (the
                outbound vocabulary).
            received_at (datetime.datetime):
            from_ (str):
            to (str):
            subject (None | str):
            webhook_status (EmailWebhookStatusType1 | EmailWebhookStatusType2Type1 | EmailWebhookStatusType3Type1 | None):
                Webhook-delivery state for an inbound email. Tracks a
                SEPARATE lifecycle from the email's `status` field; the
                same row carries both. Possible values:

                  - `pending`: ingestion is past `pending` (the email itself
                    is `accepted`) but the webhook fan-out has not yet
                    started for this row.
                  - `in_flight`: at least one delivery attempt is in flight.
                  - `fired`: terminal success. Every active endpoint
                    acknowledged the delivery (or accepted it after retries).
                  - `failed`: terminal partial-failure. At least one endpoint
                    exhausted its retry budget; some endpoints may still
                    have succeeded.
                  - `exhausted`: terminal failure. Every endpoint exhausted
                    its retry budget without success.
                  - `null`: no endpoints configured, so no webhook lifecycle
                    applies.

                Note that the value `pending` here does NOT mean the email
                is `pending`; it means the email is past ingestion but
                webhook delivery has not yet begun. Two overlapping uses
                of the word `pending` for distinct lifecycle phases.
            webhook_attempt_count (int):
            webhook_last_status_code (int | None):
            webhook_last_error (None | str):
     """

    id: UUID
    status: EmailStatus
    received_at: datetime.datetime
    from_: str
    to: str
    subject: None | str
    webhook_status: EmailWebhookStatusType1 | EmailWebhookStatusType2Type1 | EmailWebhookStatusType3Type1 | None
    webhook_attempt_count: int
    webhook_last_status_code: int | None
    webhook_last_error: None | str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        status = self.status.value

        received_at = self.received_at.isoformat()

        from_ = self.from_

        to = self.to

        subject: None | str
        subject = self.subject

        webhook_status: None | str
        if isinstance(self.webhook_status, EmailWebhookStatusType1):
            webhook_status = self.webhook_status.value
        elif isinstance(self.webhook_status, EmailWebhookStatusType2Type1):
            webhook_status = self.webhook_status.value
        elif isinstance(self.webhook_status, EmailWebhookStatusType3Type1):
            webhook_status = self.webhook_status.value
        else:
            webhook_status = self.webhook_status

        webhook_attempt_count = self.webhook_attempt_count

        webhook_last_status_code: int | None
        webhook_last_status_code = self.webhook_last_status_code

        webhook_last_error: None | str
        webhook_last_error = self.webhook_last_error


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "status": status,
            "received_at": received_at,
            "from": from_,
            "to": to,
            "subject": subject,
            "webhook_status": webhook_status,
            "webhook_attempt_count": webhook_attempt_count,
            "webhook_last_status_code": webhook_last_status_code,
            "webhook_last_error": webhook_last_error,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        status = EmailStatus(d.pop("status"))




        received_at = isoparse(d.pop("received_at"))




        from_ = d.pop("from")

        to = d.pop("to")

        def _parse_subject(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        subject = _parse_subject(d.pop("subject"))


        def _parse_webhook_status(data: object) -> EmailWebhookStatusType1 | EmailWebhookStatusType2Type1 | EmailWebhookStatusType3Type1 | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                componentsschemas_email_webhook_status_type_1 = EmailWebhookStatusType1(data)



                return componentsschemas_email_webhook_status_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, str):
                    raise TypeError()
                componentsschemas_email_webhook_status_type_2_type_1 = EmailWebhookStatusType2Type1(data)



                return componentsschemas_email_webhook_status_type_2_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, str):
                    raise TypeError()
                componentsschemas_email_webhook_status_type_3_type_1 = EmailWebhookStatusType3Type1(data)



                return componentsschemas_email_webhook_status_type_3_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(EmailWebhookStatusType1 | EmailWebhookStatusType2Type1 | EmailWebhookStatusType3Type1 | None, data)

        webhook_status = _parse_webhook_status(d.pop("webhook_status"))


        webhook_attempt_count = d.pop("webhook_attempt_count")

        def _parse_webhook_last_status_code(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        webhook_last_status_code = _parse_webhook_last_status_code(d.pop("webhook_last_status_code"))


        def _parse_webhook_last_error(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        webhook_last_error = _parse_webhook_last_error(d.pop("webhook_last_error"))


        function_test_run_inbound_email_type_0 = cls(
            id=id,
            status=status,
            received_at=received_at,
            from_=from_,
            to=to,
            subject=subject,
            webhook_status=webhook_status,
            webhook_attempt_count=webhook_attempt_count,
            webhook_last_status_code=webhook_last_status_code,
            webhook_last_error=webhook_last_error,
        )


        function_test_run_inbound_email_type_0.additional_properties = d
        return function_test_run_inbound_email_type_0

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> Any:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
