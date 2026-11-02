from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID
import datetime






T = TypeVar("T", bound="EmailRuleDecision")



@_attrs_define
class EmailRuleDecision:
    """ A rule's decision for one email.

        Attributes:
            id (UUID):
            email_id (UUID): The email.
            rule_version (int): The deciding rule version.
            classification_id (UUID): The classification it used.
            matched (bool): Whether the rule matched.
            near_miss (bool): Whether all but one part held.
            parts (list[Any]): How each top-level part decided.
            question_answers (list[Any]): Answers to the rule's questions, when asked.
            created_at (datetime.datetime):
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
        })

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




        email_rule_decision = cls(
            id=id,
            email_id=email_id,
            rule_version=rule_version,
            classification_id=classification_id,
            matched=matched,
            near_miss=near_miss,
            parts=parts,
            question_answers=question_answers,
            created_at=created_at,
        )


        email_rule_decision.additional_properties = d
        return email_rule_decision

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
