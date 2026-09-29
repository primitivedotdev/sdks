from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.presence_control_type_0_status import PresenceControlType0Status






T = TypeVar("T", bound="PresenceControlType0")



@_attrs_define
class PresenceControlType0:
    """
        Attributes:
            status (PresenceControlType0Status):
            valid_for_ms (int):
     """

    status: PresenceControlType0Status
    valid_for_ms: int





    def to_dict(self) -> dict[str, Any]:
        status = self.status.value

        valid_for_ms = self.valid_for_ms


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "status": status,
            "valid_for_ms": valid_for_ms,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        status = PresenceControlType0Status(d.pop("status"))




        valid_for_ms = d.pop("valid_for_ms")

        presence_control_type_0 = cls(
            status=status,
            valid_for_ms=valid_for_ms,
        )

        return presence_control_type_0
