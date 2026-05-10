from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="UpdateFunctionInput")



@_attrs_define
class UpdateFunctionInput:
    """ 
        Attributes:
            code (str): New bundled handler. Same rules as CreateFunctionInput.code.
            source_map (str | Unset):
     """

    code: str
    source_map: str | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        code = self.code

        source_map = self.source_map


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "code": code,
        })
        if source_map is not UNSET:
            field_dict["sourceMap"] = source_map

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        code = d.pop("code")

        source_map = d.pop("sourceMap", UNSET)

        update_function_input = cls(
            code=code,
            source_map=source_map,
        )

        return update_function_input

