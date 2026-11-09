from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast






T = TypeVar("T", bound="CredentialsGetKeySuggestionResultUsageMailboxesType0")



@_attrs_define
class CredentialsGetKeySuggestionResultUsageMailboxesType0:
    """ 
        Attributes:
            read (float | None):
            sent_from (float | None):
            complete (bool):
            unavailable_message (None | str):
     """

    read: float | None
    sent_from: float | None
    complete: bool
    unavailable_message: None | str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        read: float | None
        read = self.read

        sent_from: float | None
        sent_from = self.sent_from

        complete = self.complete

        unavailable_message: None | str
        unavailable_message = self.unavailable_message


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "read": read,
            "sent_from": sent_from,
            "complete": complete,
            "unavailable_message": unavailable_message,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        def _parse_read(data: object) -> float | None:
            if data is None:
                return data
            return cast(float | None, data)

        read = _parse_read(d.pop("read"))


        def _parse_sent_from(data: object) -> float | None:
            if data is None:
                return data
            return cast(float | None, data)

        sent_from = _parse_sent_from(d.pop("sent_from"))


        complete = d.pop("complete")

        def _parse_unavailable_message(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        unavailable_message = _parse_unavailable_message(d.pop("unavailable_message"))


        credentials_get_key_suggestion_result_usage_mailboxes_type_0 = cls(
            read=read,
            sent_from=sent_from,
            complete=complete,
            unavailable_message=unavailable_message,
        )


        credentials_get_key_suggestion_result_usage_mailboxes_type_0.additional_properties = d
        return credentials_get_key_suggestion_result_usage_mailboxes_type_0

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
