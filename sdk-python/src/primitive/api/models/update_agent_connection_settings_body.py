from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast






T = TypeVar("T", bound="UpdateAgentConnectionSettingsBody")



@_attrs_define
class UpdateAgentConnectionSettingsBody:
    """
        Attributes:
            idle_hide_after_days (int | None):
     """

    idle_hide_after_days: int | None





    def to_dict(self) -> dict[str, Any]:
        idle_hide_after_days: int | None
        idle_hide_after_days = self.idle_hide_after_days


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "idle_hide_after_days": idle_hide_after_days,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        def _parse_idle_hide_after_days(data: object) -> int | None:
            if data is None:
                return data
            return cast(int | None, data)

        idle_hide_after_days = _parse_idle_hide_after_days(d.pop("idle_hide_after_days"))


        update_agent_connection_settings_body = cls(
            idle_hide_after_days=idle_hide_after_days,
        )

        return update_agent_connection_settings_body
