from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="EmailDetailAutomationHeadersType0")



@_attrs_define
class EmailDetailAutomationHeadersType0:
    """ What the message declared about being automated, verbatim:
    `List-Unsubscribe` (RFC 2369/8058), `Precedence`, and
    `Auto-Submitted` (RFC 3834). Null or absent when the message
    declared none, and on messages received before these headers
    were captured, so a null value is not evidence that a person
    sent the message.

        Attributes:
            list_unsubscribe (str | Unset):
            precedence (str | Unset):
            auto_submitted (str | Unset):
     """

    list_unsubscribe: str | Unset = UNSET
    precedence: str | Unset = UNSET
    auto_submitted: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        list_unsubscribe = self.list_unsubscribe

        precedence = self.precedence

        auto_submitted = self.auto_submitted


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
        })
        if list_unsubscribe is not UNSET:
            field_dict["list_unsubscribe"] = list_unsubscribe
        if precedence is not UNSET:
            field_dict["precedence"] = precedence
        if auto_submitted is not UNSET:
            field_dict["auto_submitted"] = auto_submitted

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        list_unsubscribe = d.pop("list_unsubscribe", UNSET)

        precedence = d.pop("precedence", UNSET)

        auto_submitted = d.pop("auto_submitted", UNSET)

        email_detail_automation_headers_type_0 = cls(
            list_unsubscribe=list_unsubscribe,
            precedence=precedence,
            auto_submitted=auto_submitted,
        )


        email_detail_automation_headers_type_0.additional_properties = d
        return email_detail_automation_headers_type_0

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
