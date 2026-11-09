from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="StartBreakGlassRequest")



@_attrs_define
class StartBreakGlassRequest:
    """ 
        Attributes:
            reason (str):
            hours (int | Unset):  Default: 1.
     """

    reason: str
    hours: int | Unset = 1





    def to_dict(self) -> dict[str, Any]:
        reason = self.reason

        hours = self.hours


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "reason": reason,
        })
        if hours is not UNSET:
            field_dict["hours"] = hours

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        reason = d.pop("reason")

        hours = d.pop("hours", UNSET)

        start_break_glass_request = cls(
            reason=reason,
            hours=hours,
        )

        return start_break_glass_request

