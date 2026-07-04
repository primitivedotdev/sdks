from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import Literal, cast






T = TypeVar("T", bound="TemplateSourceType0")



@_attrs_define
class TemplateSourceType0:
    """ 
        Attributes:
            mode (Literal['managed-build']):
            dir_ (str):  Default: '.'.
     """

    mode: Literal['managed-build']
    dir_: str = '.'





    def to_dict(self) -> dict[str, Any]:
        mode = self.mode

        dir_ = self.dir_


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "mode": mode,
            "dir": dir_,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        mode = cast(Literal['managed-build'] , d.pop("mode"))
        if mode != 'managed-build':
            raise ValueError(f"mode must match const 'managed-build', got '{mode}'")

        dir_ = d.pop("dir")

        template_source_type_0 = cls(
            mode=mode,
            dir_=dir_,
        )

        return template_source_type_0

