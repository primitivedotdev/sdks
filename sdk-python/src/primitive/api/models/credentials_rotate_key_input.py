from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="CredentialsRotateKeyInput")



@_attrs_define
class CredentialsRotateKeyInput:
    """ 
        Attributes:
            overlap_seconds (int | Unset): How long the old key keeps working, in seconds, up to 604800 (7 days), and never
                past its own expires_at. 86400 (24 hours) when omitted. 0 stops the old key at once: use it when rotating
                because the secret leaked.
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

        credentials_rotate_key_input = cls(
            overlap_seconds=overlap_seconds,
        )

        return credentials_rotate_key_input

