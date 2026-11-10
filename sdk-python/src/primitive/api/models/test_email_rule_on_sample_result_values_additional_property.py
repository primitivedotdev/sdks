from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.test_email_rule_on_sample_result_values_additional_property_value_confidences import TestEmailRuleOnSampleResultValuesAdditionalPropertyValueConfidences





T = TypeVar("T", bound="TestEmailRuleOnSampleResultValuesAdditionalProperty")



@_attrs_define
class TestEmailRuleOnSampleResultValuesAdditionalProperty:
    """ 
        Attributes:
            value (bool | float | list[str] | None | str):
            confidence (float | None | Unset):
            value_confidences (TestEmailRuleOnSampleResultValuesAdditionalPropertyValueConfidences | Unset): A multi fact's
                chosen values, each with its own confidence: what a min_confidence on the column tests. Given in rule test
                results.
     """

    value: bool | float | list[str] | None | str
    confidence: float | None | Unset = UNSET
    value_confidences: TestEmailRuleOnSampleResultValuesAdditionalPropertyValueConfidences | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.test_email_rule_on_sample_result_values_additional_property_value_confidences import TestEmailRuleOnSampleResultValuesAdditionalPropertyValueConfidences # noqa: PLC0415
        value: bool | float | list[str] | None | str
        if isinstance(self.value, list):
            value = self.value


        else:
            value = self.value

        confidence: float | None | Unset
        if isinstance(self.confidence, Unset):
            confidence = UNSET
        else:
            confidence = self.confidence

        value_confidences: dict[str, Any] | Unset = UNSET
        if not isinstance(self.value_confidences, Unset):
            value_confidences = self.value_confidences.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "value": value,
        })
        if confidence is not UNSET:
            field_dict["confidence"] = confidence
        if value_confidences is not UNSET:
            field_dict["value_confidences"] = value_confidences

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.test_email_rule_on_sample_result_values_additional_property_value_confidences import TestEmailRuleOnSampleResultValuesAdditionalPropertyValueConfidences # noqa: PLC0415
        d = dict(src_dict)
        def _parse_value(data: object) -> bool | float | list[str] | None | str:
            if data is None:
                return data
            try:
                if not isinstance(data, list):
                    raise TypeError()
                value_type_3 = cast(list[str], data)

                return value_type_3
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(bool | float | list[str] | None | str, data)

        value = _parse_value(d.pop("value"))


        def _parse_confidence(data: object) -> float | None | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(float | None | Unset, data)

        confidence = _parse_confidence(d.pop("confidence", UNSET))


        _value_confidences = d.pop("value_confidences", UNSET)
        value_confidences: TestEmailRuleOnSampleResultValuesAdditionalPropertyValueConfidences | Unset
        if isinstance(_value_confidences,  Unset):
            value_confidences = UNSET
        else:
            value_confidences = TestEmailRuleOnSampleResultValuesAdditionalPropertyValueConfidences.from_dict(_value_confidences)




        test_email_rule_on_sample_result_values_additional_property = cls(
            value=value,
            confidence=confidence,
            value_confidences=value_confidences,
        )


        test_email_rule_on_sample_result_values_additional_property.additional_properties = d
        return test_email_rule_on_sample_result_values_additional_property

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
