from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="TestEmailRuleResultSummaryConditionsItem")



@_attrs_define
class TestEmailRuleResultSummaryConditionsItem:
    """ 
        Attributes:
            index (int):
            text (str):
            held (int):
            failed (int):
            only_failure (int):
     """

    index: int
    text: str
    held: int
    failed: int
    only_failure: int
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        index = self.index

        text = self.text

        held = self.held

        failed = self.failed

        only_failure = self.only_failure


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "index": index,
            "text": text,
            "held": held,
            "failed": failed,
            "only_failure": only_failure,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        index = d.pop("index")

        text = d.pop("text")

        held = d.pop("held")

        failed = d.pop("failed")

        only_failure = d.pop("only_failure")

        test_email_rule_result_summary_conditions_item = cls(
            index=index,
            text=text,
            held=held,
            failed=failed,
            only_failure=only_failure,
        )


        test_email_rule_result_summary_conditions_item.additional_properties = d
        return test_email_rule_result_summary_conditions_item

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
