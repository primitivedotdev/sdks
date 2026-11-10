from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.test_email_rule_on_sample_result_values_additional_property import TestEmailRuleOnSampleResultValuesAdditionalProperty





T = TypeVar("T", bound="TestEmailRuleOnSampleResultValues")



@_attrs_define
class TestEmailRuleOnSampleResultValues:
    """ By column the rule names: the value as its conditions compared it (a list cut at 50), and a fact's confidence. A
    fact left out reads null.

     """

    additional_properties: dict[str, TestEmailRuleOnSampleResultValuesAdditionalProperty] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.test_email_rule_on_sample_result_values_additional_property import TestEmailRuleOnSampleResultValuesAdditionalProperty # noqa: PLC0415
        
        field_dict: dict[str, Any] = {}
        for prop_name, prop in self.additional_properties.items():
            field_dict[prop_name] = prop.to_dict()


        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.test_email_rule_on_sample_result_values_additional_property import TestEmailRuleOnSampleResultValuesAdditionalProperty # noqa: PLC0415
        d = dict(src_dict)
        test_email_rule_on_sample_result_values = cls(
        )


        from ..models.test_email_rule_on_sample_result_values_additional_property_value_confidences import TestEmailRuleOnSampleResultValuesAdditionalPropertyValueConfidences # noqa: PLC0415
        additional_properties = {}
        for prop_name, prop_dict in d.items():
            additional_property = TestEmailRuleOnSampleResultValuesAdditionalProperty.from_dict(prop_dict)



            additional_properties[prop_name] = additional_property

        test_email_rule_on_sample_result_values.additional_properties = additional_properties
        return test_email_rule_on_sample_result_values

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> TestEmailRuleOnSampleResultValuesAdditionalProperty:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: TestEmailRuleOnSampleResultValuesAdditionalProperty) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
