from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.memory_scope_type_0_type import MemoryScopeType0Type






T = TypeVar("T", bound="MemoryScopeType0")



@_attrs_define
class MemoryScopeType0:
    """ 
        Attributes:
            type_ (MemoryScopeType0Type):
     """

    type_: MemoryScopeType0Type





    def to_dict(self) -> dict[str, Any]:
        type_ = self.type_.value


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "type": type_,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        type_ = MemoryScopeType0Type(d.pop("type"))




        memory_scope_type_0 = cls(
            type_=type_,
        )

        return memory_scope_type_0

