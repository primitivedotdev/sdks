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
            expected_priority (int | Unset): The priority the caller read for this route. When given, the whole reorder is
                refused with 409 conflict (details.route_ids naming the routes) unless the route still has it, so two reorders
                planned from the same list cannot both land. An entry whose priority equals its expected_priority only checks
                and writes nothing.
     """

    id: UUID
    priority: int
    expected_priority: int | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        priority = self.priority

        expected_priority = self.expected_priority


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "priority": priority,
        })
        if expected_priority is not UNSET:
            field_dict["expected_priority"] = expected_priority

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        priority = d.pop("priority")

        expected_priority = d.pop("expected_priority", UNSET)

        reorder_routes_input_updates_item = cls(
            id=id,
            priority=priority,
            expected_priority=expected_priority,
        )

        return reorder_routes_input_updates_item

