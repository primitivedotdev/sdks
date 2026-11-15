from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.list_email_rule_results_result_rules_item import ListEmailRuleResultsResultRulesItem





T = TypeVar("T", bound="ListEmailRuleResultsResult")



@_attrs_define
class ListEmailRuleResultsResult:
    """ 
        Attributes:
            rules (list[ListEmailRuleResultsResultRulesItem]): Rules you can see, and read_only ones: matched first, then
                not matched, then not run; newest first within each.
            hidden (int): Rules that decided on this email that you cannot see.
            not_listed (int): Rules you can see past the 50 listed.
     """

    rules: list[ListEmailRuleResultsResultRulesItem]
    hidden: int
    not_listed: int
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.list_email_rule_results_result_rules_item import ListEmailRuleResultsResultRulesItem # noqa: PLC0415
        rules = []
        for rules_item_data in self.rules:
            rules_item = rules_item_data.to_dict()
            rules.append(rules_item)



        hidden = self.hidden

        not_listed = self.not_listed


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "rules": rules,
            "hidden": hidden,
            "not_listed": not_listed,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.list_email_rule_results_result_rules_item import ListEmailRuleResultsResultRulesItem # noqa: PLC0415
        d = dict(src_dict)
        rules = []
        _rules = d.pop("rules")
        for rules_item_data in (_rules):
            rules_item = ListEmailRuleResultsResultRulesItem.from_dict(rules_item_data)



            rules.append(rules_item)


        hidden = d.pop("hidden")

        not_listed = d.pop("not_listed")

        list_email_rule_results_result = cls(
            rules=rules,
            hidden=hidden,
            not_listed=not_listed,
        )


        list_email_rule_results_result.additional_properties = d
        return list_email_rule_results_result

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
