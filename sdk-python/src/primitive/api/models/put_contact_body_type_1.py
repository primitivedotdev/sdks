from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID






T = TypeVar("T", bound="PutContactBodyType1")



@_attrs_define
class PutContactBodyType1:
    """ 
        Attributes:
            if_version (UUID): Opaque CAS token. Changes on mutations and cannot be reused after deletion/recreation.
            display_name (None | str | Unset):
     """

    if_version: UUID
    display_name: None | str | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        if_version = str(self.if_version)

        display_name: None | str | Unset
        if isinstance(self.display_name, Unset):
            display_name = UNSET
        else:
            display_name = self.display_name


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "if_version": if_version,
        })
        if display_name is not UNSET:
            field_dict["display_name"] = display_name

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        if_version = UUID(d.pop("if_version"))




        def _parse_display_name(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        display_name = _parse_display_name(d.pop("display_name", UNSET))


        put_contact_body_type_1 = cls(
            if_version=if_version,
            display_name=display_name,
        )

        return put_contact_body_type_1

