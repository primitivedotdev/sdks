from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="ProjectsListProjectsResultItemsItemAccess")



@_attrs_define
class ProjectsListProjectsResultItemsItemAccess:
    """ 
        Attributes:
            can_manage (bool):
            can_invite (bool):
     """

    can_manage: bool
    can_invite: bool
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        can_manage = self.can_manage

        can_invite = self.can_invite


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "can_manage": can_manage,
            "can_invite": can_invite,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        can_manage = d.pop("can_manage")

        can_invite = d.pop("can_invite")

        projects_list_projects_result_items_item_access = cls(
            can_manage=can_manage,
            can_invite=can_invite,
        )


        projects_list_projects_result_items_item_access.additional_properties = d
        return projects_list_projects_result_items_item_access

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
