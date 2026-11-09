from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID
import datetime






T = TypeVar("T", bound="ThreadMute")



@_attrs_define
class ThreadMute:
    """ 
        Attributes:
            thread_id (UUID):
            address (str): The receiving address the mute applies to, lowercased.
            muted (bool):
            muted_at (datetime.datetime | None):
     """

    thread_id: UUID
    address: str
    muted: bool
    muted_at: datetime.datetime | None
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        thread_id = str(self.thread_id)

        address = self.address

        muted = self.muted

        muted_at: None | str
        if isinstance(self.muted_at, datetime.datetime):
            muted_at = self.muted_at.isoformat()
        else:
            muted_at = self.muted_at


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "thread_id": thread_id,
            "address": address,
            "muted": muted,
            "muted_at": muted_at,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        thread_id = UUID(d.pop("thread_id"))




        address = d.pop("address")

        muted = d.pop("muted")

        def _parse_muted_at(data: object) -> datetime.datetime | None:
            if data is None:
                return data
            try:
                if not isinstance(data, str):
                    raise TypeError()
                muted_at_type_0 = datetime.datetime.fromisoformat(data)



                return muted_at_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(datetime.datetime | None, data)

        muted_at = _parse_muted_at(d.pop("muted_at"))


        thread_mute = cls(
            thread_id=thread_id,
            address=address,
            muted=muted,
            muted_at=muted_at,
        )


        thread_mute.additional_properties = d
        return thread_mute

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
