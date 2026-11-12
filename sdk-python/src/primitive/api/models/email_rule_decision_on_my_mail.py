from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID
import datetime






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
            question_answers (list[Any]): The answers to the rule's own questions, when they were asked.
            created_at (datetime.datetime):
            from_address (None | str): The email's sender address, as GET /v1/emails/{id} shows it.
            subject (None | str):
            received_at (datetime.datetime | None): When the email arrived. Null, with the other two, when you are not shown
                the email (it awaits sender authentication).
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
    created_at: datetime.datetime
    from_address: None | str
    subject: None | str
    received_at: datetime.datetime | None
    detail_withheld: bool | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        email_id = str(self.email_id)

        rule_version = self.rule_version

        classification_id = str(self.classification_id)

        matched = self.matched

        near_miss = self.near_miss

        parts = self.parts



        question_answers = self.question_answers



        created_at = self.created_at.isoformat()

        from_address: None | str
        from_address = self.from_address

        subject: None | str
        subject = self.subject

        received_at: None | str
        if isinstance(self.received_at, datetime.datetime):
            received_at = self.received_at.isoformat()
        else:
            received_at = self.received_at

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
            "created_at": created_at,
            "from_address": from_address,
            "subject": subject,
            "received_at": received_at,
        })
        if detail_withheld is not UNSET:
            field_dict["detail_withheld"] = detail_withheld

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        email_id = UUID(d.pop("email_id"))




        rule_version = d.pop("rule_version")

        classification_id = UUID(d.pop("classification_id"))




        matched = d.pop("matched")

        near_miss = d.pop("near_miss")

        parts = cast(list[Any], d.pop("parts"))


        question_answers = cast(list[Any], d.pop("question_answers"))


        created_at = datetime.datetime.fromisoformat(d.pop("created_at"))




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
            created_at=created_at,
            from_address=from_address,
            subject=subject,
            received_at=received_at,
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
