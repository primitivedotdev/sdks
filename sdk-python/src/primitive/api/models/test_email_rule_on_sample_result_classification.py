from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.test_email_rule_on_sample_result_classification_status import TestEmailRuleOnSampleResultClassificationStatus






T = TypeVar("T", bound="TestEmailRuleOnSampleResultClassification")



@_attrs_define
class TestEmailRuleOnSampleResultClassification:
    """ Whether the email was classified; without a classification, a rule that reads a fact does not match.

        Attributes:
            status (TestEmailRuleOnSampleResultClassificationStatus):
            error_class (str | Unset):
     """

    status: TestEmailRuleOnSampleResultClassificationStatus
    error_class: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        status = self.status.value

        error_class = self.error_class


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "status": status,
        })
        if error_class is not UNSET:
            field_dict["error_class"] = error_class

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        status = TestEmailRuleOnSampleResultClassificationStatus(d.pop("status"))




        error_class = d.pop("error_class", UNSET)

        test_email_rule_on_sample_result_classification = cls(
            status=status,
            error_class=error_class,
        )


        test_email_rule_on_sample_result_classification.additional_properties = d
        return test_email_rule_on_sample_result_classification

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
