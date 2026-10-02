from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="StopAgentMessageScheduleInput")



@_attrs_define
class StopAgentMessageScheduleInput:
    """ 
        Attributes:
            reason (str | Unset): Short reason shown to the schedule's owner.
     """

    reason: str | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        reason = self.reason


        field_dict: dict[str, Any] = {}

        field_dict.update({
        })
        if reason is not UNSET:
            field_dict["reason"] = reason

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        reason = d.pop("reason", UNSET)

        stop_agent_message_schedule_input = cls(
            reason=reason,
        )

        return stop_agent_message_schedule_input

