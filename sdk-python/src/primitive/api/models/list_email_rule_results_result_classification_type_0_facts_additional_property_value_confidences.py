from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="ListEmailRuleResultsResultClassificationType0FactsAdditionalPropertyValueConfidences")



@_attrs_define
class ListEmailRuleResultsResultClassificationType0FactsAdditionalPropertyValueConfidences:
    """ A multi fact's chosen values, each with its own confidence: what a min_confidence on the column tests. Given in rule
    test results.

     """

    additional_properties: dict[str, float] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        
        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        list_email_rule_results_result_classification_type_0_facts_additional_property_value_confidences = cls(
        )


        list_email_rule_results_result_classification_type_0_facts_additional_property_value_confidences.additional_properties = d
        return list_email_rule_results_result_classification_type_0_facts_additional_property_value_confidences

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> float:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: float) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
