from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="ListRolesResultInvitations")



@_attrs_define
class ListRolesResultInvitations:
    """ 
        Attributes:
            limited_roles_available (bool):
            members_read_all_mail (bool):
     """

    limited_roles_available: bool
    members_read_all_mail: bool
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        limited_roles_available = self.limited_roles_available

        members_read_all_mail = self.members_read_all_mail


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "limited_roles_available": limited_roles_available,
            "members_read_all_mail": members_read_all_mail,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        limited_roles_available = d.pop("limited_roles_available")

        members_read_all_mail = d.pop("members_read_all_mail")

        list_roles_result_invitations = cls(
            limited_roles_available=limited_roles_available,
            members_read_all_mail=members_read_all_mail,
        )


        list_roles_result_invitations.additional_properties = d
        return list_roles_result_invitations

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
