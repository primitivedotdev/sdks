from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.reorder_routes_input_updates_item import ReorderRoutesInputUpdatesItem





T = TypeVar("T", bound="ReorderRoutesInput")



@_attrs_define
class ReorderRoutesInput:
    """ 
        Attributes:
            updates (list[ReorderRoutesInputUpdatesItem]):
     """

    updates: list[ReorderRoutesInputUpdatesItem]





    def to_dict(self) -> dict[str, Any]:
        from ..models.reorder_routes_input_updates_item import ReorderRoutesInputUpdatesItem
        updates = []
        for updates_item_data in self.updates:
            updates_item = updates_item_data.to_dict()
            updates.append(updates_item)




        field_dict: dict[str, Any] = {}

        field_dict.update({
            "updates": updates,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.reorder_routes_input_updates_item import ReorderRoutesInputUpdatesItem
        d = dict(src_dict)
        updates = []
        _updates = d.pop("updates")
        for updates_item_data in (_updates):
            updates_item = ReorderRoutesInputUpdatesItem.from_dict(updates_item_data)



            updates.append(updates_item)


        reorder_routes_input = cls(
            updates=updates,
        )

        return reorder_routes_input

