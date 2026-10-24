from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="RotateKeyInput")



@_attrs_define
class RotateKeyInput:
    """ 
        Attributes:
            overlap_seconds (int | Unset): Seconds the old key keeps working. Default 86400; 0 revokes it at once.
     """

    overlap_seconds: int | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        overlap_seconds = self.overlap_seconds


        field_dict: dict[str, Any] = {}

        field_dict.update({
        })
        if overlap_seconds is not UNSET:
            field_dict["overlap_seconds"] = overlap_seconds

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        overlap_seconds = d.pop("overlap_seconds", UNSET)

        rotate_key_input = cls(
            overlap_seconds=overlap_seconds,
        )

        return rotate_key_input

