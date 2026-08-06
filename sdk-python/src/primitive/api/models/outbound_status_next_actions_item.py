from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="OutboundStatusNextActionsItem")



@_attrs_define
class OutboundStatusNextActionsItem:
    """ 
        Attributes:
            kind (str | Unset):
            message (str | Unset):
            command (str | Unset):
     """

    kind: str | Unset = UNSET
    message: str | Unset = UNSET
    command: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        kind = self.kind

        message = self.message

        command = self.command


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
        })
        if kind is not UNSET:
            field_dict["kind"] = kind
        if message is not UNSET:
            field_dict["message"] = message
        if command is not UNSET:
            field_dict["command"] = command

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        kind = d.pop("kind", UNSET)

        message = d.pop("message", UNSET)

        command = d.pop("command", UNSET)

        outbound_status_next_actions_item = cls(
            kind=kind,
            message=message,
            command=command,
        )


        outbound_status_next_actions_item.additional_properties = d
        return outbound_status_next_actions_item

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
