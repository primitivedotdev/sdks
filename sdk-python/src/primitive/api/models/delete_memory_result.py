from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.memory_resolved_scope import MemoryResolvedScope





T = TypeVar("T", bound="DeleteMemoryResult")



@_attrs_define
class DeleteMemoryResult:
    """ 
        Attributes:
            deleted (bool):
            key (str):
            scope (MemoryResolvedScope): Resolved memory scope returned by the API.
     """

    deleted: bool
    key: str
    scope: MemoryResolvedScope
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.memory_resolved_scope import MemoryResolvedScope # noqa: PLC0415
        deleted = self.deleted

        key = self.key

        scope = self.scope.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "deleted": deleted,
            "key": key,
            "scope": scope,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.memory_resolved_scope import MemoryResolvedScope # noqa: PLC0415
        d = dict(src_dict)
        deleted = d.pop("deleted")

        key = d.pop("key")

        scope = MemoryResolvedScope.from_dict(d.pop("scope"))




        delete_memory_result = cls(
            deleted=deleted,
            key=key,
            scope=scope,
        )


        delete_memory_result.additional_properties = d
        return delete_memory_result

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
