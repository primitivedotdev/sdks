from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID
import datetime

if TYPE_CHECKING:
  from ..models.email_rule_row_attachment import EmailRuleRowAttachment





T = TypeVar("T", bound="EmailRuleChangedEmailsEmailsItem")



@_attrs_define
class EmailRuleChangedEmailsEmailsItem:
    """ 
        Attributes:
            email_id (UUID):
            subject (None | str):
            from_ (None | str):
            received_at (datetime.datetime | None):
            attachments (list[EmailRuleRowAttachment] | None): The email's named attachments, as its row in results gives
                them: in order, at most 10 (attachment_count counts them all), [] for none, null when its content could not be
                read.
            attachment_count (int | None): How many named attachments the email has in all, listed or not. Null exactly when
                attachments is.
     """

    email_id: UUID
    subject: None | str
    from_: None | str
    received_at: datetime.datetime | None
    attachments: list[EmailRuleRowAttachment] | None
    attachment_count: int | None
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.email_rule_row_attachment import EmailRuleRowAttachment # noqa: PLC0415
        email_id = str(self.email_id)

        subject: None | str
        subject = self.subject

        from_: None | str
        from_ = self.from_

        received_at: None | str
        if isinstance(self.received_at, datetime.datetime):
            received_at = self.received_at.isoformat()
        else:
            received_at = self.received_at

        attachments: list[dict[str, Any]] | None
        if isinstance(self.attachments, list):
            attachments = []
            for attachments_type_0_item_data in self.attachments:
                attachments_type_0_item = attachments_type_0_item_data.to_dict()
                attachments.append(attachments_type_0_item)


        else:
            attachments = self.attachments

        attachment_count: int | None
        attachment_count = self.attachment_count


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "email_id": email_id,
            "subject": subject,
            "from": from_,
            "received_at": received_at,
            "attachments": attachments,
            "attachment_count": attachment_count,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.email_rule_row_attachment import EmailRuleRowAttachment # noqa: PLC0415
        d = dict(src_dict)
        email_id = UUID(d.pop("email_id"))




        def _parse_subject(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        subject = _parse_subject(d.pop("subject"))


        def _parse_from_(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        from_ = _parse_from_(d.pop("from"))


        def _parse_received_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                received_at_type_0 = datetime.datetime.fromisoformat(data)



                return received_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        received_at = _parse_received_at(d.pop("received_at"))


        def _parse_attachments(data: object) -> list[EmailRuleRowAttachment] | None:
            if data is None:
                return data
            try:
                if not isinstance(data, list):
                    raise TypeError()
                attachments_type_0 = []
                _attachments_type_0 = data
                for attachments_type_0_item_data in (_attachments_type_0):
                    attachments_type_0_item = EmailRuleRowAttachment.from_dict(attachments_type_0_item_data)



                    attachments_type_0.append(attachments_type_0_item)

                return attachments_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(list[EmailRuleRowAttachment] | None, data)

        attachments = _parse_attachments(d.pop("attachments"))


        def _parse_attachment_count(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        attachment_count = _parse_attachment_count(d.pop("attachment_count"))


        email_rule_changed_emails_emails_item = cls(
            email_id=email_id,
            subject=subject,
            from_=from_,
            received_at=received_at,
            attachments=attachments,
            attachment_count=attachment_count,
        )


        email_rule_changed_emails_emails_item.additional_properties = d
        return email_rule_changed_emails_emails_item

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
