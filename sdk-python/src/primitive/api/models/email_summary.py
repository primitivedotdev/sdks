from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.email_summary_status import EmailSummaryStatus
from ..models.email_summary_webhook_status_type_1 import EmailSummaryWebhookStatusType1
from ..models.email_summary_webhook_status_type_2_type_1 import EmailSummaryWebhookStatusType2Type1
from ..models.email_summary_webhook_status_type_3_type_1 import EmailSummaryWebhookStatusType3Type1
from dateutil.parser import isoparse
from typing import cast
from uuid import UUID
import datetime






T = TypeVar("T", bound="EmailSummary")



@_attrs_define
class EmailSummary:
    """ 
        Attributes:
            id (UUID):
            status (EmailSummaryStatus):
            sender (str): SMTP envelope sender (return-path) the inbound mail server
                accepted. For most legitimate mail this equals the bare
                address in the From header; for mailing lists, bounce
                handlers, and forwarders it is typically the bounce address
                rather than the human-visible sender.

                For the parsed From-header value (with display name handling
                and a sender-fallback when the header is unparseable), GET
                the email by id and use `from_email`.
            recipient (str):
            domain (str):
            created_at (datetime.datetime):
            received_at (datetime.datetime):
            webhook_attempt_count (int):
            message_id (None | str | Unset):
            domain_id (None | Unset | UUID):
            org_id (None | Unset | UUID):
            subject (None | str | Unset):
            spam_score (float | None | Unset):
            raw_size_bytes (int | None | Unset):
            webhook_status (EmailSummaryWebhookStatusType1 | EmailSummaryWebhookStatusType2Type1 |
                EmailSummaryWebhookStatusType3Type1 | None | Unset):
     """

    id: UUID
    status: EmailSummaryStatus
    sender: str
    recipient: str
    domain: str
    created_at: datetime.datetime
    received_at: datetime.datetime
    webhook_attempt_count: int
    message_id: None | str | Unset = UNSET
    domain_id: None | Unset | UUID = UNSET
    org_id: None | Unset | UUID = UNSET
    subject: None | str | Unset = UNSET
    spam_score: float | None | Unset = UNSET
    raw_size_bytes: int | None | Unset = UNSET
    webhook_status: EmailSummaryWebhookStatusType1 | EmailSummaryWebhookStatusType2Type1 | EmailSummaryWebhookStatusType3Type1 | None | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        status = self.status.value

        sender = self.sender

        recipient = self.recipient

        domain = self.domain

        created_at = self.created_at.isoformat()

        received_at = self.received_at.isoformat()

        webhook_attempt_count = self.webhook_attempt_count

        message_id: None | str | Unset
        if isinstance(self.message_id, Unset):
            message_id = UNSET
        else:
            message_id = self.message_id

        domain_id: None | str | Unset
        if isinstance(self.domain_id, Unset):
            domain_id = UNSET
        elif isinstance(self.domain_id, UUID):
            domain_id = str(self.domain_id)
        else:
            domain_id = self.domain_id

        org_id: None | str | Unset
        if isinstance(self.org_id, Unset):
            org_id = UNSET
        elif isinstance(self.org_id, UUID):
            org_id = str(self.org_id)
        else:
            org_id = self.org_id

        subject: None | str | Unset
        if isinstance(self.subject, Unset):
            subject = UNSET
        else:
            subject = self.subject

        spam_score: float | None | Unset
        if isinstance(self.spam_score, Unset):
            spam_score = UNSET
        else:
            spam_score = self.spam_score

        raw_size_bytes: int | None | Unset
        if isinstance(self.raw_size_bytes, Unset):
            raw_size_bytes = UNSET
        else:
            raw_size_bytes = self.raw_size_bytes

        webhook_status: None | str | Unset
        if isinstance(self.webhook_status, Unset):
            webhook_status = UNSET
        elif isinstance(self.webhook_status, EmailSummaryWebhookStatusType1):
            webhook_status = self.webhook_status.value
        elif isinstance(self.webhook_status, EmailSummaryWebhookStatusType2Type1):
            webhook_status = self.webhook_status.value
        elif isinstance(self.webhook_status, EmailSummaryWebhookStatusType3Type1):
            webhook_status = self.webhook_status.value
        else:
            webhook_status = self.webhook_status


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "status": status,
            "sender": sender,
            "recipient": recipient,
            "domain": domain,
            "created_at": created_at,
            "received_at": received_at,
            "webhook_attempt_count": webhook_attempt_count,
        })
        if message_id is not UNSET:
            field_dict["message_id"] = message_id
        if domain_id is not UNSET:
            field_dict["domain_id"] = domain_id
        if org_id is not UNSET:
            field_dict["org_id"] = org_id
        if subject is not UNSET:
            field_dict["subject"] = subject
        if spam_score is not UNSET:
            field_dict["spam_score"] = spam_score
        if raw_size_bytes is not UNSET:
            field_dict["raw_size_bytes"] = raw_size_bytes
        if webhook_status is not UNSET:
            field_dict["webhook_status"] = webhook_status

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        status = EmailSummaryStatus(d.pop("status"))




        sender = d.pop("sender")

        recipient = d.pop("recipient")

        domain = d.pop("domain")

        created_at = isoparse(d.pop("created_at"))




        received_at = isoparse(d.pop("received_at"))




        webhook_attempt_count = d.pop("webhook_attempt_count")

        def _parse_message_id(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        message_id = _parse_message_id(d.pop("message_id", UNSET))


        def _parse_domain_id(data: object) -> None | Unset | UUID:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                domain_id_type_0 = UUID(data)



                return domain_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | Unset | UUID, data)

        domain_id = _parse_domain_id(d.pop("domain_id", UNSET))


        def _parse_org_id(data: object) -> None | Unset | UUID:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                org_id_type_0 = UUID(data)



                return org_id_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | Unset | UUID, data)

        org_id = _parse_org_id(d.pop("org_id", UNSET))


        def _parse_subject(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        subject = _parse_subject(d.pop("subject", UNSET))


        def _parse_spam_score(data: object) -> float | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(float | None | Unset, data)

        spam_score = _parse_spam_score(d.pop("spam_score", UNSET))


        def _parse_raw_size_bytes(data: object) -> int | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(int | None | Unset, data)

        raw_size_bytes = _parse_raw_size_bytes(d.pop("raw_size_bytes", UNSET))


        def _parse_webhook_status(data: object) -> EmailSummaryWebhookStatusType1 | EmailSummaryWebhookStatusType2Type1 | EmailSummaryWebhookStatusType3Type1 | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                webhook_status_type_1 = EmailSummaryWebhookStatusType1(data)



                return webhook_status_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, str):
                    raise TypeError()
                webhook_status_type_2_type_1 = EmailSummaryWebhookStatusType2Type1(data)



                return webhook_status_type_2_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, str):
                    raise TypeError()
                webhook_status_type_3_type_1 = EmailSummaryWebhookStatusType3Type1(data)



                return webhook_status_type_3_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(EmailSummaryWebhookStatusType1 | EmailSummaryWebhookStatusType2Type1 | EmailSummaryWebhookStatusType3Type1 | None | Unset, data)

        webhook_status = _parse_webhook_status(d.pop("webhook_status", UNSET))


        email_summary = cls(
            id=id,
            status=status,
            sender=sender,
            recipient=recipient,
            domain=domain,
            created_at=created_at,
            received_at=received_at,
            webhook_attempt_count=webhook_attempt_count,
            message_id=message_id,
            domain_id=domain_id,
            org_id=org_id,
            subject=subject,
            spam_score=spam_score,
            raw_size_bytes=raw_size_bytes,
            webhook_status=webhook_status,
        )


        email_summary.additional_properties = d
        return email_summary

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
