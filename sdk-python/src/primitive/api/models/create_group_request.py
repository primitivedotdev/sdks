from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID






T = TypeVar("T", bound="CreateGroupRequest")



@_attrs_define
class CreateGroupRequest:
    """ 
        Attributes:
            name (str):
            description (None | str | Unset):
            role (None | str | Unset):
            members (list[UUID] | Unset):
     """

    name: str
    description: None | str | Unset = UNSET
    role: None | str | Unset = UNSET
    members: list[UUID] | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        name = self.name

        description: None | str | Unset
        if isinstance(self.description, Unset):
            description = UNSET
        else:
            description = self.description

        role: None | str | Unset
        if isinstance(self.role, Unset):
            role = UNSET
        else:
            role = self.role

        members: list[str] | Unset = UNSET
        if not isinstance(self.members, Unset):
            members = []
            for members_item_data in self.members:
                members_item = str(members_item_data)
                members.append(members_item)




        field_dict: dict[str, Any] = {}

        field_dict.update({
            "name": name,
        })
        if description is not UNSET:
            field_dict["description"] = description
        if role is not UNSET:
            field_dict["role"] = role
        if members is not UNSET:
            field_dict["members"] = members

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        name = d.pop("name")

        def _parse_description(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        description = _parse_description(d.pop("description", UNSET))


        def _parse_role(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        role = _parse_role(d.pop("role", UNSET))


        _members = d.pop("members", UNSET)
        members: list[UUID] | Unset = UNSET
        if _members is not UNSET:
            members = []
            for members_item_data in _members:
                members_item = UUID(members_item_data)



                members.append(members_item)


        create_group_request = cls(
            name=name,
            description=description,
            role=role,
            members=members,
        )

        return create_group_request

