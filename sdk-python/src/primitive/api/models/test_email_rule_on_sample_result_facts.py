from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.test_email_rule_on_sample_result_facts_additional_property import TestEmailRuleOnSampleResultFactsAdditionalProperty





T = TypeVar("T", bound="TestEmailRuleOnSampleResultFacts")



@_attrs_define
class TestEmailRuleOnSampleResultFacts:
    """ What the classifier read from the email, by fact: its value and confidence.

     """

    additional_properties: dict[str, TestEmailRuleOnSampleResultFactsAdditionalProperty] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.test_email_rule_on_sample_result_facts_additional_property import TestEmailRuleOnSampleResultFactsAdditionalProperty # noqa: PLC0415
        
        field_dict: dict[str, Any] = {}
        for prop_name, prop in self.additional_properties.items():
            field_dict[prop_name] = prop.to_dict()


        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.test_email_rule_on_sample_result_facts_additional_property import TestEmailRuleOnSampleResultFactsAdditionalProperty # noqa: PLC0415
        d = dict(src_dict)
        test_email_rule_on_sample_result_facts = cls(
        )


        additional_properties = {}
        for prop_name, prop_dict in d.items():
            additional_property = TestEmailRuleOnSampleResultFactsAdditionalProperty.from_dict(prop_dict)



            additional_properties[prop_name] = additional_property

        test_email_rule_on_sample_result_facts.additional_properties = additional_properties
        return test_email_rule_on_sample_result_facts

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> TestEmailRuleOnSampleResultFactsAdditionalProperty:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: TestEmailRuleOnSampleResultFactsAdditionalProperty) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
