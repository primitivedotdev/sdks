from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="PollCliLoginInput")



@_attrs_define
class PollCliLoginInput:
    """ 
        Attributes:
            device_code (str):
     """

    device_code: str





    def to_dict(self) -> dict[str, Any]:
        device_code = self.device_code


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "device_code": device_code,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        device_code = d.pop("device_code")

        poll_cli_login_input = cls(
            device_code=device_code,
        )

        return poll_cli_login_input

