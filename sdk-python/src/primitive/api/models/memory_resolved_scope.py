from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.memory_resolved_scope_type import MemoryResolvedScopeType
from uuid import UUID






T = TypeVar("T", bound="MemoryResolvedScope")



@_attrs_define
class MemoryResolvedScope:
    """ Resolved memory scope returned by the API.

        Attributes:
            type_ (MemoryResolvedScopeType):
            id (UUID): Org id for org scope, function id for function scope.
     """

    type_: MemoryResolvedScopeType
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
        type_ = MemoryResolvedScopeType(d.pop("type"))




        id = UUID(d.pop("id"))




        memory_resolved_scope = cls(
            type_=type_,
            id=id,
        )

        return memory_resolved_scope

