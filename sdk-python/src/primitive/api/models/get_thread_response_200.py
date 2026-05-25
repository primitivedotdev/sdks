from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.thread import Thread





T = TypeVar("T", bound="GetThreadResponse200")



@_attrs_define
class GetThreadResponse200:
    """ 
        Attributes:
            success (bool):
            data (Thread | Unset): A conversation thread: its metadata plus the inbound and
                outbound messages that belong to it, interleaved oldest-first.
                Membership is the stored `thread_id` on each message. Bodies are
                omitted here to keep the thread view lightweight; fetch
                `/emails/{id}` or `/sent-emails/{id}` for a single message's
                full content.
     """

    success: bool
    data: Thread | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.thread import Thread
        success = self.success

        data: dict[str, Any] | Unset = UNSET
        if not isinstance(self.data, Unset):
            data = self.data.to_dict()


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "success": success,
        })
        if data is not UNSET:
            field_dict["data"] = data

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.thread import Thread
        d = dict(src_dict)
        success = d.pop("success")

        _data = d.pop("data", UNSET)
        data: Thread | Unset
        if isinstance(_data,  Unset):
            data = UNSET
        else:
            data = Thread.from_dict(_data)




        get_thread_response_200 = cls(
            success=success,
            data=data,
        )


        get_thread_response_200.additional_properties = d
        return get_thread_response_200

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
