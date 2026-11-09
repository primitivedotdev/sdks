from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="OrgSettingsGetSearchSettingsResult")



@_attrs_define
class OrgSettingsGetSearchSettingsResult:
    """ 
        Attributes:
            semantic_search_opt_in (bool):
            paid_plan (bool):
            available (bool):
            hipaa_mode (bool):
            active (bool):
     """

    semantic_search_opt_in: bool
    paid_plan: bool
    available: bool
    hipaa_mode: bool
    active: bool
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        semantic_search_opt_in = self.semantic_search_opt_in

        paid_plan = self.paid_plan

        available = self.available

        hipaa_mode = self.hipaa_mode

        active = self.active


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "semantic_search_opt_in": semantic_search_opt_in,
            "paid_plan": paid_plan,
            "available": available,
            "hipaa_mode": hipaa_mode,
            "active": active,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        semantic_search_opt_in = d.pop("semantic_search_opt_in")

        paid_plan = d.pop("paid_plan")

        available = d.pop("available")

        hipaa_mode = d.pop("hipaa_mode")

        active = d.pop("active")

        org_settings_get_search_settings_result = cls(
            semantic_search_opt_in=semantic_search_opt_in,
            paid_plan=paid_plan,
            available=available,
            hipaa_mode=hipaa_mode,
            active=active,
        )


        org_settings_get_search_settings_result.additional_properties = d
        return org_settings_get_search_settings_result

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
