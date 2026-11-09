from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.set_access_mode_request_mode import SetAccessModeRequestMode






T = TypeVar("T", bound="SetAccessModeRequest")



@_attrs_define
class SetAccessModeRequest:
    """ 
        Attributes:
            mode (SetAccessModeRequestMode):
     """

    mode: SetAccessModeRequestMode





    def to_dict(self) -> dict[str, Any]:
        mode = self.mode.value


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "mode": mode,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        mode = SetAccessModeRequestMode(d.pop("mode"))




        set_access_mode_request = cls(
            mode=mode,
        )

        return set_access_mode_request

