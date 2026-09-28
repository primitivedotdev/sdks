from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast






T = TypeVar("T", bound="PutContactBodyType0")



@_attrs_define
class PutContactBodyType0:
    """ 
        Attributes:
            if_absent (bool):
            display_name (None | str | Unset):
     """

    if_absent: bool
    display_name: None | str | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        if_absent = self.if_absent

        display_name: None | str | Unset
        if isinstance(self.display_name, Unset):
            display_name = UNSET
        else:
            display_name = self.display_name


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "if_absent": if_absent,
        })
        if display_name is not UNSET:
            field_dict["display_name"] = display_name

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        if_absent = d.pop("if_absent")

        def _parse_display_name(data: object) -> None | str | Unset:
            if data is None:
                return data
            if isinstance(data, Unset):
                return data
            return cast(None | str | Unset, data)

        display_name = _parse_display_name(d.pop("display_name", UNSET))


        put_contact_body_type_0 = cls(
            if_absent=if_absent,
            display_name=display_name,
        )

        return put_contact_body_type_0

