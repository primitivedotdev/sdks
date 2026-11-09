from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.memory_scope_type import MemoryScopeType
from uuid import UUID






T = TypeVar("T", bound="MemoryScope")



@_attrs_define
class MemoryScope:
    """ Memory scope. `org` resolves to the authenticated organization. `function` requires the function id UUID in `id`;
    function names are not valid scope identifiers. Function-authenticated requests cannot override their own Function
    scope. A Function scope is available only to that Function's own credential, to an org-wide API key that can manage
    the Function, or to a person that can manage the Function; other credentials get `403 forbidden`.

        Attributes:
            type_ (MemoryScopeType):
            id (UUID | Unset): Function id UUID.
     """

    type_: MemoryScopeType
    id: UUID | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        type_ = self.type_.value

        id: str | Unset = UNSET
        if not isinstance(self.id, Unset):
            id = str(self.id)


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "type": type_,
        })
        if id is not UNSET:
            field_dict["id"] = id

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        type_ = MemoryScopeType(d.pop("type"))




        _id = d.pop("id", UNSET)
        id: UUID | Unset
        if isinstance(_id,  Unset):
            id = UNSET
        else:
            id = UUID(_id)




        memory_scope = cls(
            type_=type_,
            id=id,
        )


        memory_scope.additional_properties = d
        return memory_scope

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
