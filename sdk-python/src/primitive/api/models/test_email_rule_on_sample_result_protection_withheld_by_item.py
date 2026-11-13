from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.test_email_rule_on_sample_result_protection_withheld_by_item_reason import TestEmailRuleOnSampleResultProtectionWithheldByItemReason
from uuid import UUID






T = TypeVar("T", bound="TestEmailRuleOnSampleResultProtectionWithheldByItem")



@_attrs_define
class TestEmailRuleOnSampleResultProtectionWithheldByItem:
    """ 
        Attributes:
            id (UUID):
            name (str):
            reason (TestEmailRuleOnSampleResultProtectionWithheldByItemReason):
     """

    id: UUID
    name: str
    reason: TestEmailRuleOnSampleResultProtectionWithheldByItemReason
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        name = self.name

        reason = self.reason.value


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "name": name,
            "reason": reason,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        name = d.pop("name")

        reason = TestEmailRuleOnSampleResultProtectionWithheldByItemReason(d.pop("reason"))




        test_email_rule_on_sample_result_protection_withheld_by_item = cls(
            id=id,
            name=name,
            reason=reason,
        )


        test_email_rule_on_sample_result_protection_withheld_by_item.additional_properties = d
        return test_email_rule_on_sample_result_protection_withheld_by_item

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
