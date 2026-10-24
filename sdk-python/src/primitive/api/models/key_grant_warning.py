from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast






T = TypeVar("T", bound="KeyGrantWarning")



@_attrs_define
class KeyGrantWarning:
    """ A permission the server added because a chosen one implies it.

        Attributes:
            permission (str):
            adds (list[str]):
            why (str):
            description (str):
     """

    permission: str
    adds: list[str]
    why: str
    description: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        permission = self.permission

        adds = self.adds



        why = self.why

        description = self.description


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "permission": permission,
            "adds": adds,
            "why": why,
            "description": description,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        permission = d.pop("permission")

        adds = cast(list[str], d.pop("adds"))


        why = d.pop("why")

        description = d.pop("description")

        key_grant_warning = cls(
            permission=permission,
            adds=adds,
            why=why,
            description=description,
        )


        key_grant_warning.additional_properties = d
        return key_grant_warning

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
