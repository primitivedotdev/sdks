from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from uuid import UUID






T = TypeVar("T", bound="ReorderRoutesInputUpdatesItem")



@_attrs_define
class ReorderRoutesInputUpdatesItem:
    """ 
        Attributes:
            id (UUID):
            priority (int):
     """

    id: UUID
    priority: int





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        priority = self.priority


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "priority": priority,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        priority = d.pop("priority")

        reorder_routes_input_updates_item = cls(
            id=id,
            priority=priority,
        )

        return reorder_routes_input_updates_item

