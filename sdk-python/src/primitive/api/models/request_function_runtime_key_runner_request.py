from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="RequestFunctionRuntimeKeyRunnerRequest")



@_attrs_define
class RequestFunctionRuntimeKeyRunnerRequest:
    """ 
        Attributes:
            preset (str | Unset):
     """

    preset: str | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        preset = self.preset


        field_dict: dict[str, Any] = {}

        field_dict.update({
        })
        if preset is not UNSET:
            field_dict["preset"] = preset

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        preset = d.pop("preset", UNSET)

        request_function_runtime_key_runner_request = cls(
            preset=preset,
        )

        return request_function_runtime_key_runner_request

