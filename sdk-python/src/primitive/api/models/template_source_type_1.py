from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import Literal, cast






T = TypeVar("T", bound="TemplateSourceType1")



@_attrs_define
class TemplateSourceType1:
    """ 
        Attributes:
            mode (Literal['bundle']):
            file (str):
     """

    mode: Literal['bundle']
    file: str





    def to_dict(self) -> dict[str, Any]:
        mode = self.mode

        file = self.file


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "mode": mode,
            "file": file,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        mode = cast(Literal['bundle'] , d.pop("mode"))
        if mode != 'bundle':
            raise ValueError(f"mode must match const 'bundle', got '{mode}'")

        file = d.pop("file")

        template_source_type_1 = cls(
            mode=mode,
            file=file,
        )

        return template_source_type_1

