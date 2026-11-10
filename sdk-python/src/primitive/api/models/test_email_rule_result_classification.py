from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="TestEmailRuleResultClassification")



@_attrs_define
class TestEmailRuleResultClassification:
    """ 
        Attributes:
            classified_now (int): Emails this test classified and saved.
            still_unclassified (int): Emails left without a classification (unclassified); a skipped email is counted under
                skipped instead.
     """

    classified_now: int
    still_unclassified: int
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        classified_now = self.classified_now

        still_unclassified = self.still_unclassified


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "classified_now": classified_now,
            "still_unclassified": still_unclassified,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        classified_now = d.pop("classified_now")

        still_unclassified = d.pop("still_unclassified")

        test_email_rule_result_classification = cls(
            classified_now=classified_now,
            still_unclassified=still_unclassified,
        )


        test_email_rule_result_classification.additional_properties = d
        return test_email_rule_result_classification

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
