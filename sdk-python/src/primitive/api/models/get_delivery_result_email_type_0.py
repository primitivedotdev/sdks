from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast






T = TypeVar("T", bound="GetDeliveryResultEmailType0")



@_attrs_define
class GetDeliveryResultEmailType0:
    """ 
        Attributes:
            sender (str):
            recipient (None | str):
            subject (None | str):
     """

    sender: str
    recipient: None | str
    subject: None | str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        sender = self.sender

        recipient: None | str
        recipient = self.recipient

        subject: None | str
        subject = self.subject


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "sender": sender,
            "recipient": recipient,
            "subject": subject,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        sender = d.pop("sender")

        def _parse_recipient(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        recipient = _parse_recipient(d.pop("recipient"))


        def _parse_subject(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        subject = _parse_subject(d.pop("subject"))


        get_delivery_result_email_type_0 = cls(
            sender=sender,
            recipient=recipient,
            subject=subject,
        )


        get_delivery_result_email_type_0.additional_properties = d
        return get_delivery_result_email_type_0

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
