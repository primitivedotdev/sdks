from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast






T = TypeVar("T", bound="UpdateEmailRuleResultScopeSelectionType0")



@_attrs_define
class UpdateEmailRuleResultScopeSelectionType0:
    """ What a selected rule names; null for any other scope.

        Attributes:
            addresses (list[str]):
            domains (list[str]):
     """

    addresses: list[str]
    domains: list[str]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        addresses = self.addresses



        domains = self.domains




        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "addresses": addresses,
            "domains": domains,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        addresses = cast(list[str], d.pop("addresses"))


        domains = cast(list[str], d.pop("domains"))


        update_email_rule_result_scope_selection_type_0 = cls(
            addresses=addresses,
            domains=domains,
        )


        update_email_rule_result_scope_selection_type_0.additional_properties = d
        return update_email_rule_result_scope_selection_type_0

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
