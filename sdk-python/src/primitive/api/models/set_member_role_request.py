from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="SetMemberRoleRequest")



@_attrs_define
class SetMemberRoleRequest:
    """ 
        Attributes:
            role (str):
     """

    role: str





    def to_dict(self) -> dict[str, Any]:
        role = self.role


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "role": role,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        role = d.pop("role")

        set_member_role_request = cls(
            role=role,
        )

        return set_member_role_request

