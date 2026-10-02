from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from uuid import UUID






T = TypeVar("T", bound="SentEmailSummaryRepeatType0")



@_attrs_define
class SentEmailSummaryRepeatType0:
    """ Set when Primitive sent this message as part of a repeating send. Resolved from Primitive's own records, never from
    the message content. Null on every other message and on servers that predate repeating sends.

        Attributes:
            repeat_id (UUID):
            sequence (int):
     """

    repeat_id: UUID
    sequence: int
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        repeat_id = str(self.repeat_id)

        sequence = self.sequence


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "repeat_id": repeat_id,
            "sequence": sequence,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        repeat_id = UUID(d.pop("repeat_id"))




        sequence = d.pop("sequence")

        sent_email_summary_repeat_type_0 = cls(
            repeat_id=repeat_id,
            sequence=sequence,
        )


        sent_email_summary_repeat_type_0.additional_properties = d
        return sent_email_summary_repeat_type_0

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
