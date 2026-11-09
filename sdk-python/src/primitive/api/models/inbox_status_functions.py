from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="InboxStatusFunctions")



@_attrs_define
class InboxStatusFunctions:
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
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        total = self.total

        deployed = self.deployed

        pending = self.pending

        failed = self.failed


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
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

        inbox_status_functions = cls(
            total=total,
            deployed=deployed,
            pending=pending,
            failed=failed,
        )


        inbox_status_functions.additional_properties = d
        return inbox_status_functions

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
