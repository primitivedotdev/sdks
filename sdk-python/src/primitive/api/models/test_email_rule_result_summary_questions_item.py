from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="TestEmailRuleResultSummaryQuestionsItem")



@_attrs_define
class TestEmailRuleResultSummaryQuestionsItem:
    """ 
        Attributes:
            index (int):
            yes (int):
            no (int):
            unanswered (int):
     """

    index: int
    yes: int
    no: int
    unanswered: int
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        index = self.index

        yes = self.yes

        no = self.no

        unanswered = self.unanswered


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "index": index,
            "yes": yes,
            "no": no,
            "unanswered": unanswered,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        index = d.pop("index")

        yes = d.pop("yes")

        no = d.pop("no")

        unanswered = d.pop("unanswered")

        test_email_rule_result_summary_questions_item = cls(
            index=index,
            yes=yes,
            no=no,
            unanswered=unanswered,
        )


        test_email_rule_result_summary_questions_item.additional_properties = d
        return test_email_rule_result_summary_questions_item

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
