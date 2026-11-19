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





T = TypeVar("T", bound="EmailRuleDecisionOnMyMail")



@_attrs_define
class EmailRuleDecisionOnMyMail:
    """ 
        Attributes:
            id (UUID):
            email_id (UUID):
            rule_version (int):
            classification_id (UUID):
            matched (bool):
            near_miss (bool): Not matched, but nearly. False when detail_withheld is true.
            parts (list[Any]): How each top-level part of the rule decided.
            question_answers (list[Any]): The answers to the rule's own questions, when they were asked: each with question,
                answer, confidence and, when unanswered, error_class, as a test gives them.
            decided_at (datetime.datetime): When the rule made this decision.
            from_address (None | str): The email's sender address, as GET /v1/emails/{id} shows it.
            subject (None | str):
            recipient (None | str): Which of your mailboxes the email was received in.
            received_at (datetime.datetime | None): When the email arrived. Null, with from_address, subject and recipient,
                when you are not shown the email (it awaits sender authentication).
            attachments (list[EmailRuleRowAttachment] | None): The email's named attachments, in order, at most 10
                (attachment_count counts them all). An empty list means the email has none. Null when you cannot read the
                email's content (withheld, awaiting sender authentication, not parsed yet, failed to parse, or discarded), or
                are not shown the email: then whether it has any is not known to you. A part with no file name is not listed or
                counted.
            attachment_count (int | None): How many named attachments the email has in all, listed or not. Null exactly when
                attachments is.
            detail_withheld (bool | Unset): Present, as true, when the email's content cannot be read: matched still says
                what the rule decided, and parts and question_answers are empty.
     """

    id: UUID
    email_id: UUID
    rule_version: int
    classification_id: UUID
    matched: bool
    near_miss: bool
    parts: list[Any]
    question_answers: list[Any]
    decided_at: datetime.datetime
    from_address: None | str
    subject: None | str
    recipient: None | str
    received_at: datetime.datetime | None
    attachments: list[EmailRuleRowAttachment] | None
    attachment_count: int | None
    detail_withheld: bool | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.email_rule_row_attachment import EmailRuleRowAttachment # noqa: PLC0415
        id = str(self.id)

        email_id = str(self.email_id)

        rule_version = self.rule_version

        classification_id = str(self.classification_id)

        matched = self.matched

        near_miss = self.near_miss

        parts = self.parts



        question_answers = self.question_answers



        decided_at = self.decided_at.isoformat()

        from_address: None | str
        from_address = self.from_address

        subject: None | str
        subject = self.subject

        recipient: None | str
        recipient = self.recipient

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

        detail_withheld = self.detail_withheld


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "email_id": email_id,
            "rule_version": rule_version,
            "classification_id": classification_id,
            "matched": matched,
            "near_miss": near_miss,
            "parts": parts,
            "question_answers": question_answers,
            "decided_at": decided_at,
            "from_address": from_address,
            "subject": subject,
            "recipient": recipient,
            "received_at": received_at,
            "attachments": attachments,
            "attachment_count": attachment_count,
        })
        if detail_withheld is not UNSET:
            field_dict["detail_withheld"] = detail_withheld

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.email_rule_row_attachment import EmailRuleRowAttachment # noqa: PLC0415
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        email_id = UUID(d.pop("email_id"))




        rule_version = d.pop("rule_version")

        classification_id = UUID(d.pop("classification_id"))




        matched = d.pop("matched")

        near_miss = d.pop("near_miss")

        parts = cast(list[Any], d.pop("parts"))


        question_answers = cast(list[Any], d.pop("question_answers"))


        decided_at = datetime.datetime.fromisoformat(d.pop("decided_at"))




        def _parse_from_address(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        from_address = _parse_from_address(d.pop("from_address"))


        def _parse_subject(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        subject = _parse_subject(d.pop("subject"))


        def _parse_recipient(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        recipient = _parse_recipient(d.pop("recipient"))


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


        detail_withheld = d.pop("detail_withheld", UNSET)

        email_rule_decision_on_my_mail = cls(
            id=id,
            email_id=email_id,
            rule_version=rule_version,
            classification_id=classification_id,
            matched=matched,
            near_miss=near_miss,
            parts=parts,
            question_answers=question_answers,
            decided_at=decided_at,
            from_address=from_address,
            subject=subject,
            recipient=recipient,
            received_at=received_at,
            attachments=attachments,
            attachment_count=attachment_count,
            detail_withheld=detail_withheld,
        )


        email_rule_decision_on_my_mail.additional_properties = d
        return email_rule_decision_on_my_mail

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
