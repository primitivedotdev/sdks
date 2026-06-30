from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.memory_scope_type_1_type import MemoryScopeType1Type
from uuid import UUID






T = TypeVar("T", bound="MemoryScopeType1")



@_attrs_define
class MemoryScopeType1:
    """ 
        Attributes:
            type_ (MemoryScopeType1Type):
            id (UUID): Function id UUID.
     """

    type_: MemoryScopeType1Type
    id: UUID





    def to_dict(self) -> dict[str, Any]:
        type_ = self.type_.value

        id = str(self.id)


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "type": type_,
            "id": id,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        type_ = MemoryScopeType1Type(d.pop("type"))




        id = UUID(d.pop("id"))




        memory_scope_type_1 = cls(
            type_=type_,
            id=id,
        )

        return memory_scope_type_1

