from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.presence_control_status import PresenceControlStatus






T = TypeVar("T", bound="PresenceControl")



@_attrs_define
class PresenceControl:
    """
        Attributes:
            status (PresenceControlStatus):
            valid_for_ms (int):
     """

    status: PresenceControlStatus
    valid_for_ms: int
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        status = self.status.value

        valid_for_ms = self.valid_for_ms


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "status": status,
            "valid_for_ms": valid_for_ms,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        status = PresenceControlStatus(d.pop("status"))




        valid_for_ms = d.pop("valid_for_ms")

        presence_control = cls(
            status=status,
            valid_for_ms=valid_for_ms,
        )


        presence_control.additional_properties = d
        return presence_control

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> Any:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
