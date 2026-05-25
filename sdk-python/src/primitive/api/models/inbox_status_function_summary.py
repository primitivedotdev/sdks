from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="InboxStatusFunctionSummary")



@_attrs_define
class InboxStatusFunctionSummary:
    """ 
        Attributes:
            total (int):
            deployed (int):
            pending (int):
            failed (int):
     """

    total: int
    deployed: int
    pending: int
    failed: int





    def to_dict(self) -> dict[str, Any]:
        total = self.total

        deployed = self.deployed

        pending = self.pending

        failed = self.failed


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "total": total,
            "deployed": deployed,
            "pending": pending,
            "failed": failed,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        total = d.pop("total")

        deployed = d.pop("deployed")

        pending = d.pop("pending")

        failed = d.pop("failed")

        inbox_status_function_summary = cls(
            total=total,
            deployed=deployed,
            pending=pending,
            failed=failed,
        )

        return inbox_status_function_summary

