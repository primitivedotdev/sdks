from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
import datetime






T = TypeVar("T", bound="ListDefaultNetworkMembersResponse200DataItemPresenceType0")



@_attrs_define
class ListDefaultNetworkMembersResponse200DataItemPresenceType0:
    """
        Attributes:
            last_checked_at (datetime.datetime):
            expires_at (datetime.datetime):
            valid_for_ms (int):
     """

    last_checked_at: datetime.datetime
    expires_at: datetime.datetime
    valid_for_ms: int
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        last_checked_at = self.last_checked_at.isoformat()

        expires_at = self.expires_at.isoformat()

        valid_for_ms = self.valid_for_ms


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "last_checked_at": last_checked_at,
            "expires_at": expires_at,
            "valid_for_ms": valid_for_ms,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        last_checked_at = datetime.datetime.fromisoformat(d.pop("last_checked_at"))




        expires_at = datetime.datetime.fromisoformat(d.pop("expires_at"))




        valid_for_ms = d.pop("valid_for_ms")

        list_default_network_members_response_200_data_item_presence_type_0 = cls(
            last_checked_at=last_checked_at,
            expires_at=expires_at,
            valid_for_ms=valid_for_ms,
        )


        list_default_network_members_response_200_data_item_presence_type_0.additional_properties = d
        return list_default_network_members_response_200_data_item_presence_type_0

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
