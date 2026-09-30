from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast






T = TypeVar("T", bound="ThreadMessageSenderMemberType0")



@_attrs_define
class ThreadMessageSenderMemberType0:
    """ Verified human authorship, projected only within the member organization. Historical attribution is not current
    sending or owner authority.

        Attributes:
            address (str):
            user_id (str):
            name (None | str):
     """

    address: str
    user_id: str
    name: None | str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        address = self.address

        user_id = self.user_id

        name: None | str
        name = self.name


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "address": address,
            "user_id": user_id,
            "name": name,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        address = d.pop("address")

        user_id = d.pop("user_id")

        def _parse_name(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        name = _parse_name(d.pop("name"))


        thread_message_sender_member_type_0 = cls(
            address=address,
            user_id=user_id,
            name=name,
        )


        thread_message_sender_member_type_0.additional_properties = d
        return thread_message_sender_member_type_0

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
