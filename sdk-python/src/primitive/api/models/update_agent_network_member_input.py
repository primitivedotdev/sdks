from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="UpdateAgentNetworkMemberInput")



@_attrs_define
class UpdateAgentNetworkMemberInput:
    """ Set one or both independent discovery permissions.

        Attributes:
            can_view (bool | Unset):
            is_listed (bool | Unset):
     """

    can_view: bool | Unset = UNSET
    is_listed: bool | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        can_view = self.can_view

        is_listed = self.is_listed


        field_dict: dict[str, Any] = {}

        field_dict.update({
        })
        if can_view is not UNSET:
            field_dict["can_view"] = can_view
        if is_listed is not UNSET:
            field_dict["is_listed"] = is_listed

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        can_view = d.pop("can_view", UNSET)

        is_listed = d.pop("is_listed", UNSET)

        update_agent_network_member_input = cls(
            can_view=can_view,
            is_listed=is_listed,
        )

        return update_agent_network_member_input

