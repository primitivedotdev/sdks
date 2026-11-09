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
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        type_ = self.type_.value

        id = str(self.id)


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
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


        memory_resolved_scope.additional_properties = d
        return memory_resolved_scope

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> Any:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
