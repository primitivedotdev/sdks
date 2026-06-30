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





    def to_dict(self) -> dict[str, Any]:
        from ..models.memory_resolved_scope import MemoryResolvedScope
        deleted = self.deleted

        key = self.key

        scope = self.scope.to_dict()


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "deleted": deleted,
            "key": key,
            "scope": scope,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.memory_resolved_scope import MemoryResolvedScope
        d = dict(src_dict)
        deleted = d.pop("deleted")

        key = d.pop("key")

        scope = MemoryResolvedScope.from_dict(d.pop("scope"))




        delete_memory_result = cls(
            deleted=deleted,
            key=key,
            scope=scope,
        )

        return delete_memory_result

