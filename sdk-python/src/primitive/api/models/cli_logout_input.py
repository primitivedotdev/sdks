from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from uuid import UUID






T = TypeVar("T", bound="CliLogoutInput")



@_attrs_define
class CliLogoutInput:
    """ 
        Attributes:
            key_id (UUID | Unset): Optional id guard; when provided it must match the authenticated OAuth grant id or API
                key id
     """

    key_id: UUID | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        key_id: str | Unset = UNSET
        if not isinstance(self.key_id, Unset):
            key_id = str(self.key_id)


        field_dict: dict[str, Any] = {}

        field_dict.update({
        })
        if key_id is not UNSET:
            field_dict["key_id"] = key_id

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        _key_id = d.pop("key_id", UNSET)
        key_id: UUID | Unset
        if isinstance(_key_id,  Unset):
            key_id = UNSET
        else:
            key_id = UUID(_key_id)




        cli_logout_input = cls(
            key_id=key_id,
        )

        return cli_logout_input

