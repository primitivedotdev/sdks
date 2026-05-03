from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.email_detail_status import EmailDetailStatus
from ..models.email_detail_webhook_status_type_1 import EmailDetailWebhookStatusType1
from ..models.email_detail_webhook_status_type_2_type_1 import EmailDetailWebhookStatusType2Type1
from ..models.email_detail_webhook_status_type_3_type_1 import EmailDetailWebhookStatusType3Type1
from dateutil.parser import isoparse
from typing import cast
from uuid import UUID
import datetime






T = TypeVar("T", bound="EmailDetail")



@_attrs_define
class EmailDetail:
    """ 
        Attributes:
            id (UUID):
            sender (str):
            recipient (str):
            status (EmailDetailStatus):
            domain (str):
            created_at (datetime.datetime):
            received_at (datetime.datetime):
            webhook_attempt_count (int):
            from_email (str): Parsed from address (from_header or sender fallback)
            to_email (str): Parsed to address (same as recipient)
            message_id (None | str | Unset):
            domain_id (None | Unset | UUID):
            org_id (None | Unset | UUID):
            subject (None | str | Unset):
            body_text (None | str | Unset): Plain-text body parsed from the inbound MIME, matching the
                `email.parsed.body_text` field on the webhook payload. Null when the message had no text part or parsing failed.
            body_html (None | str | Unset): HTML body parsed from the inbound MIME, matching the `email.parsed.body_html`
                field on the webhook payload. Null when the message had no HTML part or parsing failed.
            spam_score (float | None | Unset):
            raw_size_bytes (int | None | Unset):
            raw_sha256 (None | str | Unset):
            rejection_reason (None | str | Unset):
            webhook_status (EmailDetailWebhookStatusType1 | EmailDetailWebhookStatusType2Type1 |
                EmailDetailWebhookStatusType3Type1 | None | Unset):
            webhook_last_attempt_at (datetime.datetime | None | Unset):
            webhook_last_status_code (int | None | Unset):
            webhook_last_error (None | str | Unset):
            webhook_fired_at (datetime.datetime | None | Unset):
            smtp_helo (None | str | Unset):
            smtp_mail_from (None | str | Unset):
            smtp_rcpt_to (list[str] | None | Unset):
            from_header (None | str | Unset):
            content_discarded_at (datetime.datetime | None | Unset):
            content_discarded_by_delivery_id (None | str | Unset):
     """

    id: UUID
    sender: str
    recipient: str
    status: EmailDetailStatus
    domain: str
    created_at: datetime.datetime
    received_at: datetime.datetime
    webhook_attempt_count: int
    from_email: str
    to_email: str
    message_id: None | str | Unset = UNSET
    domain_id: None | Unset | UUID = UNSET
    org_id: None | Unset | UUID = UNSET
    subject: None | str | Unset = UNSET
    body_text: None | str | Unset = UNSET
    body_html: None | str | Unset = UNSET
    spam_score: float | None | Unset = UNSET
    raw_size_bytes: int | None | Unset = UNSET
    raw_sha256: None | str | Unset = UNSET
    rejection_reason: None | str | Unset = UNSET
    webhook_status: EmailDetailWebhookStatusType1 | EmailDetailWebhookStatusType2Type1 | EmailDetailWebhookStatusType3Type1 | None | Unset = UNSET
    webhook_last_attempt_at: datetime.datetime | None | Unset = UNSET
    webhook_last_status_code: int | None | Unset = UNSET
    webhook_last_error: None | str | Unset = UNSET
    webhook_fired_at: datetime.datetime | None | Unset = UNSET
    smtp_helo: None | str | Unset = UNSET
    smtp_mail_from: None | str | Unset = UNSET
    smtp_rcpt_to: list[str] | None | Unset = UNSET
    from_header: None | str | Unset = UNSET
    content_discarded_at: datetime.datetime | None | Unset = UNSET
    content_discarded_by_delivery_id: None | str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        sender = self.sender

        recipient = self.recipient

        status = self.status.value

        domain = self.domain

        created_at = self.created_at.isoformat()

        received_at = self.received_at.isoformat()

        webhook_attempt_count = self.webhook_attempt_count

        from_email = self.from_email

        to_email = self.to_email

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

        body_text: None | str | Unset
        if isinstance(self.body_text, Unset):
            body_text = UNSET
        else:
            body_text = self.body_text

        body_html: None | str | Unset
        if isinstance(self.body_html, Unset):
            body_html = UNSET
        else:
            body_html = self.body_html

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

        raw_sha256: None | str | Unset
        if isinstance(self.raw_sha256, Unset):
            raw_sha256 = UNSET
        else:
            raw_sha256 = self.raw_sha256

        rejection_reason: None | str | Unset
        if isinstance(self.rejection_reason, Unset):
            rejection_reason = UNSET
        else:
            rejection_reason = self.rejection_reason

        webhook_status: None | str | Unset
        if isinstance(self.webhook_status, Unset):
            webhook_status = UNSET
        elif isinstance(self.webhook_status, EmailDetailWebhookStatusType1):
            webhook_status = self.webhook_status.value
        elif isinstance(self.webhook_status, EmailDetailWebhookStatusType2Type1):
            webhook_status = self.webhook_status.value
        elif isinstance(self.webhook_status, EmailDetailWebhookStatusType3Type1):
            webhook_status = self.webhook_status.value
        else:
            webhook_status = self.webhook_status

        webhook_last_attempt_at: None | str | Unset
        if isinstance(self.webhook_last_attempt_at, Unset):
            webhook_last_attempt_at = UNSET
        elif isinstance(self.webhook_last_attempt_at, datetime.datetime):
            webhook_last_attempt_at = self.webhook_last_attempt_at.isoformat()
        else:
            webhook_last_attempt_at = self.webhook_last_attempt_at

        webhook_last_status_code: int | None | Unset
        if isinstance(self.webhook_last_status_code, Unset):
            webhook_last_status_code = UNSET
        else:
            webhook_last_status_code = self.webhook_last_status_code

        webhook_last_error: None | str | Unset
        if isinstance(self.webhook_last_error, Unset):
            webhook_last_error = UNSET
        else:
            webhook_last_error = self.webhook_last_error

        webhook_fired_at: None | str | Unset
        if isinstance(self.webhook_fired_at, Unset):
            webhook_fired_at = UNSET
        elif isinstance(self.webhook_fired_at, datetime.datetime):
            webhook_fired_at = self.webhook_fired_at.isoformat()
        else:
            webhook_fired_at = self.webhook_fired_at

        smtp_helo: None | str | Unset
        if isinstance(self.smtp_helo, Unset):
            smtp_helo = UNSET
        else:
            smtp_helo = self.smtp_helo

        smtp_mail_from: None | str | Unset
        if isinstance(self.smtp_mail_from, Unset):
            smtp_mail_from = UNSET
        else:
            smtp_mail_from = self.smtp_mail_from

        smtp_rcpt_to: list[str] | None | Unset
        if isinstance(self.smtp_rcpt_to, Unset):
            smtp_rcpt_to = UNSET
        elif isinstance(self.smtp_rcpt_to, list):
            smtp_rcpt_to = self.smtp_rcpt_to


        else:
            smtp_rcpt_to = self.smtp_rcpt_to

        from_header: None | str | Unset
        if isinstance(self.from_header, Unset):
            from_header = UNSET
        else:
            from_header = self.from_header

        content_discarded_at: None | str | Unset
        if isinstance(self.content_discarded_at, Unset):
            content_discarded_at = UNSET
        elif isinstance(self.content_discarded_at, datetime.datetime):
            content_discarded_at = self.content_discarded_at.isoformat()
        else:
            content_discarded_at = self.content_discarded_at

        content_discarded_by_delivery_id: None | str | Unset
        if isinstance(self.content_discarded_by_delivery_id, Unset):
            content_discarded_by_delivery_id = UNSET
        else:
            content_discarded_by_delivery_id = self.content_discarded_by_delivery_id


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "sender": sender,
            "recipient": recipient,
            "status": status,
            "domain": domain,
            "created_at": created_at,
            "received_at": received_at,
            "webhook_attempt_count": webhook_attempt_count,
            "from_email": from_email,
            "to_email": to_email,
        })
        if message_id is not UNSET:
            field_dict["message_id"] = message_id
        if domain_id is not UNSET:
            field_dict["domain_id"] = domain_id
        if org_id is not UNSET:
            field_dict["org_id"] = org_id
        if subject is not UNSET:
            field_dict["subject"] = subject
        if body_text is not UNSET:
            field_dict["body_text"] = body_text
        if body_html is not UNSET:
            field_dict["body_html"] = body_html
        if spam_score is not UNSET:
            field_dict["spam_score"] = spam_score
        if raw_size_bytes is not UNSET:
            field_dict["raw_size_bytes"] = raw_size_bytes
        if raw_sha256 is not UNSET:
            field_dict["raw_sha256"] = raw_sha256
        if rejection_reason is not UNSET:
            field_dict["rejection_reason"] = rejection_reason
        if webhook_status is not UNSET:
            field_dict["webhook_status"] = webhook_status
        if webhook_last_attempt_at is not UNSET:
            field_dict["webhook_last_attempt_at"] = webhook_last_attempt_at
        if webhook_last_status_code is not UNSET:
            field_dict["webhook_last_status_code"] = webhook_last_status_code
        if webhook_last_error is not UNSET:
            field_dict["webhook_last_error"] = webhook_last_error
        if webhook_fired_at is not UNSET:
            field_dict["webhook_fired_at"] = webhook_fired_at
        if smtp_helo is not UNSET:
            field_dict["smtp_helo"] = smtp_helo
        if smtp_mail_from is not UNSET:
            field_dict["smtp_mail_from"] = smtp_mail_from
        if smtp_rcpt_to is not UNSET:
            field_dict["smtp_rcpt_to"] = smtp_rcpt_to
        if from_header is not UNSET:
            field_dict["from_header"] = from_header
        if content_discarded_at is not UNSET:
            field_dict["content_discarded_at"] = content_discarded_at
        if content_discarded_by_delivery_id is not UNSET:
            field_dict["content_discarded_by_delivery_id"] = content_discarded_by_delivery_id

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        sender = d.pop("sender")

        recipient = d.pop("recipient")

        status = EmailDetailStatus(d.pop("status"))




        domain = d.pop("domain")

        created_at = isoparse(d.pop("created_at"))




        received_at = isoparse(d.pop("received_at"))




        webhook_attempt_count = d.pop("webhook_attempt_count")

        from_email = d.pop("from_email")

        to_email = d.pop("to_email")

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


        def _parse_body_text(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        body_text = _parse_body_text(d.pop("body_text", UNSET))


        def _parse_body_html(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        body_html = _parse_body_html(d.pop("body_html", UNSET))


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


        def _parse_raw_sha256(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        raw_sha256 = _parse_raw_sha256(d.pop("raw_sha256", UNSET))


        def _parse_rejection_reason(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        rejection_reason = _parse_rejection_reason(d.pop("rejection_reason", UNSET))


        def _parse_webhook_status(data: object) -> EmailDetailWebhookStatusType1 | EmailDetailWebhookStatusType2Type1 | EmailDetailWebhookStatusType3Type1 | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                webhook_status_type_1 = EmailDetailWebhookStatusType1(data)



                return webhook_status_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, str):
                    raise TypeError()
                webhook_status_type_2_type_1 = EmailDetailWebhookStatusType2Type1(data)



                return webhook_status_type_2_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, str):
                    raise TypeError()
                webhook_status_type_3_type_1 = EmailDetailWebhookStatusType3Type1(data)



                return webhook_status_type_3_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(EmailDetailWebhookStatusType1 | EmailDetailWebhookStatusType2Type1 | EmailDetailWebhookStatusType3Type1 | None | Unset, data)

        webhook_status = _parse_webhook_status(d.pop("webhook_status", UNSET))


        def _parse_webhook_last_attempt_at(data: object) -> datetime.datetime | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                webhook_last_attempt_at_type_0 = isoparse(data)



                return webhook_last_attempt_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None | Unset, data)

        webhook_last_attempt_at = _parse_webhook_last_attempt_at(d.pop("webhook_last_attempt_at", UNSET))


        def _parse_webhook_last_status_code(data: object) -> int | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(int | None | Unset, data)

        webhook_last_status_code = _parse_webhook_last_status_code(d.pop("webhook_last_status_code", UNSET))


        def _parse_webhook_last_error(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        webhook_last_error = _parse_webhook_last_error(d.pop("webhook_last_error", UNSET))


        def _parse_webhook_fired_at(data: object) -> datetime.datetime | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                webhook_fired_at_type_0 = isoparse(data)



                return webhook_fired_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None | Unset, data)

        webhook_fired_at = _parse_webhook_fired_at(d.pop("webhook_fired_at", UNSET))


        def _parse_smtp_helo(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        smtp_helo = _parse_smtp_helo(d.pop("smtp_helo", UNSET))


        def _parse_smtp_mail_from(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        smtp_mail_from = _parse_smtp_mail_from(d.pop("smtp_mail_from", UNSET))


        def _parse_smtp_rcpt_to(data: object) -> list[str] | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, list):
                    raise TypeError()
                smtp_rcpt_to_type_0 = cast(list[str], data)

                return smtp_rcpt_to_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(list[str] | None | Unset, data)

        smtp_rcpt_to = _parse_smtp_rcpt_to(d.pop("smtp_rcpt_to", UNSET))


        def _parse_from_header(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        from_header = _parse_from_header(d.pop("from_header", UNSET))


        def _parse_content_discarded_at(data: object) -> datetime.datetime | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                content_discarded_at_type_0 = isoparse(data)



                return content_discarded_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None | Unset, data)

        content_discarded_at = _parse_content_discarded_at(d.pop("content_discarded_at", UNSET))


        def _parse_content_discarded_by_delivery_id(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        content_discarded_by_delivery_id = _parse_content_discarded_by_delivery_id(d.pop("content_discarded_by_delivery_id", UNSET))


        email_detail = cls(
            id=id,
            sender=sender,
            recipient=recipient,
            status=status,
            domain=domain,
            created_at=created_at,
            received_at=received_at,
            webhook_attempt_count=webhook_attempt_count,
            from_email=from_email,
            to_email=to_email,
            message_id=message_id,
            domain_id=domain_id,
            org_id=org_id,
            subject=subject,
            body_text=body_text,
            body_html=body_html,
            spam_score=spam_score,
            raw_size_bytes=raw_size_bytes,
            raw_sha256=raw_sha256,
            rejection_reason=rejection_reason,
            webhook_status=webhook_status,
            webhook_last_attempt_at=webhook_last_attempt_at,
            webhook_last_status_code=webhook_last_status_code,
            webhook_last_error=webhook_last_error,
            webhook_fired_at=webhook_fired_at,
            smtp_helo=smtp_helo,
            smtp_mail_from=smtp_mail_from,
            smtp_rcpt_to=smtp_rcpt_to,
            from_header=from_header,
            content_discarded_at=content_discarded_at,
            content_discarded_by_delivery_id=content_discarded_by_delivery_id,
        )


        email_detail.additional_properties = d
        return email_detail

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
