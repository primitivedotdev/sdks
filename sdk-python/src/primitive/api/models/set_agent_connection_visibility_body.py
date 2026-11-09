from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="SetAgentConnectionVisibilityBody")



@_attrs_define
class SetAgentConnectionVisibilityBody:
    """
        Attributes:
            hidden (bool | Unset):
            keep_visible (bool | Unset):
     """

    hidden: bool | Unset = UNSET
    keep_visible: bool | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        hidden = self.hidden

        keep_visible = self.keep_visible


        field_dict: dict[str, Any] = {}

        field_dict.update({
        })
        if hidden is not UNSET:
            field_dict["hidden"] = hidden
        if keep_visible is not UNSET:
            field_dict["keep_visible"] = keep_visible

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        hidden = d.pop("hidden", UNSET)

        keep_visible = d.pop("keep_visible", UNSET)

        set_agent_connection_visibility_body = cls(
            hidden=hidden,
            keep_visible=keep_visible,
        )

        return set_agent_connection_visibility_body
