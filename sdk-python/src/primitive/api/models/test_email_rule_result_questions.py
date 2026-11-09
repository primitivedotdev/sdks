from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="TestEmailRuleResultQuestions")



@_attrs_define
class TestEmailRuleResultQuestions:
    """ 
        Attributes:
            asked (int): Calls made to answer the rule's questions, one per matching email.
            capped (bool): Whether the per-test limit on those calls was reached.
     """

    asked: int
    capped: bool
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        asked = self.asked

        capped = self.capped


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "asked": asked,
            "capped": capped,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        asked = d.pop("asked")

        capped = d.pop("capped")

        test_email_rule_result_questions = cls(
            asked=asked,
            capped=capped,
        )


        test_email_rule_result_questions.additional_properties = d
        return test_email_rule_result_questions

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
