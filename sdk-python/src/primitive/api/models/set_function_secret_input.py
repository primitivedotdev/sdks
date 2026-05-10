from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="SetFunctionSecretInput")



@_attrs_define
class SetFunctionSecretInput:
    """ Body for PUT /functions/{id}/secrets/{key}. Key comes from the path.

        Attributes:
            value (str):
     """

    value: str





    def to_dict(self) -> dict[str, Any]:
        value = self.value


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "value": value,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        value = d.pop("value")

        set_function_secret_input = cls(
            value=value,
        )

        return set_function_secret_input

