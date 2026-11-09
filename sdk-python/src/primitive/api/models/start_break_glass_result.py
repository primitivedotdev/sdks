from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="StartBreakGlassResult")



@_attrs_define
class StartBreakGlassResult:
    """ 
        Attributes:
            id (str):
            expires_at (str):
            owners_notified (float):
     """

    id: str
    expires_at: str
    owners_notified: float
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        id = self.id

        expires_at = self.expires_at

        owners_notified = self.owners_notified


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "expires_at": expires_at,
            "owners_notified": owners_notified,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = d.pop("id")

        expires_at = d.pop("expires_at")

        owners_notified = d.pop("owners_notified")

        start_break_glass_result = cls(
            id=id,
            expires_at=expires_at,
            owners_notified=owners_notified,
        )


        start_break_glass_result.additional_properties = d
        return start_break_glass_result

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
