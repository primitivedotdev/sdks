from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID






T = TypeVar("T", bound="PutContactRequest")



@_attrs_define
class PutContactRequest:
    """ 
        Attributes:
            display_name (None | str | Unset):
            if_absent (bool | Unset):
            if_version (UUID | Unset): Opaque CAS token. Changes on mutations and cannot be reused after
                deletion/recreation.
     """

    display_name: None | str | Unset = UNSET
    if_absent: bool | Unset = UNSET
    if_version: UUID | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        display_name: None | str | Unset
        if isinstance(self.display_name, Unset):
            display_name = UNSET
        else:
            display_name = self.display_name

        if_absent = self.if_absent

        if_version: str | Unset = UNSET
        if not isinstance(self.if_version, Unset):
            if_version = str(self.if_version)


        field_dict: dict[str, Any] = {}

        field_dict.update({
        })
        if display_name is not UNSET:
            field_dict["display_name"] = display_name
        if if_absent is not UNSET:
            field_dict["if_absent"] = if_absent
        if if_version is not UNSET:
            field_dict["if_version"] = if_version

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        def _parse_display_name(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        display_name = _parse_display_name(d.pop("display_name", UNSET))


        if_absent = d.pop("if_absent", UNSET)

        _if_version = d.pop("if_version", UNSET)
        if_version: UUID | Unset
        if isinstance(_if_version,  Unset):
            if_version = UNSET
        else:
            if_version = UUID(_if_version)




        put_contact_request = cls(
            display_name=display_name,
            if_absent=if_absent,
            if_version=if_version,
        )

        return put_contact_request

