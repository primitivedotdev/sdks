from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.suspend_function_runtime_key_request_reason import SuspendFunctionRuntimeKeyRequestReason






T = TypeVar("T", bound="SuspendFunctionRuntimeKeyRequest")



@_attrs_define
class SuspendFunctionRuntimeKeyRequest:
    """ 
        Attributes:
            reason (SuspendFunctionRuntimeKeyRequestReason | Unset):
     """

    reason: SuspendFunctionRuntimeKeyRequestReason | Unset = UNSET





    def to_dict(self) -> dict[str, Any]:
        reason: str | Unset = UNSET
        if not isinstance(self.reason, Unset):
            reason = self.reason.value



        field_dict: dict[str, Any] = {}

        field_dict.update({
        })
        if reason is not UNSET:
            field_dict["reason"] = reason

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        _reason = d.pop("reason", UNSET)
        reason: SuspendFunctionRuntimeKeyRequestReason | Unset
        if isinstance(_reason,  Unset):
            reason = UNSET
        else:
            reason = SuspendFunctionRuntimeKeyRequestReason(_reason)




        suspend_function_runtime_key_request = cls(
            reason=reason,
        )

        return suspend_function_runtime_key_request

