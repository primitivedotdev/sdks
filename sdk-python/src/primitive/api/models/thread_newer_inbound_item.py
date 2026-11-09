from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID
import datetime






T = TypeVar("T", bound="ThreadNewerInboundItem")



@_attrs_define
class ThreadNewerInboundItem:
    """ 
        Attributes:
            id (UUID):
            from_ (str): Bare address from the From header, or the envelope sender when the header has none.
            received_at (datetime.datetime):
     """

    id: UUID
    from_: str
    received_at: datetime.datetime
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        id = str(self.id)

        from_ = self.from_

        received_at = self.received_at.isoformat()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "id": id,
            "from": from_,
            "received_at": received_at,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        from_ = d.pop("from")

        received_at = datetime.datetime.fromisoformat(d.pop("received_at"))




        thread_newer_inbound_item = cls(
            id=id,
            from_=from_,
            received_at=received_at,
        )


        thread_newer_inbound_item.additional_properties = d
        return thread_newer_inbound_item

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
