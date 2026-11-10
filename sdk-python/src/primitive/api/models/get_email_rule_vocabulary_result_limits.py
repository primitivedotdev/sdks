from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="GetEmailRuleVocabularyResultLimits")



@_attrs_define
class GetEmailRuleVocabularyResultLimits:
    """ The most nesting levels (a condition is one), conditions, list values, characters in a text value and questions; a
    trimmed question's length bounds; and the most bytes the tree takes as stored JSON.

        Attributes:
            depth (int):
            conditions (int):
            list_values (int):
            text_length (int):
            questions (int):
            question_min_length (int):
            question_max_length (int):
            tree_bytes (int):
     """

    depth: int
    conditions: int
    list_values: int
    text_length: int
    questions: int
    question_min_length: int
    question_max_length: int
    tree_bytes: int
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        depth = self.depth

        conditions = self.conditions

        list_values = self.list_values

        text_length = self.text_length

        questions = self.questions

        question_min_length = self.question_min_length

        question_max_length = self.question_max_length

        tree_bytes = self.tree_bytes


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "depth": depth,
            "conditions": conditions,
            "list_values": list_values,
            "text_length": text_length,
            "questions": questions,
            "question_min_length": question_min_length,
            "question_max_length": question_max_length,
            "tree_bytes": tree_bytes,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        depth = d.pop("depth")

        conditions = d.pop("conditions")

        list_values = d.pop("list_values")

        text_length = d.pop("text_length")

        questions = d.pop("questions")

        question_min_length = d.pop("question_min_length")

        question_max_length = d.pop("question_max_length")

        tree_bytes = d.pop("tree_bytes")

        get_email_rule_vocabulary_result_limits = cls(
            depth=depth,
            conditions=conditions,
            list_values=list_values,
            text_length=text_length,
            questions=questions,
            question_min_length=question_min_length,
            question_max_length=question_max_length,
            tree_bytes=tree_bytes,
        )


        get_email_rule_vocabulary_result_limits.additional_properties = d
        return get_email_rule_vocabulary_result_limits

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
