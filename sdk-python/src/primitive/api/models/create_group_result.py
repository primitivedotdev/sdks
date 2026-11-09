from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast






T = TypeVar("T", bound="CreateGroupResult")



@_attrs_define
class CreateGroupResult:
    """ 
        Attributes:
            id (str):
            name (str):
            description (None | str):
            role_id (None | str):
            members (list[str]):
     """

    id: str
    name: str
    description: None | str
    role_id: None | str
    members: list[str]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        id = self.id

        name = self.name

        description: None | str
        description = self.description

        role_id: None | str
        role_id = self.role_id

        members = self.members




        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "name": name,
            "description": description,
            "role_id": role_id,
            "members": members,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = d.pop("id")

        name = d.pop("name")

        def _parse_description(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        description = _parse_description(d.pop("description"))


        def _parse_role_id(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        role_id = _parse_role_id(d.pop("role_id"))


        members = cast(list[str], d.pop("members"))


        create_group_result = cls(
            id=id,
            name=name,
            description=description,
            role_id=role_id,
            members=members,
        )


        create_group_result.additional_properties = d
        return create_group_result

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
