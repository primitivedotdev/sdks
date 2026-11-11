from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
import datetime






T = TypeVar("T", bound="EndpointDeliveryType0HeldForOwnerType0")



@_attrs_define
class EndpointDeliveryType0HeldForOwnerType0:
    """ Rule-granted mail held for this webhook while its owner cannot act; null when none is. Only for a caller with access
    to every mailbox (held mail can be an earlier owner's), and absent when it could not be read just now.

        Attributes:
            count (int): Rule-granted emails waiting for this webhook because its owner could not act at their last check.
            oldest_queued_at (datetime.datetime): When the oldest of them was queued.
            expires_at (datetime.datetime): When the oldest is given up on if its owner still cannot act. Each is checked
                again periodically, so the count can trail a change of the owner's state.
     """

    count: int
    oldest_queued_at: datetime.datetime
    expires_at: datetime.datetime
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        count = self.count

        oldest_queued_at = self.oldest_queued_at.isoformat()

        expires_at = self.expires_at.isoformat()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "count": count,
            "oldest_queued_at": oldest_queued_at,
            "expires_at": expires_at,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        count = d.pop("count")

        oldest_queued_at = datetime.datetime.fromisoformat(d.pop("oldest_queued_at"))




        expires_at = datetime.datetime.fromisoformat(d.pop("expires_at"))




        endpoint_delivery_type_0_held_for_owner_type_0 = cls(
            count=count,
            oldest_queued_at=oldest_queued_at,
            expires_at=expires_at,
        )


        endpoint_delivery_type_0_held_for_owner_type_0.additional_properties = d
        return endpoint_delivery_type_0_held_for_owner_type_0

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
