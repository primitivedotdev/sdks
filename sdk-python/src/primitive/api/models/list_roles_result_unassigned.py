from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.list_roles_result_unassigned_key import ListRolesResultUnassignedKey
from typing import cast






T = TypeVar("T", bound="ListRolesResultUnassigned")



@_attrs_define
class ListRolesResultUnassigned:
    """ What role restricted means on a member with no role_id: no role of their own. Not a role, never assignable.

        Attributes:
            key (ListRolesResultUnassignedKey):
            name (str):
            description (str):
            permissions (list[str]):
     """

    key: ListRolesResultUnassignedKey
    name: str
    description: str
    permissions: list[str]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        key = self.key.value

        name = self.name

        description = self.description

        permissions = self.permissions




        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "key": key,
            "name": name,
            "description": description,
            "permissions": permissions,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        key = ListRolesResultUnassignedKey(d.pop("key"))




        name = d.pop("name")

        description = d.pop("description")

        permissions = cast(list[str], d.pop("permissions"))


        list_roles_result_unassigned = cls(
            key=key,
            name=name,
            description=description,
            permissions=permissions,
        )


        list_roles_result_unassigned.additional_properties = d
        return list_roles_result_unassigned

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
