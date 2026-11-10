from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.list_email_rule_results_result_classification_type_0_facts_additional_property import ListEmailRuleResultsResultClassificationType0FactsAdditionalProperty





T = TypeVar("T", bound="ListEmailRuleResultsResultClassificationType0Facts")



@_attrs_define
class ListEmailRuleResultsResultClassificationType0Facts:
    """ Every fact column, as rule conditions read it: the value (a multi's options lowercased; null if the classifier left
    it out or wrote another shape) and its confidence. It can differ from GET /emails/{id} understanding, which shows
    the facts as written.

     """

    additional_properties: dict[str, ListEmailRuleResultsResultClassificationType0FactsAdditionalProperty] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.list_email_rule_results_result_classification_type_0_facts_additional_property import ListEmailRuleResultsResultClassificationType0FactsAdditionalProperty # noqa: PLC0415
        
        field_dict: dict[str, Any] = {}
        for prop_name, prop in self.additional_properties.items():
            field_dict[prop_name] = prop.to_dict()


        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.list_email_rule_results_result_classification_type_0_facts_additional_property import ListEmailRuleResultsResultClassificationType0FactsAdditionalProperty # noqa: PLC0415
        d = dict(src_dict)
        list_email_rule_results_result_classification_type_0_facts = cls(
        )


        from ..models.list_email_rule_results_result_classification_type_0_facts_additional_property_value_confidences import ListEmailRuleResultsResultClassificationType0FactsAdditionalPropertyValueConfidences # noqa: PLC0415
        additional_properties = {}
        for prop_name, prop_dict in d.items():
            additional_property = ListEmailRuleResultsResultClassificationType0FactsAdditionalProperty.from_dict(prop_dict)



            additional_properties[prop_name] = additional_property

        list_email_rule_results_result_classification_type_0_facts.additional_properties = additional_properties
        return list_email_rule_results_result_classification_type_0_facts

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> ListEmailRuleResultsResultClassificationType0FactsAdditionalProperty:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: ListEmailRuleResultsResultClassificationType0FactsAdditionalProperty) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
